/**
 * 樂樂山點餐系統 — Firebase Functions
 * 功能：訂單建立後自動發送 LINE 接單推播
 *
 * 部署前需設定 LINE token：
 *   firebase functions:config:set line.channel_access_token="YOUR_TOKEN"
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

    // 讀取 LINE token（需先執行 functions:config:set line.channel_access_token）
    const cfg = functions.config();
    const lineToken = cfg.line && cfg.line.channel_access_token;
    if (!lineToken) {
      console.warn("[Notify] line.channel_access_token not configured, skip.", { orderId });
      return null;
    }

    const message = JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: "已收到您的訂購，稍後餐點製作完畢將通知您。" }]
    });

    try {
      await sendLinePush(lineToken, message);
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

/** LINE Messaging API push message（使用 Node 內建 https，不需額外 package） */
function sendLinePush(token, body) {
  return new Promise(function (resolve, reject) {
    const bodyBuffer = Buffer.from(body, "utf8");
    const options = {
      hostname: "api.line.me",
      path: "/v2/bot/message/push",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "Content-Length": bodyBuffer.length
      }
    };

    const req = https.request(options, function (res) {
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
