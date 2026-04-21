(function () {
  var form;
  var idInput;
  var pinInput;
  var submitBtn;
  var errorEl;

  document.addEventListener("DOMContentLoaded", function () {
    form = document.getElementById("pos-login-form");
    idInput = document.getElementById("employee-id");
    pinInput = document.getElementById("employee-pin");
    submitBtn = document.getElementById("pos-login-submit");
    errorEl = document.getElementById("pos-login-error");
    if (!form || !idInput || !pinInput || !submitBtn || !errorEl) return;

    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }

    var current = window.LeLeShanPosSession && window.LeLeShanPosSession.get();
    if (window.LeLeShanPosSession && window.LeLeShanPosSession.isValid(current)) {
      window.location.replace("/pos");
      return;
    }

    form.addEventListener("submit", onSubmit);
  });

  function setError(message) {
    if (!errorEl) return;
    if (!message) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = !!isSubmitting;
    submitBtn.classList.toggle("is-loading", !!isSubmitting);
    submitBtn.textContent = isSubmitting ? "登入中..." : "登入";
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");

    var employeeId = String((idInput && idInput.value) || "").trim();
    var pin = String((pinInput && pinInput.value) || "").trim();

    if (!/^\d{3}$/.test(employeeId)) {
      setError("員工編號需為3位數字");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN需為4位數字");
      return;
    }
    if (!navigator.onLine) {
      setError("目前離線，無法進行新的登入");
      return;
    }

    setSubmitting(true);
    var tStart = performance.now();
    try {
      var login = firebase.app().functions("us-central1").httpsCallable("posEmployeeLogin");
      var tCallStart = performance.now();
      var result = await login({
        employeeId: employeeId,
        pin: pin,
        sessionHours: 16
      });
      var tCallEnd = performance.now();
      console.log("[POS_DIAG] login.callable posEmployeeLogin", (tCallEnd - tCallStart).toFixed(2) + "ms");
      var payload = result && result.data || {};
      if (!payload || !payload.sessionToken) {
        throw new Error("LOGIN_FAILED");
      }

      window.LeLeShanPosSession.save({
        employeeId: String(payload.employeeId || employeeId),
        employeeName: payload.employeeName,
        storeId: payload.storeId,
        sessionToken: payload.sessionToken,
        loginAt: payload.loginAt || new Date().toISOString(),
        expiresAt: payload.expiresAt || null
      });
      console.log("[POS_DIAG] login.total (submit→redirect)", (performance.now() - tStart).toFixed(2) + "ms");
      window.location.replace("/pos");
    } catch (error) {
      var code = (error && error.code) || "";
      if (code === "failed-precondition" || code === "functions/failed-precondition") {
        setError("員工已停用");
      } else if (code === "unavailable" || code === "functions/unavailable") {
        setError("目前離線，無法進行新的登入");
      } else {
        setError("員工編號或 PIN 錯誤");
      }
    } finally {
      setSubmitting(false);
    }
  }
})();
