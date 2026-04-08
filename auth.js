(function () {
  function init(app) {
    app.modules.auth = api(app);
  }

  function api(app) {
    return {
      initLiff: function () { return initLiff(app); },
      proceedLineLogin: function () { return proceedLineLogin(app); },
      logout: function () { return logout(app); }
    };
  }

  async function initLiff(app) {
    if (!window.liff || !window.APP_CONFIG.liffId) {
      app.modules.ui.renderProfile(app);
      return false;
    }

    try {
      await liff.init({ liffId: window.APP_CONFIG.liffId });
      if (!liff.isLoggedIn()) {
        app.state.profile = null;
        app.modules.ui.renderProfile(app);
        return false;
      }

      app.state.profile = await liff.getProfile();
      if (app.el.customerName && !app.el.customerName.value.trim()) {
        app.el.customerName.value = app.state.profile.displayName || "";
      }
      app.modules.ui.renderProfile(app);
      app.modules.checkout.saveCheckoutDraftState();
      console.log("[LIFF] Profile loaded.", app.state.profile);
      return true;
    } catch (error) {
      console.error("[LIFF] Initialization failed.", error);
      app.state.profile = null;
      if (app.el.profileName) app.el.profileName.textContent = "初始化失敗";
      if (app.el.profileMeta) app.el.profileMeta.textContent = "請確認 LIFF Endpoint 與 LIFF ID 設定";
      return false;
    }
  }

  function proceedLineLogin(app) {
    if (!window.liff) {
      app.modules.ui.setMessage(app, "LIFF SDK 尚未載入，請稍後再試。", "error");
      app.modules.ui.closeLoginRequiredModal(app);
      return;
    }
    if (liff.isLoggedIn()) {
      app.modules.ui.closeLoginRequiredModal(app);
      return;
    }

    app.modules.checkout.savePendingCheckoutState();
    app.modules.ui.closeLoginRequiredModal(app);
    console.log("[LIFF] Redirecting customer to LINE login.");
    liff.login({ redirectUri: window.location.href });
  }

  function logout(app) {
    try {
      if (window.liff && typeof liff.logout === "function" && liff.isLoggedIn()) {
        liff.logout();
      }
    } catch (error) {
      console.error("[LIFF] Logout failed.", error);
    }

    app.state.profile = null;
    if (app.el.customerName && !app.el.customerName.value.trim()) {
      app.el.customerName.value = "";
    }
    app.modules.ui.renderProfile(app);
    app.modules.ui.setMessage(app, "已登出 LINE。", "success");
    console.log("[LIFF] User logged out and UI reset. Cart preserved.");
  }

  window.LeLeShanAuth = { init: init };
})();
