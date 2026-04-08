/**
 * 樂樂山點餐系統 — Firebase Functions
 * 功能：訂單建立後自動發送 LINE 接單推播（含訂單摘要）
 *
 * 設定 LINE token：
 *   firebase functions:config:set line.channel_access_token="YOUR_TOKEN"
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

// Firestore onCreate trigger：orders/{orderId} 新增時執行
exports.sendOrderReceivedPush = functions
  .region("us-central1")
  .firestore.document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;

    // 無 lineUserId 則跳過（現場點餐或非 LINE 環境）
    const lineUserId = order.lineUserId;
    if (!lineUserId || typeof lineUserId !== "string" || lineUserId.trim().length === 0) {
      console.log("[Notify] No lineUserId, skip.", { orderId });
      return null;
    }

    // 防止重複發送（function retry 或重覆觸發）
    if (order.notificationStatus && order.notificationStatus.receivedPushSent === true) {
      console.log("[Notify] Already sent, skip.", { orderId });
      return null;
    }

    // 讀取 LINE token
    const cfg = functions.config();
    const lineToken = cfg.line && cfg.line.channel_access_token;
    if (!lineToken) {
      console.warn("[Notify] line.channel_access_token not configured, skip.", { orderId });
      return null;
    }

    const text = buildOrderMessage(order, orderId);
    const body = JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: text }]
    });

    try {
      await sendLinePush(lineToken, body);
      await snap.ref.update({
        "notificationStatus.receivedPushSent": true,
        "notificationStatus.receivedPushSentAt": admin.firestore.FieldValue.serverTimestamp(),
        "notificationStatus.receivedPushError": null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("[Notify] Push sent.", { orderId, lineUserId });
    } catch (error) {
      const errMsg = (error && (error.message || String(error))) || "未知錯誤";
      console.error("[Notify] Push failed.", { orderId, lineUserId, error: errMsg });
      await snap.ref.update({
        "notificationStatus.receivedPushSent": false,
        "notificationStatus.receivedPushError": errMsg,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(function (e) {
        console.error("[Notify] Failed to write error status.", e);
      });
    }

    return null;
  });

// ─── 訂單摘要組字 ──────────────────────────────────────────────

function buildOrderMessage(order, orderId) {
  var lines = [];

  lines.push("已收到您的訂購 ✅");
  lines.push("");

  // 訂單基本資訊
  lines.push("訂單編號：" + safeShortId(orderId));
  if (safeStr(order.customer_name)) {
    lines.push("取餐人：" + safeStr(order.customer_name));
  }
  var pickup = [safeStr(order.scheduled_pickup_date), safeStr(order.scheduled_pickup_time)]
    .filter(Boolean).join(" ");
  if (pickup) {
    lines.push("取餐時間：" + pickup);
  }
  var createdStr = formatTimestamp(order.created_at || order.createdAt);
  if (createdStr) {
    lines.push("訂單時間：" + createdStr);
  }

  // 品項明細
  lines.push("");
  lines.push("【訂單明細】");

  var items = Array.isArray(order.items) ? order.items : [];
  items.forEach(function (item) {
    var name = safeStr(item.name) || "品項";
    var qty  = Math.max(0, Number(item.qty || item.quantity || 0));
    var sub  = Math.max(0, Number(item.subtotal || 0));

    // 主行：品名 × 數量　$金額（全形空格讓視覺對齊）
    lines.push(name + " × " + qty + "\u3000$" + sub);

    // 副資訊（縮排一格）
    var subParts = [];

    // 口味
    var flavor = safeStr(item.flavor || item.flavorName);
    if (flavor) subParts.push(flavor);

    // options（含主食及其他加購）
    var opts = Array.isArray(item.options) ? item.options : [];
    opts.forEach(function (opt) {
      if (!opt || typeof opt !== "object") return;
      var val = safeStr(opt.value);
      if (!val) return;
      var label = safeStr(opt.name);
      subParts.push(label ? label + "：" + val : val);
    });

    // 品項備註
    var note = safeStr(item.item_note || item.itemNote || item.note);
    if (note) subParts.push("備註：" + note);

    if (subParts.length > 0) {
      lines.push("　" + subParts.join("／"));
    }
  });

  // 金額合計
  lines.push("");
  var subtotal = safeNum(order.subtotal || order.totalAmount || order.totalPrice);
  var total    = safeNum(order.total    || order.totalAmount || order.totalPrice || subtotal);
  if (subtotal > 0 && subtotal !== total) {
    lines.push("小計：$" + subtotal);
  }
  lines.push("合計：$" + total);

  // 結尾
  lines.push("");
  lines.push("稍後餐點製作完畢將再通知您，謝謝。");

  // LINE 文字訊息上限 5000 字元，安全截斷
  var text = lines.join("\n");
  if (text.length > 4800) {
    text = text.slice(0, 4750) + "\n…\n合計：$" + total + "\n\n稍後餐點製作完畢將再通知您，謝謝。";
  }
  return text;
}

// ─── 工具函式 ─────────────────────────────────────────────────

function safeStr(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  return "";
}

function safeNum(val) {
  var n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function safeShortId(id) {
  var s = safeStr(id);
  return s ? s.slice(-6).toUpperCase() : "------";
}

function formatTimestamp(val) {
  if (!val) return "";
  try {
    var d = typeof val.toDate === "function" ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return "";
  }
}

// ─── LINE Messaging API push（Node 內建 https，無額外依賴）──────

function sendLinePush(token, body) {
  return new Promise(function (resolve, reject) {
    var bodyBuffer = Buffer.from(body, "utf8");
    var options = {
      hostname: "api.line.me",
      path: "/v2/bot/message/push",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "Content-Length": bodyBuffer.length
      }
    };

    var req = https.request(options, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error("LINE API " + res.statusCode + ": " + data));
        }
      });
    });

    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
}
