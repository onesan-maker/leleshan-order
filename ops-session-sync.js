(function () {
  // store_runtime/current_session_<storeId>：每門市一份主 session。
  // POS 寫入 / 清除；KDS 只讀。
  var DOC_PREFIX = "current_session_";

  function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function sessionDocRef(db, storeId) {
    return db.collection("store_runtime").doc(DOC_PREFIX + storeId);
  }

  async function writeSession(db, storeId, employee, opts) {
    opts = opts || {};
    var payload = {
      storeId: storeId,
      employeeId: String((employee && employee.employeeId) || ""),
      employeeName: String((employee && employee.employeeName) || ""),
      role: String((employee && employee.role) || "staff"),
      sessionActive: true,
      updatedAt: serverTimestamp(),
      source: opts.source || "pos",
      lastAction: opts.lastAction || "login"
    };
    if (opts.lastAction === "login" || opts.markStart) {
      payload.startedAt = serverTimestamp();
    }
    await sessionDocRef(db, storeId).set(payload, { merge: true });
    return payload;
  }

  async function clearSession(db, storeId, lastAction) {
    await sessionDocRef(db, storeId).set({
      storeId: storeId,
      sessionActive: false,
      employeeId: "",
      employeeName: "",
      role: "",
      updatedAt: serverTimestamp(),
      source: "pos",
      lastAction: lastAction || "logout"
    }, { merge: true });
  }

  function subscribeSession(db, storeId, onNext, onError) {
    return sessionDocRef(db, storeId).onSnapshot(function (snap) {
      var data = snap.exists ? snap.data() : null;
      if (typeof onNext === "function") onNext(data);
    }, function (err) {
      console.warn("[OpsSession] subscribe error", err);
      if (typeof onError === "function") onError(err);
    });
  }

  async function writeShiftLog(db, payload) {
    if (!db || !payload || !payload.type) return;
    var doc = {
      type: payload.type, // 'login' | 'switch' | 'logout'
      employeeId: String(payload.employeeId || ""),
      employeeName: String(payload.employeeName || ""),
      previousEmployeeId: payload.previousEmployeeId || null,
      previousEmployeeName: payload.previousEmployeeName || null,
      storeId: String(payload.storeId || ""),
      triggeredBy: payload.triggeredBy || "pos",
      timestamp: serverTimestamp()
    };
    try {
      await db.collection("shift_logs").add(doc);
    } catch (e) {
      console.warn("[ShiftLog] write failed", e);
    }
  }

  window.LeLeShanOpsSession = {
    writeSession: writeSession,
    clearSession: clearSession,
    subscribeSession: subscribeSession,
    writeShiftLog: writeShiftLog
  };
})();
