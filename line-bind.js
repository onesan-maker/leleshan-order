(function () {
  var statusEl = document.getElementById("bind-status");
  var nameEl = document.getElementById("bind-name");
  var closeEl = document.getElementById("bind-close-hint");

  function setStatus(text, type) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "bind-status bind-status--" + (type || "loading");
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch (e) { return ""; }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var token = getParam("token");
    if (!token) {
      setStatus("❌ 連結無效：缺少綁定碼，請重新掃描", "error");
      return;
    }

    var cfg = window.APP_CONFIG;
    if (!cfg || !cfg.liffId || !cfg.firebaseConfig) {
      setStatus("❌ 系統設定錯誤，請聯絡管理員", "error");
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
    var functionsApi = firebase.app().functions((window.APP_CONFIG && window.APP_CONFIG.functionsRegion) || "us-central1");

    try {
      setStatus("正在初始化 LINE 登入...", "loading");
      await liff.init({ liffId: cfg.liffId });

      if (!liff.isLoggedIn()) {
        setStatus("正在跳轉 LINE 登入頁...", "loading");
        liff.login({ redirectUri: window.location.href });
        return;
      }

      setStatus("正在取得 LINE 帳號...", "loading");
      var profile = await liff.getProfile();
      var lineUserId = profile.userId;
      var displayName = profile.displayName || "未命名";

      if (nameEl) {
        nameEl.textContent = "LINE 帳號：" + displayName;
        nameEl.classList.remove("hidden");
      }

      setStatus("正在完成綁定...", "loading");
      var completeBinding = functionsApi.httpsCallable("completeLineBinding");
      var result = await completeBinding({ token: token, lineUserId: lineUserId });

      if (result.data && result.data.ok) {
        var tgt = (result.data.targetName || "").trim();
        setStatus("✅ 綁定成功！" + (tgt ? " 帳號 " + tgt + " 已綁定您的 LINE" : ""), "success");
        if (closeEl) {
          closeEl.textContent = "您可以關閉此視窗";
          closeEl.classList.remove("hidden");
        }
        setTimeout(function () {
          try { if (liff.isInClient()) liff.closeWindow(); } catch (e) {}
        }, 2500);
      } else {
        setStatus("❌ 綁定失敗，請重試", "error");
      }
    } catch (error) {
      console.error("[LineBind]", error);
      var code = (error && error.code) || "";
      var msg = (error && error.message) || "未知錯誤";
      if (code === "functions/deadline-exceeded" || msg.indexOf("過期") >= 0) {
        setStatus("⏰ 綁定碼已過期，請請管理員重新產生 QR Code", "expired");
      } else if (code === "functions/failed-precondition" || msg.indexOf("已使用") >= 0) {
        setStatus("❌ 此綁定碼已使用，請管理員重新產生 QR Code", "error");
      } else if (code === "functions/not-found") {
        setStatus("❌ 綁定碼無效，請管理員重新產生 QR Code", "error");
      } else {
        setStatus("❌ 綁定失敗：" + msg, "error");
      }
    }
  });
})();
