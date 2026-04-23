(function () {
  var form;
  var idInput;
  var pinInput;
  var submitBtn;
  var errorEl;
  var plFields;
  var plActiveField = "id"; // "id" or "pin"

  document.addEventListener("DOMContentLoaded", function () {
    form      = document.getElementById("pos-login-form");
    idInput   = document.getElementById("employee-id");
    pinInput  = document.getElementById("employee-pin");
    submitBtn = document.getElementById("pos-login-submit");
    errorEl   = document.getElementById("pos-login-error");
    plFields  = document.getElementById("pl-fields");
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

    // --- Numpad ---
    pl_setActiveField("id"); // highlight employee-id on load

    document.querySelectorAll(".pl-key[data-digit]").forEach(function (key) {
      key.addEventListener("click", function () {
        var digit = key.getAttribute("data-digit");
        if (plActiveField === "id") {
          if (idInput.value.length < 3) {
            idInput.value += digit;
            if (idInput.value.length === 3) pl_setActiveField("pin");
          }
        } else {
          if (pinInput.value.length < 4) {
            pinInput.value += digit;
          }
        }
      });
    });

    var keyDel = document.getElementById("pl-key-del");
    keyDel && keyDel.addEventListener("click", function () {
      if (plActiveField === "pin") {
        if (pinInput.value.length > 0) {
          pinInput.value = pinInput.value.slice(0, -1);
        } else {
          pl_setActiveField("id");
        }
      } else {
        idInput.value = idInput.value.slice(0, -1);
      }
    });

    var keyConfirm = document.getElementById("pl-key-confirm");
    keyConfirm && keyConfirm.addEventListener("click", function () {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    });

    // Tap field to switch focus
    idInput  && idInput.addEventListener("click", function () { pl_setActiveField("id"); });
    pinInput && pinInput.addEventListener("click", function () { pl_setActiveField("pin"); });
  });

  function pl_setActiveField(field) {
    plActiveField = field;
    if (idInput)  idInput.style.borderColor  = field === "id"  ? "var(--pl-accent)" : "";
    if (pinInput) pinInput.style.borderColor = field === "pin" ? "var(--pl-accent)" : "";
    if (idInput)  idInput.style.boxShadow    = field === "id"  ? "0 0 0 3px rgba(249,115,22,.18)" : "";
    if (pinInput) pinInput.style.boxShadow   = field === "pin" ? "0 0 0 3px rgba(249,115,22,.18)" : "";
  }

  function setError(message) {
    if (!errorEl) return;
    if (!message) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
    // Shake the input fields
    if (plFields) {
      plFields.classList.remove("pl-shake");
      void plFields.offsetWidth; // force reflow to restart animation
      plFields.classList.add("pl-shake");
    }
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
      var login = firebase.app().functions((window.APP_CONFIG && window.APP_CONFIG.functionsRegion) || "us-central1").httpsCallable("posEmployeeLogin");
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
