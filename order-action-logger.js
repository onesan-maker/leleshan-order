(function () {
  // 每次 KDS / POS 對訂單的狀態操作，寫入 order_logs，以便日後做員工績效分析。
  // 與 order_events 並行：order_events 是系統事件時間軸，order_logs 專注員工動作。

  function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function actionFor(statusAfter) {
    switch (statusAfter) {
      case "preparing": return "mark_preparing";
      case "ready":     return "mark_ready";
      case "completed": return "mark_completed";
      case "picked_up": return "mark_picked_up";
      case "cancelled": return "mark_cancelled";
      default:          return "mark_" + String(statusAfter || "unknown");
    }
  }

  async function logOrderAction(db, payload) {
    if (!db || !payload || !payload.orderId) return;
    var doc = {
      orderId:     String(payload.orderId),
      storeId:     String(payload.storeId || ""),
      action:      String(payload.action || actionFor(payload.statusAfter)),
      statusBefore: payload.statusBefore || "",
      statusAfter:  payload.statusAfter || "",
      employeeId:   String(payload.employeeId || ""),
      employeeName: String(payload.employeeName || ""),
      station:      String(payload.station || ""),
      deviceType:   String(payload.deviceType || "kds"),
      cancelReason: payload.cancelReason || null,
      timestamp:    serverTimestamp()
    };
    try {
      await db.collection("order_logs").add(doc);
    } catch (e) {
      console.warn("[OrderLog] write failed", e);
    }
  }

  window.LeLeShanOrderLog = {
    logOrderAction: logOrderAction,
    actionFor: actionFor
  };
})();
