/**
 * 樂樂山點餐系統 — Firebase Functions
 * 功能：
 *   1. 建單後發送「已收到訂單」LINE 推播
 *   2. 狀態切換到 ready 時發送「可取餐」LINE 推播
 *   3. 狀態切換到 cancelled 時發送「訂單取消」LINE 推播
 *   4. 所有推播結果記錄到 notifications / order_events
 *
 * 設定 LINE token：
 *   LINE_CHANNEL_ACCESS_TOKEN=<set-in-shell>
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const https     = require("https");
const crypto    = require("crypto");

admin.initializeApp();

// ── 集中式部署設定（US→Asia 遷移時只改這一區）──────────────────
// REGION:       所有 onCall / onRequest / Firestore trigger 的部署區域。
// LIFF_ID:      LIFF 與 Firebase 專案無關，搬到 Asia 可沿用原 ID。
// SITE_URL:     用於產生 line-bind 等 callback 連結；新 Hosting 啟用後同步改。
// LINE_SECRETS: Gen 1 Secret Manager binding。部署前必須跑：
//   firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN --project <alias>
//   firebase functions:secrets:set LINE_CHANNEL_SECRET       --project <alias>
// SECRET 尚未設定時可暫時只放 ACCESS_TOKEN — webhook 會回 500
// "Channel secret not configured"，但 NEW webhook 未被 LINE 指向、無實害。
const REGION       = "us-central1";
const LIFF_ID      = "2008047700-HIAn2llR";
const SITE_URL     = "https://leleshan-order.web.app";
const LINE_SECRETS = ["LINE_CHANNEL_ACCESS_TOKEN"];

// ── 1. onCreate：建單後推播「已收到訂單」────────────────────────

exports.sendOrderReceivedPush = functions
  .runWith({ secrets: LINE_SECRETS })
  .region(REGION)
  .firestore.document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order   = snap.data();
    const orderId = context.params.orderId;

    const lineUserId = order.lineUserId;
    // Entry log — always visible, shows full chain status at a glance
    console.log("[Push/onCreate] Order received by function.", {
      orderId,
      source:  order.source || "(none)",
      status:  order.status || "(none)",
      storeId: order.storeId || "(none)",
      hasLineUserId: !!lineUserId,
      lineUid: lineUserId ? (lineUserId.slice(0, 4) + "…" + lineUserId.slice(-4)) : null
    });

    if (!lineUserId || typeof lineUserId !== "string" || !lineUserId.trim()) {
      console.log("[Push/onCreate] No lineUserId on order — skip customer push. (This is normal for POS/walk-in orders.)", { orderId, source: order.source });
      return null;
    }

    const lineToken = getLineToken();
    if (!lineToken) {
      console.error("[Push/onCreate] ❌ LINE_CHANNEL_ACCESS_TOKEN 未設定。請在 functions/.env 加入 LINE_CHANNEL_ACCESS_TOKEN=<token> 後重新 deploy。Push 跳過。", { orderId });
      return null;
    }

    // Idempotent claim: atomic check-and-set via transaction. Prevents double-push
    // from concurrent retries or dual-region subscribers during migration window.
    const claimResult = await claimPushOnOrder(snap.ref, "receivedPushSent");
    if (!claimResult.claimed) {
      console.log("[Push/onCreate] idempotent skip.", { orderId, reason: claimResult.reason });
      return null;
    }

    const text = buildReceivedMessage(order, orderId);
    await handlePush({
      db: admin.firestore(),
      ref: snap.ref,
      orderId,
      storeId: order.storeId || "",
      lineUserId,
      lineToken,
      text,
      notifType: "received",
      sentField: "receivedPushSent",
      fromStatus: null,
      toStatus: order.status || "new",
      eventType: "order_created"
    });
    return null;
  });

// ── 2. onUpdate：狀態變更推播（ready / cancelled）───────────────

exports.sendOrderStatusPush = functions
  .runWith({ secrets: LINE_SECRETS })
  .region(REGION)
  .firestore.document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before  = change.before.data();
    const after   = change.after.data();
    const orderId = context.params.orderId;

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus  = normalizeStatus(after.status);

    // 狀態沒改變，略過
    if (beforeStatus === afterStatus) return null;

    const lineUserId = after.lineUserId;
    if (!lineUserId || typeof lineUserId !== "string" || !lineUserId.trim()) {
      return null;
    }

    const lineToken = getLineToken();
    if (!lineToken) {
      console.warn("[Notify/onUpdate] No LINE token.", { orderId, afterStatus });
      return null;
    }

    const db      = admin.firestore();
    const storeId = after.storeId || "";

    if (afterStatus === "ready") {
      const claimReady = await claimPushOnOrder(change.after.ref, "readyPushSent");
      if (!claimReady.claimed) {
        console.log("[Notify/onUpdate] ready idempotent skip.", { orderId, reason: claimReady.reason });
        return null;
      }
      const text = buildReadyMessage(after, orderId);
      await handlePush({
        db, ref: change.after.ref, orderId, storeId, lineUserId, lineToken, text,
        notifType: "ready", sentField: "readyPushSent",
        fromStatus: beforeStatus, toStatus: afterStatus,
        eventType: "notification_sent"
      });
    }

    if (afterStatus === "cancelled") {
      const claimCancelled = await claimPushOnOrder(change.after.ref, "cancelledPushSent");
      if (!claimCancelled.claimed) {
        console.log("[Notify/onUpdate] cancelled idempotent skip.", { orderId, reason: claimCancelled.reason });
        return null;
      }
      const text = buildCancelledMessage(after, orderId);
      await handlePush({
        db, ref: change.after.ref, orderId, storeId, lineUserId, lineToken, text,
        notifType: "cancelled", sentField: "cancelledPushSent",
        fromStatus: beforeStatus, toStatus: afterStatus,
        eventType: "notification_sent"
      });
    }

    return null;
  });

// ── 推播 idempotent claim ─────────────────────────────────────
// Atomically check-and-set notificationStatus.{flagField} on the order doc.
// Returns { claimed: true } if THIS invocation should proceed with the push;
// { claimed: false, reason } if another invocation / retry already claimed.
//
// Why this exists:
//   Prior code did a non-atomic `if (status.sent===true) skip; ... send; mark true`.
//   Concurrent Cloud Functions retries (at-least-once delivery) or dual-region
//   subscribers could both pass the check and double-push.
//
// Failure / release contract:
//   - handlePush() success path also sets the flag (redundant write, harmless).
//   - handlePush() error path sets the flag back to false → next retry re-claims
//     and re-attempts. See the batch.update in the catch block below.
async function claimPushOnOrder(orderRef, flagField) {
  const db = admin.firestore();
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) return { claimed: false, reason: "order_not_found" };
      const data = snap.data() || {};
      const status = data.notificationStatus || {};
      if (status[flagField] === true) return { claimed: false, reason: "already_sent" };
      const ts = admin.firestore.FieldValue.serverTimestamp();
      tx.update(orderRef, {
        [`notificationStatus.${flagField}`]: true,
        [`notificationStatus.${flagField}At`]: ts,
        [`notificationStatus.${flagField}ClaimedRegion`]: REGION,
        updatedAt: ts
      });
      return { claimed: true };
    });
  } catch (e) {
    console.error("[claimPushOnOrder] tx failed — skipping push to avoid unknown state.", {
      flagField, error: e && e.message
    });
    return { claimed: false, reason: "tx_error" };
  }
}

// ── 推播執行 + 記錄 ─────────────────────────────────────────────

async function handlePush(opts) {
  const { db, ref, orderId, storeId, lineUserId, lineToken, text,
          notifType, sentField, fromStatus, toStatus, eventType } = opts;

  const maskedUid = lineUserId ? (lineUserId.slice(0, 4) + "…" + lineUserId.slice(-4)) : "(empty)";
  console.log("[Notify/handlePush] Sending push.", {
    orderId, notifType, to: maskedUid, msgLen: text.length
  });

  const body = JSON.stringify({
    to: lineUserId,
    messages: [{ type: "text", text }]
  });

  const ts         = admin.firestore.FieldValue.serverTimestamp();
  const notifRef   = db.collection("notifications").doc();
  const eventRef   = db.collection("order_events").doc();

  try {
    await sendLinePush(lineToken, body);
    console.log("[Notify/handlePush] LINE API OK.", { orderId, notifType, to: maskedUid });

    const batch = db.batch();
    batch.update(ref, {
      [`notificationStatus.${sentField}`]: true,
      [`notificationStatus.${sentField}At`]: ts,
      updatedAt: ts
    });
    batch.set(notifRef, {
      orderId, storeId, lineUserId,
      type: notifType,
      status: "sent",
      message: text.slice(0, 300),
      sentAt: ts,
      error: null,
      createdAt: ts
    });
    batch.set(eventRef, {
      orderId, storeId,
      type: eventType,
      actorType: "system",
      actorId: "functions",
      actorName: "Functions",
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      message: `${notifType} push sent to ${lineUserId}`,
      createdAt: ts
    });
    await batch.commit();
    console.log("[Notify] Push sent.", { orderId, notifType, lineUserId });
  } catch (error) {
    const errMsg = (error && (error.message || String(error))) || "未知錯誤";
    console.error("[Notify] Push failed.", { orderId, notifType, error: errMsg });

    const batch = db.batch();
    batch.update(ref, {
      [`notificationStatus.${sentField}`]: false,
      [`notificationStatus.${sentField}Error`]: errMsg,
      updatedAt: ts
    }).catch(() => {});
    batch.set(notifRef, {
      orderId, storeId, lineUserId,
      type: notifType,
      status: "failed",
      message: text.slice(0, 300),
      sentAt: null,
      error: errMsg,
      createdAt: ts
    });
    batch.set(eventRef, {
      orderId, storeId,
      type: "notification_failed",
      actorType: "system",
      actorId: "functions",
      actorName: "Functions",
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      message: `${notifType} push failed: ${errMsg}`,
      createdAt: ts
    });
    await batch.commit().catch((e) => {
      console.error("[Notify] Failed to write error records.", e);
    });
  }
}

// ── 訊息組字 ─────────────────────────────────────────────────────

function buildReceivedMessage(order, orderId) {
  const lines = [];
  lines.push("✅ 已收到您的訂單！");
  lines.push("");

  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));

  const pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ");
  if (pickup) lines.push("預計取餐：" + pickup);

  lines.push("");
  lines.push("【訂單明細】");
  const items = Array.isArray(order.items) ? order.items : [];
  items.forEach(function (item) {
    const name = safeStr(item.name) || "品項";
    const qty  = Math.max(0, Number(item.qty || item.quantity || 0));
    const sub  = Math.max(0, Number(item.subtotal || 0));
    lines.push(name + " × " + qty + "\u3000$" + sub);
    const subParts = [];
    const flavor = safeStr(item.flavor || item.flavorName);
    if (flavor) subParts.push(flavor);
    const opts = Array.isArray(item.options) ? item.options : [];
    opts.forEach(function (opt) {
      if (!opt || typeof opt !== "object") return;
      const val = safeStr(opt.value);
      if (!val) return;
      const label = safeStr(opt.name);
      subParts.push(label ? label + "：" + val : val);
    });
    const note = safeStr(item.item_note || item.itemNote || item.note);
    if (note) subParts.push("備註：" + note);
    if (subParts.length) lines.push("　" + subParts.join("／"));
  });

  lines.push("");
  const subtotal = safeNum(order.subtotal || order.totalAmount);
  const total    = safeNum(order.total    || order.totalAmount || subtotal);
  if (subtotal > 0 && subtotal !== total) lines.push("小計：$" + subtotal);
  lines.push("合計：$" + total);
  lines.push("");
  lines.push("餐點完成後將再通知您，謝謝 🙏");

  const text = lines.join("\n");
  if (text.length > 4800) return text.slice(0, 4750) + "\n…\n合計：$" + total + "\n\n餐點完成後將再通知您，謝謝 🙏";
  return text;
}

function buildReadyMessage(order, orderId) {
  const lines = [];
  lines.push("🟢 您的餐點已完成，可以取餐囉！");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));
  const total = safeNum(order.total || order.totalAmount);
  if (total) lines.push("合計：$" + total);
  lines.push("");
  lines.push("請到櫃台取餐，謝謝 🙏");
  return lines.join("\n");
}

function buildCancelledMessage(order, orderId) {
  const lines = [];
  lines.push("❌ 您的訂單已取消");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));
  const cancelReasonLabels = { busy: "爆單/忙碌中", out_of_stock: "食材售完", closing: "即將打烊", abnormal_order: "訂單異常" };
  const reasonCode = safeStr(order.cancel_reason);
  const customText = safeStr(order.cancel_reason_text);
  if (reasonCode === "custom" && customText) {
    lines.push("取消原因：" + customText);
  } else if (reasonCode) {
    lines.push("取消原因：" + (cancelReasonLabels[reasonCode] || reasonCode));
  }
  lines.push("");
  lines.push("如有疑問，請聯絡門市人員。");
  return lines.join("\n");
}

function buildPendingConfirmationMessage(order, orderId) {
  const lines = [];
  lines.push("📋 已收到您的訂單，等待店家確認中");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));
  const pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ");
  if (pickup) lines.push("預計取餐：" + pickup);
  lines.push("");
  lines.push("【訂單明細】");
  const items = Array.isArray(order.items) ? order.items : [];
  items.slice(0, 6).forEach(function (item) {
    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
    lines.push((safeStr(item.name) || "品項") + " × " + qty);
  });
  if (items.length > 6) lines.push("…（共 " + items.length + " 項）");
  lines.push("");
  const total = safeNum(order.total || order.totalAmount);
  if (total) lines.push("合計：$" + total);
  lines.push("");
  lines.push("⏰ 店家將在 15 分鐘內確認，確認後將再通知您");
  lines.push("若超時未確認，訂單將自動取消，謝謝您的耐心等候 🙏");
  return lines.join("\n");
}

function buildConfirmedMessage(order, orderId) {
  const lines = [];
  lines.push("✅ 店家已確認接單，開始為您準備！");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));
  const pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ");
  if (pickup) lines.push("預計取餐：" + pickup);
  const total = safeNum(order.total || order.totalAmount);
  if (total) lines.push("合計：$" + total);
  lines.push("");
  lines.push("餐點完成後將再通知您，謝謝 🙏");
  return lines.join("\n");
}

function buildAutoExpiredMessage(order, orderId) {
  const lines = [];
  lines.push("⏰ 訂單超時未確認，已自動取消");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) lines.push("取餐人：" + safeStr(order.customer_name));
  lines.push("");
  lines.push("很抱歉造成不便，歡迎重新下單或聯絡門市。");
  return lines.join("\n");
}

function buildAdminNewOrderMessage(order, orderId) {
  const lines = [];
  lines.push("🔔 新 LINE 訂單，請盡快確認！");
  lines.push("");
  if (order.pickupNumber) lines.push("取餐號碼：" + order.pickupNumber);
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) lines.push("顧客：" + safeStr(order.customer_name));
  const pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ");
  if (pickup) lines.push("取餐時間：" + pickup);
  lines.push("");
  lines.push("【訂單明細】");
  const items = Array.isArray(order.items) ? order.items : [];
  items.slice(0, 8).forEach(function (item) {
    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
    const sub = Math.max(0, Number(item.subtotal || 0));
    lines.push((safeStr(item.name) || "品項") + " × " + qty + (sub ? "\u3000$" + sub : ""));
  });
  if (items.length > 8) lines.push("…（共 " + items.length + " 項）");
  lines.push("");
  const total = safeNum(order.total || order.totalAmount);
  if (total) lines.push("合計：$" + total);
  lines.push("");
  lines.push("請確認訂單並開始備餐，謝謝！");
  return lines.join("\n");
}

// ── 員工新單 Flex Message（資訊卡 + 取消按鈕）─────────────────
function buildAdminNewOrderFlex(order, orderId) {
  const shortId = safeShortId(orderId);
  const customer = safeStr(order.customer_name) || "—";
  const pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ") || "立即取餐";
  const total = safeNum(order.total || order.totalAmount);
  const items = Array.isArray(order.items) ? order.items : [];
  const source = safeStr(order.source) || "liff";

  // 組品項行（最多 8 行，超過顯示「…還有 N 項」）
  const itemBoxes = items.slice(0, 8).map(function (item) {
    const name = safeStr(item.name) || "品項";
    const qty = Math.max(0, Number(item.qty || item.quantity || 0));
    const flavor = safeStr(item.flavor || item.flavorName);
    const note = safeStr(item.item_note || item.itemNote || item.note);
    const detailParts = [];
    if (flavor) detailParts.push(flavor);
    if (note) detailParts.push("備註:" + note);
    const main = name + " × " + qty;
    const contents = [
      { type: "text", text: main, size: "sm", color: "#1F2937", weight: "bold", wrap: true, flex: 5 }
    ];
    const sub = Math.max(0, Number(item.subtotal || 0));
    if (sub) contents.push({ type: "text", text: "$" + sub, size: "sm", color: "#6B7280", align: "end", flex: 2 });
    const out = [{ type: "box", layout: "baseline", contents: contents }];
    if (detailParts.length) {
      out.push({ type: "text", text: detailParts.join("／"), size: "xs", color: "#78624C", wrap: true, margin: "xs" });
    }
    return { type: "box", layout: "vertical", contents: out, margin: "sm" };
  });
  if (items.length > 8) {
    itemBoxes.push({ type: "text", text: "…還有 " + (items.length - 8) + " 項", size: "xs", color: "#9CA3AF", margin: "sm" });
  }

  const headerColor = source === "liff" || source === "line" ? "#06C755" : "#3B82F6";

  const bubble = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerColor,
      paddingAll: "14px",
      contents: [
        { type: "text", text: "🔔 新訂單（營業時段外）", color: "#FFFFFF", size: "md", weight: "bold" },
        { type: "text", text: "取餐號 " + (safeStr(order.pickupNumber) || shortId), color: "#FFFFFF", size: "xl", weight: "bold", margin: "sm" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "顧客", size: "xs", color: "#9CA3AF", flex: 2 },
          { type: "text", text: customer, size: "sm", color: "#1F2937", weight: "bold", flex: 5, wrap: true }
        ]},
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "取餐", size: "xs", color: "#9CA3AF", flex: 2 },
          { type: "text", text: pickup, size: "sm", color: "#1F2937", flex: 5, wrap: true }
        ]},
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "編號", size: "xs", color: "#9CA3AF", flex: 2 },
          { type: "text", text: shortId, size: "sm", color: "#1F2937", flex: 5 }
        ]},
        { type: "separator", margin: "md" },
        { type: "text", text: "訂單明細", size: "sm", color: "#5A3A27", weight: "bold", margin: "md" },
        { type: "box", layout: "vertical", spacing: "none", contents: itemBoxes },
        { type: "separator", margin: "md" },
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "合計", size: "sm", color: "#5A3A27", weight: "bold", flex: 2 },
          { type: "text", text: "$" + total, size: "md", color: "#DC2626", weight: "bold", align: "end", flex: 5 }
        ]}
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "sm",
          action: {
            type: "postback",
            label: "取消此訂單",
            data: "action=cancelPick&orderId=" + encodeURIComponent(orderId),
            displayText: "取消訂單 " + shortId
          }
        },
        {
          type: "text",
          text: "訂單已自動接受；如需取消請點上方按鈕",
          size: "xxs",
          color: "#9CA3AF",
          align: "center",
          wrap: true
        }
      ]
    }
  };

  return {
    altText: "新訂單：" + (safeStr(order.pickupNumber) || shortId) + "｜" + customer + "｜$" + total,
    messages: [{ type: "flex", altText: "新訂單 " + shortId, contents: bubble }]
  };
}

function buildCancelReasonQuickReply(orderId) {
  const shortId = safeShortId(orderId);
  const keys = ["busy", "out_of_stock", "closing", "abnormal_order"];
  const items = keys.map(function (k) {
    return {
      type: "action",
      action: {
        type: "postback",
        label: CANCEL_REASON_LABELS[k],
        data: "action=cancelExec&orderId=" + encodeURIComponent(orderId) + "&reason=" + k,
        displayText: "取消原因：" + CANCEL_REASON_LABELS[k]
      }
    };
  });
  // 第 5 個：自訂文字原因（會進入文字輸入模式，5 分鐘內下一句文字會被當成原因發給顧客）
  items.push({
    type: "action",
    action: {
      type: "postback",
      label: "其他原因（輸入文字）",
      data: "action=cancelAskText&orderId=" + encodeURIComponent(orderId),
      displayText: "其他原因（輸入文字）"
    }
  });
  return {
    type: "text",
    text: "請選擇取消原因（訂單 " + shortId + "）：\n選「其他原因」後，5 分鐘內下一句文字會發給顧客。",
    quickReply: { items: items }
  };
}

// ── 3. onCreate：新 LINE 訂單通知管理員 ─────────────────────────

exports.notifyAdminsNewLineOrder = functions
  .runWith({ secrets: LINE_SECRETS })
  .region(REGION)
  .firestore.document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;

    const source = order.source || "";
    const storeId = safeStr(order.storeId);

    // Entry log — always shows why this function runs or skips
    console.log("[NotifyStaff/onCreate] Triggered.", { orderId, source, storeId });

    // Only for LINE/LIFF orders
    if (source !== "liff" && source !== "line") {
      console.log("[NotifyStaff/onCreate] source is not liff/line, skip staff notify.", { orderId, source });
      return null;
    }

    const lineToken = getLineToken();
    if (!lineToken) {
      console.error("[NotifyStaff/onCreate] ❌ LINE_CHANNEL_ACCESS_TOKEN 未設定。請在 functions/.env 加入 LINE_CHANNEL_ACCESS_TOKEN=<token> 後重新 deploy。", { orderId });
      return null;
    }

    if (!storeId) {
      console.warn("[NotifyStaff/onCreate] Order has no storeId, cannot query employees.", { orderId });
      return null;
    }

    const db = admin.firestore();

    // ── 營業時段靜音窗檢查（TW 時區）─────────────────────────
    const nowMs = Date.now();
    const businessHours = await loadStoreBusinessHours(db, storeId);
    const inHours = isInBusinessHours(businessHours, nowMs);
    const nowHhmm = formatHhmmTaipei(nowMs);
    console.log("[NotifyStaff/onCreate] BusinessHours check.", {
      orderId, storeId, nowHhmm, hasConfig: !!businessHours, inHours
    });

    if (inHours) {
      console.log("[NotifyStaff/onCreate] In business hours — skip staff push (staff watches KDS).", { orderId, storeId, nowHhmm });
      try {
        await snap.ref.update({
          "notificationStatus.staffPushSkipped": "in_service_hours",
          "notificationStatus.staffPushSkippedAt": admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("[NotifyStaff/onCreate] Failed to mark skipped.", { orderId, error: e.message });
      }
      return null;
    }

    let employeesSnap;
    try {
      // Query employees belonging to the same store; filter notify/active client-side
      employeesSnap = await db.collection("employees")
        .where("storeId", "==", storeId)
        .get();
    } catch (e) {
      console.warn("[NotifyStaff/onCreate] Failed to query employees.", { orderId, storeId, error: e.message });
      return null;
    }

    const totalEmployees = employeesSnap.size;
    const eligible = [];
    employeesSnap.docs.forEach((empDoc) => {
      const empData = empDoc.data() || {};
      const isActive = empData.isActive !== false;
      const hasNotify = !!empData.notify_line_new_orders;
      const lineUid = safeStr(empData.line_user_id);
      // Log each employee's eligibility
      console.log("[NotifyStaff/onCreate] Employee check.", {
        empId: empDoc.id,
        name: empData.name || "(unnamed)",
        isActive,
        hasNotify,
        hasLineUid: !!lineUid,
        lineUid: lineUid ? (lineUid.slice(0, 4) + "…" + lineUid.slice(-4)) : null
      });
      if (!isActive || !hasNotify || !lineUid) return;
      eligible.push({ empId: empDoc.id, lineUid });
    });

    console.log("[NotifyStaff/onCreate] Eligibility summary.", {
      orderId, storeId, totalEmployees, eligibleCount: eligible.length
    });

    if (eligible.length === 0) {
      console.warn("[NotifyStaff/onCreate] No eligible employees (need: isActive=true, notify_line_new_orders=true, line_user_id set).", { orderId, storeId, totalEmployees });
      return null;
    }

    // Idempotent claim — deferred until we know we'd actually push, so that
    // early-exit paths (no employees, query failure) don't "burn" the flag
    // and block legitimate retries.
    const claimStaff = await claimPushOnOrder(snap.ref, "staffPushSent");
    if (!claimStaff.claimed) {
      console.log("[NotifyStaff/onCreate] idempotent skip.", { orderId, reason: claimStaff.reason });
      return null;
    }

    const flex = buildAdminNewOrderFlex(order, orderId);
    const promises = eligible.map(({ empId, lineUid }) => {
      const body = JSON.stringify({ to: lineUid, messages: flex.messages });
      console.log("[NotifyStaff/onCreate] Sending Flex push.", { orderId, empId, to: lineUid.slice(0, 4) + "…" + lineUid.slice(-4) });
      return sendLinePush(lineToken, body)
        .then(() => {
          console.log("[NotifyStaff/onCreate] Push sent OK.", { orderId, empId });
        })
        .catch((err) => {
          console.error("[NotifyStaff/onCreate] Push failed.", { orderId, empId, error: err.message });
        });
    });

    await Promise.all(promises);

    // 記錄推播結果到訂單
    try {
      await snap.ref.update({
        "notificationStatus.staffPushSent": true,
        "notificationStatus.staffPushSentAt": admin.firestore.FieldValue.serverTimestamp(),
        "notificationStatus.staffPushCount": eligible.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn("[NotifyStaff/onCreate] Failed to mark staffPushSent.", { orderId, error: e.message });
    }

    console.log("[NotifyStaff/onCreate] Done.", { orderId, storeId, sent: eligible.length });
    return null;
  });

// ── 4. Scheduled：自動取消（已停用，所有訂單直接進製作中）────────
// autoExpireUnconfirmedOrders 已停用：pending_confirmation 流程已移除，
// 所有訂單建立後直接進入 accepted 狀態，不再需要 15 分鐘自動取消機制。

// ── 5. LINE Webhook：員工取消按鈕 postback ─────────────────────
// 設定：LINE Developers > Messaging API > Webhook URL
//   https://<REGION>-<project>.cloudfunctions.net/lineWebhook
//   （目前 REGION=us-central1；遷移到 asia-east1 後 URL 前綴會變，
//    屆時必須到 LINE Developer Console 同步更新 Webhook URL）
// 並設定 LINE_CHANNEL_SECRET secret（firebase functions:secrets:set LINE_CHANNEL_SECRET）

exports.lineWebhook = functions
  .runWith({ secrets: LINE_SECRETS })
  .region(REGION)
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const signature = req.get("x-line-signature") || "";
    const channelSecret = process.env.LINE_CHANNEL_SECRET || "";
    if (!channelSecret) {
      console.error("[Webhook] ❌ LINE_CHANNEL_SECRET 未設定。請在 functions/.env 加入後重新 deploy。");
      res.status(500).send("Channel secret not configured");
      return;
    }
    const rawBody = req.rawBody;
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      console.error("[Webhook] Signature mismatch, reject.");
      res.status(401).send("Invalid signature");
      return;
    }

    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events : [];
    console.log("[Webhook] Received events.", { count: events.length });

    for (const ev of events) {
      try {
        await handleLineEvent(ev);
      } catch (e) {
        console.error("[Webhook] Event handler error.", { type: ev && ev.type, error: e && e.message });
      }
    }
    res.status(200).send("OK");
  });

async function handleLineEvent(ev) {
  if (!ev) return;
  const userId = (ev.source && ev.source.userId) || "";
  const replyToken = ev.replyToken;
  const lineToken = getLineToken();
  if (!lineToken) {
    console.error("[Webhook] ❌ LINE token 未設定，無法回覆。");
    return;
  }

  // ── Message events：若員工有進行中的「其他原因」session，用這句文字當取消原因 ──
  if (ev.type === "message" && ev.message && ev.message.type === "text" && userId) {
    const session = await getCustomReasonSession(userId);
    if (!session) return; // 非取消流程的一般訊息，略過
    const freeText = String(ev.message.text || "").trim();
    if (!freeText) return;
    // 自我取消（輸入「取消」即放棄流程）
    if (/^(取消|cancel|放棄)$/i.test(freeText)) {
      await clearCustomReasonSession(userId);
      await sendLineReply(lineToken, replyToken, [{ type: "text", text: "已放棄取消流程。" }]);
      return;
    }
    if (freeText.length > 200) {
      await sendLineReply(lineToken, replyToken, [{
        type: "text",
        text: "⚠️ 原因過長（限 200 字），請縮短後再傳一次。"
      }]);
      return;
    }
    console.log("[Webhook] custom reason received.", { orderId: session.orderId, len: freeText.length, userTail: userId.slice(-4) });
    const result = await applyStaffCancel(session.orderId, "custom", userId, freeText);
    await clearCustomReasonSession(userId);
    const shortId = safeShortId(session.orderId);
    if (result.ok) {
      await sendLineReply(lineToken, replyToken, [{
        type: "text",
        text: "✅ 已取消訂單 " + shortId + "\n原因：" + freeText + "\n顧客將收到取消通知"
      }]);
    } else {
      await sendLineReply(lineToken, replyToken, [{
        type: "text",
        text: "⚠️ 訂單 " + shortId + " 無法取消：" + (result.message || "未知錯誤")
      }]);
    }
    return;
  }

  if (ev.type !== "postback") return;
  const rawData = ev.postback && ev.postback.data;
  if (!rawData) return;

  const params = new URLSearchParams(rawData);
  const action = params.get("action");
  const orderId = params.get("orderId");

  if (action === "cancelPick") {
    if (!orderId) return;
    console.log("[Webhook] cancelPick.", { orderId, userTail: userId.slice(-4) });
    await sendLineReply(lineToken, replyToken, [buildCancelReasonQuickReply(orderId)]);
    return;
  }

  if (action === "cancelAskText") {
    if (!orderId || !userId) return;
    console.log("[Webhook] cancelAskText.", { orderId, userTail: userId.slice(-4) });
    await startCustomReasonSession(userId, orderId);
    await sendLineReply(lineToken, replyToken, [{
      type: "text",
      text: "📝 請直接回傳取消原因文字（將發送給顧客），5 分鐘內有效。\n訂單：" + safeShortId(orderId) + "\n\n若要放棄，請回傳「取消」。"
    }]);
    return;
  }

  if (action === "cancelExec") {
    const reason = params.get("reason");
    if (!orderId || !reason || !CANCEL_REASON_LABELS[reason]) {
      console.warn("[Webhook] cancelExec bad params.", { orderId, reason });
      return;
    }
    console.log("[Webhook] cancelExec.", { orderId, reason, userTail: userId.slice(-4) });
    const result = await applyStaffCancel(orderId, reason, userId);
    const shortId = safeShortId(orderId);
    if (result.ok) {
      await sendLineReply(lineToken, replyToken, [{
        type: "text",
        text: "✅ 已取消訂單 " + shortId + "\n原因：" + CANCEL_REASON_LABELS[reason] + "\n顧客將收到取消通知"
      }]);
    } else {
      await sendLineReply(lineToken, replyToken, [{
        type: "text",
        text: "⚠️ 訂單 " + shortId + " 無法取消：" + (result.message || "未知錯誤")
      }]);
    }
    return;
  }
}

// ── 員工「其他原因」暫存 session（Firestore, 5 分鐘 TTL）──────
const CUSTOM_REASON_TTL_MS = 5 * 60 * 1000;

async function startCustomReasonSession(lineUserId, orderId) {
  const db = admin.firestore();
  const ref = db.collection("staffCancelSessions").doc(String(lineUserId));
  const nowMs = Date.now();
  await ref.set({
    lineUserId: String(lineUserId),
    orderId: String(orderId),
    status: "awaiting_text",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAtMs: nowMs + CUSTOM_REASON_TTL_MS
  });
}

async function getCustomReasonSession(lineUserId) {
  if (!lineUserId) return null;
  const db = admin.firestore();
  const ref = db.collection("staffCancelSessions").doc(String(lineUserId));
  try {
    const snap = await ref.get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (d.status !== "awaiting_text") return null;
    if (!d.orderId) return null;
    if (typeof d.expiresAtMs === "number" && Date.now() > d.expiresAtMs) {
      // 過期：順手清掉，不 await
      ref.delete().catch(() => {});
      return null;
    }
    return { orderId: String(d.orderId) };
  } catch (e) {
    console.warn("[CancelSession] fetch failed.", { lineUserId: String(lineUserId).slice(-4), error: e.message });
    return null;
  }
}

async function clearCustomReasonSession(lineUserId) {
  if (!lineUserId) return;
  const db = admin.firestore();
  try {
    await db.collection("staffCancelSessions").doc(String(lineUserId)).delete();
  } catch (e) {
    console.warn("[CancelSession] delete failed.", { error: e.message });
  }
}

// 員工於 LINE 觸發的取消 — 寫入 Firestore（會觸發 sendOrderStatusPush 通知顧客）
// reasonCode: "busy" | "out_of_stock" | "closing" | "abnormal_order" | "custom"
// customText: 當 reasonCode === "custom" 時的自訂文字原因（將展示給顧客）
async function applyStaffCancel(orderId, reasonCode, lineUserId, customText) {
  const db = admin.firestore();
  const ref = db.collection("orders").doc(String(orderId));
  const isCustom = reasonCode === "custom";
  const displayReason = isCustom
    ? String(customText || "").trim()
    : (CANCEL_REASON_LABELS[reasonCode] || reasonCode);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, message: "訂單不存在" };
      const cur = snap.data() || {};
      const curStatus = normalizeStatus(cur.status);
      if (curStatus === "cancelled") return { ok: false, message: "訂單先前已取消" };
      if (curStatus === "completed" || curStatus === "picked_up") return { ok: false, message: "訂單已完成，無法取消" };
      const ts = admin.firestore.FieldValue.serverTimestamp();
      const updates = {
        status: "cancelled",
        cancel_reason: reasonCode,
        cancelled_at: ts,
        cancelledAt: ts,
        updated_at: ts,
        updatedAt: ts,
        last_status_actor_uid: lineUserId ? "line:" + lineUserId : "line:unknown",
        last_status_actor_name: "LINE 員工",
        last_status_actor_type: "staff_line"
      };
      if (isCustom && displayReason) updates.cancel_reason_text = displayReason;
      tx.update(ref, updates);
      const eventRef = db.collection("order_events").doc();
      tx.set(eventRef, {
        orderId: String(orderId),
        storeId: cur.storeId || "",
        type: "status_changed",
        actorType: "staff_line",
        actorId: lineUserId ? "line:" + lineUserId : "",
        actorName: "LINE 員工",
        fromStatus: curStatus,
        toStatus: "cancelled",
        message: "取消原因：" + displayReason,
        createdAt: ts
      });
      return { ok: true, prevStatus: curStatus };
    });
  } catch (e) {
    console.error("[StaffCancel] Transaction failed.", { orderId, reasonCode, error: e.message });
    return { ok: false, message: "系統錯誤：" + e.message };
  }
}

// ── 工具函式 ─────────────────────────────────────────────────────

function getLineToken() {
  return (
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
    ""
  );
}

const LEGACY_STATUS_MAP = { cooking: "preparing", packing: "preparing", done: "ready", picked_up: "completed" };
function normalizeStatus(status) {
  return LEGACY_STATUS_MAP[status] || status || "new";
}

function safeStr(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  return "";
}

function safeNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function safeShortId(id) {
  const s = safeStr(id);
  return s ? s.slice(-6).toUpperCase() : "------";
}

// ── 營業時段（Asia/Taipei，UTC+8，不支援跨午夜）─────────────
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getTaipeiParts(whenMs) {
  const d = new Date((typeof whenMs === "number" ? whenMs : Date.now()) + 8 * 60 * 60 * 1000);
  return {
    dayKey: DAY_KEYS[d.getUTCDay()],
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes()
  };
}

function hhmmToMin(value) {
  const s = safeStr(value);
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
  const p = s.split(":");
  const h = Number(p[0]), m = Number(p[1]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

// true = 目前位於該日營業時段內，員工靠 KDS 查看，不推 LINE
// false = 時段外 / 公休 / 未設定 / 格式錯誤 — 推 LINE
function isInBusinessHours(businessHours, whenMs) {
  if (!businessHours || typeof businessHours !== "object") return false;
  const parts = getTaipeiParts(whenMs);
  const day = businessHours[parts.dayKey];
  if (!day || day.closed) return false;
  const openMin = hhmmToMin(day.open);
  const closeMin = hhmmToMin(day.close);
  if (openMin == null || closeMin == null) return false;
  if (closeMin <= openMin) return false; // 不支援跨午夜；無效配置視為時段外
  const nowMin = parts.hh * 60 + parts.mm;
  return nowMin >= openMin && nowMin < closeMin;
}

async function loadStoreBusinessHours(db, storeId) {
  if (!storeId) return null;
  try {
    const snap = await db.collection("stores").doc(String(storeId)).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return data.businessHours || null;
  } catch (e) {
    console.warn("[Stores] Failed to load businessHours.", { storeId, error: e.message });
    return null;
  }
}

// ── LINE reply（webhook postback 回覆用）─────────────────────
function sendLineReply(token, replyToken, messages) {
  const body = JSON.stringify({ replyToken, messages });
  return new Promise(function (resolve, reject) {
    const buf = Buffer.from(body, "utf8");
    const options = {
      hostname: "api.line.me",
      path: "/v2/bot/message/reply",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "Content-Length": buf.length
      }
    };
    const req = https.request(options, function (res) {
      let data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
        console.error("[sendLineReply] LINE API error.", { statusCode: res.statusCode, body: data.slice(0, 500) });
        reject(new Error("LINE reply HTTP " + res.statusCode + " — " + data));
      });
    });
    req.on("error", function (err) { reject(err); });
    req.write(buf);
    req.end();
  });
}

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!rawBody || !signature || !channelSecret) return false;
  const mac = crypto.createHmac("sha256", channelSecret)
    .update(rawBody instanceof Buffer ? rawBody : Buffer.from(String(rawBody), "utf8"))
    .digest("base64");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(String(signature));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

const CANCEL_REASON_LABELS = {
  busy: "爆單/忙碌中",
  out_of_stock: "食材售完",
  closing: "即將打烊",
  abnormal_order: "訂單異常"
};

function formatHhmmTaipei(whenMs) {
  const p = getTaipeiParts(whenMs);
  return String(p.hh).padStart(2, "0") + ":" + String(p.mm).padStart(2, "0");
}

// ── LINE Messaging API push ───────────────────────────────────────

function sendLinePush(token, body) {
  return new Promise(function (resolve, reject) {
    const buf     = Buffer.from(body, "utf8");
    const options = {
      hostname: "api.line.me",
      path:     "/v2/bot/message/push",
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Authorization":  "Bearer " + token,
        "Content-Length": buf.length
      }
    };
    const req = https.request(options, function (res) {
      let data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end",  function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          // Parse LINE error body for clearer diagnostics
          let errDetail = data;
          try { errDetail = JSON.stringify(JSON.parse(data)); } catch (_) {}
          const errMsg = "LINE API HTTP " + res.statusCode + " — " + errDetail;
          // Log immediately so it's visible even if caller swallows the error
          console.error("[sendLinePush] LINE API error.", { statusCode: res.statusCode, body: errDetail.slice(0, 500) });
          reject(new Error(errMsg));
        }
      });
    });
    req.on("error", function(err) {
      console.error("[sendLinePush] Network error.", { message: err.message });
      reject(err);
    });
    req.write(buf);
    req.end();
  });
}

// ── LINE 綁定 Functions ───────────────────────────────────────

exports.createLineBindingToken = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { db, role, adminData } = await requireAdminContext(context);

    const targetCollection = safeStr(data && data.targetCollection);
    const targetDocId = safeStr(data && data.targetDocId);
    const targetName = safeStr(data && data.targetName) || "未知帳號";

    if (!["admins", "employees"].includes(targetCollection)) {
      throw new functions.https.HttpsError("invalid-argument", "無效的目標集合");
    }
    if (!targetDocId) {
      throw new functions.https.HttpsError("invalid-argument", "缺少目標文件 ID");
    }

    const targetRef = db.collection(targetCollection).doc(targetDocId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "目標帳號不存在");
    }
    const targetData = targetSnap.data() || {};

    if (role !== "owner") {
      const tStoreId = String(targetData.storeId || "");
      const aStoreId = String(adminData.storeId || "");
      if (tStoreId && aStoreId && tStoreId !== aStoreId) {
        throw new functions.https.HttpsError("permission-denied", "無權管理其他門市帳號");
      }
    }

    // Invalidate existing unused tokens for this target
    const existingSnap = await db.collection("line_bindings")
      .where("targetDocId", "==", targetDocId)
      .where("used", "==", false)
      .where("invalidated", "==", false)
      .get();

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const tokenRef = db.collection("line_bindings").doc(token);

    const batch = db.batch();
    existingSnap.docs.forEach(function (doc) {
      batch.update(doc.ref, { invalidated: true, invalidatedAt: ts });
    });
    batch.set(tokenRef, {
      token,
      targetCollection,
      targetDocId,
      targetName,
      storeId: String(targetData.storeId || ""),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      invalidated: false,
      usedAt: null,
      lineUserId: null,
      createdBy: context.auth.uid,
      createdAt: ts
    });
    await batch.commit();

    const bindUrl = SITE_URL + "/line-bind?token=" + token;
    return { ok: true, token, expiresAt: expiresAt.toISOString(), bindUrl };
  });

exports.completeLineBinding = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const db = admin.firestore();
    const token = safeStr(data && data.token);
    const lineUserId = safeStr(data && data.lineUserId);

    if (!token || !lineUserId) {
      throw new functions.https.HttpsError("invalid-argument", "缺少必要參數");
    }
    if (!lineUserId.startsWith("U") || lineUserId.length < 15) {
      throw new functions.https.HttpsError("invalid-argument", "無效的 LINE 使用者 ID");
    }

    const tokenRef = db.collection("line_bindings").doc(token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      throw new functions.https.HttpsError("not-found", "綁定碼不存在");
    }

    const binding = tokenSnap.data() || {};
    if (binding.invalidated) {
      throw new functions.https.HttpsError("failed-precondition", "綁定碼已失效，請重新產生");
    }
    if (binding.used) {
      throw new functions.https.HttpsError("failed-precondition", "綁定碼已使用");
    }
    const expDate = binding.expiresAt && binding.expiresAt.toDate ? binding.expiresAt.toDate() : null;
    if (!expDate || expDate.getTime() < Date.now()) {
      throw new functions.https.HttpsError("deadline-exceeded", "綁定碼已過期，請重新產生");
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();
    const targetRef = db.collection(binding.targetCollection).doc(binding.targetDocId);

    const batch = db.batch();
    batch.update(tokenRef, { used: true, usedAt: ts, lineUserId });
    batch.set(targetRef, {
      line_user_id: lineUserId,
      line_bound_at: ts,
      line_binding_status: "bound",
      updatedAt: ts
    }, { merge: true });
    await batch.commit();

    return { ok: true, targetName: safeStr(binding.targetName) };
  });

exports.unbindLine = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { db, role, adminData } = await requireAdminContext(context);

    const targetCollection = safeStr(data && data.targetCollection);
    const targetDocId = safeStr(data && data.targetDocId);

    if (!["admins", "employees"].includes(targetCollection)) {
      throw new functions.https.HttpsError("invalid-argument", "無效的目標集合");
    }
    if (!targetDocId) {
      throw new functions.https.HttpsError("invalid-argument", "缺少目標文件 ID");
    }

    const targetRef = db.collection(targetCollection).doc(targetDocId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "目標帳號不存在");
    }
    const targetData = targetSnap.data() || {};

    if (role !== "owner") {
      const tStoreId = String(targetData.storeId || "");
      const aStoreId = String(adminData.storeId || "");
      if (tStoreId && aStoreId && tStoreId !== aStoreId) {
        throw new functions.https.HttpsError("permission-denied", "無權管理其他門市帳號");
      }
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();
    await targetRef.set({
      line_user_id: null,
      line_bound_at: null,
      line_binding_status: "unbound",
      notify_line_new_orders: false,
      updatedAt: ts
    }, { merge: true });

    return { ok: true };
  });

exports.updateLineNotificationSettings = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { db, role, adminData } = await requireAdminContext(context);

    const targetCollection = safeStr(data && data.targetCollection);
    const targetDocId = safeStr(data && data.targetDocId);

    if (!["admins", "employees"].includes(targetCollection)) {
      throw new functions.https.HttpsError("invalid-argument", "無效的目標集合");
    }
    if (!targetDocId) {
      throw new functions.https.HttpsError("invalid-argument", "缺少目標文件 ID");
    }

    const targetRef = db.collection(targetCollection).doc(targetDocId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "目標帳號不存在");
    }
    const targetData = targetSnap.data() || {};

    if (role !== "owner") {
      const tStoreId = String(targetData.storeId || "");
      const aStoreId = String(adminData.storeId || "");
      if (tStoreId && aStoreId && tStoreId !== aStoreId) {
        throw new functions.https.HttpsError("permission-denied", "無權管理其他門市帳號");
      }
    }

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (typeof data.notify_line_new_orders === "boolean") {
      updates.notify_line_new_orders = data.notify_line_new_orders;
    }
    if (typeof data.can_confirm_line_orders === "boolean") {
      updates.can_confirm_line_orders = data.can_confirm_line_orders;
    }
    await targetRef.set(updates, { merge: true });

    return { ok: true };
  });

function nowTs() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeEmployeeId(employeeId) {
  return String(employeeId || "").trim();
}

function normalizePin(pin) {
  return String(pin || "").trim();
}

function assertPin(pin) {
  if (!/^\d{4}$/.test(pin)) {
    throw new functions.https.HttpsError("invalid-argument", "PIN 必須為 4 位數字");
  }
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPin(pin, pinHash) {
  if (!pinHash || typeof pinHash !== "string") return false;
  const parts = pinHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = Buffer.from(parts[2], "hex");
  const actual = crypto.scryptSync(pin, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

async function requireAdminContext(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError("unauthenticated", "請先登入");
  }
  const db = admin.firestore();
  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "無管理員權限");
  }
  const role = (adminDoc.data() && adminDoc.data().role) || "";
  if (!["owner", "admin"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "無管理員權限");
  }
  return { db, role, adminData: adminDoc.data() || {} };
}

function sessionTokenHash(sessionToken) {
  return crypto.createHash("sha256").update(String(sessionToken || "")).digest("hex");
}

exports.resetEmployeePin = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { db, role, adminData } = await requireAdminContext(context);
    const employeeDocId = String(data && data.employeeDocId || "").trim();
    const pin = normalizePin(data && data.pin);
    if (!employeeDocId) {
      throw new functions.https.HttpsError("invalid-argument", "缺少員工資料");
    }
    assertPin(pin);

    const employeeRef = db.collection("employees").doc(employeeDocId);
    const snap = await employeeRef.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "員工不存在");
    }
    const employee = snap.data() || {};
    if (role !== "owner" && String(employee.storeId || "") !== String(adminData.storeId || "")) {
      throw new functions.https.HttpsError("permission-denied", "不可操作其他門市員工");
    }

    await employeeRef.set({
      pinHash: hashPin(pin),
      updatedAt: nowTs()
    }, { merge: true });
    return { ok: true };
  });

exports.verifyPosSession = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const db = admin.firestore();
    const employeeId = normalizeEmployeeId(data && data.employeeId);
    const sessionToken = String(data && data.sessionToken || "").trim();
    if (!employeeId || !sessionToken) {
      throw new functions.https.HttpsError("invalid-argument", "缺少 session");
    }

    const tokenHash = sessionTokenHash(sessionToken);
    const snap = await db.collection("posSessions").doc(tokenHash).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError("unauthenticated", "session 無效");
    }
    const session = snap.data() || {};
    if (session.employeeId !== employeeId) {
      throw new functions.https.HttpsError("permission-denied", "session 無效");
    }
    if (session.revokedAt) {
      throw new functions.https.HttpsError("unauthenticated", "session 已登出");
    }
    const expiresAt = session.expiresAt && session.expiresAt.toDate ? session.expiresAt.toDate() : null;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      throw new functions.https.HttpsError("unauthenticated", "session 已過期");
    }

    return {
      ok: true,
      employeeId: session.employeeId,
      employeeName: session.employeeName || "",
      storeId: session.storeId || "",
      loginAt: session.loginAt && session.loginAt.toDate ? session.loginAt.toDate().toISOString() : null,
      expiresAt: expiresAt.toISOString()
    };
  });

exports.listPosTodayOrders = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const db = admin.firestore();
    const employeeId = normalizeEmployeeId(data && data.employeeId);
    const sessionToken = String(data && data.sessionToken || "").trim();
    const limit = Math.max(1, Math.min(500, Number(data && data.limit || 200)));
    if (!employeeId || !sessionToken) {
      throw new functions.https.HttpsError("invalid-argument", "缺少 session");
    }

    const tokenHash = sessionTokenHash(sessionToken);
    const sessionSnap = await db.collection("posSessions").doc(tokenHash).get();
    if (!sessionSnap.exists) {
      throw new functions.https.HttpsError("unauthenticated", "session 無效");
    }
    const session = sessionSnap.data() || {};
    if (session.employeeId !== employeeId) {
      throw new functions.https.HttpsError("permission-denied", "session 無效");
    }
    if (session.revokedAt) {
      throw new functions.https.HttpsError("unauthenticated", "session 已登出");
    }
    const expiresAt = session.expiresAt && session.expiresAt.toDate ? session.expiresAt.toDate() : null;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      throw new functions.https.HttpsError("unauthenticated", "session 已過期");
    }

    const storeId = String(session.storeId || "").trim();
    if (!storeId) {
      throw new functions.https.HttpsError("failed-precondition", "session 缺少門市資訊");
    }

    const now = new Date();
    const tzOffsetMinutes = 8 * 60;
    const localNow = new Date(now.getTime() + (tzOffsetMinutes + now.getTimezoneOffset()) * 60000);
    const startUtc = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), -8, 0, 0));
    const startTs = admin.firestore.Timestamp.fromDate(startUtc);

    const snap = await db.collection("orders")
      .where("storeId", "==", storeId)
      .where("createdAt", ">=", startTs)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const orders = snap.docs.map((doc) => {
      const row = doc.data() || {};
      const createdAtDate = row.createdAt && row.createdAt.toDate ? row.createdAt.toDate() : null;
      return {
        id: doc.id,
        source: row.source || "pos",
        status: row.status || "new",
        storeId: row.storeId || storeId,
        customer_name: row.customer_name || "",
        display_name: row.display_name || "",
        total: Number(row.total || row.totalAmount || row.subtotal || 0),
        subtotal: Number(row.subtotal || 0),
        pickupNumber: row.pickupNumber || "",
        pickupCode: row.pickupCode || "",
        scheduled_pickup_time: row.scheduled_pickup_time || "",
        scheduled_pickup_at: row.scheduled_pickup_at || "",
        lineUserId: row.lineUserId || "",
        note: row.note || "",
        items: Array.isArray(row.items) ? row.items : [],
        groups: Array.isArray(row.groups) ? row.groups : [],
        lineItems: Array.isArray(row.lineItems) ? row.lineItems : [],
        normalizedItems: Array.isArray(row.normalizedItems) ? row.normalizedItems : [],
        cartSnapshot: Array.isArray(row.cartSnapshot) ? row.cartSnapshot : [],
        createdAt: createdAtDate ? createdAtDate.getTime() : null
      };
    });

    return {
      ok: true,
      storeId: storeId,
      count: orders.length,
      orders: orders
    };
  });

exports.logoutPosSession = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const db = admin.firestore();
    const sessionToken = String(data && data.sessionToken || "").trim();
    if (!sessionToken) return { ok: true };
    const tokenHash = sessionTokenHash(sessionToken);
    await db.collection("posSessions").doc(tokenHash).set({
      revokedAt: nowTs()
    }, { merge: true });
    return { ok: true };
  });

// Transaction-safe unique employeeId enforcement with employeeIdIndex sidecar.
exports.upsertEmployee = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { db, role, adminData } = await requireAdminContext(context);
    const employeeDocId = String(data && data.employeeDocId || "").trim();
    const name = String(data && data.name || "").trim();
    const employeeId = normalizeEmployeeId(data && data.employeeId);
    const pin = normalizePin(data && data.pin);
    const isActive = data && typeof data.isActive === "boolean" ? data.isActive : true;
    const requestedStoreId = String(data && data.storeId || "").trim();
    const storeId = role === "owner" ? requestedStoreId : String(adminData.storeId || "").trim();

    if (!name || !employeeId || !storeId) {
      throw new functions.https.HttpsError("invalid-argument", "員工姓名、員工編號與門市不可空白");
    }
    if (!employeeDocId) {
      assertPin(pin);
    } else if (pin) {
      assertPin(pin);
    }

    const employeeRef = employeeDocId
      ? db.collection("employees").doc(employeeDocId)
      : db.collection("employees").doc();
    const employeeIdIndexRef = db.collection("employeeIdIndex").doc(employeeId);
    let savedEmployeeDocId = employeeRef.id;

    await db.runTransaction(async (tx) => {
      if (employeeDocId) {
        const existingSnap = await tx.get(employeeRef);
        if (!existingSnap.exists) {
          throw new functions.https.HttpsError("not-found", "員工資料不存在");
        }
        const existing = existingSnap.data() || {};
        const existingEmployeeId = normalizeEmployeeId(existing.employeeId);
        if (existingEmployeeId && existingEmployeeId !== employeeId) {
          throw new functions.https.HttpsError("invalid-argument", "員工編號不可修改");
        }
      }

      const duplicateQuery = db.collection("employees")
        .where("employeeId", "==", employeeId)
        .limit(10);
      const duplicateSnap = await tx.get(duplicateQuery);
      const hasDuplicate = duplicateSnap.docs.some((doc) => doc.id !== employeeRef.id);
      if (hasDuplicate) {
        throw new functions.https.HttpsError("already-exists", "員工編號已存在，請使用其他編號");
      }

      const indexSnap = await tx.get(employeeIdIndexRef);
      if (indexSnap.exists) {
        const indexData = indexSnap.data() || {};
        if (String(indexData.employeeDocId || "") !== employeeRef.id) {
          throw new functions.https.HttpsError("already-exists", "員工編號已存在，請使用其他編號");
        }
      }

      const payload = {
        name,
        employeeId,
        storeId,
        isActive: !!isActive,
        updatedAt: nowTs()
      };
      if (pin) {
        payload.pinHash = hashPin(pin);
      }
      if (!employeeDocId) {
        payload.createdAt = nowTs();
      }

      tx.set(employeeRef, payload, { merge: true });
      tx.set(employeeIdIndexRef, {
        employeeId,
        employeeDocId: employeeRef.id,
        storeId,
        updatedAt: nowTs()
      }, { merge: true });
      savedEmployeeDocId = employeeRef.id;
    });

    return { ok: true, employeeDocId: savedEmployeeDocId };
  });

// Dedupe-aware employee login — picks the primary record when duplicates exist,
// matching admin-side primary record rules (non-suppressed, oldest, then docId asc).
exports.posEmployeeLogin = functions
  .region(REGION)
  .https.onCall(async (data) => {
    const db = admin.firestore();
    const employeeId = normalizeEmployeeId(data && data.employeeId);
    const pin = normalizePin(data && data.pin);
    const sessionHours = Math.max(1, Math.min(72, Number(data && data.sessionHours || 16)));

    if (!employeeId || !pin) {
      throw new functions.https.HttpsError("invalid-argument", "缺少登入資料");
    }
    assertPin(pin);

    const employeeSnap = await db.collection("employees")
      .where("employeeId", "==", employeeId)
      .limit(20)
      .get();
    if (employeeSnap.empty) {
      console.log("[POS Login] employee not found", { employeeId, matchedCount: 0 });
      throw new functions.https.HttpsError("unauthenticated", "員工編號或 PIN 錯誤");
    }

    const candidates = employeeSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() || {}
    }));

    const sorted = candidates.slice().sort((left, right) => {
      const leftSuppressed = left.data.duplicateSuppressed === true ? 1 : 0;
      const rightSuppressed = right.data.duplicateSuppressed === true ? 1 : 0;
      if (leftSuppressed !== rightSuppressed) return leftSuppressed - rightSuppressed;

      const leftCreated = left.data.createdAt && left.data.createdAt.toDate
        ? left.data.createdAt.toDate().getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightCreated = right.data.createdAt && right.data.createdAt.toDate
        ? right.data.createdAt.toDate().getTime()
        : Number.MAX_SAFE_INTEGER;
      if (leftCreated !== rightCreated) return leftCreated - rightCreated;

      const leftUpdated = left.data.updatedAt && left.data.updatedAt.toDate
        ? left.data.updatedAt.toDate().getTime()
        : Number.MAX_SAFE_INTEGER;
      const rightUpdated = right.data.updatedAt && right.data.updatedAt.toDate
        ? right.data.updatedAt.toDate().getTime()
        : Number.MAX_SAFE_INTEGER;
      if (leftUpdated !== rightUpdated) return leftUpdated - rightUpdated;

      return String(left.id || "").localeCompare(String(right.id || ""));
    });

    const selected = sorted[0];
    const employee = selected.data || {};
    const isActive = employee.isActive !== false;

    console.log("[POS Login] employee candidates resolved", {
      employeeId,
      matchedCount: candidates.length,
      selectedDocId: selected.id,
      selectedIsActive: employee.isActive,
      selectedDuplicateSuppressed: employee.duplicateSuppressed === true
    });

    if (!isActive) {
      console.log("[POS Login] blocked by inactive primary employee", {
        employeeId,
        selectedDocId: selected.id,
        selectedIsActive: employee.isActive
      });
      throw new functions.https.HttpsError("failed-precondition", "員工已停用");
    }
    if (!verifyPin(pin, employee.pinHash)) {
      throw new functions.https.HttpsError("unauthenticated", "員工編號或 PIN 錯誤");
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sessionTokenHash(sessionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionHours * 60 * 60 * 1000);

    await db.collection("posSessions").doc(tokenHash).set({
      tokenHash,
      employeeDocId: selected.id,
      employeeId: employee.employeeId,
      employeeName: employee.name || "",
      storeId: employee.storeId || "",
      loginAt: nowTs(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      revokedAt: null
    }, { merge: true });

    return {
      ok: true,
      employeeId: employee.employeeId,
      employeeName: employee.name || "",
      storeId: employee.storeId || "",
      sessionToken,
      loginAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  });
