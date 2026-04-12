/**
 * 樂樂山點餐系統 — Firebase Functions
 * 功能：
 *   1. 建單後發送「已收到訂單」LINE 推播
 *   2. 狀態切換到 ready 時發送「可取餐」LINE 推播
 *   3. 狀態切換到 cancelled 時發送「訂單取消」LINE 推播
 *   4. 所有推播結果記錄到 notifications / order_events
 *
 * 設定 LINE token：
 *   firebase functions:config:set line.channel_access_token="<set-in-shell>"
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const https     = require("https");

admin.initializeApp();

// ── 1. onCreate：建單後推播「已收到訂單」────────────────────────

exports.sendOrderReceivedPush = functions
  .region("us-central1")
  .firestore.document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order   = snap.data();
    const orderId = context.params.orderId;

    const lineUserId = order.lineUserId;
    if (!lineUserId || typeof lineUserId !== "string" || !lineUserId.trim()) {
      console.log("[Notify/onCreate] No lineUserId, skip.", { orderId });
      return null;
    }

    if (order.notificationStatus && order.notificationStatus.receivedPushSent === true) {
      console.log("[Notify/onCreate] Already sent, skip.", { orderId });
      return null;
    }

    const lineToken = getLineToken();
    if (!lineToken) {
      console.warn("[Notify/onCreate] line.channel_access_token not configured.", { orderId });
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
  .region("us-central1")
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
      if (after.notificationStatus && after.notificationStatus.readyPushSent === true) {
        console.log("[Notify/onUpdate] readyPush already sent, skip.", { orderId });
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
      if (after.notificationStatus && after.notificationStatus.cancelledPushSent === true) {
        console.log("[Notify/onUpdate] cancelledPush already sent, skip.", { orderId });
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

// ── 推播執行 + 記錄 ─────────────────────────────────────────────

async function handlePush(opts) {
  const { db, ref, orderId, storeId, lineUserId, lineToken, text,
          notifType, sentField, fromStatus, toStatus, eventType } = opts;

  const body = JSON.stringify({
    to: lineUserId,
    messages: [{ type: "text", text }]
  });

  const ts         = admin.firestore.FieldValue.serverTimestamp();
  const notifRef   = db.collection("notifications").doc();
  const eventRef   = db.collection("order_events").doc();

  try {
    await sendLinePush(lineToken, body);

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
  lines.push("");
  lines.push("如有疑問，請聯絡門市人員。");
  return lines.join("\n");
}

// ── 工具函式 ─────────────────────────────────────────────────────

function getLineToken() {
  const envToken =
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
    "";
  if (envToken) return envToken;
  try {
    const cfg = functions.config();
    return cfg.line && cfg.line.channel_access_token || "";
  } catch (e) {
    return "";
  }
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
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error("LINE API " + res.statusCode + ": " + data));
      });
    });
    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}
