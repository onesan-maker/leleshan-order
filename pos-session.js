(function () {
  var STORAGE_KEY = "leleshan_pos_employee_session_v1";
  var DEFAULT_MAX_AGE_MS = 16 * 60 * 60 * 1000;

  function toDate(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function get() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
  }

  function save(session) {
    if (!session || typeof session !== "object") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function isValid(session) {
    if (!session) return false;
    if (!session.employeeId || !session.employeeName || !session.storeId || !session.sessionToken || !session.loginAt) {
      return false;
    }
    var loginAt = toDate(session.loginAt);
    if (!loginAt) return false;
    var expiresAt = toDate(session.expiresAt);
    if (expiresAt) {
      return expiresAt.getTime() > Date.now();
    }
    return loginAt.getTime() + DEFAULT_MAX_AGE_MS > Date.now();
  }

  window.LeLeShanPosSession = {
    key: STORAGE_KEY,
    get: get,
    save: save,
    clear: clear,
    isValid: isValid
  };
})();

