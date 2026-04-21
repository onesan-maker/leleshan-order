(function () {
  console.time("POS_PAGE_LOAD");
  window.addEventListener("load", function () {
    console.timeEnd("POS_PAGE_LOAD");
  });

  var diag = {
    timers: {},
    durations: {
      pageLoad: null,
      firebaseInit: null,
      fetchData: null,
      renderUI: null
    },
    itemCount: {
      menuItems: 0,
      combos: 0,
      categories: 0,
      todaysOrders: 0
    },
    firestoreRequestCount: 0,
    firestoreRequests: [],
    onSnapshotRegistered: 0,
    onSnapshotTriggered: 0
  };

  function diagStart(key) {
    diag.timers[key] = performance.now();
  }

  function diagEnd(key) {
    if (typeof diag.timers[key] !== "number") return;
    var elapsed = performance.now() - diag.timers[key];
    delete diag.timers[key];
    diag.durations[key] = elapsed;
    console.log("[POS_DIAG]", key, elapsed.toFixed(2) + "ms");
  }

  function diagReport() {
    console.log("=== POS 效能診斷 ===");
    console.log({
      pageLoad: diag.durations.pageLoad == null ? "pending" : diag.durations.pageLoad.toFixed(2) + "ms",
      firebaseInit: diag.durations.firebaseInit == null ? "n/a" : diag.durations.firebaseInit.toFixed(2) + "ms",
      fetchData: diag.durations.fetchData == null ? "n/a" : diag.durations.fetchData.toFixed(2) + "ms",
      renderUI: diag.durations.renderUI == null ? "n/a" : diag.durations.renderUI.toFixed(2) + "ms",
      itemCount: {
        menuItems: diag.itemCount.menuItems,
        combos: diag.itemCount.combos,
        categories: diag.itemCount.categories,
        todaysOrders: diag.itemCount.todaysOrders
      },
      firestoreRequests: diag.firestoreRequestCount,
      onSnapshot: {
        registered: diag.onSnapshotRegistered,
        triggered: diag.onSnapshotTriggered
      }
    });
  }

  function installSnapshotDiagnostics() {
    try {
      var proto = firebase && firebase.firestore && firebase.firestore.Query && firebase.firestore.Query.prototype;
      if (!proto || proto.__posDiagWrapped) return;
      var original = proto.onSnapshot;
      if (typeof original !== "function") return;
      proto.onSnapshot = function () {
        diag.onSnapshotRegistered += 1;
        console.log("[POS_DIAG] onSnapshot registered");
        var args = Array.prototype.slice.call(arguments);
        if (typeof args[0] === "function") {
          var next = args[0];
          args[0] = function () {
            diag.onSnapshotTriggered += 1;
            console.log("onSnapshot triggered");
            return next.apply(this, arguments);
          };
        } else if (typeof args[1] === "function") {
          var nextWithOptions = args[1];
          args[1] = function () {
            diag.onSnapshotTriggered += 1;
            console.log("onSnapshot triggered");
            return nextWithOptions.apply(this, arguments);
          };
        }
        return original.apply(this, args);
      };
      proto.__posDiagWrapped = true;
    } catch (error) {
      console.warn("[POS_DIAG] snapshot diagnostics install failed.", error);
    }
  }

  window.addEventListener("load", function () {
    var nav = performance.getEntriesByType("navigation")[0];
    if (nav && typeof nav.duration === "number") {
      diag.durations.pageLoad = nav.duration;
    }
    diagReport();
  });

  // ── POS 現場點餐 ──────────────────────────────────────────────
  // source = "pos"；不需要 LIFF SDK
  // 功能：新建訂單 / 今日訂單列表 / 查看詳情 / 追加既有訂單

  var DEFAULT_STORE_ID = (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1";

  var SOURCE_LABEL_MAP = {
    liff: "LIFF", pos: "POS", manual: "手動", onsite: "現場",
    ubereats: "UberEats", foodpanda: "Foodpanda"
  };
  var STATUS_LABEL_MAP = {
    new: "製作中",
    accepted: "製作中",
    preparing: "製作中",
    ready: "可取餐",
    completed: "已完成",
    picked_up: "已取餐",
    cancelled: "已取消",
    unknown: "未知"
  };
  var POS_RULE_TYPE_DEFAULTS = [
    { code: "set", label: "套餐", flavorMode: "required", stapleMode: "required", allowAssignPart: true, enabled: true },
    { code: "addon", label: "單點", flavorMode: "inherit", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "staple_rice", label: "白飯類", flavorMode: "none", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "staple_noodle", label: "麵類主食", flavorMode: "inherit", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "drink", label: "飲料", flavorMode: "none", stapleMode: "none", allowAssignPart: false, enabled: true },
    { code: "other", label: "其他", flavorMode: "none", stapleMode: "none", allowAssignPart: true, enabled: true }
  ];
  var POS_RULE_GLOBAL_DEFAULTS = {
    enableAssignDifferentPeople: true,
    singleFlavorPerPart: true,
    setUpdatesPartFlavor: true,
    noodleRequiresFlavorIfPartMissing: true
  };
  var state = {
    storeId:           DEFAULT_STORE_ID,
    context:           null,
    session:           null,
    booted:            false,
    cart:              [],   // [{ itemId, name, unitPrice, qty, type, categoryName }]
    menu:              [],   // 所有菜單品項（flat list, posVisible / isSoldOut 過濾後）
    combos:            [],   // 套餐
    globalOptions:     { flavors: [], staples: [] },
    posRules:          null,
    activePartId:      "part_1",
    partOrder:         ["part_1"],
    partContexts:      {},
    pendingAssignTargetPartId: "",
    assignTargetPartId: "",
    inlineAssignVisible: false,
    submitting:        false,
    pendingSpecSelection: null,
    appendTargetOrder: null, // 追加模式：目標訂單
    todaysOrders:      [],   // 今日訂單快取
    searchQuery:       "",
    selectedPaymentMethod: "",
    selectedSource:        "walk_in"
  };

  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    bindTabs();
    initPosSessionAuth();
  });

  // ── DOM cache ─────────────────────────────────────────────────

  function cache() {
    el.loading           = document.getElementById("auth-loading");
    el.error             = document.getElementById("auth-error");
    el.storeMeta         = document.getElementById("ops-store-meta");
    el.userMeta          = document.getElementById("ops-user-meta");
    el.offlineHint       = document.getElementById("pos-offline-hint");
    el.logoutBtn         = document.getElementById("pos-logout-btn");
    el.switchBtn         = document.getElementById("pos-switch-btn");
    el.switchModal       = document.getElementById("pos-switch-modal");
    el.switchClose       = document.getElementById("pos-switch-close");
    el.switchCancel      = document.getElementById("pos-switch-cancel");
    el.switchConfirm     = document.getElementById("pos-switch-confirm");
    el.switchEmpId       = document.getElementById("pos-switch-empid");
    el.switchPin         = document.getElementById("pos-switch-pin");
    el.switchError       = document.getElementById("pos-switch-error");
    el.dutyBadge         = document.getElementById("pos-duty-badge");
    el.dutyText          = document.getElementById("pos-duty-text");
    el.menuLoading       = document.getElementById("pos-menu-loading");
    el.menuRoot          = document.getElementById("pos-menu-root");
    el.partList          = document.getElementById("pos-part-list");
    el.partHint          = document.getElementById("pos-part-hint");
    el.addPartBtn        = document.getElementById("pos-add-part-btn");
    el.assignToggleBtn   = document.getElementById("pos-assign-toggle-btn");
    el.assignInline      = document.getElementById("pos-assign-inline");
    el.assignTargetChips = document.getElementById("pos-assign-target-chips");
    el.assignTarget      = document.getElementById("pos-assign-target"); // may be null now
    el.assignConfirm     = document.getElementById("pos-assign-confirm");
    el.assignCancel      = document.getElementById("pos-assign-cancel");
    el.cartTitle         = document.getElementById("pos-cart-title");
    el.cartItems         = document.getElementById("pos-cart-items");
    el.cartTotal         = document.getElementById("pos-cart-total");
    el.checkoutPanel     = document.getElementById("pos-checkout");
    el.checkoutTotal     = document.getElementById("pos-checkout-total");
    el.paymentCashBtn    = document.getElementById("pos-payment-cash");
    el.paymentLinePayBtn = document.getElementById("pos-payment-linepay");
    el.sourceWalkInBtn   = document.getElementById("pos-source-walkin");
    el.sourcePhoneBtn    = document.getElementById("pos-source-phone");
    el.cartFields        = document.getElementById("pos-cart-fields");
    el.customerName      = document.getElementById("pos-customer-name");
    el.lineUserId        = document.getElementById("pos-line-user-id");
    el.pickupTime        = document.getElementById("pos-pickup-time");
    el.note              = document.getElementById("pos-note");
    el.submitBtn         = document.getElementById("pos-submit-btn");
    el.status            = document.getElementById("pos-status");
    el.appendBanner      = document.getElementById("pos-append-banner");
    el.appendBannerText  = document.getElementById("pos-append-banner-text");
    el.appendCancelBtn   = document.getElementById("pos-append-cancel-btn");
    el.ordersList        = document.getElementById("pos-orders-list");
    el.ordersSearch      = document.getElementById("pos-orders-search");
    el.ordersRefresh     = document.getElementById("pos-orders-refresh");
    el.detailOverlay     = document.getElementById("pos-detail-overlay");
    el.detailTitle       = document.getElementById("pos-detail-title");
    el.detailMeta        = document.getElementById("pos-detail-meta");
    el.detailItems       = document.getElementById("pos-detail-items");
    el.detailTotal       = document.getElementById("pos-detail-total");
    el.detailNote        = document.getElementById("pos-detail-note");
    el.detailClose       = document.getElementById("pos-detail-close");
    el.detailClose2      = document.getElementById("pos-detail-close2");
    el.detailAppendBtn   = document.getElementById("pos-detail-append-btn");
    el.specOverlay       = document.getElementById("pos-spec-overlay");
    el.specTitle         = document.getElementById("pos-spec-title");
    el.specSub           = document.querySelector(".pos-spec-sub");
    el.specFlavorGroup   = document.getElementById("pos-spec-flavor-group");
    el.specFlavorOptions = document.getElementById("pos-spec-flavor-options");
    el.specStapleGroup   = document.getElementById("pos-spec-staple-group");
    el.specStapleOptions = document.getElementById("pos-spec-staple-options");
    el.specAssignGroup   = document.getElementById("pos-spec-assign-group");
    el.specAssignCurrent = document.getElementById("pos-spec-assign-current");
    el.specAssignOther   = document.getElementById("pos-spec-assign-other");
    el.specAssignTarget  = document.getElementById("pos-spec-assign-target");
    el.specError         = document.getElementById("pos-spec-error");
    el.specCloseTop      = document.getElementById("pos-spec-close-top");
    el.specCancel        = document.getElementById("pos-spec-cancel");
    el.specConfirm       = document.getElementById("pos-spec-confirm");
  }

  // ── Tab switching ─────────────────────────────────────────────

  function bindTabs() {
    document.querySelectorAll(".pos-tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".pos-tab-btn").forEach(function (b) { b.classList.remove("is-active"); });
        document.querySelectorAll(".pos-tab-content").forEach(function (c) { c.classList.remove("is-active"); });
        btn.classList.add("is-active");
        document.getElementById("pos-tab-" + tab).classList.add("is-active");
        if (tab === "orders" && state.context) {
          loadTodaysOrders();
          startOrdersAutoRefresh();
        } else {
          stopOrdersAutoRefresh();
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────

  function redirectToPosLogin() {
    window.location.replace("/pos-login");
  }

  function setAuthError(message) {
    if (!el.error) return;
    if (!message) {
      el.error.textContent = "";
      el.error.classList.add("hidden");
      return;
    }
    el.error.textContent = message;
    el.error.classList.remove("hidden");
  }

  function updateOfflineHint() {
    if (!el.offlineHint) return;
    el.offlineHint.classList.toggle("hidden", navigator.onLine);
  }

  function buildContextFromSession(session) {
    return {
      db: firebase.firestore(),
      user: { uid: "emp:" + session.employeeId, email: "" },
      admin: { name: session.employeeName, role: "employee", storeId: session.storeId },
      storeId: session.storeId
    };
  }

  async function verifySessionOnline(session) {
    var callable = firebase.app().functions("us-central1").httpsCallable("verifyPosSession");
    var res = await callable({
      employeeId: session.employeeId,
      sessionToken: session.sessionToken
    });
    return (res && res.data) || null;
  }

  async function initPosSessionAuth() {
    if (!window.LeLeShanPosSession) {
      setAuthError("POS session 模組載入失敗");
      return;
    }
    diagStart("firebaseInit");
    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }
    installSnapshotDiagnostics();
    diagEnd("firebaseInit");
    var session = window.LeLeShanPosSession.get();
    if (!window.LeLeShanPosSession.isValid(session)) {
      window.LeLeShanPosSession.clear();
      redirectToPosLogin();
      return;
    }
    state.session = session;
    updateOfflineHint();
    window.addEventListener("online", updateOfflineHint);
    window.addEventListener("offline", updateOfflineHint);

    if (navigator.onLine) {
      try {
        var verified = await verifySessionOnline(session);
        if (verified && verified.employeeId) {
          session.employeeName = verified.employeeName || session.employeeName;
          session.storeId = verified.storeId || session.storeId;
          session.loginAt = verified.loginAt || session.loginAt;
          session.expiresAt = verified.expiresAt || session.expiresAt || null;
          window.LeLeShanPosSession.save(session);
          state.session = session;
        }
      } catch (error) {
        var message = (error && error.message) || "";
        if (message.indexOf("unauthenticated") >= 0 || message.indexOf("permission-denied") >= 0 || message.indexOf("session") >= 0) {
          window.LeLeShanPosSession.clear();
          redirectToPosLogin();
          return;
        }
      }
    }

    el.loading.classList.add("hidden");
    start(buildContextFromSession(state.session));
  }

  async function start(context) {
    if (state.booted) return;
    state.booted = true;
    state.storeId = context.storeId || DEFAULT_STORE_ID;
    state.context = context;
    resetPartContexts();
    el.storeMeta.textContent = "門市：" + state.storeId;
    el.userMeta.textContent  = "員工：" + (state.session && state.session.employeeName || context.admin.name || "") + " (" + (state.session && state.session.employeeId || "") + ")";

    await loadMenu(context.db);
    renderPartBar();
    el.submitBtn.disabled = false;
    el.submitBtn.addEventListener("click", handleSubmit);
    if (el.paymentCashBtn) {
      el.paymentCashBtn.addEventListener("click", function () {
        setPaymentMethod("cash");
      });
    }
    if (el.paymentLinePayBtn) {
      el.paymentLinePayBtn.addEventListener("click", function () {
        setPaymentMethod("linepay");
      });
    }
    if (el.sourceWalkInBtn) el.sourceWalkInBtn.addEventListener("click", function () { setSource("walk_in"); });
    if (el.sourcePhoneBtn)  el.sourcePhoneBtn.addEventListener("click",  function () { setSource("phone"); });
    setSource("walk_in"); // default selection on boot
    el.cartItems.addEventListener("click", onCartClick);
    el.appendCancelBtn.addEventListener("click", exitAppendMode);
    el.ordersRefresh.addEventListener("click", loadTodaysOrders);
    el.ordersSearch.addEventListener("input", function () {
      state.searchQuery = this.value.trim().toLowerCase();
      renderOrdersList();
    });
    el.detailClose.addEventListener("click", closeDetailOverlay);
    el.detailClose2.addEventListener("click", closeDetailOverlay);
    if (el.specCloseTop) el.specCloseTop.addEventListener("click", closeSpecModal);
    if (el.specCancel) el.specCancel.addEventListener("click", closeSpecModal);
    if (el.specConfirm) el.specConfirm.addEventListener("click", confirmSpecSelection);
    if (el.partList) {
      el.partList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-part-id]");
        if (!btn) return;
        setActivePart(btn.getAttribute("data-part-id"));
      });
    }
    if (el.addPartBtn) {
      el.addPartBtn.addEventListener("click", function () {
        var id = createNewPart();
        setActivePart(id);
        showPartHint("已新增" + getPartLabel(id) + "，目前商品會加入此組。");
      });
    }
    if (el.assignToggleBtn) {
      el.assignToggleBtn.addEventListener("click", function () {
        if (getPosRules().global.enableAssignDifferentPeople !== true) {
          showStatus("目前規則未啟用「分給不同人」，請在後台 POS 規則設定中啟用。", "err");
          return;
        }
        setInlineAssignVisible(!state.inlineAssignVisible);
        if (state.inlineAssignVisible) {
          // Pre-select current active part or existing pending target
          state.assignTargetPartId = state.pendingAssignTargetPartId || state.activePartId;
          renderAssignTargetChips(state.assignTargetPartId);
        } else {
          state.assignTargetPartId = "";
          showPartHint("");
        }
      });
    }
    if (el.assignTargetChips) {
      el.assignTargetChips.addEventListener("click", function (event) {
        var chip = event.target.closest("[data-assign-target]");
        if (!chip) return;
        var val = chip.getAttribute("data-assign-target");
        if (val === "__new__") {
          var newId = createNewPart();
          state.assignTargetPartId = newId;
        } else {
          state.assignTargetPartId = val;
        }
        renderAssignTargetChips(state.assignTargetPartId);
      });
    }
    if (el.assignConfirm) {
      el.assignConfirm.addEventListener("click", function () {
        var target = resolveSelectedTargetPart();
        state.pendingAssignTargetPartId = target;
        state.assignTargetPartId = "";
        setInlineAssignVisible(false);
        renderPartBar();
        showPartHint("下一個品項將套用到：" + getPartLabel(target) + "｜" + getPartSummary(target));
      });
    }
    if (el.assignCancel) {
      el.assignCancel.addEventListener("click", function () {
        state.pendingAssignTargetPartId = "";
        state.assignTargetPartId = "";
        setInlineAssignVisible(false);
        showPartHint("");
        renderPartBar();
      });
    }
    if (el.specAssignCurrent) {
      el.specAssignCurrent.addEventListener("click", function () {
        if (!state.pendingSpecSelection) return;
        state.pendingSpecSelection.assignMode = "current";
        renderSpecAssignState(state.pendingSpecSelection);
      });
    }
    if (el.specAssignOther) {
      el.specAssignOther.addEventListener("click", function () {
        if (!state.pendingSpecSelection) return;
        state.pendingSpecSelection.assignMode = "other";
        renderSpecAssignState(state.pendingSpecSelection);
      });
    }
    if (el.specOverlay) {
      el.specOverlay.addEventListener("click", function (event) {
        if (event.target === el.specOverlay) closeSpecModal();
      });
    }
    if (el.specFlavorOptions) {
      el.specFlavorOptions.addEventListener("click", function (event) {
        handleOptionCardClick(el.specFlavorOptions, event);
      });
    }
    if (el.specStapleOptions) {
      el.specStapleOptions.addEventListener("click", function (event) {
        handleOptionCardClick(el.specStapleOptions, event);
      });
    }
    el.detailAppendBtn.addEventListener("click", function () {
      if (!state.detailCurrentOrder) return;
      startAppendMode(state.detailCurrentOrder);
    });
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener("click", handleLogout);
    }
    bindSwitchEmployee();
    updateDutyBadge(state.session);
    // 只在首次使用此 sessionToken 時寫 login shift log，避免頁面重整重複紀錄
    var LOGIN_LOG_KEY = "leleshan_pos_login_log_for_token";
    var loggedToken = null;
    try { loggedToken = localStorage.getItem(LOGIN_LOG_KEY); } catch(_) {}
    var shouldLogLogin = state.session && state.session.sessionToken && loggedToken !== state.session.sessionToken;
    publishCurrentSession(shouldLogLogin ? "login" : "resume")
      .catch(function (e) { console.warn("[POS] publish session failed", e); });
    if (shouldLogLogin) {
      writeShiftLog("login", state.session, null);
      try { localStorage.setItem(LOGIN_LOG_KEY, state.session.sessionToken); } catch(_) {}
    }
  }

  // ── 當班 session 同步到 store_runtime（KDS 讀取同份資料）────
  async function publishCurrentSession(lastAction) {
    if (!state.session || !window.LeLeShanOpsSession) return;
    var db = firebase.firestore();
    try {
      await window.LeLeShanOpsSession.writeSession(db, state.session.storeId, {
        employeeId: state.session.employeeId,
        employeeName: state.session.employeeName,
        role: "staff"
      }, { source: "pos", lastAction: lastAction || "login" });
    } catch (e) {
      console.warn("[POS] writeSession failed", e);
    }
  }

  function writeShiftLog(type, current, previous) {
    if (!window.LeLeShanOpsSession) return;
    var db = firebase.firestore();
    window.LeLeShanOpsSession.writeShiftLog(db, {
      type: type,
      employeeId: (current && current.employeeId) || "",
      employeeName: (current && current.employeeName) || "",
      previousEmployeeId: (previous && previous.employeeId) || null,
      previousEmployeeName: (previous && previous.employeeName) || null,
      storeId: (current && current.storeId) || (previous && previous.storeId) || state.storeId,
      triggeredBy: "pos"
    });
  }

  function updateDutyBadge(session) {
    if (!el.dutyBadge || !el.dutyText) return;
    if (session && session.employeeName) {
      el.dutyBadge.style.display = "";
      el.dutyText.textContent = "目前值班：" + session.employeeName + " (" + session.employeeId + ")";
    } else {
      el.dutyBadge.style.display = "none";
    }
  }

  function bindSwitchEmployee() {
    if (!el.switchBtn) return;
    el.switchBtn.addEventListener("click", openSwitchModal);
    if (el.switchClose)  el.switchClose.addEventListener("click", closeSwitchModal);
    if (el.switchCancel) el.switchCancel.addEventListener("click", closeSwitchModal);
    if (el.switchConfirm) el.switchConfirm.addEventListener("click", submitSwitchEmployee);
    if (el.switchModal) {
      el.switchModal.addEventListener("click", function (ev) {
        if (ev.target === el.switchModal) closeSwitchModal();
      });
    }
  }

  function openSwitchModal() {
    if (!el.switchModal) return;
    el.switchModal.hidden = false;
    el.switchModal.style.display = "flex";
    if (el.switchEmpId) el.switchEmpId.value = "";
    if (el.switchPin)   el.switchPin.value = "";
    if (el.switchError) { el.switchError.textContent = ""; el.switchError.classList.add("hidden"); }
    setTimeout(function () { if (el.switchEmpId) el.switchEmpId.focus(); }, 50);
  }

  function closeSwitchModal() {
    if (!el.switchModal) return;
    el.switchModal.hidden = true;
    el.switchModal.style.display = "none";
  }

  function setSwitchError(msg) {
    if (!el.switchError) return;
    if (!msg) { el.switchError.textContent = ""; el.switchError.classList.add("hidden"); return; }
    el.switchError.textContent = msg;
    el.switchError.classList.remove("hidden");
  }

  async function submitSwitchEmployee() {
    setSwitchError("");
    var empId = String((el.switchEmpId && el.switchEmpId.value) || "").trim();
    var pin   = String((el.switchPin && el.switchPin.value) || "").trim();
    if (!/^\d{3}$/.test(empId)) { setSwitchError("員工編號需為3位數字"); return; }
    if (!/^\d{4}$/.test(pin))   { setSwitchError("PIN 需為4位數字"); return; }
    if (!navigator.onLine)       { setSwitchError("目前離線，無法切換員工"); return; }
    if (state.session && state.session.employeeId === empId) {
      setSwitchError("已經是目前值班員工");
      return;
    }
    if (el.switchConfirm) { el.switchConfirm.disabled = true; el.switchConfirm.textContent = "驗證中..."; }
    try {
      var login = firebase.app().functions("us-central1").httpsCallable("posEmployeeLogin");
      var result = await login({ employeeId: empId, pin: pin, sessionHours: 16 });
      var payload = (result && result.data) || {};
      if (!payload || !payload.sessionToken) throw new Error("SWITCH_FAILED");

      var previous = state.session ? {
        employeeId: state.session.employeeId,
        employeeName: state.session.employeeName,
        storeId: state.session.storeId
      } : null;

      // 先請舊的 session 在後端失效（best-effort）
      if (previous && previous.employeeId) {
        try {
          var oldToken = state.session && state.session.sessionToken;
          if (oldToken) {
            var logoutCall = firebase.app().functions("us-central1").httpsCallable("logoutPosSession");
            await logoutCall({ sessionToken: oldToken });
          }
        } catch (e) { console.warn("[POS] old session logout on switch failed", e); }
      }

      var newSession = {
        employeeId: String(payload.employeeId || empId),
        employeeName: payload.employeeName,
        storeId: payload.storeId,
        sessionToken: payload.sessionToken,
        loginAt: payload.loginAt || new Date().toISOString(),
        expiresAt: payload.expiresAt || null
      };
      window.LeLeShanPosSession.save(newSession);
      state.session = newSession;

      // 更新 UI
      if (el.userMeta) {
        el.userMeta.textContent = "員工：" + newSession.employeeName + " (" + newSession.employeeId + ")";
      }
      updateDutyBadge(newSession);

      await publishCurrentSession("switch");
      writeShiftLog("switch", newSession, previous);

      closeSwitchModal();
    } catch (error) {
      console.error("[POS] switch failed", error);
      var code = (error && error.code) || "";
      if (code === "failed-precondition" || code === "functions/failed-precondition") {
        setSwitchError("員工已停用");
      } else if (code === "unavailable" || code === "functions/unavailable") {
        setSwitchError("目前離線，無法切換員工");
      } else {
        setSwitchError("員工編號或 PIN 錯誤");
      }
    } finally {
      if (el.switchConfirm) { el.switchConfirm.disabled = false; el.switchConfirm.textContent = "確認切換"; }
    }
  }

  async function handleLogout() {
    var tStart = performance.now();
    var session = window.LeLeShanPosSession && window.LeLeShanPosSession.get();
    if (session && navigator.onLine && firebase.apps.length) {
      try {
        var callable = firebase.app().functions("us-central1").httpsCallable("logoutPosSession");
        var t1 = performance.now();
        await callable({ sessionToken: session.sessionToken });
        console.log("[POS_DIAG] logout.callable logoutPosSession", (performance.now() - t1).toFixed(2) + "ms");
      } catch (error) {
        console.warn("[POS] logout session sync failed.", error);
      }
    }
    // 清除全店主 session，寫 shift log；KDS 會即時收到 sessionActive=false
    // 重要：此動作不能受前一步失敗影響，且必須在清 localStorage 之前完成，
    //       否則下次頁面若沒登入就不會再觸發這段。
    if (window.LeLeShanOpsSession && firebase.apps.length && session && session.storeId) {
      try {
        var t2 = performance.now();
        await window.LeLeShanOpsSession.clearSession(firebase.firestore(), session.storeId, "logout");
        console.log("[POS_DIAG] logout.clearSession", (performance.now() - t2).toFixed(2) + "ms");
        console.log("[POS] current_session cleared for store", session.storeId);
      } catch (e) {
        console.error("[POS] clearSession FAILED — 請確認 Firestore rules 已部署 store_runtime 規則", e);
        alert("登出時無法同步 KDS 值班狀態（可能 Firestore 規則未部署）。仍會登出本機。");
      }
      try {
        var t3 = performance.now();
        writeShiftLog("logout", session, null);
        console.log("[POS_DIAG] logout.writeShiftLog", (performance.now() - t3).toFixed(2) + "ms");
      } catch (e) { console.warn("[POS] logout shift log failed", e); }
    }
    try { localStorage.removeItem("leleshan_pos_login_log_for_token"); } catch(_) {}
    if (window.LeLeShanPosSession) {
      window.LeLeShanPosSession.clear();
    }
    console.log("[POS_DIAG] logout.total (click→redirect)", (performance.now() - tStart).toFixed(2) + "ms");
    redirectToPosLogin();
  }

  // ── 載入菜單（posVisible / isSoldOut 過濾）────────────────────

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizePosRules(raw) {
    var typeRules = POS_RULE_TYPE_DEFAULTS.map(function (def) {
      var source = raw && Array.isArray(raw.typeRules)
        ? raw.typeRules.find(function (row) { return normalizeText(row && row.code) === def.code; })
        : null;
      var flavorMode = normalizeText(source && source.flavorMode);
      var stapleMode = normalizeText(source && source.stapleMode);
      return {
        code: def.code,
        label: normalizeText(source && source.label) || def.label,
        flavorMode: ["required", "inherit", "none"].indexOf(flavorMode) >= 0 ? flavorMode : def.flavorMode,
        stapleMode: ["required", "none"].indexOf(stapleMode) >= 0 ? stapleMode : def.stapleMode,
        allowAssignPart: typeof (source && source.allowAssignPart) === "boolean" ? source.allowAssignPart : def.allowAssignPart,
        enabled: typeof (source && source.enabled) === "boolean" ? source.enabled : def.enabled
      };
    });
    var global = raw && raw.global ? raw.global : {};
    return {
      typeRules: typeRules,
      global: {
        enableAssignDifferentPeople: typeof global.enableAssignDifferentPeople === "boolean" ? global.enableAssignDifferentPeople : POS_RULE_GLOBAL_DEFAULTS.enableAssignDifferentPeople,
        singleFlavorPerPart: typeof global.singleFlavorPerPart === "boolean" ? global.singleFlavorPerPart : POS_RULE_GLOBAL_DEFAULTS.singleFlavorPerPart,
        setUpdatesPartFlavor: typeof global.setUpdatesPartFlavor === "boolean" ? global.setUpdatesPartFlavor : POS_RULE_GLOBAL_DEFAULTS.setUpdatesPartFlavor,
        noodleRequiresFlavorIfPartMissing: typeof global.noodleRequiresFlavorIfPartMissing === "boolean" ? global.noodleRequiresFlavorIfPartMissing : POS_RULE_GLOBAL_DEFAULTS.noodleRequiresFlavorIfPartMissing
      }
    };
  }

  function getPosRules() {
    if (!state.posRules) state.posRules = normalizePosRules(null);
    return state.posRules;
  }

  function inferPosType(product, fallbackType) {
    if (product && typeof product.posType === "string" && product.posType) return product.posType;
    if (fallbackType === "combo") return "set";
    var name = normalizeText(product && product.name);
    var category = normalizeText(product && (product.categoryId || product.category));
    var text = (name + " " + category).toLowerCase();
    if (text.indexOf("套餐") >= 0 || text.indexOf("combo") >= 0 || text.indexOf("set") >= 0) return "set";
    if (name.indexOf("白飯") >= 0) return "staple_rice";
    var noodleKeywords = ["泡麵", "寬粉", "冬粉", "王子麵", "烏龍麵", "意麵", "拉麵", "麵", "粉絲", "米粉"];
    if (noodleKeywords.some(function (keyword) { return name.indexOf(keyword) >= 0; })) return "staple_noodle";
    var drinkKeywords = ["飲料", "紅茶", "綠茶", "奶茶", "可樂", "雪碧", "汽水"];
    if (drinkKeywords.some(function (keyword) { return name.indexOf(keyword) >= 0 || category.indexOf(keyword) >= 0; })) return "drink";
    return "addon";
  }

  function getTypeRule(posType) {
    var rules = getPosRules();
    var normalizedType = normalizeText(posType) || "other";
    var exact = rules.typeRules.find(function (row) {
      return row && row.enabled !== false && row.code === normalizedType;
    });
    if (exact) return exact;
    var other = rules.typeRules.find(function (row) {
      return row && row.enabled !== false && row.code === "other";
    });
    return other || POS_RULE_TYPE_DEFAULTS[5];
  }

  function ensureActivePartContext() {
    var id = normalizeText(state.activePartId) || "part_1";
    state.activePartId = id;
    if (!Array.isArray(state.partOrder) || !state.partOrder.length) {
      state.partOrder = [id];
    }
    if (state.partOrder.indexOf(id) < 0) state.partOrder.push(id);
    if (!state.partContexts[id]) {
      state.partContexts[id] = {
        id: id,
        label: "第" + getPartIndexFromId(id) + "組",
        flavor: "",
        staple: ""
      };
    }
    return state.partContexts[id];
  }

  function getPartIndexFromId(partId) {
    var m = String(partId || "").match(/^part_(\d+)$/);
    if (!m) return 1;
    var idx = Number(m[1] || 1);
    return idx > 0 ? idx : 1;
  }

  function getPartLabel(partId) {
    return "第" + getPartIndexFromId(partId) + "組";
  }

  function createNewPart() {
    var max = (state.partOrder || []).reduce(function (acc, id) {
      return Math.max(acc, getPartIndexFromId(id));
    }, 0);
    var next = max + 1;
    var id = "part_" + next;
    if (!Array.isArray(state.partOrder)) state.partOrder = [];
    state.partOrder.push(id);
    state.partContexts[id] = {
      id: id,
      label: "第" + next + "組",
      flavor: "",
      staple: ""
    };
    return id;
  }

  function setActivePart(partId) {
    var id = normalizeText(partId);
    if (!id) return;
    state.activePartId = id;
    ensureActivePartContext();
    renderPartBar();
  }

  function showPartHint(message) {
    if (!el.partHint) return;
    if (!message) {
      el.partHint.textContent = "";
      el.partHint.classList.remove("is-visible");
      return;
    }
    el.partHint.textContent = message;
    el.partHint.classList.add("is-visible");
  }

  function setInlineAssignVisible(visible) {
    state.inlineAssignVisible = !!visible;
    if (el.assignInline) el.assignInline.classList.toggle("is-visible", !!visible);
  }

  function isSetGroupItem(item) {
    var itemType = normalizeText(item && item.type).toLowerCase();
    if (itemType === "combo") return true;
    var itemPosType = normalizeText(item && item.posType).toLowerCase();
    return itemPosType === "set";
  }

  function getPartCartItems(partId) {
    return (state.cart || []).filter(function (item) {
      return (item.partId || "part_1") === partId;
    });
  }

  function collectPartDisplayMeta(partId) {
    var ctx = state.partContexts[partId] || {};
    var partItems = getPartCartItems(partId);
    var flavor = normalizeText(ctx.flavor);
    var staple = normalizeText(ctx.staple);
    if (!flavor) {
      for (var i = 0; i < partItems.length; i++) {
        if (partItems[i] && partItems[i].flavor) {
          flavor = normalizeText(partItems[i].flavor);
          if (flavor) break;
        }
      }
    }
    if (!staple) {
      for (var j = 0; j < partItems.length; j++) {
        if (partItems[j] && partItems[j].staple) {
          staple = normalizeText(partItems[j].staple);
          if (staple) break;
        }
      }
    }
    return {
      flavor: flavor,
      staple: staple,
      hasSetItem: partItems.some(isSetGroupItem)
    };
  }

  function getPartSummary(partId) {
    var meta = collectPartDisplayMeta(partId);
    var pieces = [];
    if (meta.flavor) pieces.push(meta.flavor);
    if (!pieces.length) pieces.push("未選口味");
    return pieces.join("｜");
  }

  function buildGroupHeaderLabel(partId) {
    var parts = [getPartLabel(partId)];
    var meta = collectPartDisplayMeta(partId);
    if (meta.flavor) parts.push(meta.flavor);
    if (parts.length === 1) parts.push("未選口味");
    return parts.join("｜");
  }

  function buildPartTargetOptions() {
    var options = (state.partOrder || []).map(function (partId) {
      return {
        id: partId,
        label: buildGroupHeaderLabel(partId)
      };
    });
    options.push({ id: "__new__", label: "新增一組…" });
    return options;
  }

  function renderPartTargetSelect(selectEl, selected) {
    if (!selectEl) return;
    var options = buildPartTargetOptions();
    selectEl.innerHTML = options.map(function (opt) {
      return '<option value="' + esc(opt.id) + '"' + (opt.id === selected ? " selected" : "") + ">" + esc(opt.label) + "</option>";
    }).join("");
  }

  function resolveSelectedTargetPart() {
    var value = normalizeText(state.assignTargetPartId) || state.activePartId;
    if (!value || value === "__new__") return createNewPart();
    return value;
  }

  // Used only by spec modal (which still has a select for "分給不同人" in-modal)
  function resolveSelectTargetPart(selectEl) {
    if (!selectEl) return state.activePartId;
    var value = normalizeText(selectEl.value) || state.activePartId;
    if (value === "__new__") return createNewPart();
    return value;
  }

  function renderAssignTargetChips(selectedId) {
    if (!el.assignTargetChips) return;
    var options = buildPartTargetOptions();
    el.assignTargetChips.innerHTML = options.map(function (opt) {
      var isNew = opt.id === "__new__";
      var isSelected = opt.id === selectedId;
      var cls = "pos-assign-chip" +
        (isNew ? " pos-assign-chip--new" : "") +
        (isSelected ? " is-selected" : "");
      return '<button type="button" class="' + cls + '" data-assign-target="' + esc(opt.id) + '">' +
        esc(opt.label) + "</button>";
    }).join("");
  }

  function renderPartBar() {
    ensureActivePartContext();
    if (el.partList) {
      var chips = (state.partOrder || []).map(function (partId) {
        var isActive = partId === state.activePartId;
        var isPending = partId === state.pendingAssignTargetPartId && state.pendingAssignTargetPartId;
        var activeClass = isActive ? " is-active" : "";
        var label = buildGroupHeaderLabel(partId);
        var pendingBadge = isPending ? " ↗" : "";
        return '<button type="button" class="pos-part-chip' + activeClass + '" data-part-id="' + esc(partId) + '">' +
          esc(label) + esc(pendingBadge) +
          "</button>";
      });
      el.partList.innerHTML = chips.join("");
    }
    // Render chips in assign inline panel
    var assignSelected = state.assignTargetPartId || state.pendingAssignTargetPartId || state.activePartId;
    renderAssignTargetChips(assignSelected);
    // Sync spec modal select (kept as select for modal context)
    if (el.specAssignTarget) {
      renderPartTargetSelect(el.specAssignTarget, state.activePartId);
    }
    // Gate 套用↗ button behind the "enableAssignDifferentPeople" rule
    if (el.assignToggleBtn) {
      var enabled = getPosRules().global.enableAssignDifferentPeople === true;
      el.assignToggleBtn.style.display = enabled ? "" : "none";
      if (!enabled) {
        state.pendingAssignTargetPartId = "";
        state.assignTargetPartId = "";
        setInlineAssignVisible(false);
      }
    }
  }

  function resetPartContexts() {
    state.activePartId = "part_1";
    state.partOrder = ["part_1"];
    state.pendingAssignTargetPartId = "";
    state.inlineAssignVisible = false;
    state.partContexts = {
      part_1: {
        id: "part_1",
        label: "第1組",
        flavor: "",
        staple: ""
      }
    };
    setInlineAssignVisible(false);
    showPartHint("");
    renderPartBar();
  }

  function getGlobalSpecOptions() {
    return {
      flavors: Array.isArray(state.globalOptions && state.globalOptions.flavors) ? state.globalOptions.flavors.slice() : [],
      staples: Array.isArray(state.globalOptions && state.globalOptions.staples) ? state.globalOptions.staples.slice() : []
    };
  }

  function normalizeMenuProduct(item) {
    return {
      id: item.id,
      name: item.name || "",
      price: Number(item.price || 0),
      categoryId: item.categoryId || item.category || "未分類",
      posType: normalizeText(item.posType),
      enabled: item.enabled !== false && item.isActive !== false,
      isSoldOut: item.isSoldOut === true,
      posVisible: item.posVisible !== false,
      requiresFlavor: item.requiresFlavor === true,
      requiresStaple: item.requiresStaple === true,
      flavorMode: normalizeText(item.flavorMode),
      inheritFlavor: item.inheritFlavor === true,
      flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
      stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
      posHidden: item.posHidden === true || item.posVisible === false,
      posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
      posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : [],
      sort: Number(item.posSortOrder != null ? item.posSortOrder : (item.sortOrder != null ? item.sortOrder : (item.sort != null ? item.sort : 999)))
    };
  }

  function normalizeComboProduct(item) {
    var globalSpecOptions = getGlobalSpecOptions();
    var flavorOptions = Array.isArray(item.flavorOptions) ? item.flavorOptions.filter(Boolean) : [];
    var stapleOptions = Array.isArray(item.stapleOptions) ? item.stapleOptions.filter(Boolean) : [];
    var requiresFlavor = item.requiresFlavor === true;
    var requiresStaple = item.requiresStaple === true;
    if (requiresFlavor && !flavorOptions.length) flavorOptions = globalSpecOptions.flavors.slice();
    // 套餐主食選項與後台全局主食同步：有全局設定時優先使用全局清單
    if (requiresStaple) {
      if (Array.isArray(globalSpecOptions.staples) && globalSpecOptions.staples.length) {
        stapleOptions = globalSpecOptions.staples.slice();
      } else if (!stapleOptions.length) {
        stapleOptions = [];
      }
    }
    return {
      id: item.id,
      name: item.name || "",
      price: Number(item.price || 0),
      posType: normalizeText(item.posType) || "set",
      enabled: item.enabled !== false && item.isActive !== false,
      isSoldOut: item.isSoldOut === true,
      posVisible: item.posVisible !== false,
      description: item.description || "",
      optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
      requiresFlavor: requiresFlavor,
      requiresStaple: requiresStaple,
      flavorMode: normalizeText(item.flavorMode),
      inheritFlavor: item.inheritFlavor === true,
      flavorOptions: flavorOptions,
      stapleOptions: stapleOptions,
      posHidden: item.posHidden === true || item.posVisible === false,
      posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
      posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : [],
      sort: Number(item.posSortOrder != null ? item.posSortOrder : (item.sort != null ? item.sort : 999))
    };
  }

  async function loadMenu(db) {
    try {
      diagStart("fetchData");
      diag.firestoreRequestCount += 6;
      diag.firestoreRequests.push("menu_items", "menuItems", "comboTemplates", "categories", "settings", "flavors");
      var snaps = await Promise.all([
        db.collection("menu_items").where("storeId", "==", state.storeId).get(),
        db.collection("menuItems").where("storeId", "==", state.storeId).get(),
        db.collection("comboTemplates").where("storeId", "==", state.storeId).get(),
        db.collection("categories").where("storeId", "==", state.storeId).get(),
        db.collection("settings").doc(state.storeId).get(),
        db.collection("flavors").where("storeId", "==", state.storeId).get()
      ]);
      diagEnd("fetchData");
      var settingsData = snaps[4].exists ? (snaps[4].data() || {}) : {};
      var settingsGlobalOptions = settingsData.globalOptions || {};
      state.posRules = normalizePosRules(settingsData.posRules);
      ensureActivePartContext();
      var flavorDocs = mapDocs(snaps[5]).filter(function (item) { return item.enabled !== false; });
      var flavorNamesFromDocs = flavorDocs.map(function (item) { return String(item.name || "").trim(); }).filter(Boolean);
      state.globalOptions = {
        flavors: Array.isArray(settingsGlobalOptions.flavors) && settingsGlobalOptions.flavors.length
          ? settingsGlobalOptions.flavors.slice()
          : flavorNamesFromDocs,
        staples: Array.isArray(settingsGlobalOptions.staples) && settingsGlobalOptions.staples.length
          ? settingsGlobalOptions.staples.slice()
          : []
      };

      // 合併 menu_items + menuItems，去重
      var newItems     = mapDocs(snaps[0]).map(normalizeMenuProduct);
      var legacyItems  = mapDocs(snaps[1]).map(normalizeMenuProduct).filter(function (i) {
        return !newItems.find(function (n) { return n.id === i.id; });
      });
      var allItems = newItems.concat(legacyItems);

      // 過濾：isActive !== false, posVisible !== false（undefined 視為 true）
      state.menu = allItems.filter(function (i) {
        if (i.enabled === false) return false;
        if (i.isActive === false) return false;
        if (i.posHidden === true) return false;
        return true;
      }).sort(bySort);

      // 套餐
      state.combos = mapDocs(snaps[2]).map(normalizeComboProduct).filter(function (i) {
        return i.enabled !== false && i.posHidden !== true;
      }).sort(bySort);

      var categories = mapDocs(snaps[3]).filter(function (i) { return i.enabled !== false; }).sort(bySort);
      diag.itemCount.menuItems = state.menu.length;
      diag.itemCount.combos = state.combos.length;
      diag.itemCount.categories = categories.length;
      console.log("商品數量:", state.menu.length);
      console.log("[POS_DIAG] 套餐數量:", state.combos.length, "分類數量:", categories.length);

      el.menuLoading.style.display = "none";
      diagStart("renderUI");
      renderMenu(categories);
      diagEnd("renderUI");
      diagReport();
    } catch (e) {
      el.menuLoading.textContent = "菜單載入失敗：" + (e.message || e);
    }
  }

  // ── 渲染菜單 ──────────────────────────────────────────────────

  function renderMenu(categories) {
    var html = [];

    // 套餐區塊
    if (state.combos.length) {
      html.push('<div class="pos-section-title">套餐</div>');
      html.push('<div class="pos-menu-grid">');
      state.combos.forEach(function (combo) {
        html.push(menuTile(combo.id, combo.name, combo.price, "combo", "", combo.isSoldOut));
      });
      html.push('</div>');
    }

    // 單點（按分類）
    if (categories.length) {
      categories.forEach(function (cat) {
        var items = state.menu.filter(function (i) { return i.categoryId === cat.id; });
        if (!items.length) return;
        html.push('<div class="pos-section-title">' + esc(cat.name) + '</div>');
        html.push('<div class="pos-menu-grid">');
        items.forEach(function (item) {
          html.push(menuTile(item.id, item.name, item.price, "single", cat.name, item.isSoldOut));
        });
        html.push('</div>');
      });
    } else if (state.menu.length) {
      html.push('<div class="pos-section-title">單點</div>');
      html.push('<div class="pos-menu-grid">');
      state.menu.forEach(function (item) {
        html.push(menuTile(item.id, item.name, item.price, "single", "", item.isSoldOut));
      });
      html.push('</div>');
    }

    el.menuRoot.innerHTML = html.join("") || '<div class="pos-empty">尚無菜單資料</div>';
    el.menuRoot.addEventListener("click", onMenuClick);
  }

  function menuTile(id, name, price, type, category, isSoldOut) {
    var soldOutClass = isSoldOut ? ' pos-menu-tile--soldout' : '';
    var soldOutLabel = isSoldOut ? '<div class="pos-menu-tile__soldout-label">已售完</div>' : '';
    var soldOutAttr = isSoldOut ? ' data-soldout="true" aria-disabled="true"' : ' data-soldout="false"';
    return '<div class="pos-menu-tile' + soldOutClass + '" ' +
      'data-item-id="' + esc(id) + '" data-type="' + esc(type) + '" data-category="' + esc(category || "") + '"' + soldOutAttr + '>' +
      '<div class="pos-menu-tile__name">' + esc(name) + '</div>' +
      '<div class="pos-menu-tile__price">NT$' + Number(price || 0) + '</div>' +
      soldOutLabel +
      '</div>';
  }

  // ── 點菜 ──────────────────────────────────────────────────────

  function onMenuClick(event) {
    var tile = event.target.closest("[data-item-id]");
    if (!tile) return;
    var itemId   = tile.getAttribute("data-item-id");
    var type     = tile.getAttribute("data-type");
    var category = tile.getAttribute("data-category") || "";
    var source = type === "combo" ? state.combos : state.menu;
    var product = source.find(function (i) { return i.id === itemId; });
    if (!product) return;
    handleProductClick(product, {
      type: type,
      category: category
    });
  }

  function isProductSoldOut(product) {
    return !!(product && product.isSoldOut === true);
  }

  function statusDisplayMeta(status) {
    if (window.LeLeShanOrderStatus && typeof window.LeLeShanOrderStatus.getMeta === "function") {
      return window.LeLeShanOrderStatus.getMeta(status);
    }
    var key = String(status || "").trim().toLowerCase();
    if (!key) key = "unknown";
    if (key === "cooking" || key === "packing") key = "preparing";
    if (key === "done") key = "ready";
    if (key === "picked_up") key = "completed";
    if (key === "canceled") key = "cancelled";
    return { key: key, label: STATUS_LABEL_MAP[key] || STATUS_LABEL_MAP.unknown };
  }

  function buildProductOptionPayload(product, context) {
    var globalSpec = getGlobalSpecOptions();
    var type = context && context.type || "single";
    var posType = inferPosType(product, type);
    var rule = getTypeRule(posType);
    var targetPartId = normalizeText(context && context.targetPartId) || normalizeText(state.pendingAssignTargetPartId) || state.activePartId;
    if (!targetPartId) targetPartId = state.activePartId;
    if (targetPartId === "__new__") targetPartId = createNewPart();
    state.activePartId = state.activePartId || targetPartId;
    var part = state.partContexts[targetPartId] || ensureActivePartContext();
    if (!state.partContexts[targetPartId]) {
      state.partContexts[targetPartId] = {
        id: targetPartId,
        label: getPartLabel(targetPartId),
        flavor: "",
        staple: ""
      };
      if (state.partOrder.indexOf(targetPartId) < 0) state.partOrder.push(targetPartId);
      part = state.partContexts[targetPartId];
    }
    var inheritedFlavor = normalizeText(part && part.flavor);
    var requireFlavor = false;
    var resolvedFlavor = "";
    var requireStaple = rule.stapleMode === "required";
    var ruleFlavorMode = rule.flavorMode;
    if (ruleFlavorMode === "required") {
      requireFlavor = true;
    } else if (ruleFlavorMode === "inherit") {
      if (inheritedFlavor) {
        resolvedFlavor = inheritedFlavor;
      } else {
        requireFlavor = true;
      }
    }

    var flavorOptions = resolveSpecOptionNames(product.flavorOptions, globalSpec.flavors, product.posDisabledFlavorOptions);
    var stapleOptions = resolveSpecOptionNames(product.stapleOptions, globalSpec.staples, product.posDisabledStapleOptions);
    if (requireFlavor && !flavorOptions.length && Array.isArray(globalSpec.flavors)) {
      flavorOptions = globalSpec.flavors.slice();
    }
    if (requireStaple && !stapleOptions.length && Array.isArray(globalSpec.staples)) {
      stapleOptions = globalSpec.staples.slice();
    }

    // Fallback: keep old product-level requirement if type rule is missing or disabled
    if (!rule || rule.enabled === false) {
      requireFlavor = product.requiresFlavor === true;
      requireStaple = product.requiresStaple === true;
      resolvedFlavor = "";
    }

    return {
      itemId: product.id,
      type: type,
      posType: posType,
      category: context && context.category || "",
      name: product.name || "",
      price: Number(product.price || 0),
      requiresFlavor: requireFlavor,
      requiresStaple: requireStaple,
      flavor: resolvedFlavor,
      flavorMode: ruleFlavorMode,
      stapleMode: rule.stapleMode,
      flavorOptions: flavorOptions,
      stapleOptions: stapleOptions,
      partId: targetPartId,
      partLabel: part.label || getPartLabel(targetPartId),
      partFlavor: inheritedFlavor
    };
  }

  function validatePartFlavorConstraint(partContext, flavor) {
    var normalizedFlavor = normalizeText(flavor);
    if (!normalizedFlavor) return true;
    var globalRules = getPosRules().global;
    if (!globalRules.singleFlavorPerPart) return true;
    var current = normalizeText(partContext && partContext.flavor);
    if (!current || current === normalizedFlavor) return true;
    showStatus("此組已是" + current + "，若要不同口味請新增另一組或改組數", "err");
    return false;
  }

  function applyPartFlavorAfterAdd(payload, flavor) {
    var part = state.partContexts[payload.partId] || ensureActivePartContext();
    var normalizedFlavor = normalizeText(flavor);
    if (!normalizedFlavor) return;
    if (!normalizeText(part.flavor)) {
      part.flavor = normalizedFlavor;
      return;
    }
    var globalRules = getPosRules().global;
    if (payload.posType === "set" && globalRules.setUpdatesPartFlavor === true) {
      part.flavor = normalizedFlavor;
    }
    renderPartBar();
  }

  function applyPartStapleAfterAdd(payload, staple) {
    var part = state.partContexts[payload.partId] || ensureActivePartContext();
    var normalizedStaple = normalizeText(staple);
    if (!normalizedStaple) return;
    part.staple = normalizedStaple;
    renderPartBar();
  }

  function consumePendingAssignTarget() {
    if (!state.pendingAssignTargetPartId) return "";
    var target = state.pendingAssignTargetPartId;
    state.pendingAssignTargetPartId = "";
    showPartHint("");
    renderPartBar();
    return target;
  }

  function handleProductClick(product, context) {
    if (!product) return;
    if (isProductSoldOut(product)) {
      showStatus("此商品已售完，無法加入購物車。", "err");
      return;
    }
    var runtimeContext = Object.assign({}, context || {});
    var assignedByDifferentPeople = false;
    if (!runtimeContext.targetPartId) {
      var assigned = consumePendingAssignTarget();
      if (assigned) {
        runtimeContext.targetPartId = assigned;
        assignedByDifferentPeople = true;
      }
    }
    var payload = buildProductOptionPayload(product, runtimeContext);
    var shouldOpenModal = payload.requiresFlavor === true || payload.requiresStaple === true;
    if (shouldOpenModal) {
      renderPartBar();
      openProductOptionsModal(payload);
      return;
    }
    if (!validatePartFlavorConstraint(state.partContexts[payload.partId], payload.flavor || "")) return;
    var inheritedFromPartFlavor = false;
    if (payload.flavorMode === "inherit" && normalizeText(payload.partFlavor) && normalizeText(payload.flavor) === normalizeText(payload.partFlavor)) {
      inheritedFromPartFlavor = true;
    }
    addToCartCore({
      itemId: product.id,
      type: payload.type,
      posType: payload.posType,
      category: payload.category,
      name: product.name,
      unitPrice: Number(product.price || 0),
      flavor: payload.flavor || "",
      staple: "",
      partId: payload.partId,
      partLabel: payload.partLabel,
      inheritedFromPartFlavor: inheritedFromPartFlavor
    });
    // Show inherit notice so staff sees the auto-applied flavor
    if (inheritedFromPartFlavor && payload.flavor) {
      showStatus("✓ 已套用套餐口味「" + payload.flavor + "」到 " + product.name, "ok");
    }
    applyPartFlavorAfterAdd(payload, payload.flavor || "");
    applyPartStapleAfterAdd(payload, "");
    if (assignedByDifferentPeople) setActivePart(payload.partId);
    renderPartBar();
  }

  function openProductOptionsModal(payload) {
    openSpecModal(payload);
  }

  function cartItemKey(item) {
    return [
      String(item && item.itemId || ""),
      String(item && item.type || ""),
      String(item && item.partId || "part_1"),
      String(item && item.flavor || ""),
      String(item && item.staple || "")
    ].join("::");
  }

  function resolveSpecOptionNames(options, fallbackList, disabledList) {
    var disabled = new Set(Array.isArray(disabledList) ? disabledList.map(function (name) {
      return String(name || "").trim();
    }) : []);
    var normalized = Array.isArray(options) ? options.map(function (entry) {
      if (typeof entry === "string") return entry.trim();
      return String(entry && (entry.name || entry.id) || "").trim();
    }).filter(Boolean) : [];
    if (normalized.length) {
      return normalized.filter(function (name) { return !disabled.has(name); });
    }
    return Array.isArray(fallbackList) ? fallbackList.filter(function (name) {
      return name && !disabled.has(String(name || "").trim());
    }) : [];
  }

  function showSpecError(message) {
    if (!el.specError) return;
    if (!message) {
      el.specError.textContent = "";
      el.specError.classList.remove("is-visible");
      return;
    }
    el.specError.textContent = message;
    el.specError.classList.add("is-visible");
  }

  function setSelectedOptionCard(root, card) {
    if (!root || !card) return;
    Array.prototype.slice.call(root.querySelectorAll(".pos-spec-option-card")).forEach(function (entry) {
      entry.classList.remove("selected");
      entry.setAttribute("aria-pressed", "false");
    });
    card.classList.add("selected");
    card.setAttribute("aria-pressed", "true");
  }

  function handleOptionCardClick(root, event) {
    if (!root) return;
    var card = event.target && event.target.closest(".pos-spec-option-card");
    if (!card || !root.contains(card)) return;
    setSelectedOptionCard(root, card);
    showSpecError("");
  }

  function renderSpecOptions(root, name, options, selectedValue) {
    if (!root) return;
    root.setAttribute("data-group", name);
    root.innerHTML = (options || []).map(function (option) {
      var value = typeof option === "string" ? option : (option.name || option.id || "");
      if (!value) return "";
      var selectedClass = selectedValue && selectedValue === value ? " selected" : "";
      var pressed = selectedClass ? "true" : "false";
      return '<div class="pos-spec-option-card' + selectedClass + '" data-value="' + esc(value) + '" role="button" tabindex="0" aria-pressed="' + pressed + '">' + esc(value) + "</div>";
    }).join("");
  }

  function renderSpecAssignState(payload) {
    if (!el.specAssignGroup) return;
    var enabled = getPosRules().global.enableAssignDifferentPeople === true;
    var mode = payload && payload.assignMode === "other" ? "other" : "current";
    var show = !!enabled;
    el.specAssignGroup.classList.toggle("hidden", !show);
    if (!show) return;
    if (el.specAssignCurrent) el.specAssignCurrent.classList.toggle("is-active", mode === "current");
    if (el.specAssignOther) el.specAssignOther.classList.toggle("is-active", mode === "other");
    if (el.specAssignTarget) {
      renderPartTargetSelect(el.specAssignTarget, payload && payload.partId ? payload.partId : state.activePartId);
      el.specAssignTarget.classList.toggle("hidden", mode !== "other");
    }
  }

  function openSpecModal(payload) {
    if (!el.specOverlay || !payload) return;
    payload.assignMode = payload.assignMode || "current";
    if (state.pendingAssignTargetPartId) {
      payload.assignMode = "other";
      payload.partId = state.pendingAssignTargetPartId;
      payload.partLabel = getPartLabel(payload.partId);
      state.pendingAssignTargetPartId = "";
      showPartHint("");
    }
    state.pendingSpecSelection = payload;
    if (payload.requiresFlavor === true && !payload.flavor && Array.isArray(payload.flavorOptions) && payload.flavorOptions.length) {
      payload.flavor = String(payload.flavorOptions[0] || "").trim();
    }
    if (payload.requiresStaple === true && !payload.staple && Array.isArray(payload.stapleOptions) && payload.stapleOptions.length) {
      payload.staple = String(payload.stapleOptions[0] || "").trim();
    }
    if (el.specTitle) el.specTitle.textContent = payload.name || "選擇規格";
    if (el.specSub) {
      var hint = "";
      var ruleFlavorMode = payload.flavorMode || "";
      if (ruleFlavorMode === "inherit" && payload.requiresFlavor) {
        hint = "此品項會跟著套餐口味，但目前組別還沒有口味記錄，請先選一個口味。";
      } else if (payload.requiresFlavor && payload.requiresStaple) {
        hint = "此品項需要選擇口味與主食，才能加入訂單。";
      } else if (payload.requiresFlavor) {
        hint = "此品項需要先選擇口味，才能加入訂單。";
      } else if (payload.requiresStaple) {
        hint = "此套餐需要搭配一種主食，才能加入訂單。";
      } else {
        hint = "請完成規格選擇後加入購物車。";
      }
      el.specSub.textContent = hint;
    }
    showSpecError("");

    if (el.specFlavorGroup) {
      var showFlavor = payload.requiresFlavor === true;
      el.specFlavorGroup.classList.toggle("hidden", !showFlavor);
      if (showFlavor) renderSpecOptions(el.specFlavorOptions, "pos-spec-flavor", payload.flavorOptions || [], payload.flavor || "");
    }
    if (el.specStapleGroup) {
      var showStaple = payload.requiresStaple === true;
      el.specStapleGroup.classList.toggle("hidden", !showStaple);
      if (showStaple) renderSpecOptions(el.specStapleOptions, "pos-spec-staple", payload.stapleOptions || [], payload.staple || "");
    }
    renderSpecAssignState(payload);

    el.specOverlay.classList.remove("hidden");
  }

  function closeSpecModal() {
    state.pendingSpecSelection = null;
    showSpecError("");
    if (el.specOverlay) el.specOverlay.classList.add("hidden");
  }

  function readCheckedSpecValue(root) {
    if (!root) return "";
    var selected = root.querySelector(".pos-spec-option-card.selected");
    return selected ? String(selected.getAttribute("data-value") || "").trim() : "";
  }

  function confirmSpecSelection() {
    var pending = state.pendingSpecSelection;
    if (!pending) return;
    if (getPosRules().global.enableAssignDifferentPeople === true && pending.assignMode === "other" && el.specAssignTarget) {
      var selectedTargetPart = resolveSelectTargetPart(el.specAssignTarget);
      pending.partId = selectedTargetPart;
      pending.partLabel = getPartLabel(selectedTargetPart);
      if (state.partContexts[selectedTargetPart]) {
        pending.partFlavor = normalizeText(state.partContexts[selectedTargetPart].flavor);
      }
    }
    var flavor = pending.requiresFlavor === true ? readCheckedSpecValue(el.specFlavorOptions) : (pending.flavor || "");
    var staple = pending.requiresStaple === true ? readCheckedSpecValue(el.specStapleOptions) : "";

    if (pending.requiresFlavor === true && !flavor) {
      showSpecError("請先選擇口味");
      return;
    }
    if (pending.requiresStaple === true && !staple) {
      showSpecError("請先選擇主食");
      return;
    }
    if (!validatePartFlavorConstraint(state.partContexts[pending.partId], flavor)) {
      showSpecError("此組口味衝突，請改選相同口味或改組數");
      return;
    }
    var inheritedFromPartFlavor = false;
    if (pending.flavorMode === "inherit" && normalizeText(pending.partFlavor) && normalizeText(flavor) === normalizeText(pending.partFlavor)) {
      inheritedFromPartFlavor = true;
    }

    addToCartCore({
      itemId: pending.itemId,
      type: pending.type,
      posType: pending.posType,
      category: pending.category,
      name: pending.name,
      unitPrice: Number(pending.price || 0),
      flavor: flavor,
      staple: staple,
      partId: pending.partId,
      partLabel: pending.partLabel,
      inheritedFromPartFlavor: inheritedFromPartFlavor
    });
    applyPartFlavorAfterAdd(pending, flavor);
    applyPartStapleAfterAdd(pending, staple);
    if (pending.assignMode === "other") {
      setActivePart(pending.partId);
    }
    closeSpecModal();
  }

  function addToCartCore(entry) {
    var incomingPartId = entry.partId || state.activePartId || "part_1";
    if (!state.partContexts[incomingPartId]) {
      state.partContexts[incomingPartId] = {
        id: incomingPartId,
        label: getPartLabel(incomingPartId),
        flavor: "",
        staple: ""
      };
    }
    if (state.partOrder.indexOf(incomingPartId) < 0) state.partOrder.push(incomingPartId);
    var incoming = {
      itemId: entry.itemId,
      name: entry.name,
      unitPrice: Number(entry.unitPrice || 0),
      qty: 1,
      categoryName: entry.category || "",
      type: entry.type || "single",
      posType: entry.posType || "other",
      flavor: entry.flavor || "",
      staple: entry.staple || "",
      partId: incomingPartId,
      partLabel: entry.partLabel || getPartLabel(incomingPartId),
      partIndex: getPartIndexFromId(incomingPartId),
      inheritedFromPartFlavor: entry.inheritedFromPartFlavor === true
    };
    var incomingKey = cartItemKey(incoming);
    var existing = state.cart.find(function (item) {
      return cartItemKey(item) === incomingKey;
    });
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push(incoming);
    }
    renderCart();
  }

  function addToCart(itemId, type, category) {
    var source  = type === "combo" ? state.combos : state.menu;
    var found   = source.find(function (i) { return i.id === itemId; });
    if (!found) return;
    handleProductClick(found, { type: type, category: category });
  }

  function findProductByIdAndType(itemId, type) {
    var normalizedType = normalizeText(type);
    if (normalizedType === "combo") {
      return state.combos.find(function (item) { return item.id === itemId; }) || null;
    }
    return state.menu.find(function (item) { return item.id === itemId; }) || null;
  }

  function cartItemNeedsFlavor(item) {
    if (!item) return false;
    var posType = normalizeText(item.posType);
    var rule = getTypeRule(posType || "other");
    if (rule && rule.enabled !== false) {
      return rule.flavorMode === "required" || rule.flavorMode === "inherit";
    }
    var product = findProductByIdAndType(item.itemId, item.type);
    if (!product) return false;
    var productFlavorMode = normalizeText(product.flavorMode);
    if (productFlavorMode === "required" || productFlavorMode === "inherit") return true;
    if (product.inheritFlavor === true) return true;
    return product.requiresFlavor === true;
  }

  function cartItemNeedsStaple(item) {
    if (!item) return false;
    var posType = normalizeText(item.posType);
    var rule = getTypeRule(posType || "other");
    if (rule && rule.enabled !== false) {
      return rule.stapleMode === "required";
    }
    var product = findProductByIdAndType(item.itemId, item.type);
    if (!product) return false;
    return product.requiresStaple === true;
  }

  function validateCartSpecIntegrity() {
    var flavorMissing = state.cart.filter(function (item) {
      return cartItemNeedsFlavor(item) && !normalizeText(item.flavor);
    });
    var stapleMissing = state.cart.filter(function (item) {
      return cartItemNeedsStaple(item) && !normalizeText(item.staple);
    });
    if (!flavorMissing.length && !stapleMissing.length) return true;

    var messages = [];
    if (flavorMissing.length) {
      var fNames = flavorMissing.slice(0, 3).map(function (i) { return i.name || "未命名品項"; });
      var fExtra = flavorMissing.length > 3 ? (" 等共" + flavorMissing.length + "項") : "";
      messages.push("【口味未選】" + fNames.join("、") + fExtra);
    }
    if (stapleMissing.length) {
      var sNames = stapleMissing.slice(0, 3).map(function (i) { return i.name || "未命名品項"; });
      var sExtra = stapleMissing.length > 3 ? (" 等共" + stapleMissing.length + "項") : "";
      messages.push("【主食未選】" + sNames.join("、") + sExtra);
    }
    showStatus("結帳前請補齊：" + messages.join("；") + "。", "err");
    highlightCartSpecErrors(flavorMissing, stapleMissing);
    return false;
  }

  // Keep old name as alias for backward compatibility
  function validateCartFlavorIntegrity() {
    return validateCartSpecIntegrity();
  }

  function highlightCartSpecErrors(flavorMissing, stapleMissing) {
    if (!el.cartItems) return;
    var flavorKeys = {};
    flavorMissing.forEach(function (i) { flavorKeys[cartItemKey(i)] = true; });
    var stapleKeys = {};
    stapleMissing.forEach(function (i) { stapleKeys[cartItemKey(i)] = true; });
    Array.prototype.slice.call(el.cartItems.querySelectorAll(".pos-cart-item")).forEach(function (row) {
      var key = row.getAttribute("data-cart-key");
      var hasFlavorErr = !!flavorKeys[key];
      var hasStapleErr = !!stapleKeys[key];
      row.classList.toggle("is-spec-error", hasFlavorErr || hasStapleErr);
      var warn = row.querySelector(".pos-cart-item__warn");
      if (!warn) return;
      var parts = [];
      if (hasFlavorErr) parts.push("缺口味");
      if (hasStapleErr) parts.push("缺主食");
      warn.textContent = parts.length ? ("⚠ " + parts.join("／")) : "";
      warn.style.display = parts.length ? "" : "none";
    });
  }

  function onCartClick(event) {
    var inc = event.target.closest("[data-cart-inc]");
    var dec = event.target.closest("[data-cart-dec]");
    if (inc) changeQty(inc.getAttribute("data-cart-inc"), 1);
    if (dec) changeQty(dec.getAttribute("data-cart-dec"), -1);
  }

  function changeQty(itemKey, delta) {
    var idx = state.cart.findIndex(function (c) { return cartItemKey(c) === itemKey; });
    if (idx < 0) return;
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
    renderCart();
  }

  function renderCart() {
    var total = 0;
    if (!state.cart.length) {
      el.cartItems.innerHTML  = '<div class="pos-empty">尚未選取品項</div>';
      el.cartTotal.textContent = "合計：NT$0";
      if (el.checkoutTotal) el.checkoutTotal.textContent = "NT$0";
      renderPartBar();
      return;
    }
    var html = state.cart.map(function (item) {
      var itemKey = cartItemKey(item);
      var sub = item.unitPrice * item.qty;
      total += sub;
      var specLines = [];
      if (item.partLabel) specLines.push("分配：" + item.partLabel);
      var needsFlavor = cartItemNeedsFlavor(item);
      var needsStaple = cartItemNeedsStaple(item);
      var missingFlavor = needsFlavor && !normalizeText(item.flavor);
      var missingStaple = needsStaple && !normalizeText(item.staple);
      if (item.flavor) {
        var flavorDisplay = item.flavor;
        if (item.inheritedFromPartFlavor) {
          flavorDisplay += ' <span class="pos-cart-item__inherit-badge">↳ 繼承套餐</span>';
        }
        specLines.push("口味：" + flavorDisplay);
      } else if (needsFlavor) {
        specLines.push('<span class="pos-cart-item__warn">⚠ 缺口味</span>');
      }
      if (item.staple) {
        specLines.push("主食：" + item.staple);
      } else if (needsStaple) {
        specLines.push('<span class="pos-cart-item__warn">⚠ 缺主食</span>');
      }
      var specHtml = specLines.length
        ? '<div class="pos-cart-item__meta">' + specLines.join(" / ") + "</div>"
        : "";
      var errorClass = (missingFlavor || missingStaple) ? " is-spec-error" : "";
      return '<div class="pos-cart-item' + errorClass + '" data-cart-key="' + esc(itemKey) + '">' +
        '<span class="pos-cart-item__name"><span>' + esc(item.name) + '</span>' + specHtml + '</span>' +
        '<button class="pos-cart-item__qty-btn" data-cart-dec="' + esc(itemKey) + '">−</button>' +
        '<span class="pos-cart-item__qty">' + item.qty + '</span>' +
        '<button class="pos-cart-item__qty-btn" data-cart-inc="' + esc(itemKey) + '">＋</button>' +
        '<span class="pos-cart-item__price">NT$' + sub + '</span>' +
        '</div>';
    });
    el.cartItems.innerHTML   = html.join("");
    el.cartTotal.textContent = "合計：NT$" + total;
    if (el.checkoutTotal) el.checkoutTotal.textContent = "NT$" + total;
    renderPartBar();
  }

  function setPaymentMethod(method) {
    state.selectedPaymentMethod = method || "";
    if (el.paymentCashBtn) {
      el.paymentCashBtn.classList.toggle("is-selected", state.selectedPaymentMethod === "cash");
    }
    if (el.paymentLinePayBtn) {
      el.paymentLinePayBtn.classList.toggle("is-selected", state.selectedPaymentMethod === "linepay");
    }
  }

  var POS_SOURCE_LABELS = { walk_in: "現場顧客", phone: "電話訂" };

  function setSource(source) {
    state.selectedSource = source || "walk_in";
    var btnMap = { walk_in: el.sourceWalkInBtn, phone: el.sourcePhoneBtn };
    Object.keys(btnMap).forEach(function (key) {
      if (btnMap[key]) btnMap[key].classList.toggle("is-selected", key === state.selectedSource);
    });
  }

  // ── 送出訂單 / 追加分派 ──────────────────────────────────────

  async function handleSubmit() {
    if (state.appendTargetOrder) {
      await handleAppendSubmit();
    } else {
      await handleNewOrderSubmit();
    }
  }

  // ── 新建訂單 ──────────────────────────────────────────────────

  async function handleNewOrderSubmit() {
    if (state.submitting || !state.cart.length) {
      if (!state.cart.length) showStatus("請先選取品項。", "err");
      return;
    }
    if (!state.selectedPaymentMethod) {
      showStatus("請先選擇收款方式。", "err");
      return;
    }
    if (!validateCartFlavorIntegrity()) return;
    state.submitting = true;
    el.submitBtn.disabled = true;
    showStatus("收款中…");

    var ctx          = state.context;
    var db           = ctx.db;
    var storeId      = state.storeId;
    var customerName = (el.customerName.value || "").trim() || "現場顧客";
    var lineUserId   = (el.lineUserId.value || "").trim() || null;
    var pickupTime   = (el.pickupTime.value || "").trim();
    var note         = (el.note.value || "").trim();
    var paymentMethod = state.selectedPaymentMethod;

    var now       = new Date();
    var tzOffset  = 8 * 60;
    var local     = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60000);
    var todayStr  = local.getFullYear() + "-" + pad(local.getMonth() + 1) + "-" + pad(local.getDate());

    var ref        = db.collection("orders").doc();
    var counterRef = db.collection("order_counters").doc(todayStr);

    var items = cartToItems();
    var total = items.reduce(function (s, i) { return s + i.subtotal; }, 0);

    // Build groups structure so KDS can display by flavor group
    var groups = state.partOrder.reduce(function (acc, partId) {
      var ctx = state.partContexts[partId] || {};
      var groupItems = items.filter(function (i) { return (i.partId || "part_1") === partId; });
      if (groupItems.length) {
        acc.push({
          id:     partId,
          index:  getPartIndexFromId(partId),
          label:  getPartLabel(partId),
          flavor: ctx.flavor || "",
          staple: ctx.staple || "",
          items:  groupItems
        });
      }
      return acc;
    }, []);

    var payload = window.LeLeShanOrders.buildCreatePayload({
      id:             ref.id,
      storeId:        storeId,
      customer_name:  customerName,
      source:         state.selectedSource || "walk_in",
      label:          POS_SOURCE_LABELS[state.selectedSource] || "現場顧客",
      display_name:   (POS_SOURCE_LABELS[state.selectedSource] || "現場顧客") + (customerName !== "現場顧客" ? " " + customerName : ""),
      items:          items,
      subtotal:       total,
      total:          total,
      status:         "accepted",
      lineUserId:     lineUserId,
      lineDisplayName: lineUserId ? customerName : null,
      paymentMethod:  paymentMethod,
      isPaid:         true,
      paymentStatus:  "paid",
      note:           note,
      scheduled_pickup_date: todayStr,
      scheduled_pickup_time: pickupTime,
      scheduled_pickup_at:   pickupTime ? (todayStr + "T" + pickupTime + ":00+08:00") : "",
      isTest:         false,
      groups:         groups.length > 0 ? groups : null
    });
    payload.isPaid       = true;
    payload.accepted_at  = firebase.firestore.FieldValue.serverTimestamp();
    payload.acceptedAt   = firebase.firestore.FieldValue.serverTimestamp();

    var pickupNumber = null;
    try {
      await db.runTransaction(function (tx) {
        return tx.get(counterRef).then(function (counterDoc) {
          var seq = counterDoc.exists ? ((counterDoc.data().seq || 0) + 1) : 1;
          pickupNumber = String(seq).padStart(3, "0");
          tx.set(counterRef, { seq: seq, date: todayStr, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          payload.pickupNumber   = pickupNumber;
          payload.pickupSequence = seq;
          tx.set(ref, payload);

          // order_events: order_created
          var eventRef = db.collection("order_events").doc();
          tx.set(eventRef, window.LeLeShanOrders.buildOrderEventPayload({
            orderId:    ref.id,
            storeId:    storeId,
            type:       "order_created",
            actorType:  "staff",
            actorId:    ctx.user.uid,
            actorName:  ctx.admin.name || ctx.user.email || "",
            fromStatus: null,
            toStatus:   "accepted",
            message:    "POS 現場建單，取餐號碼 " + (pickupNumber || "")
          }));
        });
      });

      // order_items（非 transaction，不阻塞主流程）
      try {
        var itemsPayload = window.LeLeShanOrders.buildOrderItemsPayload({
          orderId: ref.id, storeId: storeId, source: "pos", items: payload.items
        });
        if (itemsPayload.length) {
          var batch = db.batch();
          itemsPayload.forEach(function (doc) { batch.set(db.collection("order_items").doc(), doc); });
          batch.commit().catch(function (e) { console.warn("[POS] order_items write failed.", e); });
        }
      } catch (e) { console.warn("[POS] order_items skipped.", e); }

      upsertCustomer(db, { storeId: storeId, lineUserId: lineUserId, customerName: customerName, orderId: ref.id });

      console.log("[POS] submitOrder success.", {
        orderId:      ref.id,
        storeId:      payload.storeId,
        status:       payload.status,
        source:       payload.source,
        pickupNumber: pickupNumber,
        total:        payload.total,
        itemCount:    (payload.items || []).length
      });
      showStatus("✅ 已收款，取餐號碼：" + pickupNumber, "ok");
      clearCart();

    } catch (err) {
      console.error("[POS] submitOrder failed.", err);
      showStatus("送單失敗：" + (err.message || err), "err");
    } finally {
      state.submitting      = false;
      el.submitBtn.disabled = false;
    }
  }

  // ── 追加既有訂單 ─────────────────────────────────────────────

  function startAppendMode(order) {
    state.appendTargetOrder = order;
    closeDetailOverlay();

    // 切換到點餐 tab
    document.querySelectorAll(".pos-tab-btn").forEach(function (b) { b.classList.remove("is-active"); });
    document.querySelectorAll(".pos-tab-content").forEach(function (c) { c.classList.remove("is-active"); });
    document.querySelector('[data-tab="order"]').classList.add("is-active");
    document.getElementById("pos-tab-order").classList.add("is-active");

    // 顯示 banner
    var label = order.pickupNumber ? "#" + order.pickupNumber : (order.id || "").slice(-6);
    el.appendBannerText.textContent = "追加模式：訂單 " + label + "（" + (order.customer_name || order.display_name || "顧客") + "）";
    el.appendBanner.classList.remove("hidden");

    // 更新按鈕 & 隱藏新建表單
    el.cartTitle.textContent = "追加品項";
    el.cartFields.style.display = "none";
    if (el.checkoutPanel) el.checkoutPanel.style.display = "none";
    el.submitBtn.textContent = "追加到訂單 " + label;
    el.submitBtn.classList.add("pos-submit-btn--append");

    // 清空購物車
    state.cart = [];
    resetPartContexts();
    renderCart();
    showStatus("", "");
    el.status.style.display = "none";
  }

  function exitAppendMode() {
    state.appendTargetOrder = null;
    el.appendBanner.classList.add("hidden");
    el.cartTitle.textContent   = "購物車";
    el.cartFields.style.display = "";
    if (el.checkoutPanel) el.checkoutPanel.style.display = "";
    el.submitBtn.textContent   = "確認收款";
    el.submitBtn.classList.remove("pos-submit-btn--append");
    state.cart = [];
    resetPartContexts();
    renderCart();
    el.status.style.display = "none";
  }

  async function handleAppendSubmit() {
    if (state.submitting || !state.cart.length) {
      if (!state.cart.length) showStatus("請先選取要追加的品項。", "err");
      return;
    }
    if (!validateCartFlavorIntegrity()) return;
    state.submitting = true;
    el.submitBtn.disabled = true;
    showStatus("追加中…");

    var ctx     = state.context;
    var db      = ctx.db;
    var storeId = state.storeId;
    var order   = state.appendTargetOrder;
    var orderId = order.id;

    var appendItems = cartToItems();
    var appendTotal = appendItems.reduce(function (s, i) { return s + i.subtotal; }, 0);

    var orderRef = db.collection("orders").doc(orderId);
    var ts       = firebase.firestore.FieldValue.serverTimestamp();
    var inc      = firebase.firestore.FieldValue.increment;

    try {
      var wasReady    = false;
      var prevStatus  = "";

      await db.runTransaction(function (tx) {
        return tx.get(orderRef).then(function (orderDoc) {
          if (!orderDoc.exists) throw new Error("訂單不存在");
          var data = orderDoc.data();
          prevStatus = data.status || "new";
          wasReady   = prevStatus === "ready";

          // 合併 items 陣列
          var currentItems = Array.isArray(data.items) ? data.items : [];
          var newItems     = currentItems.concat(appendItems);

          var updateData = {
            items:      newItems,
            subtotal:   inc(appendTotal),
            total:      inc(appendTotal),
            itemCount:  inc(appendItems.length),
            updatedAt:  ts
          };
          if (wasReady) {
            updateData.status = "preparing";
          }
          tx.update(orderRef, updateData);

          // order_events: order_appended
          var eventRef = db.collection("order_events").doc();
          tx.set(eventRef, {
            orderId:        orderId,
            storeId:        storeId,
            type:           "order_appended",
            actorType:      "staff",
            actorId:        ctx.user.uid,
            actorName:      ctx.admin.name || ctx.user.email || "",
            fromStatus:     prevStatus,
            toStatus:       wasReady ? "preparing" : prevStatus,
            appendedItems:  appendItems.map(function (i) { return { name: i.name, qty: i.qty, subtotal: i.subtotal }; }),
            amountDelta:    appendTotal,
            appendedAt:     ts,
            createdAt:      ts
          });

          // 若從 ready 回退，補一筆 status_changed
          if (wasReady) {
            var scRef = db.collection("order_events").doc();
            tx.set(scRef, window.LeLeShanOrders.buildOrderEventPayload({
              orderId:    orderId,
              storeId:    storeId,
              type:       "status_changed",
              actorType:  "staff",
              actorId:    ctx.user.uid,
              actorName:  ctx.admin.name || ctx.user.email || "",
              fromStatus: "ready",
              toStatus:   "preparing",
              message:    "追加品項，自動回退製作中"
            }));
          }
        });
      });

      // order_items batch（非 transaction）
      try {
        var itemsPayload = window.LeLeShanOrders.buildOrderItemsPayload({
          orderId: orderId, storeId: storeId, source: "pos", items: appendItems
        });
        if (itemsPayload.length) {
          var batch = db.batch();
          itemsPayload.forEach(function (doc) { batch.set(db.collection("order_items").doc(), doc); });
          batch.commit().catch(function (e) { console.warn("[POS] append order_items failed.", e); });
        }
      } catch (e) { console.warn("[POS] append order_items skipped.", e); }

      var label = order.pickupNumber ? "#" + order.pickupNumber : orderId.slice(-6);
      showStatus("✅ 已追加到訂單 " + label + (wasReady ? "（訂單已回退製作中）" : ""), "ok");

      // 離開追加模式
      setTimeout(function () { exitAppendMode(); }, 2000);
      // 重整今日訂單快取（下次開啟時更新）
      state.todaysOrders = [];

    } catch (err) {
      console.error("[POS] appendOrder failed.", err);
      showStatus("追加失敗：" + (err.message || err), "err");
    } finally {
      state.submitting      = false;
      el.submitBtn.disabled = false;
    }
  }

  // ── 今日訂單列表（含自動輪詢）────────────────────────────────

  var ordersAutoRefreshTimer = null;
  var ORDERS_AUTO_REFRESH_MS = 20000; // 每 20 秒自動刷新

  function startOrdersAutoRefresh() {
    stopOrdersAutoRefresh();
    ordersAutoRefreshTimer = setInterval(function () {
      if (state.context && !state.submitting) {
        console.log("[POS] Auto-refresh orders list.");
        loadTodaysOrdersQuiet();
      }
    }, ORDERS_AUTO_REFRESH_MS);
    console.log("[POS] Orders auto-refresh started (every " + ORDERS_AUTO_REFRESH_MS / 1000 + "s).");
  }

  function stopOrdersAutoRefresh() {
    if (ordersAutoRefreshTimer) {
      clearInterval(ordersAutoRefreshTimer);
      ordersAutoRefreshTimer = null;
    }
  }

  // 靜默刷新（不清空列表、不顯示「載入中」，避免閃爍）
  async function loadTodaysOrdersQuiet() {
    try {
      var session = state.session || (window.LeLeShanPosSession && window.LeLeShanPosSession.get()) || null;
      if (!session || !session.employeeId || !session.sessionToken) return;
      var callable = firebase.app().functions("us-central1").httpsCallable("listPosTodayOrders");
      var result = await callable({ employeeId: session.employeeId, sessionToken: session.sessionToken, limit: 200 });
      var payload = result && result.data || {};
      var rows = Array.isArray(payload.orders) ? payload.orders : [];
      state.todaysOrders = rows.map(function (row) {
        var mapped = Object.assign({}, row || {});
        mapped.id = mapped.id || "";
        mapped.createdAt = mapped.createdAt || null;
        return mapped;
      });
      renderOrdersList();
    } catch (e) {
      console.warn("[POS] Auto-refresh failed (non-critical).", e && e.message || e);
    }
  }

  async function loadTodaysOrders() {
    el.ordersList.innerHTML = '<div class="pos-empty">載入中…</div>';
    try {
      diagStart("fetchData");
      diag.firestoreRequestCount += 1;
      diag.firestoreRequests.push("callable:listPosTodayOrders");
      var session = state.session || (window.LeLeShanPosSession && window.LeLeShanPosSession.get()) || null;
      if (!session || !session.employeeId || !session.sessionToken) {
        throw new Error("POS_SESSION_MISSING");
      }
      var callable = firebase.app().functions("us-central1").httpsCallable("listPosTodayOrders");
      var result = await callable({
        employeeId: session.employeeId,
        sessionToken: session.sessionToken,
        limit: 200
      });
      var payload = result && result.data || {};
      var rows = Array.isArray(payload.orders) ? payload.orders : [];
      diagEnd("fetchData");

      state.todaysOrders = rows.map(function (row) {
        var mapped = Object.assign({}, row || {});
        mapped.id = mapped.id || "";
        mapped.createdAt = mapped.createdAt || null;
        return mapped;
      });
      diag.itemCount.todaysOrders = state.todaysOrders.length;
      var statusSummary = {};
      state.todaysOrders.forEach(function(o) { statusSummary[o.status || "?"] = (statusSummary[o.status || "?"] || 0) + 1; });
      console.log("[POS] loadTodaysOrders:", { count: state.todaysOrders.length, byStatus: statusSummary, storeId: payload.storeId });
      diagStart("renderUI");
      renderOrdersList();
      diagEnd("renderUI");
      diagReport();
    } catch (e) {
      console.error("[POS] 今日訂單載入失敗", {
        source: "callable:listPosTodayOrders",
        storeId: state.storeId,
        query: {
          collection: "orders",
          where: [
            ["storeId", "==", state.storeId],
            ["createdAt", ">=", "today@Asia/Taipei"]
          ],
          orderBy: ["createdAt", "desc"],
          limit: 200
        },
        code: e && e.code || "",
        message: e && e.message || String(e)
      });
      el.ordersList.innerHTML = '<div class="pos-empty" style="color:#fca5a5">載入失敗：' + esc(e.message || String(e)) + '</div>';
    }
  }

  function renderOrdersList() {
    var orders = state.todaysOrders;
    var q      = state.searchQuery;
    if (q) {
      orders = orders.filter(function (o) {
        var no   = String(o.pickupNumber || "").toLowerCase();
        var name = String(o.customer_name || o.display_name || "").toLowerCase();
        var id   = String(o.id || "").toLowerCase();
        return no.indexOf(q) >= 0 || name.indexOf(q) >= 0 || id.indexOf(q) >= 0;
      });
    }

    if (!orders.length) {
      el.ordersList.innerHTML = '<div class="pos-empty">' + (q ? "沒有符合搜尋的訂單" : "今日尚無訂單") + '</div>';
      return;
    }

    var completedSet = new Set(["completed", "cancelled"]);
    var rows = orders.map(function (o) {
      var statusMeta = statusDisplayMeta(o.status || "new");
      var status = statusMeta.key;
      var statusLbl = statusMeta.label;
      var srcKey    = o.source || "pos";
      var srcLbl    = SOURCE_LABEL_MAP[srcKey] || srcKey;
      var canAppend = !completedSet.has(status);
      var cancelReasonLabels = { busy: "爆單/忙碌中", out_of_stock: "食材售完", closing: "即將打烊", abnormal_order: "訂單異常" };
      var cancelReasonText = o.cancel_reason ? (cancelReasonLabels[o.cancel_reason] || o.cancel_reason) : "";
      var createdAt = tsToTime(o.createdAt);
      var total     = Number(o.total || o.totalAmount || o.subtotal || 0);
      var no        = o.pickupNumber ? "#" + o.pickupNumber : o.id.slice(-6);
      var name      = esc(o.customer_name || o.display_name || "—");

      return '<tr>' +
        '<td><strong>' + esc(no) + '</strong></td>' +
        '<td>' + name + '</td>' +
        '<td><span class="pos-source-badge pos-source-badge--' + esc(srcKey) + '">' + esc(srcLbl) + '</span></td>' +
        '<td>NT$' + total + '</td>' +
        '<td><span class="pos-status-pill pos-status-pill--' + esc(status) + '">' + esc(statusLbl) + '</span>' +
          (cancelReasonText ? '<span class="pos-cancel-reason"> (' + esc(cancelReasonText) + ')</span>' : '') + '</td>' +
        '<td>' + esc(createdAt) + '</td>' +
        '<td>' +
          '<div class="pos-orders-actions">' +
            '<button class="pos-orders-btn pos-orders-btn--view" data-view-order="' + esc(o.id) + '">查看</button>' +
            (canAppend ? '<button class="pos-orders-btn pos-orders-btn--append" data-append-order="' + esc(o.id) + '">追加</button>' : '') +
          '</div>' +
        '</td>' +
        '</tr>';
    });

    var table = '<table class="pos-orders-table">' +
      '<thead><tr><th>號碼</th><th>顧客</th><th>來源</th><th>金額</th><th>狀態</th><th>時間</th><th>操作</th></tr></thead>' +
      '<tbody>' + rows.join("") + '</tbody>' +
      '</table>';

    el.ordersList.innerHTML = table;
    el.ordersList.addEventListener("click", onOrdersListClick);
  }

  function onOrdersListClick(event) {
    var viewBtn   = event.target.closest("[data-view-order]");
    var appendBtn = event.target.closest("[data-append-order]");
    if (viewBtn) {
      var orderId = viewBtn.getAttribute("data-view-order");
      var order   = state.todaysOrders.find(function (o) { return o.id === orderId; });
      if (order) openDetailOverlay(order);
      return;
    }
    if (appendBtn) {
      var orderId = appendBtn.getAttribute("data-append-order");
      var order   = state.todaysOrders.find(function (o) { return o.id === orderId; });
      if (order) startAppendMode(order);
    }
  }

  // ── 訂單詳情 Overlay ─────────────────────────────────────────

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value && typeof value.toDate === "function") {
      var d1 = value.toDate();
      return d1 && !isNaN(d1.getTime()) ? d1.getTime() : 0;
    }
    if (value && typeof value.seconds === "number") {
      return value.seconds * 1000;
    }
    var d2 = new Date(value);
    return isNaN(d2.getTime()) ? 0 : d2.getTime();
  }

  function normalizeDetailItem(raw) {
    var item = raw || {};
    var qty = Number(item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1));
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;
    var unit = Number(item.unit_price != null ? item.unit_price : (item.price != null ? item.price : (item.unitPrice != null ? item.unitPrice : 0)));
    if (!Number.isFinite(unit) || unit < 0) unit = 0;
    var subtotal = Number(item.subtotal != null ? item.subtotal : (unit * qty));
    if (!Number.isFinite(subtotal) || subtotal < 0) subtotal = unit * qty;
    return {
      id: item.id || "",
      name: item.name || item.itemName || item.title || "",
      qty: qty,
      subtotal: subtotal,
      flavor: item.flavor || item.selectedFlavor || "",
      staple: item.staple || item.selectedStaple || "",
      note: item.item_note || item.note || "",
      createdAt: item.createdAt || item.updatedAt || null
    };
  }

  function renderDetailItemsHtml(items) {
    return (items || []).map(function (i) {
      var details = [];
      if (i.flavor) details.push("口味：" + i.flavor);
      if (i.staple) details.push("主食：" + i.staple);
      if (i.note) details.push("備註：" + i.note);
      var detailsHtml = details.length
        ? '<div style="color:var(--ops-muted);font-size:.78rem;margin-top:2px;">' + esc(details.join(" / ")) + "</div>"
        : "";
      return '<div class="pos-detail-item">' +
        '<span class="pos-detail-item__qty">' + Number(i.qty || 1) + 'x</span>' +
        '<span class="pos-detail-item__name">' + esc(i.name || "未命名品項") + detailsHtml + '</span>' +
        '<span class="pos-detail-item__price">NT$' + Number(i.subtotal || 0) + '</span>' +
        '</div>';
    }).join("");
  }

  function extractOrderFallbackItems(order) {
    var buckets = [];
    if (Array.isArray(order && order.items)) buckets = buckets.concat(order.items);
    if (Array.isArray(order && order.lineItems)) buckets = buckets.concat(order.lineItems);
    if (Array.isArray(order && order.normalizedItems)) buckets = buckets.concat(order.normalizedItems);
    if (Array.isArray(order && order.cartSnapshot)) buckets = buckets.concat(order.cartSnapshot);
    if (Array.isArray(order && order.groups)) {
      order.groups.forEach(function (group) {
        if (Array.isArray(group && group.items)) buckets = buckets.concat(group.items);
      });
    }
    return buckets.map(normalizeDetailItem).filter(function (item) {
      return !!(item.name || item.subtotal || item.qty);
    });
  }

  async function openDetailOverlay(order) {
    state.detailCurrentOrder = order;
    var completedSet = new Set(["completed", "cancelled"]);
    var orderStatusMeta = statusDisplayMeta(order.status || "new");
    var canAppend    = !completedSet.has(orderStatusMeta.key);

    var label    = order.pickupNumber ? "#" + order.pickupNumber : order.id.slice(-6);
    var status   = orderStatusMeta.key;
    var statusLbl= orderStatusMeta.label;
    var srcKey   = order.source || "pos";
    var srcLbl   = SOURCE_LABEL_MAP[srcKey] || srcKey;
    var total    = Number(order.total || order.totalAmount || order.subtotal || 0);

    el.detailTitle.textContent = "訂單 " + label;

    el.detailMeta.innerHTML = [
      metaRow("顧客", esc(order.customer_name || order.display_name || "—")),
      metaRow("狀態", '<span class="pos-status-pill pos-status-pill--' + esc(status) + '">' + esc(statusLbl) + '</span>'),
      metaRow("來源", '<span class="pos-source-badge pos-source-badge--' + esc(srcKey) + '">' + esc(srcLbl) + '</span>'),
      metaRow("時間", esc(tsToTime(order.createdAt))),
      order.scheduled_pickup_time ? metaRow("取餐時間", esc(order.scheduled_pickup_time)) : "",
      order.paymentMethod ? metaRow("付款", esc(order.paymentMethod)) : ""
    ].join("");

    el.detailItems.innerHTML = '<div class="pos-empty">品項載入中…</div>';
    el.detailTotal.textContent = "";
    el.detailNote.classList.add("hidden");
    el.detailAppendBtn.style.display = canAppend ? "" : "none";
    el.detailOverlay.classList.remove("hidden");

    var groupedRendered = false;
    if (Array.isArray(order.groups) && order.groups.length > 1) {
      try {
        var groupsHtml = order.groups.map(function (g) {
          var gItems = Array.isArray(g && g.items) ? g.items.map(normalizeDetailItem) : [];
          if (!gItems.length) return "";
          return '<div class="pos-order-group-header">' + esc(g.label || "") + '</div>' + renderDetailItemsHtml(gItems);
        }).filter(Boolean).join("");
        if (groupsHtml) {
          el.detailItems.innerHTML = groupsHtml;
          groupedRendered = true;
        }
      } catch (groupRenderError) {
        console.error("[POS] 訂單分組渲染失敗", {
          orderId: order.id,
          source: "order.groups",
          message: groupRenderError && groupRenderError.message || String(groupRenderError)
        });
      }
    }

    if (!groupedRendered) {
      var detailItems = [];
      var queryError = null;
      try {
        var db = state.context.db;
        var snap = await db.collection("order_items")
          .where("orderId", "==", order.id)
          .get();
        detailItems = snap.docs.map(function (doc) {
          var data = doc.data() || {};
          data.id = doc.id;
          return normalizeDetailItem(data);
        }).sort(function (a, b) {
          return toMillis(a.createdAt) - toMillis(b.createdAt);
        });
      } catch (e) {
        queryError = e;
        console.error("[POS] 訂單明細查詢失敗", {
          orderId: order.id,
          source: "order_items",
          query: { where: [["orderId", "==", order.id]] },
          code: e && e.code || "",
          message: e && e.message || String(e)
        });
      }

      if (!detailItems.length) {
        detailItems = extractOrderFallbackItems(order);
      }

      if (detailItems.length) {
        el.detailItems.innerHTML = renderDetailItemsHtml(detailItems);
      } else if (queryError) {
        el.detailItems.innerHTML = '<div class="pos-empty">品項載入失敗</div>';
      } else {
        el.detailItems.innerHTML = '<div class="pos-empty">此訂單沒有品項資料</div>';
      }
    }

    el.detailTotal.textContent = "合計：NT$" + total;
    if (order.note) {
      el.detailNote.textContent = "備註：" + order.note;
      el.detailNote.classList.remove("hidden");
    }
  }

  function closeDetailOverlay() {
    el.detailOverlay.classList.add("hidden");
    state.detailCurrentOrder = null;
  }

  function metaRow(label, valHtml) {
    return '<div class="pos-detail-meta-row">' +
      '<span class="pos-detail-meta-label">' + label + '</span>' +
      '<span class="pos-detail-meta-val">' + valHtml + '</span>' +
      '</div>';
  }

  // ── customers upsert ─────────────────────────────────────────

  function upsertCustomer(db, opts) {
    if (!opts.lineUserId) return;
    var ts  = firebase.firestore.FieldValue.serverTimestamp();
    var ref = db.collection("customers").doc(opts.lineUserId);
    ref.set({
      lineUserId:  opts.lineUserId,
      storeId:     opts.storeId,
      name:        opts.customerName || "",
      lastOrderId: opts.orderId || "",
      lastOrderAt: ts,
      updatedAt:   ts,
      createdAt:   ts
    }, { merge: true }).catch(function (e) { console.warn("[POS] customers upsert failed.", e); });
  }

  // ── helpers ──────────────────────────────────────────────────

  function cartToItems() {
    return state.cart.map(function (c) {
      return {
        sku:        c.itemId,
        itemId:     c.itemId,
        type:       c.type || "single",
        posType:    c.posType || "other",
        partId:     c.partId || "part_1",
        partLabel:  c.partLabel || "第1組",
        partIndex:  Number(c.partIndex || getPartIndexFromId(c.partId || "part_1")),
        name:       c.name,
        qty:        c.qty,
        flavor:     c.flavor || "",
        staple:     c.staple || "",
        inheritedFromPartFlavor: c.inheritedFromPartFlavor === true,
        selectedFlavor: c.flavor || "",
        selectedStaple: c.staple || "",
        options:    [],
        unit_price: c.unitPrice,
        price:      c.unitPrice,
        subtotal:   c.unitPrice * c.qty,
        item_note:  ""
      };
    });
  }

  function clearCart() {
    state.cart = [];
    resetPartContexts();
    setPaymentMethod("");
    setSource("walk_in");
    renderCart();
    if (el.customerName) el.customerName.value = "";
    if (el.lineUserId)   el.lineUserId.value   = "";
    if (el.pickupTime)   el.pickupTime.value   = "";
    if (el.note)         el.note.value         = "";
  }

  function mapDocs(snap) {
    return snap.docs.map(function (doc) { var d = doc.data(); d.id = doc.id; return d; });
  }

  function bySort(a, b) {
    // posSortOrder 優先，fallback 到 sort
    var aSort = a.posSortOrder != null ? Number(a.posSortOrder) : Number(a.sort || 0);
    var bSort = b.posSortOrder != null ? Number(b.posSortOrder) : Number(b.sort || 0);
    return aSort - bSort;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function tsToTime(ts) {
    if (!ts) return "—";
    var d;
    if (ts && typeof ts.toDate === "function") {
      d = ts.toDate();
    } else if (ts && ts.seconds) {
      d = new Date(ts.seconds * 1000);
    } else {
      d = new Date(ts);
    }
    if (isNaN(d.getTime())) return "—";
    // 台灣時間 UTC+8
    var local = new Date(d.getTime() + 8 * 3600000);
    return pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showStatus(msg, cls) {
    if (!msg) { el.status.style.display = "none"; return; }
    el.status.style.display = "block";
    el.status.textContent   = msg;
    el.status.className     = "pos-status" + (cls ? " " + cls : "");
  }
})();
