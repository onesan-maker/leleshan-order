(function () {
  var STATUS = { LOADING: "loading", OPEN: "open", CLOSED: "closed", UNKNOWN: "unknown" };
  var defaults = window.LELESHAN_DEFAULTS || {};

  var app = {
    STATUS: STATUS,
    defaults: defaults,
    state: {
      db: null,
      profile: null,
      storeId: (window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1",
      selectedFlavor: null,
      selectedOrderType: null,
      cart: [],
      submitting: false,
      storeOpenStatus: STATUS.LOADING,
      flavors: defaults.flavors || [],
      stapleOptions: defaults.stapleOptions || [],
      comboItems: defaults.comboTemplates || [],
      singleCategories: [],
      promotions: [],
      settings: null,
      appliedPromotion: null,
      dataSourceSummary: null,
      pickupDateOptions: [],
      pickupTimeOptions: [],
      pickupDateLabel: "",
      pickupDateValue: "",
      pickupTime: "",
      storeClosedModalShown: false,
      pendingCheckoutRestored: false,
      activeModal: null,
      pendingCartSelection: null
    },
    el: {},
    modules: {}
  };

  document.addEventListener("DOMContentLoaded", function () {
    initializeModules();
    bindEvents();
    initFlow();
  });

  function initializeModules() {
    window.LeLeShanUI.init(app);
    window.LeLeShanCart.init(app);
    window.LeLeShanAuth.init(app);
    window.LeLeShanCheckout.init(app);
    if (window.LeLeShanMember) window.LeLeShanMember.init(app);
    app.modules.ui = window.LeLeShanUI;
    app.modules.ui.updateStoreStatusUI(app, STATUS.LOADING);
    app.modules.ui.renderProfile(app);
    app.modules.ui.syncControls(app);
  }

  function bindEvents() {
    if (app.el.orderForm) {
      app.el.orderForm.addEventListener("submit", function (event) {
        app.modules.checkout.handleSubmit(event);
      });
    }
    if (app.el.submitBtn) {
      app.el.submitBtn.addEventListener("click", function () {
        if (!app.el.orderForm) return;
        if (typeof app.el.orderForm.requestSubmit === "function") app.el.orderForm.requestSubmit();
        else app.el.orderForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      });
    }
    if (app.el.pickupDate) {
      app.el.pickupDate.addEventListener("change", function () {
        app.state.pickupDateValue = app.el.pickupDate.value;
        app.state.pickupDateLabel = app.el.pickupDate.options[app.el.pickupDate.selectedIndex] ? app.el.pickupDate.options[app.el.pickupDate.selectedIndex].text : "";
        app.modules.ui.renderPickupTimeOptions(app);
        app.modules.checkout.saveCheckoutDraftState();
      });
    }
    if (app.el.pickupTime) {
      app.el.pickupTime.addEventListener("change", function () {
        app.state.pickupTime = app.el.pickupTime.value;
        app.modules.checkout.saveCheckoutDraftState();
      });
    }
    if (app.el.customerName) app.el.customerName.addEventListener("input", function () { app.modules.checkout.saveCheckoutDraftState(); });
    if (app.el.orderNote) app.el.orderNote.addEventListener("input", function () { app.modules.checkout.saveCheckoutDraftState(); });
    if (app.el.storeStatusModalClose) app.el.storeStatusModalClose.addEventListener("click", function () { app.modules.ui.closeStoreStatusModal(app); });
    if (app.el.loginRequiredConfirm) app.el.loginRequiredConfirm.addEventListener("click", function () { app.modules.auth.proceedLineLogin(); });
    if (app.el.loginRequiredCancel) app.el.loginRequiredCancel.addEventListener("click", function () { app.modules.ui.closeLoginRequiredModal(app); });
    if (app.el.quantityModalConfirm) app.el.quantityModalConfirm.addEventListener("click", function () { app.modules.ui.closeQuantityModal(app); });
    if (app.el.viewCartBtnSticky) app.el.viewCartBtnSticky.addEventListener("click", function () { app.modules.ui.scrollToCartList(app); });
    if (app.el.logoutBtn) app.el.logoutBtn.addEventListener("click", function () { app.modules.auth.logout(); });
    app.modules.ui.bindModalDismiss(app, app.el.storeStatusModal, app.modules.ui.closeStoreStatusModal);
    app.modules.ui.bindModalDismiss(app, app.el.loginRequiredModal, app.modules.ui.closeLoginRequiredModal);
    app.modules.ui.bindModalDismiss(app, app.el.quantityModal, app.modules.ui.closeQuantityModal);
    document.addEventListener("keydown", function (event) {
      app.modules.ui.handleDocumentKeydown(app, event);
    });
  }

  async function initFlow() {
    try {
      initFirebase();
      await app.modules.ui.loadStoreData(app);
    } catch (error) {
      console.error("[Front] Failed to load Firestore menu data.", error);
      app.modules.ui.setMessage(app, "目前資料載入失敗：" + detail(error), "error");
    }

    await app.modules.ui.checkStoreOpenStatus(app);
    app.modules.checkout.initializePickupSelection();
    app.modules.ui.renderAll(app);
    var pending = window.LeLeShanStorage.loadPendingCheckoutState();
    if (window.LeLeShanStorage.isPendingCheckoutExpired(pending.timestamp)) {
      window.LeLeShanStorage.clearPendingCheckoutState();
      pending = { cart: null, form: null, returnTo: null, timestamp: 0 };
    }
    app.modules.checkout.restoreCheckoutDraftState();

    var loggedIn = await app.modules.auth.initLiff();
    if (loggedIn) app.modules.checkout.restorePendingCheckoutState();
  }

  function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    app.state.db = firebase.firestore();
    console.log("[Firestore] Firebase app initialized.", { projectId: window.APP_CONFIG.firebaseConfig.projectId });
    console.log("[Firestore] Firestore initialized.", { projectId: window.APP_CONFIG.firebaseConfig.projectId, collection: "orders" });
  }

  function detail(error) {
    return error && (error.message || error.code || String(error)) || "未知錯誤";
  }
})();
