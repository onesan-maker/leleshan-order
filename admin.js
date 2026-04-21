(function () {
  var db;
  var auth;
  var functionsApi;
  var user = null;
  var admin = null;
  var storeId = null;
  var data = {
    stores: [],
    categories: [],
    menuItems: [],
    comboTemplates: [],
    flavors: [],
    inventory: [],
    inventoryMovements: [],
    promotions: [],
    employees: [],
    admins: [],
    users: [],
    orders: [],
    settings: null,
    platformOrders: [],
    platformMappings: [],
    importLogs: [],
    latestPlatformImportSummary: null,
    latestPlatformFailedRows: [],
    pointRules: [],
    pointTransactions: []
  };
  var el = {};
  var adminState = {
    autoSeedAttempted: false
  };
  var giftPromoRules = []; // in-memory rules for the admin UI editor
  var OWNER_ROLE = "owner";
  var ADMIN_ROLE = "admin";
  var EMPLOYEE_SESSION_HOURS = 16;
  var CATEGORY_COLOR_OPTIONS = [
    { value: "cream", label: "奶油米", bgColor: "#F7F1E3", buttonColor: "#B9853C", textColor: "#5A3418", buttonTextColor: "#FFFFFF" },
    { value: "warm-beige", label: "暖米色", bgColor: "#EFE3D3", buttonColor: "#A66A46", textColor: "#5B3723", buttonTextColor: "#FFFFFF" },
    { value: "light-wheat", label: "淡麥色", bgColor: "#F3E4C8", buttonColor: "#C9922E", textColor: "#5A3418", buttonTextColor: "#FFFFFF" },
    { value: "soft-yellow", label: "柔黃", bgColor: "#F6E8B1", buttonColor: "#B8891F", textColor: "#584110", buttonTextColor: "#FFFFFF" },
    { value: "pale-apricot", label: "淡杏色", bgColor: "#F3D9C3", buttonColor: "#C67A50", textColor: "#5D3424", buttonTextColor: "#FFFFFF" },
    { value: "light-blush", label: "淡粉膚", bgColor: "#F2DDD7", buttonColor: "#B46A66", textColor: "#5B3130", buttonTextColor: "#FFFFFF" },
    { value: "soft-olive", label: "淡橄欖", bgColor: "#E7E4C8", buttonColor: "#8F8A4D", textColor: "#494522", buttonTextColor: "#FFFFFF" },
    { value: "sage-light", label: "淺鼠尾草", bgColor: "#DDE5D6", buttonColor: "#759065", textColor: "#33442C", buttonTextColor: "#FFFFFF" },
    { value: "mist-blue", label: "霧藍灰", bgColor: "#DCE6E8", buttonColor: "#6F8D96", textColor: "#2E4850", buttonTextColor: "#FFFFFF" },
    { value: "pale-latte", label: "淺拿鐵", bgColor: "#E8D8C8", buttonColor: "#9D7156", textColor: "#4E3223", buttonTextColor: "#FFFFFF" }
  ];
  var DEFAULT_CATEGORY_COLOR = "warm-beige";
  var DEFAULT_PRODUCT_FLAVOR_OPTIONS = [
    "紅油麻辣",
    "藤椒",
    "鮮湯底",
    "骨湯麻辣燙",
    "麻辣乾拌"
  ];
  var DEFAULT_PRODUCT_STAPLE_OPTIONS = [
    "白飯",
    "泡麵",
    "寬粉"
  ];
  var REQUIRED_COMBO_NAMES = ["經典組合", "熱賣三倍肉", "招牌毛肚雙倍肉", "綜合鍋物"];

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    initFirebase();
    bind();
    renderCategoryColorOptions();
    initProductSpecEditors();
    auth.onAuthStateChanged(onAuth);
  });

  function cache() {
    el.userMeta = document.getElementById("admin-user-meta");
    el.status = document.getElementById("admin-status-message");
    el.storeSelect = document.getElementById("admin-store-select");
    el.seedBtn = document.getElementById("seed-default-data-btn");
    el.logoutBtn = document.getElementById("admin-logout-btn");
    el.nav = Array.prototype.slice.call(document.querySelectorAll(".admin-nav a"));
    el.views = Array.prototype.slice.call(document.querySelectorAll(".admin-view"));
    el.openFormButtons = Array.prototype.slice.call(document.querySelectorAll("[data-open-form]"));
    el.formPanels = Array.prototype.slice.call(document.querySelectorAll("[data-form-panel]"));
    el.modal = document.getElementById("admin-modal");
    el.modalTitle = document.getElementById("admin-modal-title");
    el.modalClose = document.getElementById("admin-modal-close");
    el.comboOptionGroups = document.getElementById("combo-option-groups");
    el.comboAddOptionBtn = document.getElementById("combo-add-option-btn");
    el.settingsSummary = document.getElementById("settings-summary-text");
    el.platform = {
      uberFile: document.getElementById("platform-ubereats-file"),
      pandaFile: document.getElementById("platform-foodpanda-file"),
      uberImportBtn: document.getElementById("platform-ubereats-import-btn"),
      pandaImportBtn: document.getElementById("platform-foodpanda-import-btn"),
      summary: document.getElementById("platform-import-summary"),
      todayStats: document.getElementById("platform-today-stats"),
      pendingMappings: document.getElementById("platform-pending-mappings"),
      ordersList: document.getElementById("platform-orders-list"),
      failedRows: document.getElementById("platform-failed-rows"),
      importLogs: document.getElementById("platform-import-logs")
    };
    el.lists = {
      stores: document.getElementById("stores-list"),
      categories: document.getElementById("categories-list"),
      menu: document.getElementById("menu-list"),
      combos: document.getElementById("combos-list"),
      flavors: document.getElementById("flavors-list"),
      orders: document.getElementById("orders-list"),
      inventory: document.getElementById("inventory-list"),
      employees: document.getElementById("employees-list"),
      users: document.getElementById("users-list"),
      promotions: document.getElementById("promotions-list")
    };
    el.adminsLineList = document.getElementById("admins-line-list");
    el.adminsLineRefreshBtn = document.getElementById("admins-line-refresh-btn");
    el.lineBindModal = document.getElementById("line-bind-modal");
    el.lineBindClose = document.getElementById("line-bind-close");
    el.lineBindBackdrop = document.getElementById("line-bind-backdrop");
    el.lineBindTargetLabel = document.getElementById("line-bind-target-label");
    el.lineBindModalStatus = document.getElementById("line-bind-modal-status");
    el.lineBindQrCanvas = document.getElementById("line-bind-qr-canvas");
    el.lineBindQrWrap = document.getElementById("line-bind-qr-wrap");
    el.lineBindCountdown = document.getElementById("line-bind-countdown");
    el.lineBindRegenBtn = document.getElementById("line-bind-regenerate-btn");
  }

  function initFirebase() {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    try {
      functionsApi = firebase.app().functions("us-central1");
    } catch (e) {
      console.error("[Admin] Firebase Functions init failed:", e);
    }
  }

  function addListener(target, eventName, handler) {
    if (!target || typeof target.addEventListener !== "function") return false;
    target.addEventListener(eventName, handler);
    return true;
  }

  function bind() {
    var reloginButton = document.getElementById("admin-access-relogin-btn");

    addListener(el.logoutBtn, "click", async function () {
      await auth.signOut();
      window.location.href = "/admin/login";
    });

    addListener(reloginButton, "click", signOutToLogin);

    addListener(el.seedBtn, "click", seedDefaults);

    addListener(el.storeSelect, "change", function () {
      storeId = el.storeSelect.value;
      localStorage.setItem("adminCurrentStoreId", storeId);
      loadScoped();
    });

    el.nav.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        history.pushState({}, "", link.getAttribute("href"));
        show(routeName());
      });
    });

    window.addEventListener("popstate", function () {
      show(routeName());
    });

    el.openFormButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        openCreateForm(button.getAttribute("data-open-form"));
      });
    });

    addListener(el.modalClose, "click", closeModal);
    addListener(el.modal, "click", function (event) {
      if (event.target && event.target.getAttribute("data-close-modal") === "true") {
        closeModal();
      }
    });

    addListener(document.getElementById("store-form"), "submit", saveStore);
    addListener(document.getElementById("category-form"), "submit", function (event) {
      event.preventDefault();
      saveDoc("categories", "category", buildCategory());
    });
    addListener(document.getElementById("menu-form"), "submit", function (event) {
      event.preventDefault();
      saveMenuItem();
    });
    addListener(document.getElementById("combo-form"), "submit", function (event) {
      event.preventDefault();
      saveComboTemplate();
    });
    addListener(document.getElementById("flavor-form"), "submit", function (event) {
      event.preventDefault();
      saveDoc("flavors", "flavor", buildFlavor());
    });
    addListener(document.getElementById("inventory-form"), "submit", function (event) {
      event.preventDefault();
      saveDoc("inventory", "inventory", buildInventory());
    });
    addListener(document.getElementById("promotion-form"), "submit", function (event) {
      event.preventDefault();
      saveDoc("promotions", "promotion", buildPromotion());
    });
    addListener(document.getElementById("settings-form"), "submit", saveSettings);
    addListener(document.getElementById("kds-timing-form"), "submit", saveKdsTiming);
    var kdstSimBtn = document.getElementById("kdst-sim-run-btn");
    if (kdstSimBtn) kdstSimBtn.addEventListener("click", runKdsTimingSimulator);
    var employeeForm = document.getElementById("employee-form");
    addListener(employeeForm, "submit", saveEmployee);
    var employeePinForm = document.getElementById("employee-pin-form");
    addListener(employeePinForm, "submit", resetEmployeePin);

    var ordersRefreshBtn = document.getElementById("orders-refresh-btn");
    if (ordersRefreshBtn) {
      ordersRefreshBtn.addEventListener("click", function () {
        loadScoped().then(function () { msg("訂單資料已重新整理"); });
      });
    }

    var ordersShowArchivedBtn = document.getElementById("orders-show-archived-btn");
    if (ordersShowArchivedBtn) {
      ordersShowArchivedBtn.addEventListener("click", function () {
        showArchivedOrders = !showArchivedOrders;
        if (showArchivedOrders) showTestOrdersOnly = false;
        renderOrders();
      });
    }

    var ordersShowTestBtn = document.getElementById("orders-show-test-btn");
    if (ordersShowTestBtn) {
      ordersShowTestBtn.addEventListener("click", function () {
        showTestOrdersOnly = !showTestOrdersOnly;
        if (showTestOrdersOnly) showArchivedOrders = false;
        renderOrders();
      });
    }

    var ordersDeleteTestBtn = document.getElementById("orders-delete-test-btn");
    if (ordersDeleteTestBtn) {
      ordersDeleteTestBtn.addEventListener("click", deleteTestOrders);
    }

    var pointRuleSaveBtn = document.getElementById("point-rule-save-btn");
    if (pointRuleSaveBtn) {
      pointRuleSaveBtn.addEventListener("click", savePointRule);
    }
    var giftPromoSaveBtn = document.getElementById("gift-promo-save-btn");
    if (giftPromoSaveBtn) {
      giftPromoSaveBtn.addEventListener("click", saveGiftPromotionSettings);
    }
    var giftPromoAddRuleBtn = document.getElementById("gift-promo-add-rule-btn");
    if (giftPromoAddRuleBtn) {
      giftPromoAddRuleBtn.addEventListener("click", function () {
        giftPromoRules.push({
          id: uid8(),
          name: "",
          enabled: true,
          minAmount: 0,
          maxAmount: null,
          maxStaple: 1,
          maxVegetable: 0,
          sort: giftPromoRules.length + 1,
          items: []
        });
        renderGiftRulesUI();
      });
    }
    bindSwitchLabel("point-rule-enabled", "point-rule-enabled-label", "啟用中", "未啟用");
    bindSwitchLabel("gift-promo-enabled", "gift-promo-enabled-label", "啟用中", "未啟用");

    var userSearchBtn = document.getElementById("user-search-btn");
    if (userSearchBtn) {
      userSearchBtn.addEventListener("click", function () { renderUsers(); });
    }
    var userDetailClose = document.getElementById("user-detail-close");
    if (userDetailClose) {
      userDetailClose.addEventListener("click", function () {
        var panel = document.getElementById("user-detail-panel");
        if (panel) panel.classList.add("hidden");
      });
    }
    var userPointAdjustBtn = document.getElementById("user-point-adjust-btn");
    if (userPointAdjustBtn) {
      userPointAdjustBtn.addEventListener("click", adjustUserPoints);
    }

    addListener(el.lineBindClose, "click", closeLineBindModal);
    addListener(el.lineBindBackdrop, "click", closeLineBindModal);
    addListener(el.adminsLineRefreshBtn, "click", loadAndRenderAdmins);
    addListener(el.lineBindRegenBtn, "click", function () {
      if (lineBindState.targetDocId) {
        generateLineBindToken(lineBindState.targetCollection, lineBindState.targetDocId, lineBindState.targetName);
      }
    });

    document.addEventListener("click", onDocumentClick);
    addListener(el.comboAddOptionBtn, "click", function () {
      appendComboGroup();
    });
    if (el.platform.uberImportBtn) {
      el.platform.uberImportBtn.addEventListener("click", function () {
        importPlatformCsv("ubereats");
      });
    }
    if (el.platform.pandaImportBtn) {
      el.platform.pandaImportBtn.addEventListener("click", function () {
        importPlatformCsv("foodpanda");
      });
    }

    bindSwitchLabel("store-active", "store-active-label", "啟用中", "停用中");
    bindSwitchLabel("category-enabled", "category-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("menu-is-staple", "menu-is-staple-label", "主食類", "非主食");
    bindSwitchLabel("menu-requires-flavor", "menu-requires-flavor-label", "需要選口味", "不需要口味");
    bindSwitchLabel("menu-requires-staple", "menu-requires-staple-label", "需要選主食", "不需要主食");
    bindSwitchLabel("menu-pos-hidden", "menu-pos-hidden-label", "POS 已隱藏", "POS 顯示中");
    bindSwitchLabel("menu-quick-add", "menu-quick-add-label", "快速加購", "標準模式");
    bindSwitchLabel("menu-enabled", "menu-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("combo-requires-flavor", "combo-requires-flavor-label", "需要選口味", "不需要口味");
    bindSwitchLabel("combo-requires-staple", "combo-requires-staple-label", "需要選主食", "不需要主食");
    bindSwitchLabel("combo-pos-hidden", "combo-pos-hidden-label", "POS 已隱藏", "POS 顯示中");
    bindSwitchLabel("combo-enabled", "combo-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("flavor-enabled", "flavor-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("promotion-enabled", "promotion-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("employee-active", "employee-active-label", "啟用", "停用");
    bindSwitchLabel("settings-open", "settings-open-label", "營業中", "休息中");
    bindSwitchLabel("settings-promo-enabled", "settings-promo-enabled-label", "啟用中", "未啟用");
    bindSwitchLabel("settings-gift-enabled", "settings-gift-enabled-label", "啟用中", "未啟用");
  }

  function renderCategoryColorOptions() {
    var select = document.getElementById("category-bg-color");
    var grid = document.getElementById("category-theme-options");
    if (!select || !grid) return;
    select.innerHTML = CATEGORY_COLOR_OPTIONS.map(function (option) {
      return '<option value="' + esc(option.value) + '">' + esc(option.label) + "</option>";
    }).join("");
    select.value = DEFAULT_CATEGORY_COLOR;
    grid.innerHTML = CATEGORY_COLOR_OPTIONS.map(function (option) {
      return '<button type="button" class="admin-theme-card' + (option.value === select.value ? ' is-selected' : '') + '" data-theme-value="' + esc(option.value) + '" aria-pressed="' + (option.value === select.value ? 'true' : 'false') + '"><span class="admin-theme-card__label">' + esc(option.label) + '</span><span class="admin-theme-card__preview" style="background:' + esc(option.bgColor) + ';color:' + esc(option.textColor) + '"><span>底色 ' + esc(option.bgColor) + '</span><span class="admin-theme-card__button" style="background:' + esc(option.buttonColor) + ';color:' + esc(option.buttonTextColor) + '">加入按鈕</span></span></button>';
    }).join("");
    updateCategoryColorPreview(select.value);
  }

  function getGlobalSpecOptions() {
    var settingsOptions = data.settings && data.settings.globalOptions ? data.settings.globalOptions : null;
    var flavorOptions = Array.isArray(settingsOptions && settingsOptions.flavors) && settingsOptions.flavors.length
      ? settingsOptions.flavors.slice()
      : DEFAULT_PRODUCT_FLAVOR_OPTIONS.slice();
    var stapleOptions = Array.isArray(settingsOptions && settingsOptions.staples) && settingsOptions.staples.length
      ? settingsOptions.staples.slice()
      : DEFAULT_PRODUCT_STAPLE_OPTIONS.slice();
    return {
      flavorOptions: flavorOptions,
      stapleOptions: stapleOptions
    };
  }

  function renderSpecOptionCheckboxes(rootId, options, selectedValues) {
    var root = document.getElementById(rootId);
    if (!root) return;
    var selectedSet = new Set(Array.isArray(selectedValues) ? selectedValues : []);
    root.innerHTML = options.map(function (option, index) {
      var inputId = rootId + "-" + index;
      var checkedAttr = selectedSet.has(option) ? ' checked' : "";
      return '<label for="' + esc(inputId) + '"><input type="checkbox" id="' + esc(inputId) + '" value="' + esc(option) + '"' + checkedAttr + '><span>' + esc(option) + "</span></label>";
    }).join("");
  }

  function readSpecOptionCheckboxes(rootId) {
    var root = document.getElementById(rootId);
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"]:checked')).map(function (checkbox) {
      return String(checkbox.value || "").trim();
    }).filter(Boolean);
  }

  function toggleSpecOptionVisibility() {
    var menuFlavorWrap = document.getElementById("menu-flavor-options-wrap");
    var menuStapleWrap = document.getElementById("menu-staple-options-wrap");
    var comboFlavorWrap = document.getElementById("combo-flavor-options-wrap");
    var comboStapleWrap = document.getElementById("combo-staple-options-wrap");
    var menuRequiresFlavor = document.getElementById("menu-requires-flavor");
    var menuRequiresStaple = document.getElementById("menu-requires-staple");
    var comboRequiresFlavor = document.getElementById("combo-requires-flavor");
    var comboRequiresStaple = document.getElementById("combo-requires-staple");

    if (menuFlavorWrap && menuRequiresFlavor) menuFlavorWrap.classList.toggle("hidden", !menuRequiresFlavor.checked);
    if (menuStapleWrap && menuRequiresStaple) menuStapleWrap.classList.toggle("hidden", !menuRequiresStaple.checked);
    if (comboFlavorWrap && comboRequiresFlavor) comboFlavorWrap.classList.toggle("hidden", !comboRequiresFlavor.checked);
    if (comboStapleWrap && comboRequiresStaple) comboStapleWrap.classList.toggle("hidden", !comboRequiresStaple.checked);
  }

  function initProductSpecEditors() {
    var specOptions = getGlobalSpecOptions();
    renderSpecOptionCheckboxes("menu-flavor-options", specOptions.flavorOptions, []);
    renderSpecOptionCheckboxes("menu-staple-options", specOptions.stapleOptions, []);
    renderSpecOptionCheckboxes("menu-pos-disabled-flavors", specOptions.flavorOptions, []);
    renderSpecOptionCheckboxes("menu-pos-disabled-staples", specOptions.stapleOptions, []);
    renderSpecOptionCheckboxes("combo-flavor-options", specOptions.flavorOptions, []);
    renderSpecOptionCheckboxes("combo-staple-options", specOptions.stapleOptions, []);
    renderSpecOptionCheckboxes("combo-pos-disabled-flavors", specOptions.flavorOptions, []);
    renderSpecOptionCheckboxes("combo-pos-disabled-staples", specOptions.stapleOptions, []);
    [
      "menu-requires-flavor",
      "menu-requires-staple",
      "combo-requires-flavor",
      "combo-requires-staple",
      "menu-pos-hidden",
      "combo-pos-hidden"
    ].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) {
        input.addEventListener("change", toggleSpecOptionVisibility);
      }
    });
    toggleSpecOptionVisibility();
  }

  function updateCategoryColorPreview(value) {
    var preview = document.getElementById("category-color-preview");
    if (!preview) return;
    var theme = categoryColorMeta(value);
    preview.innerHTML = '<div class="admin-color-preview__card" style="background:' + esc(theme.bgColor) + ";color:" + esc(theme.textColor) + '"><div class="admin-color-preview__label">' + esc(theme.label) + '</div><div>底色：' + esc(theme.bgColor) + '</div><div>按鈕色：' + esc(theme.buttonColor) + '</div><span class="admin-color-preview__button" style="background:' + esc(theme.buttonColor) + ";color:" + esc(theme.buttonTextColor) + '">加入按鈕</span></div>';
    syncCategoryThemeCards(theme.value);
  }

  function syncCategoryThemeCards(value) {
    Array.prototype.slice.call(document.querySelectorAll("[data-theme-value]")).forEach(function (button) {
      var selected = button.getAttribute("data-theme-value") === value;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function routeName() {
    var parts = location.pathname.split("/").filter(Boolean);
    return parts[1] || "dashboard";
  }

  function show(name) {
    if (name === "employees" && !canManage()) {
      name = "dashboard";
    }
    el.views.forEach(function (view) {
      view.classList.toggle("hidden", view.id !== "view-" + name);
    });
    el.nav.forEach(function (link) {
      link.classList.toggle("active", link.dataset.view === name);
    });
    renderByView(name);
  }

  function canManage() {
    return admin && (admin.role === OWNER_ROLE || admin.role === ADMIN_ROLE);
  }

  function isOwner() {
    return admin && admin.role === OWNER_ROLE;
  }

  function setupStoreSelector() {
    var list = isOwner()
      ? data.stores
      : data.stores.filter(function (store) { return store.id === admin.storeId; });

    if (!list.length && admin.storeId) {
      list = [{ id: admin.storeId, name: admin.storeId, isActive: true }];
    }

    el.storeSelect.innerHTML = list.map(function (store) {
      return '<option value="' + esc(store.id) + '">' + esc(store.name || store.id) + "</option>";
    }).join("");

    el.storeSelect.disabled = !isOwner();
    storeId = isOwner()
      ? (localStorage.getItem("adminCurrentStoreId") || (list[0] && list[0].id) || window.APP_CONFIG.store.defaultStoreId)
      : admin.storeId;
    el.storeSelect.value = storeId;

    var storesLink = el.nav.find(function (link) { return link.dataset.view === "stores"; });
    if (storesLink) {
      storesLink.style.display = isOwner() ? "block" : "none";
    }
    var employeesLink = el.nav.find(function (link) { return link.dataset.view === "employees"; });
    if (employeesLink) {
      employeesLink.style.display = canManage() ? "block" : "none";
    }

    // 測試訂單管理按鈕：僅 owner 可見
    var showTestBtn = document.getElementById("orders-show-test-btn");
    if (showTestBtn) showTestBtn.style.display = isOwner() ? "" : "none";
    var deleteTestBtn = document.getElementById("orders-delete-test-btn");
    if (deleteTestBtn) deleteTestBtn.style.display = isOwner() ? "" : "none";
  }

  function setAccessState(title, description, showRetry) {
    var shell = document.getElementById("admin-shell");
    var state = document.getElementById("admin-access-state");
    var titleEl = document.getElementById("admin-access-title");
    var descriptionEl = document.getElementById("admin-access-description");
    var retryButton = document.getElementById("admin-access-relogin-btn");

    if (shell) shell.classList.add("hidden");
    if (state) state.classList.remove("hidden");
    if (titleEl) titleEl.textContent = title;
    if (descriptionEl) descriptionEl.textContent = description;
    if (retryButton) retryButton.classList.toggle("hidden", !showRetry);
  }

  function showAdminShell() {
    var state = document.getElementById("admin-access-state");
    var shell = document.getElementById("admin-shell");
    if (state) state.classList.add("hidden");
    if (shell) shell.classList.remove("hidden");
  }

  async function signOutToLogin() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("[AdminAuth] signOut failed.", error);
    }
    window.location.href = "/admin/login";
  }

  async function verifyAdminAccess(uid) {
    var access = await window.AdminAuthHelper.fetchAdminAccess(db, uid);
    console.log("[AdminAuth] admins/{uid} 是否存在", access.exists);
    console.log("[AdminAuth] role 值", access.role || "(empty)");
    console.log("[AdminAuth] 權限驗證結果", access.allowed ? "allowed" : "denied");
    return access;
  }

  // CACHE_MARKER
  async function onAuth(current) {
    if (!current) {
      window.location.href = "/admin/login";
      return;
    }

    user = current;
    console.log("[AdminAuth] Google 登入成功", {
      email: user.email || "",
      displayName: user.displayName || ""
    });
    console.log("[AdminAuth] 目前 uid", user.uid);
    setAccessState("正在驗證後台權限", "請稍候，系統正在確認你的管理員身分。", false);

    try {
      var access = await verifyAdminAccess(user.uid);
      if (!access.allowed) {
        setAccessState("沒有後台權限", "此 Google 帳號尚未被加入管理名單", true);
        await auth.signOut();
        return;
      }

      admin = access.data || {};
      admin.role = access.role;
      if (el.userMeta) {
        el.userMeta.textContent = (admin.name || "未命名管理員") + " / " + admin.role;
      }

      await loadStores();
      setupStoreSelector();
      show(routeName());
      await loadScoped();
      showAdminShell();
      return;
    } catch (error) {
      console.error("[AdminAuth] 權限驗證失敗", error);
      console.log("[AdminAuth] 權限驗證結果", "denied");
      setAccessState("權限驗證失敗，請稍後再試", "目前無法完成權限驗證，請稍後重新登入。", true);
      return;
    }
  }

  async function loadStores() {
    var snap = await db.collection("stores").orderBy("createdAt", "asc").get();
    data.stores = snap.docs.map(function (doc) {
      var item = doc.data();
      item.id = doc.id;
      return item;
    });
  }

  // AUTH_MARKER
  async function loadScoped() {
    if (!storeId) return;

    msg("正在讀取 " + storeId + " 的資料...");
    console.log("[AdminData] Loading admin collections.", {
      storeId: storeId,
        paths: {
          categories: "categories where storeId==" + storeId,
          menuItems: "menu_items where storeId==" + storeId,
          comboTemplates: "comboTemplates where storeId==" + storeId,
        flavors: "flavors where storeId==" + storeId,
        inventory: "inventory where storeId==" + storeId,
        promotions: "promotions where storeId==" + storeId,
        employees: "employees where storeId==" + storeId,
        users: "users where storeId==" + storeId,
        orders: "orders where storeId==" + storeId,
        settings: "settings/" + storeId
      }
    });

    var results = await Promise.all([
      db.collection("categories").where("storeId", "==", storeId).get(),
      db.collection("menu_items").where("storeId", "==", storeId).get(),
      db.collection("menuItems").where("storeId", "==", storeId).get(),
      db.collection("comboTemplates").where("storeId", "==", storeId).get(),
      db.collection("flavors").where("storeId", "==", storeId).get(),
      db.collection("inventory").where("storeId", "==", storeId).get(),
      db.collection("promotions").where("storeId", "==", storeId).get(),
      db.collection("employees").where("storeId", "==", storeId).limit(300).get(),
      db.collection("users").where("storeId", "==", storeId).limit(100).get(),
      db.collection("orders").where("storeId", "==", storeId).limit(200).get(),
      db.collection("settings").doc(storeId).get(),
      db.collection("platform_orders").where("store_id", "==", storeId).get(),
      db.collection("platform_menu_mapping").where("store_id", "==", storeId).get(),
      db.collection("inventory_movements").where("store_id", "==", storeId).get(),
      db.collection("import_logs").where("store_id", "==", storeId).get(),
      db.collection("point_rules").where("storeId", "==", storeId).limit(5).get()
    ]);

    data.categories = mapDocs(results[0]).sort(bySort);
    var menuItemsNew = mapDocs(results[1]).map(function (item) { item._sourceCollection = "menu_items"; return normalizeMenuItem(item); }).sort(byMenuSort);
    var menuItemsLegacy = mapDocs(results[2]).map(function (item) { item._sourceCollection = "menuItems"; return normalizeMenuItem(item); }).sort(byMenuSort);
    data.menuItems = mergeMenuItems(menuItemsNew, menuItemsLegacy).sort(byMenuSort);
    data.comboTemplates = mapDocs(results[3]).map(normalizeComboTemplate).sort(bySort);
    data.flavors = mapDocs(results[4]).sort(bySort);
    data.inventory = mapDocs(results[5]);
    data.promotions = mapDocs(results[6]);
    var rawEmployees = mapDocs(results[7]).sort(byUpdatedDesc);
    await suppressDuplicateEmployees(rawEmployees);
    data.employees = uniqueEmployees(rawEmployees);
    data.users = mapDocs(results[8]).sort(byCreatedDesc);
    data.orders = mapDocs(results[9]).sort(byCreatedDesc);
    data.settings = results[10].exists ? results[10].data() : null;
    data.platformOrders = mapDocs(results[11]).sort(byCreatedDesc);
    data.platformMappings = mapDocs(results[12]).sort(byCreatedDesc);
    data.inventoryMovements = mapDocs(results[13]).sort(byCreatedDesc);
    data.importLogs = mapDocs(results[14]).sort(byCreatedDesc);
    data.pointRules = results[15] ? mapDocs(results[15]) : [];

    console.log("[AdminData] Firestore documents loaded.", {
      storeId: storeId,
      counts: {
        categories: data.categories.length,
        menuItems: data.menuItems.length,
        menuItemsNew: menuItemsNew.length,
        menuItemsLegacy: menuItemsLegacy.length,
        comboTemplates: data.comboTemplates.length,
        flavors: data.flavors.length,
        inventory: data.inventory.length,
        promotions: data.promotions.length,
        employees: data.employees.length,
        users: data.users.length,
        orders: data.orders.length,
        settings: data.settings ? 1 : 0,
        platformOrders: data.platformOrders.length,
        platformMappings: data.platformMappings.length,
        inventoryMovements: data.inventoryMovements.length,
        importLogs: data.importLogs.length
      }
    });

    if (!data.menuItems.length || !data.comboTemplates.length || !data.flavors.length) {
      console.warn("[AdminData] Some admin collections are empty.", {
        storeId: storeId,
        emptyCollections: {
          menuItems: data.menuItems.length === 0,
          comboTemplates: data.comboTemplates.length === 0,
          flavors: data.flavors.length === 0
        }
      });
    }

    if (!adminState.autoSeedAttempted && canManage() && shouldSeedDefaults()) {
      adminState.autoSeedAttempted = true;
      console.warn("[AdminData] Firestore is empty for store, starting one-time seed from defaults.js.", { storeId: storeId });
      await seedDefaultsInternal({ silent: true });
      return;
    }

    await ensureGlobalOptionsConfigured();
    await loadAdmins();
    renderByView(routeName());
    msg("已載入 " + storeId + " 的資料");
    await migrateQuickAddItems();
    await migrateComboSpecDefaults();
  }

  async function ensureGlobalOptionsConfigured() {
    var current = data.settings && data.settings.globalOptions ? data.settings.globalOptions : {};
    var next = {
      flavors: Array.isArray(current.flavors) && current.flavors.length ? current.flavors.slice() : DEFAULT_PRODUCT_FLAVOR_OPTIONS.slice(),
      staples: Array.isArray(current.staples) && current.staples.length ? current.staples.slice() : DEFAULT_PRODUCT_STAPLE_OPTIONS.slice()
    };
    var changed = !Array.isArray(current.flavors) || !current.flavors.length || !Array.isArray(current.staples) || !current.staples.length;
    if (!changed) return;
    try {
      await db.collection("settings").doc(storeId).set({
        storeId: storeId,
        globalOptions: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user && user.uid || ""
      }, { merge: true });
      data.settings = data.settings || {};
      data.settings.globalOptions = next;
      console.log("[Admin] globalOptions initialized in settings.", { storeId: storeId });
    } catch (error) {
      console.warn("[Admin] globalOptions init failed.", error);
    }
  }

  // 一次性將白飯、滷肉飯、王子麵、水餃設為 quickAdd=true（若尚未設定）
  async function migrateQuickAddItems() {
    var QUICK_ADD_NAMES = ["白飯", "滷肉飯", "王子麵", "水餃"];
    var toUpdate = data.menuItems.filter(function (item) {
      return QUICK_ADD_NAMES.indexOf(item.name) !== -1 && item.quickAdd !== true;
    });
    if (!toUpdate.length) return;
    try {
      var batch = db.batch();
      toUpdate.forEach(function (item) {
        var col = item._sourceCollection || "menu_items";
        batch.update(db.collection(col).doc(item.id), { quickAdd: true });
        item.quickAdd = true; // update local state immediately
      });
      await batch.commit();
      console.log("[Admin] migrateQuickAddItems: set quickAdd=true for", toUpdate.map(function (i) { return i.name; }));
    } catch (e) {
      console.warn("[Admin] migrateQuickAddItems failed:", e);
    }
  }

  async function migrateComboSpecDefaults() {
    var specOptions = getGlobalSpecOptions();
    function shouldApply(item) {
      var normalizedName = String(item && item.name || "").replace(/\s+/g, "");
      var idText = String(item && item.id || "").toLowerCase();
      return REQUIRED_COMBO_NAMES.some(function (name) {
        var normalizedTarget = String(name || "").replace(/\s+/g, "");
        return normalizedName === normalizedTarget
          || normalizedName.indexOf(normalizedTarget) >= 0
          || idText.indexOf(normalizedTarget.toLowerCase()) >= 0;
      });
    }
    var toUpdate = data.comboTemplates.filter(function (item) {
      if (!shouldApply(item)) return false;
      var flavorOptions = Array.isArray(item.flavorOptions) ? item.flavorOptions : [];
      var stapleOptions = Array.isArray(item.stapleOptions) ? item.stapleOptions : [];
      var missingFlavor = item.requiresFlavor !== true || flavorOptions.length === 0;
      var missingStaple = item.requiresStaple !== true || stapleOptions.length === 0;
      return missingFlavor || missingStaple;
    });
    if (!toUpdate.length) return;
    try {
      var batch = db.batch();
      toUpdate.forEach(function (item) {
        batch.update(db.collection("comboTemplates").doc(item.id), {
          requiresFlavor: true,
          requiresStaple: true,
          flavorOptions: specOptions.flavorOptions.slice(),
          stapleOptions: specOptions.stapleOptions.slice(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: user && user.uid || ""
        });
      });
      await batch.commit();
      toUpdate.forEach(function (item) {
        item.requiresFlavor = true;
        item.requiresStaple = true;
        item.flavorOptions = specOptions.flavorOptions.slice();
        item.stapleOptions = specOptions.stapleOptions.slice();
      });
      console.log("[Admin] migrateComboSpecDefaults updated.", toUpdate.map(function (item) { return item.name; }));
    } catch (error) {
      console.warn("[Admin] migrateComboSpecDefaults failed:", error);
    }
  }

  async function seedDefaults() {
    return seedDefaultsInternal({ silent: false });
  }

  async function seedDefaultsInternal(options) {
    if (!canManage()) return;

    var silent = options && options.silent;
    if (!silent && !window.confirm("這會把預設菜單寫入目前門市，確定要繼續嗎？")) return;

    var defaults = window.LELESHAN_DEFAULTS;
    var batch = db.batch();

    console.log("[AdminSeed] Starting defaults seed.", {
      storeId: storeId,
      source: "defaults.js"
    });

    batch.set(db.collection("stores").doc(storeId), {
      name: storeId === "store_1" ? "樂樂山新竹店" : storeId,
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    defaults.categories.forEach(function (item) { batch.set(db.collection("categories").doc(item.id), withStore(item), { merge: true }); });
    defaults.flavors.forEach(function (item) { batch.set(db.collection("flavors").doc(item.id), withStore(item), { merge: true }); });
    defaults.menuItems.forEach(function (item) {
      batch.set(db.collection("menu_items").doc(item.id), {
        ...withStore(item),
        category: item.categoryId || "未分類",
        categoryId: item.categoryId || "未分類",
        sortOrder: item.sort || 999,
        sort: item.sort || 999,
        isActive: item.enabled !== false,
        enabled: item.enabled !== false,
        requiresFlavor: item.requiresFlavor === true,
        requiresStaple: item.requiresStaple === true,
        flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
        stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
        posHidden: item.posHidden === true,
        posVisible: item.posHidden !== true,
        posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
        posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : [],
        imageUrl: item.imageUrl || "",
        updatedBy: user && user.uid || ""
      }, { merge: true });
      batch.set(db.collection("inventory").doc(storeId + "_" + item.id), {
        storeId: storeId,
        itemId: item.id,
        stock: 99,
        safeStock: 10,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    defaults.comboTemplates.forEach(function (item) {
      batch.set(db.collection("comboTemplates").doc(item.id), {
        ...withStore(item),
        requiresFlavor: item.requiresFlavor === true,
        requiresStaple: item.requiresStaple === true,
        flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
        stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
        posHidden: item.posHidden === true,
        posVisible: item.posHidden !== true,
        posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
        posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : []
      }, { merge: true });
      batch.set(db.collection("inventory").doc(storeId + "_" + item.id), {
        storeId: storeId,
        itemId: item.id,
        stock: 99,
        safeStock: 10,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    defaults.promotions.forEach(function (item) { batch.set(db.collection("promotions").doc(item.id), withStore(item), { merge: true }); });
    batch.set(db.collection("settings").doc(storeId), {
      storeId: storeId,
      ...defaults.settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    console.log("[AdminSeed] Defaults seed completed.", {
      storeId: storeId,
      counts: {
        categories: defaults.categories.length,
        flavors: defaults.flavors.length,
        menuItems: defaults.menuItems.length,
        comboTemplates: defaults.comboTemplates.length,
        promotions: defaults.promotions.length
      }
    });

    await loadStores();
    await loadScoped();
    if (!silent) msg("預設菜單已匯入完成");
  }

  function shouldSeedDefaults() {
    var hasDefaults = window.LELESHAN_DEFAULTS && window.LELESHAN_DEFAULTS.menuItems && window.LELESHAN_DEFAULTS.menuItems.length;
    var allEmpty = data.menuItems.length === 0 && data.comboTemplates.length === 0 && data.flavors.length === 0 && data.categories.length === 0;

    console.log("[AdminData] Seed decision.", {
      storeId: storeId,
      hasDefaults: !!hasDefaults,
      allEmpty: allEmpty
    });

    return hasDefaults && allEmpty;
  }

  function withStore(item) {
    return {
      ...item,
      storeId: storeId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  // LOAD_MARKER
  function renderAll() {
    renderDashboard();
    renderStores();
    renderCategories();
    renderMenu();
    renderCombos();
    renderFlavors();
    renderPromotions();
    renderOrders();
    renderInventory();
    renderEmployees();
    renderPlatformOrders();
    renderUsers();
    renderSettingsSummary();
    renderKdsTimingSummary();
    renderCategoryOptions();
    renderPointRuleSummary();
  }

  function renderByView(name) {
    var viewName = name || routeName();
    switch (viewName) {
      case "dashboard":
        renderDashboard();
        break;
      case "stores":
        renderStores();
        break;
      case "categories":
        renderCategories();
        break;
      case "menu":
        renderMenu();
        renderCategoryOptions();
        break;
      case "combos":
        renderCombos();
        break;
      case "flavors":
        renderFlavors();
        break;
      case "orders":
        renderOrders();
        break;
      case "inventory":
        renderInventory();
        break;
      case "employees":
        renderEmployees();
        renderAdminsLineSection();
        break;
      case "users":
        renderUsers();
        break;
      case "promotions":
        renderPromotions();
        break;
      case "platform-orders":
        renderPlatformOrders();
        break;
      case "settings":
        renderSettingsSummary();
        renderPointRuleSummary();
        break;
      case "kds-timing":
        renderKdsTimingSummary();
        break;
      default:
        break;
    }
  }

  /**
   * 統計計算共用過濾規則：
   * - 已封存（archived）、測試單（isTest）、已取消（cancelled）不列入統計
   * - Dashboard、熱門商品、時段分布、平均客單價都從此函式走
   */
  function isValidOrderForStats(order) {
    if (!order) return false;
    if (order.archived) return false;       // 封存單不列入
    if (order.isTest) return false;         // 測試單不列入
    if (order.status === "cancelled") return false; // 已取消不列入
    return true;
  }

  function renderDashboard() {
    var start = new Date();
    start.setHours(0, 0, 0, 0);

    var todayOrders = data.orders.filter(function (order) {
      var createdAt = toDate(order.createdAt);
      // 使用共用過濾邏輯，與訂單列表排除邏輯保持一致
      return createdAt && createdAt >= start && isValidOrderForStats(order);
    });
    var revenue = todayOrders.reduce(function (sum, order) {
      return sum + Number(order.totalAmount || 0);
    }, 0);
    var count = todayOrders.length;
    var average = count ? Math.round(revenue / count) : 0;
    var lowStock = data.inventory.filter(function (item) {
      return Number(item.stock || 0) <= Number(item.safeStock || 0);
    }).length;
    var topItems = {};
    var hours = {};

    todayOrders.forEach(function (order) {
      (order.items || []).forEach(function (item) {
        topItems[item.name] = (topItems[item.name] || 0) + Number(item.qty || 0);
      });
      var hour = String(toDate(order.createdAt).getHours()).padStart(2, "0");
      hours[hour] = (hours[hour] || 0) + 1;
    });

    document.getElementById("metric-revenue").textContent = "NT$ " + revenue;
    document.getElementById("metric-orders").textContent = String(count);
    document.getElementById("metric-average").textContent = "NT$ " + average;
    document.getElementById("metric-low-stock").textContent = String(lowStock);
    document.getElementById("dashboard-top-items").innerHTML = renderParagraphList(
      Object.keys(topItems).sort(function (left, right) { return topItems[right] - topItems[left]; }).slice(0, 5).map(function (name) {
        return name + "：" + topItems[name] + " 份";
      }),
      "今日尚無熱門商品資料"
    );
    document.getElementById("dashboard-hourly").innerHTML = renderParagraphList(
      Object.keys(hours).sort().map(function (hour) {
        return hour + ":00 - " + hours[hour] + " 筆";
      }),
      "今日尚無訂單時段資料"
    );
  }

  function renderStores() {
    el.lists.stores.innerHTML = data.stores.map(function (store) {
      var button = isOwner()
        ? '<button type="button" data-edit="stores" data-id="' + esc(store.id) + '">編輯</button>'
        : "";
      return buildCard(store.name || store.id, [
        { label: "門市代碼", value: store.id },
        { label: "門市名稱", value: store.name || "未設定" },
        { label: "門市狀態", value: statusPill(store.isActive !== false ? "啟用中" : "停用中", store.isActive !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有門市資料");
  }

  function renderCategories() {
    el.lists.categories.innerHTML = data.categories.map(function (item) {
      var button = canManage()
        ? '<button type="button" data-edit="categories" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      var colorMeta = categoryColorMeta(item.colorTheme || item.bgColor || item.themeColor);
      return buildCard(item.name || item.id, [
        { label: "分類編號", value: item.id },
        { label: "分類名稱", value: item.name || "未命名分類" },
        { label: "排序", value: String(item.sort || 0) },
        { label: "類別配色", value: '<span class="admin-color-chip"><span class="admin-color-chip__swatch" style="background:' + esc(colorMeta.bgColor) + '"></span><span class="admin-color-chip__swatch" style="background:' + esc(colorMeta.buttonColor) + '"></span>' + esc(colorMeta.label) + "</span>", html: true },
        { label: "分類狀態", value: statusPill(item.enabled !== false ? "啟用中" : "未啟用", item.enabled !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有分類資料");
  }

  function renderMenu() {
    el.lists.menu.innerHTML = data.menuItems.map(function (item) {
      var button = canManage()
        ? '<div class="admin-order-actions"><button type="button" data-edit="menu" data-id="' + esc(item.id) + '">編輯</button><button type="button" data-menu-toggle="' + esc(item.id) + '">' + esc(item.isActive ? "下架" : "上架") + '</button><button type="button" data-menu-delete="' + esc(item.id) + '">刪除</button></div>'
        : "";
      return buildCard(item.name || item.id, [
        { label: "品項編號", value: item.id },
        { label: "品項名稱", value: item.name || "未命名品項" },
        { label: "售價", value: "NT$ " + Number(item.price || 0) },
        { label: "分類", value: categoryName(item.category) },
        { label: "排序", value: String(item.sortOrder || 999) },
        { label: "說明", value: item.description || "無" },
        { label: "圖片網址", value: item.imageUrl || "無" },
        { label: "品項狀態", value: statusPill(item.isActive ? "上架中" : "已下架", item.isActive), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有菜單資料");
  }

  function menuCategoryDisplayName(item) {
    var raw = item && (item.category || item.categoryId || item.categoryName || "");
    var name = String(categoryName(raw) || "").trim();
    if (!name || name === "未設定") return "未分類";
    return name;
  }

  function menuCategoryDisplayRank(name) {
    var order = ["主食", "套餐", "肉品", "蔬菜", "火鍋料 A", "火鍋料 B", "飲品", "其他", "未分類"];
    var index = order.indexOf(name);
    return index >= 0 ? index : 999;
  }

  function menuGroupsForRender(items) {
    var groups = {};
    (items || []).forEach(function (item) {
      var groupName = menuCategoryDisplayName(item);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    return Object.keys(groups).sort(function (left, right) {
      var leftRank = menuCategoryDisplayRank(left);
      var rightRank = menuCategoryDisplayRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left || "").localeCompare(String(right || ""), "zh-Hant");
    }).map(function (name) {
      return {
        name: name,
        items: groups[name].slice().sort(byMenuSort)
      };
    });
  }

  function renderMenu() {
    var groups = menuGroupsForRender(data.menuItems || []);
    if (!groups.length) {
      el.lists.menu.innerHTML = emptyCard("目前沒有菜單資料");
      return;
    }
    el.lists.menu.innerHTML = groups.map(function (group) {
      return [
        '<section class="admin-group-section">',
        '<div class="admin-group-section__head"><h3>' + esc(group.name) + "（" + group.items.length + '項）</h3></div>',
        '<div class="admin-group-section__items">',
        group.items.map(function (item) {
          var button = canManage()
            ? '<div class="admin-order-actions"><button type="button" data-edit="menu" data-id="' + esc(item.id) + '">編輯</button><button type="button" data-menu-toggle="' + esc(item.id) + '">' + esc(item.isActive ? "下架" : "上架") + '</button><button type="button" data-menu-delete="' + esc(item.id) + '">刪除</button></div>'
            : "";
          return buildCard(item.name || item.id, [
            { label: "品項編號", value: item.id },
            { label: "品項名稱", value: item.name || "未命名品項" },
            { label: "售價", value: "NT$ " + Number(item.price || 0) },
            { label: "分類", value: group.name },
            { label: "排序", value: String(item.sortOrder || 999) },
            { label: "說明", value: item.description || "無" },
            { label: "圖片網址", value: item.imageUrl || "無" },
            { label: "品項狀態", value: statusPill(item.isActive ? "上架中" : "下架中", item.isActive), html: true }
          ], button);
        }).join(""),
        "</div>",
        "</section>"
      ].join("");
    }).join("");
  }

  function renderCombos() {
    el.lists.combos.innerHTML = data.comboTemplates.map(function (item) {
      var button = canManage()
        ? '<button type="button" data-edit="combos" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      return buildCard(item.name || item.id, [
        { label: "套餐編號", value: item.id },
        { label: "套餐名稱", value: item.name || "未命名套餐" },
        { label: "套餐售價", value: "NT$ " + Number(item.price || 0) },
        { label: "排序", value: String(item.sort || 0) },
        { label: "標籤", value: (item.tags || []).join("、") || "無" },
        { label: "套餐說明", value: item.description || "無" },
        { label: "套餐加購群組", value: groupSummary(item.optionGroups) },
        { label: "套餐狀態", value: statusPill(item.enabled !== false ? "啟用中" : "未啟用", item.enabled !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有套餐資料");
  }

  function renderFlavors() {
    el.lists.flavors.innerHTML = data.flavors.map(function (item) {
      var button = canManage()
        ? '<button type="button" data-edit="flavors" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      return buildCard(item.name || item.id, [
        { label: "口味編號", value: item.id },
        { label: "口味名稱", value: item.name || "未命名口味" },
        { label: "辣度標示", value: item.spicyLabel || "未設定" },
        { label: "排序", value: String(item.sort || 0) },
        { label: "口味說明", value: item.description || "無" },
        { label: "口味狀態", value: statusPill(item.enabled !== false ? "啟用中" : "未啟用", item.enabled !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有口味資料");
  }

  function renderPromotions() {
    // Load gift promo settings into the promotions view
    fillGiftPromotionFields("gift-promo", data.settings || {});
    el.lists.promotions.innerHTML = data.promotions.map(function (item) {
      var button = canManage()
        ? '<button type="button" data-edit="promotions" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      return buildCard(item.name || item.id, [
        { label: "優惠編號", value: item.id },
        { label: "優惠名稱", value: item.name || "未命名優惠" },
        { label: "優惠類型", value: item.type || "未設定" },
        { label: "最低消費", value: "NT$ " + Number(item.condition && item.condition.minAmount || 0) },
        { label: "回饋內容", value: rewardSummary(item.reward) },
        { label: "優惠狀態", value: statusPill(item.enabled !== false ? "啟用中" : "未啟用", item.enabled !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有優惠資料");
  }

  function renderInventory() {
    el.lists.inventory.innerHTML = data.inventory.map(function (item) {
      var low = Number(item.stock || 0) <= Number(item.safeStock || 0);
      var button = canManage()
        ? '<button type="button" data-edit="inventory" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      return buildCard(inventoryName(item.itemId), [
        { label: "庫存紀錄編號", value: item.id },
        { label: "品項名稱", value: inventoryName(item.itemId) },
        { label: "品項編號", value: item.itemId || "未設定" },
        { label: "目前庫存", value: String(item.stock || 0) },
        { label: "安全庫存", value: String(item.safeStock || 0) },
        { label: "庫存狀態", value: statusPill(low ? "庫存偏低" : "庫存正常", !low), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有庫存資料");
  }

  function renderEmployees() {
    renderEmployeeLineBinding();
    renderAdminsLineSection();
  }

  function employeePrimaryComparator(left, right) {
    var leftCreated = toDate(left.createdAt);
    var rightCreated = toDate(right.createdAt);
    var leftTime = leftCreated ? leftCreated.getTime() : Number.MAX_SAFE_INTEGER;
    var rightTime = rightCreated ? rightCreated.getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    var leftUpdated = toDate(left.updatedAt);
    var rightUpdated = toDate(right.updatedAt);
    var leftUpdatedTime = leftUpdated ? leftUpdated.getTime() : Number.MAX_SAFE_INTEGER;
    var rightUpdatedTime = rightUpdated ? rightUpdated.getTime() : Number.MAX_SAFE_INTEGER;
    if (leftUpdatedTime !== rightUpdatedTime) return leftUpdatedTime - rightUpdatedTime;
    return String(left.id || "").localeCompare(String(right.id || ""));
  }

  function uniqueEmployees(rawEmployees) {
    var groups = {};
    (rawEmployees || []).forEach(function (employee) {
      var id = String(employee.employeeId || "").trim();
      if (!id) return;
      if (!groups[id]) groups[id] = [];
      groups[id].push(employee);
    });
    return Object.keys(groups).map(function (employeeId) {
      var list = groups[employeeId].slice().sort(employeePrimaryComparator);
      return list[0];
    }).sort(byUpdatedDesc);
  }

  async function suppressDuplicateEmployees(rawEmployees) {
    if (!canManage()) return;
    var groups = {};
    (rawEmployees || []).forEach(function (employee) {
      var id = String(employee.employeeId || "").trim();
      if (!id) return;
      if (!groups[id]) groups[id] = [];
      groups[id].push(employee);
    });

    var duplicates = [];
    Object.keys(groups).forEach(function (employeeId) {
      var list = groups[employeeId];
      if (list.length <= 1) return;
      var sorted = list.slice().sort(employeePrimaryComparator);
      sorted.slice(1).forEach(function (item) { duplicates.push(item); });
    });
    if (!duplicates.length) return;

    try {
      var batch = db.batch();
      var changed = 0;
      duplicates.forEach(function (item) {
        if (item.isActive === false && item.duplicateSuppressed === true) return;
        batch.set(db.collection("employees").doc(item.id), {
          isActive: false,
          duplicateSuppressed: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        changed += 1;
      });
      if (changed > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.warn("[AdminEmployee] Failed to suppress duplicates.", error);
    }
  }

  function renderUsers() {
    var searchVal = (document.getElementById("user-search-input") || {}).value || "";
    var filtered = data.users;
    if (searchVal.trim()) {
      var keyword = searchVal.trim().toLowerCase();
      filtered = data.users.filter(function (item) {
        return (item.name || "").toLowerCase().indexOf(keyword) >= 0
          || (item.lineUserId || "").toLowerCase().indexOf(keyword) >= 0
          || (item.displayName || "").toLowerCase().indexOf(keyword) >= 0
          || (item.id || "").toLowerCase().indexOf(keyword) >= 0;
      });
    }
    el.lists.users.innerHTML = filtered.map(function (item) {
      var points = Number(item.currentPoints || item.points || 0);
      var spent = Number(item.totalSpent || 0);
      var orders = Number(item.totalOrders || 0);
      var lastOrder = item.lastOrderAt ? formatDate(item.lastOrderAt) : "無";
      var status = item.status === "disabled" ? "停用" : "啟用";
      return buildCompactCard(item.name || item.displayName || item.lineUserId || item.id, [
        points + " 點",
        "NT$ " + spent,
        orders + " 筆",
        status
      ], '<button type="button" data-user-detail="' + esc(item.id) + '">詳情</button>');
    }).join("") || emptyCard("目前沒有會員資料");
  }

  var selectedUserId = null;
  var showArchivedOrders = false;
  var showTestOrdersOnly = false;
  var savingEmployee = false;

  function normalizeGiftPoolInput(list) {
    return (Array.isArray(list) ? list : []).map(function (item) {
      if (!item) return null;
      if (typeof item === "string") return { id: item, name: item, priceAdjustment: 0 };
      var id = item.id || item.itemId || item.sku || "";
      var name = item.name || item.label || id;
      if (!id && !name) return null;
      return {
        id: id || name,
        name: name || id,
        priceAdjustment: Number(item.priceAdjustment || item.price || 0)
      };
    }).filter(Boolean);
  }

  function serializeGiftPool(list) {
    return normalizeGiftPoolInput(list).map(function (item) {
      return item.id + "|" + item.name;
    }).join("\n");
  }

  function parseGiftPoolTextarea(id) {
    return val(id).split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean).map(function (line) {
      var parts = line.split("|").map(function (item) { return item.trim(); }).filter(Boolean);
      if (!parts.length) return null;
      return {
        id: parts[0],
        name: parts[1] || parts[0],
        priceAdjustment: 0
      };
    }).filter(Boolean);
  }

  // Default gift rules for initial seeding
  var DEFAULT_GIFT_RULES = [
    {
      id: "rule-150-299", name: "150-299 主食 1 份", enabled: true, minAmount: 150, maxAmount: 299,
      maxStaple: 1, maxVegetable: 0, sort: 1,
      items: [
        { id: "white-rice", name: "白飯", type: "staple", enabled: true, sort: 1 },
        { id: "instant-noodle", name: "泡麵", type: "staple", enabled: true, sort: 2 },
        { id: "wide-noodle", name: "寬粉", type: "staple", enabled: true, sort: 3 }
      ]
    },
    {
      id: "rule-300-449", name: "300-449 主食 2 份", enabled: true, minAmount: 300, maxAmount: 449,
      maxStaple: 2, maxVegetable: 0, sort: 2,
      items: [
        { id: "white-rice", name: "白飯", type: "staple", enabled: true, sort: 1 },
        { id: "instant-noodle", name: "泡麵", type: "staple", enabled: true, sort: 2 },
        { id: "wide-noodle", name: "寬粉", type: "staple", enabled: true, sort: 3 }
      ]
    },
    {
      id: "rule-450-plus", name: "450+ 主食 2 份＋蔬菜 1 份", enabled: true, minAmount: 450, maxAmount: null,
      maxStaple: 2, maxVegetable: 1, sort: 3,
      items: [
        { id: "white-rice", name: "白飯", type: "staple", enabled: true, sort: 1 },
        { id: "instant-noodle", name: "泡麵", type: "staple", enabled: true, sort: 2 },
        { id: "wide-noodle", name: "寬粉", type: "staple", enabled: true, sort: 3 },
        { id: "cabbage", name: "高麗菜", type: "vegetable", enabled: true, sort: 4 },
        { id: "mainland-lettuce", name: "大陸妹", type: "vegetable", enabled: true, sort: 5 },
        { id: "baby-cabbage", name: "娃娃菜", type: "vegetable", enabled: true, sort: 6 }
      ]
    }
  ];

  function describeGiftPromotion(settings) {
    var promo = settings && settings.giftPromotion || {};
    var status = promo.enabled ? "啟用中" : "未啟用";
    var rules = promo.rules || [];
    var activeRules = rules.filter(function (r) { return r && r.enabled !== false; });
    if (!activeRules.length) return "狀態：" + status + "｜尚未設定區間規則";
    return "狀態：" + status + "｜共 " + activeRules.length + " 個啟用區間（" +
      activeRules.map(function (r) {
        return (r.name || ("NT$" + (r.minAmount || 0) + (r.maxAmount != null ? "–" + r.maxAmount : "+")));
      }).join("、") + "）";
  }

  function fillGiftPromotionFields(prefix, settings) {
    var promo = settings && settings.giftPromotion || {};
    var enabledEl = document.getElementById(prefix + "-enabled");
    if (enabledEl) enabledEl.checked = promo.enabled === true;
    if (prefix === "gift-promo") {
      giftPromoRules = cloneRules(promo.rules && promo.rules.length ? promo.rules : DEFAULT_GIFT_RULES);
      renderGiftRulesUI();
    }
    var statusEl = document.getElementById(prefix + "-status");
    if (statusEl) statusEl.textContent = describeGiftPromotion(settings);
  }

  function cloneRules(rules) {
    return (rules || []).map(function (r) {
      return {
        id: r.id || uid8(),
        name: r.name || "",
        enabled: r.enabled !== false,
        minAmount: Number(r.minAmount || 0),
        maxAmount: (r.maxAmount != null && r.maxAmount !== "") ? Number(r.maxAmount) : null,
        maxStaple: Number(r.maxStaple || 0),
        maxVegetable: Number(r.maxVegetable || 0),
        sort: Number(r.sort != null ? r.sort : 9999),
        items: (r.items || []).map(function (i) {
          return {
            id: (i.id || i.name || uid8()).trim(),
            name: i.name || i.id || "",
            type: i.type === "vegetable" ? "vegetable" : "staple",
            enabled: i.enabled !== false,
            sort: Number(i.sort != null ? i.sort : 9999)
          };
        })
      };
    });
  }

  function uid8() {
    return "r" + Math.random().toString(36).slice(2, 10);
  }

  function renderGiftRulesUI() {
    var container = document.getElementById("gift-promo-rules-list");
    if (!container) return;
    if (!giftPromoRules.length) {
      container.innerHTML = '<p style="color:var(--admin-muted);font-size:.88rem;">尚無區間規則，點下方「新增金額區間」。</p>';
      return;
    }
    container.innerHTML = giftPromoRules.map(function (rule, rIdx) {
      return buildRuleHTML(rule, rIdx);
    }).join("");
    attachGiftRuleEvents();
  }

  function buildRuleHTML(rule, rIdx) {
    var maxAmountVal = rule.maxAmount != null ? rule.maxAmount : "";
    var itemsHTML = (rule.items || []).map(function (item, iIdx) {
      return buildItemHTML(item, rIdx, iIdx);
    }).join("");
    return (
      '<div class="gr-card" data-rule-idx="' + rIdx + '">' +

        // ── Card header ──
        '<div class="gr-card-head">' +
          '<div class="gr-card-head-left">' +
            '<label class="gr-enabled-wrap" title="啟用此規則">' +
              '<input type="checkbox" class="gift-rule-enabled" data-rule="' + rIdx + '"' + (rule.enabled ? ' checked' : '') + '>' +
              '<span class="gr-enabled-dot"></span>' +
            '</label>' +
            '<span class="gr-card-index">規則 ' + (rIdx + 1) + '</span>' +
            '<input type="text" class="gift-rule-name gr-name-input" data-rule="' + rIdx + '" value="' + esc(rule.name || "") + '" placeholder="規則名稱（選填）">' +
          '</div>' +
          '<button type="button" class="gr-delete-btn gift-rule-delete" data-rule="' + rIdx + '">刪除規則</button>' +
        '</div>' +

        // ── Threshold row ──
        '<div class="gr-fields-grid">' +
          '<div class="gr-field">' +
            '<label class="gr-field-label">最低金額（元）</label>' +
            '<input type="number" class="gift-rule-min gr-field-input" data-rule="' + rIdx + '" value="' + rule.minAmount + '" min="0" placeholder="0">' +
          '</div>' +
          '<div class="gr-field">' +
            '<label class="gr-field-label">最高金額（元）</label>' +
            '<input type="number" class="gift-rule-max gr-field-input" data-rule="' + rIdx + '" value="' + maxAmountVal + '" placeholder="無上限">' +
          '</div>' +
          '<div class="gr-field">' +
            '<label class="gr-field-label">主食上限（份）</label>' +
            '<input type="number" class="gift-rule-staple gr-field-input gr-field-input--sm" data-rule="' + rIdx + '" value="' + rule.maxStaple + '" min="0">' +
          '</div>' +
          '<div class="gr-field">' +
            '<label class="gr-field-label">蔬菜上限（份）</label>' +
            '<input type="number" class="gift-rule-vegetable gr-field-input gr-field-input--sm" data-rule="' + rIdx + '" value="' + rule.maxVegetable + '" min="0">' +
          '</div>' +
        '</div>' +

        // ── Gift items sub-section ──
        '<div class="gr-items-section">' +
          '<div class="gr-items-header">' +
            '<span class="gr-items-title">可選贈品</span>' +
            '<button type="button" class="gr-add-item-btn gift-item-add" data-rule="' + rIdx + '">＋ 新增</button>' +
          '</div>' +
          (itemsHTML
            ? '<div class="gr-items-list">' + itemsHTML + '</div>'
            : '<p class="gr-items-empty">尚未設定任何贈品，請點擊「＋ 新增」。</p>') +
        '</div>' +

      '</div>'
    );
  }

  function buildItemHTML(item, rIdx, iIdx) {
    var menuOptions = '<option value="">（手動輸入品名）</option>' +
      (data.menuItems || []).map(function (m) {
        var sel = (m.id === item.id) ? ' selected' : '';
        return '<option value="' + esc(m.id) + '" data-name="' + esc(m.name) + '"' + sel + '>' + esc(m.name) + '</option>';
      }).join('');
    var showManual = !item.id || !(data.menuItems || []).some(function (m) { return m.id === item.id; });
    return (
      '<div class="gr-item-row" data-item-idx="' + iIdx + '">' +
        '<div class="gr-item-row-main">' +
          '<label class="gr-item-enabled-wrap" title="啟用此贈品">' +
            '<input type="checkbox" class="gift-item-enabled" data-rule="' + rIdx + '" data-item="' + iIdx + '"' + (item.enabled ? ' checked' : '') + '>' +
            '<span class="gr-item-dot"></span>' +
          '</label>' +
          '<div class="gr-item-name-col">' +
            '<select class="gift-item-menu-select gr-item-select" data-rule="' + rIdx + '" data-item="' + iIdx + '">' + menuOptions + '</select>' +
            '<input type="text" class="gift-item-name gr-item-name-input" data-rule="' + rIdx + '" data-item="' + iIdx + '" value="' + esc(item.name || "") + '" placeholder="自訂品名"' + (showManual ? '' : ' style="display:none;"') + '>' +
          '</div>' +
          '<select class="gift-item-type gr-item-type-select" data-rule="' + rIdx + '" data-item="' + iIdx + '">' +
            '<option value="staple"' + (item.type !== "vegetable" ? ' selected' : '') + '>主食</option>' +
            '<option value="vegetable"' + (item.type === "vegetable" ? ' selected' : '') + '>蔬菜</option>' +
          '</select>' +
          '<button type="button" class="gr-item-remove-btn gift-item-remove" data-rule="' + rIdx + '" data-item="' + iIdx + '">移除</button>' +
        '</div>' +
      '</div>'
    );
  }

  function attachGiftRuleEvents() {
    var container = document.getElementById("gift-promo-rules-list");
    if (!container) return;

    // Rule-level fields
    container.querySelectorAll(".gift-rule-enabled").forEach(function (el) {
      el.addEventListener("change", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].enabled = this.checked;
      });
    });
    container.querySelectorAll(".gift-rule-name").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].name = this.value;
      });
    });
    container.querySelectorAll(".gift-rule-min").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].minAmount = Number(this.value) || 0;
      });
    });
    container.querySelectorAll(".gift-rule-max").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var v = this.value.trim();
        giftPromoRules[rIdx].maxAmount = v === "" ? null : Number(v);
      });
    });
    container.querySelectorAll(".gift-rule-staple").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].maxStaple = Number(this.value) || 0;
      });
    });
    container.querySelectorAll(".gift-rule-vegetable").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].maxVegetable = Number(this.value) || 0;
      });
    });
    container.querySelectorAll(".gift-rule-delete").forEach(function (el) {
      el.addEventListener("click", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        if (!confirm("確認刪除此區間規則？")) return;
        giftPromoRules.splice(rIdx, 1);
        renderGiftRulesUI();
      });
    });

    // Menu item selector: when a menu item is chosen, update the rule's item id+name
    container.querySelectorAll(".gift-item-menu-select").forEach(function (el) {
      el.addEventListener("change", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var iIdx = parseInt(this.getAttribute("data-item"), 10);
        var selectedOption = this.options[this.selectedIndex];
        if (this.value) {
          giftPromoRules[rIdx].items[iIdx].id = this.value;
          giftPromoRules[rIdx].items[iIdx].name = selectedOption.getAttribute("data-name") || selectedOption.text;
          // Hide manual name input when menu item selected
          var nameInput = this.parentElement.querySelector(".gift-item-name");
          if (nameInput) nameInput.style.display = "none";
        } else {
          giftPromoRules[rIdx].items[iIdx].id = "";
          var nameInput2 = this.parentElement.querySelector(".gift-item-name");
          if (nameInput2) nameInput2.style.display = "";
        }
      });
    });

    // Item-level fields
    container.querySelectorAll(".gift-item-enabled").forEach(function (el) {
      el.addEventListener("change", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var iIdx = parseInt(this.getAttribute("data-item"), 10);
        giftPromoRules[rIdx].items[iIdx].enabled = this.checked;
      });
    });
    container.querySelectorAll(".gift-item-name").forEach(function (el) {
      el.addEventListener("input", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var iIdx = parseInt(this.getAttribute("data-item"), 10);
        giftPromoRules[rIdx].items[iIdx].name = this.value;
      });
    });
    container.querySelectorAll(".gift-item-type").forEach(function (el) {
      el.addEventListener("change", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var iIdx = parseInt(this.getAttribute("data-item"), 10);
        giftPromoRules[rIdx].items[iIdx].type = this.value;
      });
    });
    container.querySelectorAll(".gift-item-remove").forEach(function (el) {
      el.addEventListener("click", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        var iIdx = parseInt(this.getAttribute("data-item"), 10);
        giftPromoRules[rIdx].items.splice(iIdx, 1);
        renderGiftRulesUI();
      });
    });
    container.querySelectorAll(".gift-item-add").forEach(function (el) {
      el.addEventListener("click", function () {
        var rIdx = parseInt(this.getAttribute("data-rule"), 10);
        giftPromoRules[rIdx].items.push({ id: uid8(), name: "", type: "staple", enabled: true, sort: giftPromoRules[rIdx].items.length + 1 });
        renderGiftRulesUI();
      });
    });
  }

  function renderSettingsSummary() {
    var settingsOpen = document.getElementById("settings-open");
    var settingsPromoEnabled = document.getElementById("settings-promo-enabled");
    var settingsOpenNotice = document.getElementById("settings-open-notice");
    var settingsPromoText = document.getElementById("settings-promo-text");
    var settingsOpenFrom = document.getElementById("settings-open-from");
    var settingsOpenTo = document.getElementById("settings-open-to");
    if (!settingsOpen || !settingsPromoEnabled || !settingsOpenNotice || !settingsPromoText || !settingsOpenFrom || !settingsOpenTo) return;

    settingsOpen.checked = !!(data.settings && data.settings.isOpen);
    settingsPromoEnabled.checked = !!(data.settings && data.settings.promoEnabled);
    settingsOpenNotice.value = data.settings && data.settings.openNotice || "";
    settingsPromoText.value = data.settings && data.settings.promoText || "";
    settingsOpenFrom.value = data.settings && data.settings.openFrom || "";
    settingsOpenTo.value = data.settings && data.settings.openTo || "";
    syncSwitchLabels();

    if (el.settingsSummary) {
      el.settingsSummary.innerHTML = [
        statusPill(data.settings && data.settings.isOpen ? "營業中" : "休息中", !!(data.settings && data.settings.isOpen)),
        "<p><strong>營業公告：</strong>" + esc(data.settings && data.settings.openNotice || "未設定") + "</p>",
        "<p><strong>優惠提示：</strong>" + esc(data.settings && data.settings.promoText || "未設定") + "</p>",
        "<p><strong>優惠提示狀態：</strong>" + (data.settings && data.settings.promoEnabled ? "啟用中" : "未啟用") + "</p>",
        "<p><strong>接單時間：</strong>" + esc((data.settings && data.settings.openFrom) || "17:40") + " – " + esc((data.settings && data.settings.openTo) || "22:50") + "</p>",
        "<p><strong>滿額贈送：</strong>" + esc(describeGiftPromotion(data.settings || {})) + "（詳細規則在「優惠管理」）</p>"
      ].join("");
    }
    var giftStatusEl = document.getElementById("gift-promo-status");
    if (giftStatusEl) giftStatusEl.textContent = describeGiftPromotion(data.settings || {});
  }

  function renderCategoryOptions() {
    var menuCategory = document.getElementById("menu-category");
    if (!menuCategory) return;
    menuCategory.innerHTML = ['<option value="未分類">未分類</option>'].concat(data.categories.map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc(item.name || item.id) + "</option>";
    })).join("");
  }

  // RENDER_MARKER
  function onDocumentClick(event) {
    var themeButton = event.target.closest("[data-theme-value]");
    var editType = event.target.getAttribute("data-edit");
    var editId = event.target.getAttribute("data-id");
    var orderId = event.target.getAttribute("data-order-save");
    var menuToggleId = event.target.getAttribute("data-menu-toggle");
    var menuDeleteId = event.target.getAttribute("data-menu-delete");
    var removeGroupIndex = event.target.getAttribute("data-remove-combo-option");
    var addChoiceIndex = event.target.getAttribute("data-add-combo-choice");
    var removeChoiceIndex = event.target.getAttribute("data-remove-combo-choice");
    var mappingKey = event.target.getAttribute("data-platform-map");
    var ignoreMappingKey = event.target.getAttribute("data-platform-ignore");
    var userDetailId = event.target.getAttribute("data-user-detail");
    var employeeResetPinId = event.target.getAttribute("data-employee-reset-pin");
    var orderArchiveId = event.target.getAttribute("data-order-archive");
    var orderUnarchiveId = event.target.getAttribute("data-order-unarchive");
    var orderPermDeleteId = event.target.getAttribute("data-order-perm-delete");
    var orderMarkTestId = event.target.getAttribute("data-order-mark-test");

    if (themeButton) {
      var select = document.getElementById("category-bg-color");
      var themeValue = themeButton.getAttribute("data-theme-value");
      if (select && themeValue) {
        select.value = themeValue;
        updateCategoryColorPreview(themeValue);
      }
      return;
    }

    if (editType && editId) {
      edit(editType, editId);
      return;
    }

    if (orderId) {
      var status = document.querySelector('[data-order-status="' + orderId + '"]').value;
      updateOrder(orderId, status);
      return;
    }

    if (menuToggleId) {
      toggleMenuItem(menuToggleId);
      return;
    }

    if (menuDeleteId) {
      deleteMenuItem(menuDeleteId);
      return;
    }

    if (mappingKey) {
      savePlatformMapping(mappingKey);
      return;
    }

    if (ignoreMappingKey) {
      ignorePlatformMapping(ignoreMappingKey);
      return;
    }

    if (removeGroupIndex !== null && removeGroupIndex !== "") {
      removeComboGroup(Number(removeGroupIndex));
      return;
    }

    if (addChoiceIndex !== null && addChoiceIndex !== "") {
      appendComboChoice(Number(addChoiceIndex));
      return;
    }

    if (removeChoiceIndex) {
      var tokens = removeChoiceIndex.split(":");
      removeComboChoice(Number(tokens[0]), Number(tokens[1]));
      return;
    }

    if (userDetailId) {
      openUserDetail(userDetailId);
      return;
    }

    if (employeeResetPinId) {
      openEmployeePinForm(employeeResetPinId);
      return;
    }

    if (orderArchiveId) {
      archiveOrder(orderArchiveId, true);
      return;
    }

    if (orderUnarchiveId) {
      archiveOrder(orderUnarchiveId, false);
      return;
    }

    if (orderPermDeleteId) {
      permanentDeleteOrder(orderPermDeleteId);
      return;
    }

    if (orderMarkTestId) {
      markAsTest(orderMarkTestId);
      return;
    }

    var lineBindTarget = event.target.closest("[data-line-bind]");
    var lineReBindTarget = event.target.closest("[data-line-rebind]");
    var lineUnbindTarget = event.target.closest("[data-line-unbind]");
    var lineNotifyToggle = event.target.closest("[data-line-notify-toggle]");
    var lineConfirmToggle = event.target.closest("[data-line-confirm-toggle]");

    if (lineBindTarget || lineReBindTarget) {
      var el2 = lineBindTarget || lineReBindTarget;
      openLineBindModal(
        el2.getAttribute("data-target-collection"),
        el2.getAttribute("data-target-id"),
        el2.getAttribute("data-target-name")
      );
      return;
    }
    if (lineUnbindTarget) {
      var tName = lineUnbindTarget.getAttribute("data-target-name") || "此帳號";
      if (!confirm("確定要解除「" + tName + "」的 LINE 綁定嗎？\n解除後該帳號將無法收到 LINE 訂單通知。")) return;
      doUnbindLine(
        lineUnbindTarget.getAttribute("data-target-collection"),
        lineUnbindTarget.getAttribute("data-target-id"),
        tName
      );
      return;
    }
    if (lineNotifyToggle) {
      var checkbox = lineNotifyToggle.tagName === "INPUT" ? lineNotifyToggle : lineNotifyToggle.querySelector("input");
      if (checkbox) {
        saveLineNotificationSetting(
          checkbox.getAttribute("data-target-collection"),
          checkbox.getAttribute("data-target-id"),
          "notify_line_new_orders",
          checkbox.checked
        );
      }
      return;
    }
    if (lineConfirmToggle) {
      var checkbox2 = lineConfirmToggle.tagName === "INPUT" ? lineConfirmToggle : lineConfirmToggle.querySelector("input");
      if (checkbox2) {
        saveLineNotificationSetting(
          checkbox2.getAttribute("data-target-collection"),
          checkbox2.getAttribute("data-target-id"),
          "can_confirm_line_orders",
          checkbox2.checked
        );
      }
      return;
    }
  }

  function openCreateForm(type) {
    resetForm(type);
    if (type === "employee") {
      populateEmployeeStoreSelect();
      var pinWrap = document.getElementById("employee-pin-wrap");
      if (pinWrap) pinWrap.classList.remove("hidden");
      var employeeIdInput = document.getElementById("employee-id");
      if (employeeIdInput) employeeIdInput.disabled = false;
      var originalInput = document.getElementById("employee-original-id");
      if (originalInput) originalInput.value = "";
    }
    if (type === "settings") {
      document.getElementById("settings-open").checked = !!(data.settings && data.settings.isOpen);
      document.getElementById("settings-promo-enabled").checked = !!(data.settings && data.settings.promoEnabled);
      document.getElementById("settings-open-notice").value = data.settings && data.settings.openNotice || "";
      document.getElementById("settings-promo-text").value = data.settings && data.settings.promoText || "";
      document.getElementById("settings-open-from").value = data.settings && data.settings.openFrom || "";
      document.getElementById("settings-open-to").value = data.settings && data.settings.openTo || "";
      fillGiftPromotionFields("settings-gift", data.settings || {});
      syncSwitchLabels();
    }
    if (type === "kds-timing") {
      fillKdsTimingForm();
      if (typeof syncSwitchLabels === "function") syncSwitchLabels();
    }
    var editTypes = { settings: true, "kds-timing": true };
    openModal(type, editTypes[type] ? "編輯" : "新增");
  }

  function edit(type, id) {
    var item = findItem(type, id);
    if (!item) return;

    resetForm(type);

    if (type === "stores") {
      document.getElementById("store-id").value = item.id;
      document.getElementById("store-name").value = item.name || "";
      document.getElementById("store-active").checked = item.isActive !== false;
      renderStoreHoursGrid(item.businessHours);
    } else if (type === "categories") {
      document.getElementById("category-id").value = item.id;
      document.getElementById("category-name").value = item.name || "";
      document.getElementById("category-sort").value = item.sort || 0;
      document.getElementById("category-bg-color").value = categoryColorMeta(item.colorTheme || item.bgColor || item.themeColor).value;
      updateCategoryColorPreview(document.getElementById("category-bg-color").value);
      document.getElementById("category-enabled").checked = item.enabled !== false;
    } else if (type === "menu") {
      var specOptions = getGlobalSpecOptions();
      document.getElementById("menu-id").value = item.id;
      document.getElementById("menu-original-id").value = item.id; // 記錄原始 ID 用於 rename 偵測
      document.getElementById("menu-name").value = item.name || "";
      document.getElementById("menu-price").value = item.price || 0;
      document.getElementById("menu-category").value = item.category || "";
      document.getElementById("menu-sort").value = item.sortOrder || 999;
      document.getElementById("menu-image-url").value = item.imageUrl || "";
      document.getElementById("menu-tags").value = (item.tags || []).join(",");
      document.getElementById("menu-unit").value = item.unit || "";
      document.getElementById("menu-description").value = item.description || "";
      document.getElementById("menu-option-groups").value = JSON.stringify(item.optionGroups || [], null, 2);
      document.getElementById("menu-is-staple").checked = (function () {
        if (item.isStaple || item.staple || item.type === "staple") return true;
        var catId = (item.category || item.categoryId || "").toLowerCase();
        return catId === "staples" || catId === "staple" || catId.indexOf("staple") !== -1;
      })();
      document.getElementById("menu-requires-flavor").checked = item.requiresFlavor === true;
      document.getElementById("menu-requires-staple").checked = item.requiresStaple === true;
      renderSpecOptionCheckboxes("menu-flavor-options", specOptions.flavorOptions, item.flavorOptions || []);
      renderSpecOptionCheckboxes("menu-staple-options", specOptions.stapleOptions, item.stapleOptions || []);
      document.getElementById("menu-pos-hidden").checked = item.posHidden === true;
      renderSpecOptionCheckboxes("menu-pos-disabled-flavors", specOptions.flavorOptions, item.posDisabledFlavorOptions || []);
      renderSpecOptionCheckboxes("menu-pos-disabled-staples", specOptions.stapleOptions, item.posDisabledStapleOptions || []);
      toggleSpecOptionVisibility();
      document.getElementById("menu-quick-add").checked = item.quickAdd === true;
      document.getElementById("menu-enabled").checked = !!item.isActive;
    } else if (type === "combos") {
      var comboSpecOptions = getGlobalSpecOptions();
      document.getElementById("combo-id").value = item.id;
      document.getElementById("combo-name").value = item.name || "";
      document.getElementById("combo-price").value = item.price || 0;
      document.getElementById("combo-sort").value = item.sort || 0;
      document.getElementById("combo-tags").value = (item.tags || []).join(",");
      document.getElementById("combo-description").value = item.description || "";
      document.getElementById("combo-requires-flavor").checked = item.requiresFlavor === true;
      document.getElementById("combo-requires-staple").checked = item.requiresStaple === true;
      renderSpecOptionCheckboxes("combo-flavor-options", comboSpecOptions.flavorOptions, item.flavorOptions || []);
      renderSpecOptionCheckboxes("combo-staple-options", comboSpecOptions.stapleOptions, item.stapleOptions || []);
      document.getElementById("combo-pos-hidden").checked = item.posHidden === true;
      renderSpecOptionCheckboxes("combo-pos-disabled-flavors", comboSpecOptions.flavorOptions, item.posDisabledFlavorOptions || []);
      renderSpecOptionCheckboxes("combo-pos-disabled-staples", comboSpecOptions.stapleOptions, item.posDisabledStapleOptions || []);
      toggleSpecOptionVisibility();
      renderComboGroups(item.optionGroups || []);
      document.getElementById("combo-enabled").checked = item.enabled !== false;
    } else if (type === "flavors") {
      document.getElementById("flavor-id").value = item.id;
      document.getElementById("flavor-name").value = item.name || "";
      document.getElementById("flavor-sort").value = item.sort || 0;
      document.getElementById("flavor-spicy").value = item.spicyLabel || "";
      document.getElementById("flavor-description").value = item.description || "";
      document.getElementById("flavor-enabled").checked = item.enabled !== false;
    } else if (type === "inventory") {
      document.getElementById("inventory-id").value = item.id;
      document.getElementById("inventory-item-id").value = item.itemId || "";
      document.getElementById("inventory-stock").value = item.stock || 0;
      document.getElementById("inventory-safe-stock").value = item.safeStock || 0;
    } else if (type === "promotions") {
      document.getElementById("promotion-id").value = item.id;
      document.getElementById("promotion-name").value = item.name || "";
      document.getElementById("promotion-type").value = item.type || "gift";
      document.getElementById("promotion-min-amount").value = item.condition && item.condition.minAmount || 0;
      document.getElementById("promotion-reward-type").value = item.reward && item.reward.type || "";
      document.getElementById("promotion-reward-item-id").value = item.reward && item.reward.itemId || "";
      document.getElementById("promotion-reward-value").value = item.reward && item.reward.value || 0;
      document.getElementById("promotion-start-at").value = item.startAt ? formatDateTime(item.startAt) : "";
      document.getElementById("promotion-end-at").value = item.endAt ? formatDateTime(item.endAt) : "";
      document.getElementById("promotion-enabled").checked = item.enabled !== false;
    } else if (type === "employees") {
      populateEmployeeStoreSelect();
      document.getElementById("employee-original-id").value = item.id || "";
      document.getElementById("employee-name").value = item.name || "";
      document.getElementById("employee-id").value = item.employeeId || "";
      document.getElementById("employee-id").disabled = true;
      document.getElementById("employee-store-id").value = item.storeId || storeId;
      document.getElementById("employee-active").checked = item.isActive !== false;
      var pinWrap = document.getElementById("employee-pin-wrap");
      if (pinWrap) pinWrap.classList.add("hidden");
    }

    syncSwitchLabels();
    openModal(type, "編輯");
  }

  // ── 營業時段（員工 LINE 靜音窗）─────────────────────────────
  var BUSINESS_HOURS_DAYS = [
    { key: "mon", label: "一" },
    { key: "tue", label: "二" },
    { key: "wed", label: "三" },
    { key: "thu", label: "四" },
    { key: "fri", label: "五" },
    { key: "sat", label: "六" },
    { key: "sun", label: "日" }
  ];

  function defaultBusinessHours() {
    var out = {};
    BUSINESS_HOURS_DAYS.forEach(function (d) {
      out[d.key] = { open: "17:30", close: "22:30", closed: false };
    });
    out.sat = { open: "", close: "", closed: true };
    return out;
  }

  function normalizeHhMm(value) {
    var s = String(value == null ? "" : value).trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) return "";
    var parts = s.split(":");
    var h = Math.max(0, Math.min(23, Number(parts[0]) || 0));
    var m = Math.max(0, Math.min(59, Number(parts[1]) || 0));
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function renderStoreHoursGrid(hours) {
    var grid = document.getElementById("store-hours-grid");
    if (!grid) return;
    var current = hours && typeof hours === "object" ? hours : defaultBusinessHours();
    var rows = BUSINESS_HOURS_DAYS.map(function (d) {
      var h = current[d.key] || { open: "", close: "", closed: false };
      var isClosed = !!h.closed;
      var open = normalizeHhMm(h.open) || "17:30";
      var close = normalizeHhMm(h.close) || "22:30";
      return ''
        + '<div class="store-hours-row" data-day="' + d.key + '">'
        +   '<span class="store-hours-day">週' + d.label + '</span>'
        +   '<label class="store-hours-closed"><input type="checkbox" data-hours-closed="' + d.key + '"' + (isClosed ? ' checked' : '') + '><span>公休</span></label>'
        +   '<input type="time" data-hours-open="' + d.key + '" value="' + open + '"' + (isClosed ? ' disabled' : '') + '>'
        +   '<span class="store-hours-sep">–</span>'
        +   '<input type="time" data-hours-close="' + d.key + '" value="' + close + '"' + (isClosed ? ' disabled' : '') + '>'
        + '</div>';
    });
    grid.innerHTML = rows.join("");
    BUSINESS_HOURS_DAYS.forEach(function (d) {
      var cb = grid.querySelector('[data-hours-closed="' + d.key + '"]');
      if (!cb) return;
      cb.addEventListener("change", function () {
        var open = grid.querySelector('[data-hours-open="' + d.key + '"]');
        var close = grid.querySelector('[data-hours-close="' + d.key + '"]');
        if (open) open.disabled = cb.checked;
        if (close) close.disabled = cb.checked;
      });
    });
  }

  function readStoreHoursFromForm() {
    var grid = document.getElementById("store-hours-grid");
    if (!grid) return defaultBusinessHours();
    var out = {};
    BUSINESS_HOURS_DAYS.forEach(function (d) {
      var closedEl = grid.querySelector('[data-hours-closed="' + d.key + '"]');
      var openEl = grid.querySelector('[data-hours-open="' + d.key + '"]');
      var closeEl = grid.querySelector('[data-hours-close="' + d.key + '"]');
      var closed = !!(closedEl && closedEl.checked);
      var open = normalizeHhMm(openEl && openEl.value);
      var close = normalizeHhMm(closeEl && closeEl.value);
      out[d.key] = closed
        ? { open: "", close: "", closed: true }
        : { open: open, close: close, closed: false };
    });
    return out;
  }

  async function saveStore(event) {
    event.preventDefault();
    if (!isOwner()) return;

    var docId = val("store-id");
    await db.collection("stores").doc(docId).set({
      name: val("store-name"),
      isActive: document.getElementById("store-active").checked,
      businessHours: readStoreHoursFromForm(),
      businessHoursUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await loadStores();
    setupStoreSelector();
    renderStores();
    closeModal();
    msg("門市資料已儲存");
  }

  async function saveDoc(collection, prefix, payload) {
    if (!canManage()) return;

    var baseId = val(prefix + "-id") || db.collection(collection).doc().id;
    var docId = prefix === "inventory" && !val(prefix + "-id") ? storeId + "_" + payload.itemId : baseId;

    await db.collection(collection).doc(docId).set({
      storeId: storeId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...payload
    }, { merge: true });

    console.log("[AdminData] Saved document.", {
      collection: collection,
      docId: docId,
      storeId: storeId
    });

    closeModal();
    await loadScoped();
    msg(collection + " 已儲存");
  }

  function validateSpecRequirements(payload, namePrefix) {
    if (payload.requiresFlavor === true && (!Array.isArray(payload.flavorOptions) || !payload.flavorOptions.length)) {
      msg((namePrefix || "此商品") + "已勾選需要口味，請至少勾選一個可用口味");
      return false;
    }
    if (payload.requiresStaple === true && (!Array.isArray(payload.stapleOptions) || !payload.stapleOptions.length)) {
      msg((namePrefix || "此商品") + "已勾選需要主食，請至少勾選一個可用主食");
      return false;
    }
    return true;
  }

  async function saveComboTemplate() {
    if (!canManage()) return;
    var payload = buildCombo();
    if (!validateSpecRequirements(payload, "此套餐")) return;
    await saveDoc("comboTemplates", "combo", payload);
  }

  async function saveMenuItem() {
    if (!canManage()) return;

    // originalId = Firestore 文件 ID（不可變，編輯時永遠用這個寫回）
    // menuIdField = 「品項編號」欄位值（可修改，只是文件內的一個欄位）
    var originalId = val("menu-original-id").trim();
    var isNew = !originalId;

    // 新增時：使用 menu-id 作為 doc ID（若空白則自動產生）
    var docId;
    if (isNew) {
      docId = val("menu-id").trim() || db.collection("menu_items").doc().id;
    } else {
      // 編輯時：永遠寫回原始 doc ID，絕不新增新文件
      docId = originalId;
    }

    var payload = buildMenuItem();
    if (!validateSpecRequirements(payload, "此品項")) return;
    var firestoreData = {
      storeId: storeId,
      name: payload.name,
      price: payload.price,
      category: payload.category,
      categoryId: payload.category,
      sortOrder: payload.sortOrder,
      sort: payload.sortOrder,
      isActive: payload.isActive,
      enabled: payload.isActive,
      isStaple: payload.isStaple,
      requiresFlavor: payload.requiresFlavor,
      requiresStaple: payload.requiresStaple,
      flavorOptions: payload.flavorOptions,
      stapleOptions: payload.stapleOptions,
      posHidden: payload.posHidden === true,
      posVisible: payload.posHidden !== true,
      posDisabledFlavorOptions: payload.posDisabledFlavorOptions,
      posDisabledStapleOptions: payload.posDisabledStapleOptions,
      quickAdd: payload.quickAdd,
      description: payload.description,
      imageUrl: payload.imageUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user && user.uid || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      tags: payload.tags,
      unit: payload.unit,
      optionGroups: payload.optionGroups
    };

    try {
      await db.collection("menu_items").doc(docId).set(firestoreData, { merge: true });
      console.log("[AdminMenu] Saved menu item.", { docId: docId, action: isNew ? "create" : "update" });
      msg(isNew ? "新增成功" : "更新成功");
      closeModal();
      await loadScoped();
    } catch (error) {
      console.error("[AdminMenu] Save failed.", error);
      msg("儲存失敗：" + (error.message || error));
    }
  }

  async function toggleMenuItem(id) {
    if (!canManage()) return;
    var item = data.menuItems.find(function (entry) { return entry.id === id; });
    if (!item) return;

    var newActive = !item.isActive;
    try {
      await db.collection("menu_items").doc(id).set({
        storeId: storeId,
        name: item.name,
        price: item.price,
        category: item.category,
        categoryId: item.category,
        sortOrder: item.sortOrder,
        sort: item.sortOrder,
        description: item.description,
        imageUrl: item.imageUrl,
        tags: item.tags,
        unit: item.unit,
        optionGroups: item.optionGroups,
        requiresFlavor: item.requiresFlavor === true,
        requiresStaple: item.requiresStaple === true,
        flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
        stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
        posHidden: item.posHidden === true,
        posVisible: item.posHidden !== true,
        posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
        posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : [],
        isActive: newActive,
        enabled: newActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user && user.uid || ""
      }, { merge: true });
      item.isActive = newActive;
      item.enabled = newActive;
      renderMenu();
      console.log("[AdminMenu] Toggled menu item.", { docId: id, isActive: newActive });
      msg("狀態已更新");
    } catch (error) {
      console.error("[AdminMenu] Toggle failed.", error);
      msg("狀態更新失敗，請稍後再試");
    }
  }

  async function deleteMenuItem(id) {
    if (!canManage()) return;
    if (!window.confirm("確定要刪除這筆菜單品項嗎？")) return;

    try {
      await Promise.all([
        db.collection("menu_items").doc(id).delete(),
        db.collection("menuItems").doc(id).delete()
      ]);
      console.log("[AdminMenu] Deleted menu item.", { docId: id });
      await loadScoped();
      msg("刪除成功");
    } catch (error) {
      console.error("[AdminMenu] Delete failed.", error);
      msg("刪除失敗，請確認權限設定");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!canManage()) return;

    await db.collection("settings").doc(storeId).set({
      storeId: storeId,
      isOpen: document.getElementById("settings-open").checked,
      promoEnabled: document.getElementById("settings-promo-enabled").checked,
      openNotice: val("settings-open-notice"),
      promoText: val("settings-promo-text"),
      openFrom: val("settings-open-from") || "17:40",
      openTo: val("settings-open-to") || "22:50",
      giftPromotion: Object.assign(
        {},
        (data.settings && data.settings.giftPromotion) || {},
        { enabled: checked("settings-gift-enabled") }
      ),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    closeModal();
    await loadScoped();
    msg("營業狀態設定已儲存");
  }

  function getDefaultKdsTimingRules() {
    var helpers = window.LeLeShanOrders;
    return (helpers && helpers.DEFAULT_KDS_TIMING_RULES)
      ? JSON.parse(JSON.stringify(helpers.DEFAULT_KDS_TIMING_RULES))
      : {
        queueBaseMinutes: { first: 5, second: 7, third: 10, afterThirdIncrement: 3 },
        amountRule: { baseAmount: 200, stepAmount: 100, stepMinutes: 2, roundUp: true },
        longCookRule: { enabled: true, minMinutes: 6.5, keywords: ["火鍋料", "寬粉", "水餃", "玉米筍", "烏龍麵"] },
        startBufferMinutes: 1,
        overdueAlertAfterMinutes: 3
      };
  }

  function getCurrentKdsTimingRules() {
    var helpers = window.LeLeShanOrders;
    if (helpers && typeof helpers.getKdsTimingRules === "function") {
      return helpers.getKdsTimingRules(data.settings || {});
    }
    return getDefaultKdsTimingRules();
  }

  function fillKdsTimingForm() {
    var r = getCurrentKdsTimingRules();
    var q = r.queueBaseMinutes || {};
    var a = r.amountRule || {};
    var tiers = Array.isArray(a.tiers) && a.tiers.length >= 4 ? a.tiers : [
      { upTo: 200, minutes: 0 }, { upTo: 400, minutes: 2 }, { upTo: 700, minutes: 4 }, { upTo: null, minutes: 6 }
    ];
    var lo = r.largeOrderRule || {};
    var l = r.longCookRule || {};
    function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = (v == null ? "" : v); }
    function setChk(id, v) { var el = document.getElementById(id); if (el) el.checked = !!v; }

    // queueBaseMinutes slots（v2.7）：若 stored 無 slots 則用 first/second/third + 預設再填回前 6 格
    var defaultSlots = [5, 6, 8, 11, 14, 17];
    var slotsByPos = {};
    if (Array.isArray(q.slots) && q.slots.length) {
      q.slots.forEach(function (s) {
        if (s && Number.isFinite(Number(s.position))) slotsByPos[Number(s.position)] = Number(s.minutes);
      });
    }
    for (var i = 1; i <= 6; i++) {
      var val;
      if (slotsByPos[i] != null && Number.isFinite(slotsByPos[i])) val = slotsByPos[i];
      else if (i === 1 && Number.isFinite(Number(q.first))) val = Number(q.first);
      else if (i === 2 && Number.isFinite(Number(q.second))) val = Number(q.second);
      else if (i === 3 && Number.isFinite(Number(q.third))) val = Number(q.third);
      else if (i > 3 && Number.isFinite(Number(q.third)) && Number.isFinite(Number(q.afterThirdIncrement))) {
        val = Number(q.third) + (i - 3) * Number(q.afterThirdIncrement);
      } else {
        val = defaultSlots[i - 1];
      }
      setVal("kdst-queue-slot" + i, val);
    }
    var afterLast = q.afterLastIncrement != null ? Number(q.afterLastIncrement) : (Number.isFinite(Number(q.afterThirdIncrement)) ? Number(q.afterThirdIncrement) : 3);
    setVal("kdst-queue-after-last", afterLast);
    // tiered 金額加時
    setVal("kdst-amt-tier1-upto", tiers[0] && tiers[0].upTo);
    setVal("kdst-amt-tier1-min",  tiers[0] && tiers[0].minutes);
    setVal("kdst-amt-tier2-upto", tiers[1] && tiers[1].upTo);
    setVal("kdst-amt-tier2-min",  tiers[1] && tiers[1].minutes);
    setVal("kdst-amt-tier3-upto", tiers[2] && tiers[2].upTo);
    setVal("kdst-amt-tier3-min",  tiers[2] && tiers[2].minutes);
    setVal("kdst-amt-tier4-min",  tiers[3] && tiers[3].minutes);
    // 超大單
    setChk("kdst-large-enabled", lo.enabled !== false);
    setVal("kdst-large-item1", lo.itemCountThreshold1);
    setVal("kdst-large-extra1", lo.extraMinutes1);
    setVal("kdst-large-item2", lo.itemCountThreshold2);
    setVal("kdst-large-extra2", lo.extraMinutes2);
    setVal("kdst-large-group1", lo.groupCountThreshold1);
    setVal("kdst-large-group2", lo.groupCountThreshold2);
    // 長煮
    setChk("kdst-long-enabled", l.enabled !== false);
    setVal("kdst-long-min", l.minMinutes);
    setVal("kdst-long-keywords", Array.isArray(l.keywords) ? l.keywords.join("\n") : "");
    // 其他
    setVal("kdst-buffer", r.startBufferMinutes);
    setVal("kdst-overdue-alert", r.overdueAlertAfterMinutes);
  }

  function renderKdsTimingSummary() {
    var el = document.getElementById("kds-timing-summary-text");
    if (!el) return;
    var r = getCurrentKdsTimingRules();
    var q = r.queueBaseMinutes || {};
    var a = r.amountRule || {};
    var lo = r.largeOrderRule || {};
    var l = r.longCookRule || {};
    var keywordsStr = Array.isArray(l.keywords) && l.keywords.length ? l.keywords.join("、") : "（無）";

    var tierStr;
    if (Array.isArray(a.tiers) && a.tiers.length) {
      var parts = [];
      var prev = 0;
      a.tiers.forEach(function (t, idx) {
        var mins = Number(t.minutes) || 0;
        if (t.upTo == null) {
          parts.push(prev + 1 + "+ 元 → +" + mins + " 分（封頂）");
        } else {
          var lower = idx === 0 ? 0 : (prev + 1);
          parts.push(lower + "–" + t.upTo + " 元 → +" + mins + " 分");
          prev = Number(t.upTo);
        }
      });
      tierStr = parts.join("、");
    } else {
      tierStr = esc(a.baseAmount) + "元以上，每" + esc(a.stepAmount) + "元 +" + esc(a.stepMinutes) + "分（legacy 線性）";
    }

    var largeStr = lo.enabled === false
      ? "未啟用"
      : ("item≥" + esc(lo.itemCountThreshold1) + " 或 group≥" + esc(lo.groupCountThreshold1) + " → +" + esc(lo.extraMinutes1) + " 分；"
        + "item≥" + esc(lo.itemCountThreshold2) + " 或 group≥" + esc(lo.groupCountThreshold2) + " → +" + esc(lo.extraMinutes2) + " 分（取較大級）");

    var queueStr;
    if (Array.isArray(q.slots) && q.slots.length) {
      var sortedSlots = q.slots.slice().sort(function (a, b) { return Number(a.position) - Number(b.position); });
      var inc = Number(q.afterLastIncrement);
      if (!Number.isFinite(inc)) inc = 3;
      var lastPos = Number(sortedSlots[sortedSlots.length - 1].position);
      queueStr = sortedSlots.map(function (s) { return "第" + s.position + "張=" + s.minutes + "分"; }).join("、") + "、第" + (lastPos + 1) + "張起每張 +" + inc + " 分";
    } else {
      queueStr = "1=" + esc(q.first) + "分、2=" + esc(q.second) + "分、3=" + esc(q.third) + "分、第4張起每張+" + esc(q.afterThirdIncrement) + "分";
    }

    el.innerHTML =
      '<div class="admin-form" style="max-width:780px;">' +
      '<p><strong>隊列基礎：</strong>' + esc(queueStr) + '</p>' +
      '<p><strong>金額加時：</strong>' + esc(tierStr) + '</p>' +
      '<p><strong>超大單加時：</strong>' + esc(largeStr) + '</p>' +
      '<p><strong>長時食材：</strong>' + (l.enabled === false ? "未啟用" : ("最低 " + esc(l.minMinutes) + " 分；關鍵字：" + esc(keywordsStr))) + '</p>' +
      '<p><strong>其他：</strong>提前緩衝 ' + esc(r.startBufferMinutes) + ' 分、逾時 ' + esc(r.overdueAlertAfterMinutes) + ' 分強警示</p>' +
      '</div>';
  }

  async function saveKdsTiming(event) {
    event.preventDefault();
    if (!canManage()) return;
    function numOrDefault(id, fallback) {
      var el = document.getElementById(id);
      var v = el ? Number(el.value) : NaN;
      return Number.isFinite(v) ? v : fallback;
    }
    var defaults = getDefaultKdsTimingRules();
    var keywordsRaw = (document.getElementById("kdst-long-keywords") || {}).value || "";
    var keywords = keywordsRaw.split(/\r?\n/).map(function (s) { return String(s || "").trim(); }).filter(Boolean);

    var tiers = [
      { upTo: numOrDefault("kdst-amt-tier1-upto", defaults.amountRule.tiers[0].upTo), minutes: numOrDefault("kdst-amt-tier1-min", defaults.amountRule.tiers[0].minutes) },
      { upTo: numOrDefault("kdst-amt-tier2-upto", defaults.amountRule.tiers[1].upTo), minutes: numOrDefault("kdst-amt-tier2-min", defaults.amountRule.tiers[1].minutes) },
      { upTo: numOrDefault("kdst-amt-tier3-upto", defaults.amountRule.tiers[2].upTo), minutes: numOrDefault("kdst-amt-tier3-min", defaults.amountRule.tiers[2].minutes) },
      { upTo: null, minutes: numOrDefault("kdst-amt-tier4-min", defaults.amountRule.tiers[3].minutes) }
    ];

    var defaultSlots = Array.isArray(defaults.queueBaseMinutes.slots) ? defaults.queueBaseMinutes.slots : [
      { position: 1, minutes: 5 }, { position: 2, minutes: 6 }, { position: 3, minutes: 8 },
      { position: 4, minutes: 11 }, { position: 5, minutes: 14 }, { position: 6, minutes: 17 }
    ];
    var queueSlots = [1,2,3,4,5,6].map(function (pos) {
      var ds = defaultSlots.find(function (s) { return Number(s.position) === pos; }) || { minutes: 5 };
      return { position: pos, minutes: numOrDefault("kdst-queue-slot" + pos, ds.minutes) };
    });
    var afterLastInc = numOrDefault("kdst-queue-after-last", defaults.queueBaseMinutes.afterLastIncrement != null ? defaults.queueBaseMinutes.afterLastIncrement : 3);

    var kdsTimingRules = {
      queueBaseMinutes: {
        mode: "parallel_capacity",
        slots: queueSlots,
        afterLastIncrement: afterLastInc,
        // legacy 欄位同步維護，保留對舊程式碼的相容性
        first: queueSlots[0].minutes,
        second: queueSlots[1].minutes,
        third: queueSlots[2].minutes,
        afterThirdIncrement: afterLastInc
      },
      amountRule: {
        mode: "tiered_cap",
        baseAmount: tiers[0].upTo,
        tiers: tiers
      },
      largeOrderRule: {
        enabled: !!checked("kdst-large-enabled"),
        itemCountThreshold1: numOrDefault("kdst-large-item1", defaults.largeOrderRule.itemCountThreshold1),
        extraMinutes1: numOrDefault("kdst-large-extra1", defaults.largeOrderRule.extraMinutes1),
        itemCountThreshold2: numOrDefault("kdst-large-item2", defaults.largeOrderRule.itemCountThreshold2),
        extraMinutes2: numOrDefault("kdst-large-extra2", defaults.largeOrderRule.extraMinutes2),
        groupCountThreshold1: numOrDefault("kdst-large-group1", defaults.largeOrderRule.groupCountThreshold1),
        groupCountThreshold2: numOrDefault("kdst-large-group2", defaults.largeOrderRule.groupCountThreshold2)
      },
      longCookRule: {
        enabled: !!checked("kdst-long-enabled"),
        minMinutes: numOrDefault("kdst-long-min", defaults.longCookRule.minMinutes),
        keywords: keywords.length ? keywords : defaults.longCookRule.keywords
      },
      startBufferMinutes: numOrDefault("kdst-buffer", defaults.startBufferMinutes),
      overdueAlertAfterMinutes: numOrDefault("kdst-overdue-alert", defaults.overdueAlertAfterMinutes)
    };

    await db.collection("settings").doc(storeId).set({
      storeId: storeId,
      kdsTimingRules: kdsTimingRules,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    closeModal();
    await loadScoped();
    msg("KDS 出餐時間規則已儲存");
  }

  function runKdsTimingSimulator() {
    var helpers = window.LeLeShanOrders;
    var resultEl = document.getElementById("kdst-sim-result");
    if (!helpers || typeof helpers.estimateOrderPrepMinutes !== "function") {
      if (resultEl) resultEl.textContent = "估時函式尚未載入，請重新整理頁面";
      return;
    }
    var pos = Number((document.getElementById("kdst-sim-position") || {}).value);
    if (!Number.isFinite(pos) || pos < 1) pos = 1;
    var amount = Number((document.getElementById("kdst-sim-amount") || {}).value) || 0;
    var itemsRaw = (document.getElementById("kdst-sim-items") || {}).value || "";
    var itemNames = itemsRaw.split(/\r?\n/).map(function (s) { return String(s || "").trim(); }).filter(Boolean);

    // 若表單有編輯中但尚未儲存的值，優先用表單值讓使用者即時預覽
    var rules;
    var form = document.getElementById("kds-timing-form");
    if (form && form.offsetParent !== null) {
      var defaults = getDefaultKdsTimingRules();
      function num(id, fb) { var el = document.getElementById(id); var v = el ? Number(el.value) : NaN; return Number.isFinite(v) ? v : fb; }
      var keywordsRaw = (document.getElementById("kdst-long-keywords") || {}).value || "";
      var keywords = keywordsRaw.split(/\r?\n/).map(function (s) { return String(s || "").trim(); }).filter(Boolean);
      var formTiers = [
        { upTo: num("kdst-amt-tier1-upto", defaults.amountRule.tiers[0].upTo), minutes: num("kdst-amt-tier1-min", defaults.amountRule.tiers[0].minutes) },
        { upTo: num("kdst-amt-tier2-upto", defaults.amountRule.tiers[1].upTo), minutes: num("kdst-amt-tier2-min", defaults.amountRule.tiers[1].minutes) },
        { upTo: num("kdst-amt-tier3-upto", defaults.amountRule.tiers[2].upTo), minutes: num("kdst-amt-tier3-min", defaults.amountRule.tiers[2].minutes) },
        { upTo: null, minutes: num("kdst-amt-tier4-min", defaults.amountRule.tiers[3].minutes) }
      ];
      var simDefaultSlots = Array.isArray(defaults.queueBaseMinutes.slots) ? defaults.queueBaseMinutes.slots : [];
      var simSlots = [1,2,3,4,5,6].map(function (pos) {
        var ds = simDefaultSlots.find(function (s) { return Number(s.position) === pos; }) || { minutes: 5 };
        return { position: pos, minutes: num("kdst-queue-slot" + pos, ds.minutes) };
      });
      var simAfterLast = num("kdst-queue-after-last", defaults.queueBaseMinutes.afterLastIncrement != null ? defaults.queueBaseMinutes.afterLastIncrement : 3);
      rules = {
        queueBaseMinutes: {
          mode: "parallel_capacity",
          slots: simSlots,
          afterLastIncrement: simAfterLast,
          first: simSlots[0].minutes,
          second: simSlots[1].minutes,
          third: simSlots[2].minutes,
          afterThirdIncrement: simAfterLast
        },
        amountRule: { mode: "tiered_cap", baseAmount: formTiers[0].upTo, tiers: formTiers },
        largeOrderRule: {
          enabled: !!checked("kdst-large-enabled"),
          itemCountThreshold1: num("kdst-large-item1", defaults.largeOrderRule.itemCountThreshold1),
          extraMinutes1: num("kdst-large-extra1", defaults.largeOrderRule.extraMinutes1),
          itemCountThreshold2: num("kdst-large-item2", defaults.largeOrderRule.itemCountThreshold2),
          extraMinutes2: num("kdst-large-extra2", defaults.largeOrderRule.extraMinutes2),
          groupCountThreshold1: num("kdst-large-group1", defaults.largeOrderRule.groupCountThreshold1),
          groupCountThreshold2: num("kdst-large-group2", defaults.largeOrderRule.groupCountThreshold2)
        },
        longCookRule: {
          enabled: !!checked("kdst-long-enabled"),
          minMinutes: num("kdst-long-min", defaults.longCookRule.minMinutes),
          keywords: keywords.length ? keywords : defaults.longCookRule.keywords
        },
        startBufferMinutes: num("kdst-buffer", defaults.startBufferMinutes),
        overdueAlertAfterMinutes: num("kdst-overdue-alert", defaults.overdueAlertAfterMinutes)
      };
    } else {
      rules = getCurrentKdsTimingRules();
    }

    var fakeOrder = {
      id: "__sim__",
      total: amount,
      items: itemNames.map(function (n) { return { name: n, qty: 1 }; })
    };

    // 模擬 group / item 數：填了就優先用，沒填就從 items 推估
    var simGroupRaw = (document.getElementById("kdst-sim-group-count") || {}).value;
    var simItemRaw = (document.getElementById("kdst-sim-item-count") || {}).value;
    var simContext = { queuePosition: pos };
    var hasSimGroup = simGroupRaw !== "" && simGroupRaw != null && Number.isFinite(Number(simGroupRaw));
    var hasSimItem = simItemRaw !== "" && simItemRaw != null && Number.isFinite(Number(simItemRaw));
    if (hasSimGroup) simContext.groupCount = Number(simGroupRaw);
    if (hasSimItem) simContext.itemCount = Number(simItemRaw);

    var result = helpers.estimateOrderPrepMinutes(fakeOrder, simContext, rules);
    var bd = result.breakdown || {};
    var matchedNames = Array.isArray(bd.longCookMatchedNames) ? bd.longCookMatchedNames : [];

    if (!resultEl) return;
    resultEl.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;max-width:560px;">' +
      '<div>排隊位置</div><div><strong>第 ' + esc(bd.queuePosition || pos) + ' 張</strong></div>' +
      '<div>隊列基礎分鐘</div><div><strong>' + esc(bd.queueBaseMinutes || 0) + ' 分</strong></div>' +
      '<div>金額加時分鐘</div><div><strong>+' + esc(bd.amountMinutes || 0) + ' 分</strong></div>' +
      '<div>超大單加時</div><div><strong>+' + esc(bd.extraLargeOrderMinutes || 0) + ' 分</strong></div>' +
      '<div>group / item 統計</div><div><strong>' + esc(bd.groupCount || 0) + ' 組 / ' + esc(bd.itemCount || 0) + ' 項</strong></div>' +
      '<div>長煮下限命中</div><div><strong>' + (bd.longCookFloorApplied ? "是" : "否") + '</strong></div>' +
      '<div>命中食材</div><div><strong>' + esc(matchedNames.length ? matchedNames.join("、") : "—") + '</strong></div>' +
      '<div style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px;">最終預估</div>' +
      '<div style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px;"><strong style="color:#2563eb;font-size:1.05rem;">' + esc(result.prepMinutes) + ' 分</strong></div>' +
      '</div>';
  }

  function employeePinValid(pin) {
    return /^[0-9]{4}$/.test(String(pin || ""));
  }

  function populateEmployeeStoreSelect() {
    var select = document.getElementById("employee-store-id");
    if (!select) return;
    var options = (isOwner() ? data.stores : data.stores.filter(function (s) { return s.id === storeId; }))
      .map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.name || s.id) + "</option>";
      }).join("");
    select.innerHTML = options || '<option value="' + esc(storeId || "") + '">' + esc(storeId || "") + "</option>";
    select.value = storeId || (data.stores[0] && data.stores[0].id) || "";
    select.disabled = !isOwner();
  }

  function openEmployeePinForm(id) {
    if (!canManage()) return;
    var item = data.employees.find(function (entry) { return entry.id === id; });
    if (!item) return;
    var targetId = document.getElementById("employee-pin-target-id");
    var targetLabel = document.getElementById("employee-pin-target-label");
    var pinInput = document.getElementById("employee-pin-reset");
    if (targetId) targetId.value = item.id;
    if (targetLabel) targetLabel.value = (item.employeeId || "") + " / " + (item.name || "");
    if (pinInput) pinInput.value = "";
    openModal("employee-pin", "重設");
  }

  async function saveEmployee(event) {
    event.preventDefault();
    if (!canManage()) return;
    if (savingEmployee) return;

    var form = event.currentTarget || document.getElementById("employee-form");
    var submitBtn = form && form.querySelector ? form.querySelector('button[type="submit"]') : null;

    var originalId = val("employee-original-id");
    var name = val("employee-name");
    var employeeId = val("employee-id");
    var employeeStoreId = val("employee-store-id") || storeId;
    var isActive = checked("employee-active");
    var pin = val("employee-pin");

    if (!name || !employeeId) {
      msg("員工姓名與員工編號不可空白");
      return;
    }
    if (!originalId && !employeePinValid(pin)) {
      msg("PIN 必須是 4 位數字");
      return;
    }

    savingEmployee = true;
    if (submitBtn) {
      submitBtn.dataset.originalText = submitBtn.textContent || "儲存員工";
      submitBtn.disabled = true;
      submitBtn.textContent = "儲存中...";
    }

    if (!functionsApi) { msg("Functions 服務未就緒，請重新整理"); savingEmployee = false; return; }
    var callable = functionsApi.httpsCallable("upsertEmployee");
    try {
      await callable({
        employeeDocId: originalId || null,
        name: name,
        employeeId: employeeId,
        pin: pin || null,
        storeId: employeeStoreId,
        isActive: isActive,
        sessionHours: EMPLOYEE_SESSION_HOURS
      });
      closeModal();
      await loadScoped();
      msg(originalId ? "員工資料已更新" : "員工已新增");
    } catch (error) {
      console.error("[AdminEmployee] save failed.", error);
      var code = (error && error.code) || "";
      if (code === "already-exists" || code === "functions/already-exists") {
        msg("員工編號已存在，請使用其他編號");
      } else {
        msg((error && error.message) || "員工儲存失敗");
      }
    } finally {
      savingEmployee = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "儲存員工";
      }
    }
  }

  async function resetEmployeePin(event) {
    event.preventDefault();
    if (!canManage()) return;
    var id = val("employee-pin-target-id");
    var pin = val("employee-pin-reset");
    if (!id) return;
    if (!employeePinValid(pin)) {
      msg("PIN 必須是 4 位數字");
      return;
    }
    if (!functionsApi) { msg("Functions 服務未就緒，請重新整理"); return; }
    var callable = functionsApi.httpsCallable("resetEmployeePin");
    try {
      await callable({ employeeDocId: id, pin: pin });
      closeModal();
      await loadScoped();
      msg("員工 PIN 已重設");
    } catch (error) {
      console.error("[AdminEmployee] reset pin failed.", error);
      msg((error && error.message) || "重設 PIN 失敗");
    }
  }

  function buildCategory() {
    var themeValue = val("category-bg-color") || DEFAULT_CATEGORY_COLOR;
    return {
      name: val("category-name"),
      sort: num("category-sort"),
      colorTheme: themeValue,
      bgColor: themeValue,
      themeColor: themeValue,
      enabled: checked("category-enabled")
    };
  }

  function buildMenuItem() {
    var sortValue = val("menu-sort");
    return {
      name: val("menu-name"),
      price: num("menu-price"),
      category: val("menu-category") || "未分類",
      sortOrder: sortValue === "" ? 999 : Number(sortValue),
      description: val("menu-description"),
      imageUrl: val("menu-image-url"),
      tags: csv("menu-tags"),
      unit: val("menu-unit"),
      optionGroups: json("menu-option-groups"),
      isStaple: checked("menu-is-staple"),
      requiresFlavor: checked("menu-requires-flavor"),
      requiresStaple: checked("menu-requires-staple"),
      flavorOptions: readSpecOptionCheckboxes("menu-flavor-options"),
      stapleOptions: readSpecOptionCheckboxes("menu-staple-options"),
      posHidden: checked("menu-pos-hidden"),
      posVisible: !checked("menu-pos-hidden"),
      posDisabledFlavorOptions: readSpecOptionCheckboxes("menu-pos-disabled-flavors"),
      posDisabledStapleOptions: readSpecOptionCheckboxes("menu-pos-disabled-staples"),
      quickAdd: checked("menu-quick-add"),
      isActive: checked("menu-enabled")
    };
  }

  function buildCombo() {
    var sortValue = val("combo-sort");
    return {
      name: val("combo-name"),
      price: num("combo-price"),
      sort: sortValue === "" ? 999 : Number(sortValue),
      category: "套餐",
      description: val("combo-description"),
      tags: csv("combo-tags"),
      optionGroups: readComboGroups(),
      requiresFlavor: checked("combo-requires-flavor"),
      requiresStaple: checked("combo-requires-staple"),
      flavorOptions: readSpecOptionCheckboxes("combo-flavor-options"),
      stapleOptions: readSpecOptionCheckboxes("combo-staple-options"),
      posHidden: checked("combo-pos-hidden"),
      posVisible: !checked("combo-pos-hidden"),
      posDisabledFlavorOptions: readSpecOptionCheckboxes("combo-pos-disabled-flavors"),
      posDisabledStapleOptions: readSpecOptionCheckboxes("combo-pos-disabled-staples"),
      enabled: checked("combo-enabled")
    };
  }

  function buildFlavor() {
    return {
      name: val("flavor-name"),
      sort: num("flavor-sort"),
      spicyLabel: val("flavor-spicy"),
      description: val("flavor-description"),
      enabled: checked("flavor-enabled")
    };
  }

  function buildInventory() {
    return { itemId: val("inventory-item-id"), stock: num("inventory-stock"), safeStock: num("inventory-safe-stock") };
  }

  function buildPromotion() {
    return {
      name: val("promotion-name"),
      type: val("promotion-type"),
      condition: { minAmount: num("promotion-min-amount") },
      reward: { type: val("promotion-reward-type"), itemId: val("promotion-reward-item-id"), value: num("promotion-reward-value") },
      startAt: date("promotion-start-at"),
      endAt: date("promotion-end-at"),
      enabled: checked("promotion-enabled")
    };
  }

  function openModal(type, actionText) {
    var panelName = panelType(type);
    el.formPanels.forEach(function (panel) {
      panel.classList.toggle("hidden", panel.getAttribute("data-form-panel") !== panelName);
    });
    el.modalTitle.textContent = actionText + formTitle(panelName);
    el.modal.classList.remove("hidden");
  }

  function closeModal() {
    el.modal.classList.add("hidden");
  }

  function resetForm(type) {
    var panelName = panelType(type);
    var form = document.getElementById(panelName + "-form");
    if (form) form.reset();
    if (panelName === "menu" || panelName === "combo") {
      var specOptions = getGlobalSpecOptions();
      if (panelName === "menu") {
        renderSpecOptionCheckboxes("menu-flavor-options", specOptions.flavorOptions, []);
        renderSpecOptionCheckboxes("menu-staple-options", specOptions.stapleOptions, []);
        renderSpecOptionCheckboxes("menu-pos-disabled-flavors", specOptions.flavorOptions, []);
        renderSpecOptionCheckboxes("menu-pos-disabled-staples", specOptions.stapleOptions, []);
      } else {
        renderSpecOptionCheckboxes("combo-flavor-options", specOptions.flavorOptions, []);
        renderSpecOptionCheckboxes("combo-staple-options", specOptions.stapleOptions, []);
        renderSpecOptionCheckboxes("combo-pos-disabled-flavors", specOptions.flavorOptions, []);
        renderSpecOptionCheckboxes("combo-pos-disabled-staples", specOptions.stapleOptions, []);
      }
      toggleSpecOptionVisibility();
    }
    if (panelName === "employee") {
      var employeeIdInput = document.getElementById("employee-id");
      if (employeeIdInput) employeeIdInput.disabled = false;
      var pinWrap = document.getElementById("employee-pin-wrap");
      if (pinWrap) pinWrap.classList.remove("hidden");
    }
    if (panelName === "store") {
      renderStoreHoursGrid(defaultBusinessHours());
    }
    if (panelName === "combo") renderComboGroups([]);
    if (panelName === "category") {
      var select = document.getElementById("category-bg-color");
      if (select) {
        select.value = DEFAULT_CATEGORY_COLOR;
        updateCategoryColorPreview(DEFAULT_CATEGORY_COLOR);
      }
    }
    syncSwitchLabels();
  }

  function panelType(type) {
    var map = { stores: "store", categories: "category", combos: "combo", flavors: "flavor", promotions: "promotion", employees: "employee" };
    return map[type] || type;
  }

  function formTitle(type) {
    var map = {
      store: "門市",
      category: "分類",
      menu: "品項",
      combo: "套餐",
      flavor: "口味",
      inventory: "庫存",
      promotion: "優惠",
      settings: "營業設定",
      "kds-timing": "KDS 出餐時間規則",
      employee: "員工",
      "employee-pin": "PIN"
    };
    return map[type] || "資料";
  }

  function findItem(type, id) {
    if (type === "stores") return data.stores.find(function (item) { return item.id === id; });
    if (type === "categories") return data.categories.find(function (item) { return item.id === id; });
    if (type === "menu") return data.menuItems.find(function (item) { return item.id === id; });
    if (type === "combos") return data.comboTemplates.find(function (item) { return item.id === id; });
    if (type === "flavors") return data.flavors.find(function (item) { return item.id === id; });
    if (type === "inventory") return data.inventory.find(function (item) { return item.id === id; });
    if (type === "promotions") return data.promotions.find(function (item) { return item.id === id; });
    if (type === "employees") return data.employees.find(function (item) { return item.id === id; });
    return null;
  }

  // FORM_MARKER
  function renderComboGroups(groups) {
    el.comboOptionGroups.innerHTML = "";
    if (!groups.length) {
      appendComboGroup();
      return;
    }
    groups.forEach(function (group) {
      appendComboGroup(group);
    });
  }

  function appendComboGroup(group) {
    var groupIndex = el.comboOptionGroups.children.length;
    var wrapper = document.createElement("div");
    wrapper.className = "option-card";
    wrapper.innerHTML = [
      '<div class="option-builder__head">',
      "<strong>群組 " + (groupIndex + 1) + "</strong>",
      '<button type="button" data-remove-combo-option="' + groupIndex + '">移除群組</button>',
      "</div>",
      '<div class="option-row">',
      '<label><span>群組代碼</span><input data-combo-group-id value="' + esc(group && group.id || "") + '" placeholder="例如：staple"></label>',
      '<label><span>群組名稱</span><input data-combo-group-name value="' + esc(group && group.name || "") + '" placeholder="例如：主食選擇"></label>',
      '<label><span>選擇方式</span><select data-combo-group-type><option value="single">single</option><option value="multi">multi</option></select></label>',
      "</div>",
      '<div class="option-choice-list"></div>',
      '<button type="button" data-add-combo-choice="' + groupIndex + '">新增選項</button>'
    ].join("");
    el.comboOptionGroups.appendChild(wrapper);
    wrapper.querySelector("[data-combo-group-type]").value = group && group.type || "single";

    var options = group && group.options && group.options.length ? group.options : [{}];
    options.forEach(function (option) {
      appendComboChoice(groupIndex, option);
    });
  }

  function removeComboGroup(index) {
    var cards = Array.prototype.slice.call(el.comboOptionGroups.children);
    if (!cards[index]) return;
    cards[index].remove();
    renumberComboGroups();
  }

  function appendComboChoice(groupIndex, option) {
    var card = Array.prototype.slice.call(el.comboOptionGroups.children)[groupIndex];
    if (!card) return;

    var list = card.querySelector(".option-choice-list");
    var choiceIndex = list.children.length;
    var row = document.createElement("div");
    row.className = "option-choice-row";
    row.innerHTML = [
      '<label><span>選項代碼</span><input data-combo-choice-id value="' + esc(option && option.id || "") + '" placeholder="例如：rice-free"></label>',
      '<label><span>選項名稱</span><input data-combo-choice-name value="' + esc(option && option.name || "") + '" placeholder="例如：白飯"></label>',
      '<label><span>加價</span><input data-combo-choice-price type="number" value="' + esc(String(option && option.price || 0)) + '" placeholder="例如：0"></label>',
      '<button type="button" data-remove-combo-choice="' + groupIndex + ":" + choiceIndex + '">移除選項</button>'
    ].join("");
    list.appendChild(row);
    renumberComboChoices(card, groupIndex);
  }

  function removeComboChoice(groupIndex, choiceIndex) {
    var card = Array.prototype.slice.call(el.comboOptionGroups.children)[groupIndex];
    if (!card) return;
    var rows = Array.prototype.slice.call(card.querySelectorAll(".option-choice-row"));
    if (!rows[choiceIndex]) return;
    rows[choiceIndex].remove();
    renumberComboChoices(card, groupIndex);
  }

  function renumberComboGroups() {
    Array.prototype.slice.call(el.comboOptionGroups.children).forEach(function (card, groupIndex) {
      var title = card.querySelector(".option-builder__head strong");
      var removeButton = card.querySelector("[data-remove-combo-option]");
      var addButton = card.querySelector("[data-add-combo-choice]");
      if (title) title.textContent = "群組 " + (groupIndex + 1);
      if (removeButton) removeButton.setAttribute("data-remove-combo-option", groupIndex);
      if (addButton) addButton.setAttribute("data-add-combo-choice", groupIndex);
      renumberComboChoices(card, groupIndex);
    });
  }

  function renumberComboChoices(card, groupIndex) {
    Array.prototype.slice.call(card.querySelectorAll(".option-choice-row")).forEach(function (row, choiceIndex) {
      var removeButton = row.querySelector("[data-remove-combo-choice]");
      if (removeButton) removeButton.setAttribute("data-remove-combo-choice", groupIndex + ":" + choiceIndex);
    });
  }

  function readComboGroups() {
    return Array.prototype.slice.call(el.comboOptionGroups.children).map(function (card) {
      return {
        id: (card.querySelector("[data-combo-group-id]").value || "").trim(),
        name: (card.querySelector("[data-combo-group-name]").value || "").trim(),
        type: card.querySelector("[data-combo-group-type]").value || "single",
        options: Array.prototype.slice.call(card.querySelectorAll(".option-choice-row")).map(function (row) {
          return {
            id: (row.querySelector("[data-combo-choice-id]").value || "").trim(),
            name: (row.querySelector("[data-combo-choice-name]").value || "").trim(),
            price: Number(row.querySelector("[data-combo-choice-price]").value || 0)
          };
        }).filter(function (option) {
          return option.id || option.name;
        })
      };
    }).filter(function (group) {
      return group.id || group.name || group.options.length;
    });
  }

  function bindSwitchLabel(inputId, labelId, onText, offText) {
    var input = document.getElementById(inputId);
    var label = document.getElementById(labelId);
    if (!input || !label) return;
    input.addEventListener("change", function () {
      label.textContent = input.checked ? onText : offText;
    });
    label.textContent = input.checked ? onText : offText;
  }

  function syncSwitchLabels() {
    [
      ["store-active", "store-active-label", "啟用中", "停用中"],
      ["category-enabled", "category-enabled-label", "啟用中", "停用中"],
      ["menu-is-staple", "menu-is-staple-label", "主食類", "非主食"],
      ["menu-requires-flavor", "menu-requires-flavor-label", "需要選口味", "不需要口味"],
      ["menu-requires-staple", "menu-requires-staple-label", "需要選主食", "不需要主食"],
      ["menu-pos-hidden", "menu-pos-hidden-label", "POS 已隱藏", "POS 顯示中"],
      ["menu-quick-add", "menu-quick-add-label", "快速加購", "標準模式"],
      ["menu-enabled", "menu-enabled-label", "啟用中", "停用中"],
      ["combo-requires-flavor", "combo-requires-flavor-label", "需要選口味", "不需要口味"],
      ["combo-requires-staple", "combo-requires-staple-label", "需要選主食", "不需要主食"],
      ["combo-pos-hidden", "combo-pos-hidden-label", "POS 已隱藏", "POS 顯示中"],
      ["combo-enabled", "combo-enabled-label", "啟用中", "停用中"],
      ["flavor-enabled", "flavor-enabled-label", "啟用中", "停用中"],
      ["promotion-enabled", "promotion-enabled-label", "啟用中", "停用中"],
      ["employee-active", "employee-active-label", "啟用", "停用"],
      ["settings-open", "settings-open-label", "營業中", "休息中"],
      ["settings-promo-enabled", "settings-promo-enabled-label", "啟用中", "未啟用"]
    ].forEach(function (entry) {
      var input = document.getElementById(entry[0]);
      var label = document.getElementById(entry[1]);
      if (input && label) {
        label.textContent = input.checked ? entry[2] : entry[3];
      }
    });
  }

  function buildCard(title, fields, actionHtml) {
    return [
      "<article>",
      '<div class="admin-list__row">',
      '<strong class="admin-card__title">' + esc(title) + "</strong>",
      "</div>",
      '<div class="admin-detail-grid">',
      fields.map(function (field) {
        return [
          '<div class="admin-detail-item">',
          '<span class="admin-detail-label">' + esc(field.label) + "</span>",
          '<span class="admin-detail-value">' + (field.html ? field.value : esc(field.value)) + "</span>",
          "</div>"
        ].join("");
      }).join(""),
      "</div>",
      (actionHtml ? '<div class="admin-card__actions admin-card__actions--footer">' + actionHtml + "</div>" : ""),
      "</article>"
    ].join("");
  }

  function emptyCard(message) {
    return '<article><div class="admin-list__muted">' + esc(message) + "</div></article>";
  }

  function buildCompactCard(title, badges, actionHtml) {
    return [
      '<article class="compact-card">',
      '<div class="compact-card__title">' + esc(title) + '</div>',
      '<div class="compact-card__badges">',
      badges.map(function (b) { return '<span class="compact-card__badge">' + esc(b) + '</span>'; }).join(""),
      '</div>',
      (actionHtml ? '<div class="compact-card__action">' + actionHtml + '</div>' : ''),
      '</article>'
    ].join("");
  }

  function renderParagraphList(items, fallback) {
    if (!items.length) return "<p>" + esc(fallback) + "</p>";
    return items.map(function (item) { return "<p>" + esc(item) + "</p>"; }).join("");
  }

  function statusPill(text, on) {
    return '<span class="admin-status-pill' + (on ? "" : " off") + '">' + esc(text) + "</span>";
  }

  function categoryName(categoryId) {
    var item = data.categories.find(function (category) { return category.id === categoryId; });
    return item ? item.name : (categoryId || "未設定");
  }

  function normalizeMenuCategoryName(item) {
    var raw = item && (item.category || item.categoryId || item.categoryName || "");
    var name = String(categoryName(raw) || "").trim();
    if (!name) return "未分類";
    if (name === "未設定") return "未分類";
    return name;
  }

  function menuCategoryRank(name) {
    var order = ["主食", "套餐", "肉品", "蔬菜", "火鍋料 A", "火鍋料 B", "飲品", "其他", "未分類"];
    var index = order.indexOf(name);
    return index >= 0 ? index : 999;
  }

  function groupMenuItemsByCategory(items) {
    var groups = {};
    (items || []).forEach(function (item) {
      var groupName = normalizeMenuCategoryName(item);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    return Object.keys(groups).sort(function (left, right) {
      var leftRank = menuCategoryRank(left);
      var rightRank = menuCategoryRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left || "").localeCompare(String(right || ""), "zh-Hant");
    }).map(function (name) {
      return {
        name: name,
        items: groups[name].slice().sort(byMenuSort)
      };
    });
  }

  function normalizeMenuItem(item) {
    var normalized = { ...item };
    normalized.name = normalized.name || "";
    normalized.price = Number(normalized.price || 0);
    normalized.category = normalized.category || "套餐";
    normalized.category = normalized.category || normalized.categoryId || "未分類";
    normalized.categoryId = normalized.category;
    normalized.sortOrder = Number(normalized.sortOrder != null ? normalized.sortOrder : (normalized.sort != null ? normalized.sort : 999));
    normalized.sort = normalized.sortOrder;
    normalized.isActive = normalized.isActive === true || (normalized.isActive == null && normalized.enabled === true);
    normalized.enabled = normalized.isActive;
    normalized.description = normalized.description || "";
    normalized.imageUrl = normalized.imageUrl || "";
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
    normalized.unit = normalized.unit || "";
    normalized.optionGroups = Array.isArray(normalized.optionGroups) ? normalized.optionGroups : [];
    normalized.requiresFlavor = normalized.requiresFlavor === true;
    normalized.requiresStaple = normalized.requiresStaple === true;
    normalized.flavorOptions = Array.isArray(normalized.flavorOptions) ? normalized.flavorOptions : [];
    normalized.stapleOptions = Array.isArray(normalized.stapleOptions) ? normalized.stapleOptions : [];
    normalized.posHidden = normalized.posHidden === true || normalized.posVisible === false;
    normalized.posDisabledFlavorOptions = Array.isArray(normalized.posDisabledFlavorOptions) ? normalized.posDisabledFlavorOptions : [];
    normalized.posDisabledStapleOptions = Array.isArray(normalized.posDisabledStapleOptions) ? normalized.posDisabledStapleOptions : [];
    normalized.quickAdd = normalized.quickAdd === true;
    return normalized;
  }

  function normalizeComboTemplate(item) {
    var normalized = { ...item };
    normalized.name = normalized.name || "";
    normalized.price = Number(normalized.price || 0);
    normalized.sort = Number(normalized.sort != null ? normalized.sort : 999);
    normalized.description = normalized.description || "";
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
    normalized.optionGroups = Array.isArray(normalized.optionGroups) ? normalized.optionGroups : [];
    normalized.enabled = normalized.enabled !== false && normalized.isActive !== false;
    normalized.requiresFlavor = normalized.requiresFlavor === true;
    normalized.requiresStaple = normalized.requiresStaple === true;
    normalized.flavorOptions = Array.isArray(normalized.flavorOptions) ? normalized.flavorOptions : [];
    normalized.stapleOptions = Array.isArray(normalized.stapleOptions) ? normalized.stapleOptions : [];
    normalized.posHidden = normalized.posHidden === true || normalized.posVisible === false;
    normalized.posDisabledFlavorOptions = Array.isArray(normalized.posDisabledFlavorOptions) ? normalized.posDisabledFlavorOptions : [];
    normalized.posDisabledStapleOptions = Array.isArray(normalized.posDisabledStapleOptions) ? normalized.posDisabledStapleOptions : [];
    return normalized;
  }

  function mergeMenuItems(primaryItems, fallbackItems) {
    var merged = {};
    fallbackItems.forEach(function (item) {
      merged[item.id] = item;
    });
    primaryItems.forEach(function (item) {
      merged[item.id] = item;
    });
    return Object.keys(merged).map(function (key) { return merged[key]; });
  }

  function byMenuSort(left, right) {
    var categoryCompare = String(left.category || "").localeCompare(String(right.category || ""), "zh-Hant");
    if (categoryCompare !== 0) return categoryCompare;
    return Number(left.sortOrder || 999) - Number(right.sortOrder || 999);
  }

  function categoryColorMeta(value) {
    return CATEGORY_COLOR_OPTIONS.find(function (option) { return option.value === value; })
      || CATEGORY_COLOR_OPTIONS.find(function (option) { return option.bgColor === value || option.buttonColor === value; })
      || CATEGORY_COLOR_OPTIONS.find(function (option) { return option.value === DEFAULT_CATEGORY_COLOR; })
      || { value: DEFAULT_CATEGORY_COLOR, label: "暖米色", bgColor: "#EFE3D3", buttonColor: "#A66A46", textColor: "#5B3723", buttonTextColor: "#FFFFFF" };
  }

  function inventoryName(itemId) {
    var menuItem = data.menuItems.find(function (item) { return item.id === itemId; });
    if (menuItem) return menuItem.name || menuItem.id;
    var comboItem = data.comboTemplates.find(function (item) { return item.id === itemId; });
    if (comboItem) return comboItem.name || comboItem.id;
    return itemId || "未設定品項";
  }

  function groupSummary(groups) {
    if (!groups || !groups.length) return "無";
    return groups.map(function (group) {
      var options = (group.options || []).map(function (option) { return option.name || option.id; }).join("、");
      return (group.name || group.id || "未命名群組") + "（" + ((group.type || "single") === "multi" ? "可多選" : "單選") + "：" + (options || "無選項") + "）";
    }).join("；");
  }

  function rewardSummary(reward) {
    if (!reward) return "未設定";
    var parts = [];
    if (reward.type) parts.push("類型：" + reward.type);
    if (reward.itemId) parts.push("品項：" + inventoryName(reward.itemId));
    if (reward.value) parts.push("數值：" + reward.value);
    return parts.join(" / ") || "未設定";
  }

  function orderStatusText(status) {
    if (window.LeLeShanOrderStatus && typeof window.LeLeShanOrderStatus.getLabel === "function") {
      return window.LeLeShanOrderStatus.getLabel(status);
    }
    var meta = window.LeLeShanOrders.statusMeta(status);
    return meta.label;
  }

  function orderItemsSummary(items, groups) {
    if (groups && groups.length > 1) {
      return groups.map(function (g, gIdx) {
        var gItems = g.items || [];
        if (!gItems.length) return "";
        var displayLabel = "第" + (gIdx + 1) + "份";
        return "<strong>" + esc(displayLabel) + "</strong>：" + gItems.map(function (i) {
          var detail = [];
          if (i.flavor) detail.push(i.flavor);
          if (i.staple) detail.push("主食：" + i.staple);
          var suffix = detail.length ? "（" + detail.join("／") + "）" : "";
          return esc((i.name || i.itemId || "未命名") + " x" + Number(i.qty || 0) + suffix);
        }).join("、");
      }).filter(Boolean).join("<br>");
    }
    if (!items || !items.length) return "無";
    return items.map(function (item) {
      var detail = [];
      if (item.flavor || item.flavorName) detail.push(item.flavor || item.flavorName);
      if (item.staple || item.stapleName) detail.push("主食：" + (item.staple || item.stapleName));
      var suffix = detail.length ? "（" + detail.join("／") + "）" : "";
      return (item.name || item.itemId || "未命名品項") + " x" + Number(item.qty || 0) + suffix;
    }).join("、");
  }

  function mapDocs(snap) {
    return snap.docs.map(function (doc) {
      var item = doc.data();
      item.id = doc.id;
      return item;
    });
  }

  function bySort(left, right) {
    return Number(left.sort || 0) - Number(right.sort || 0);
  }

  function byCreatedDesc(left, right) {
    var rightValue = right.createdAt || right.created_at || right.imported_at || right.updated_at || right.order_time;
    var leftValue = left.createdAt || left.created_at || left.imported_at || left.updated_at || left.order_time;
    return toDate(rightValue) - toDate(leftValue);
  }

  function byUpdatedDesc(left, right) {
    var rightValue = right.updatedAt || right.updated_at || right.createdAt || right.created_at;
    var leftValue = left.updatedAt || left.updated_at || left.createdAt || left.created_at;
    return toDate(rightValue) - toDate(leftValue);
  }

  function val(id) {
    return (document.getElementById(id).value || "").trim();
  }

  function num(id) {
    return Number(document.getElementById(id).value || 0);
  }

  function checked(id) {
    return document.getElementById(id).checked;
  }

  function csv(id) {
    return val(id).split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function json(id) {
    return val(id) ? JSON.parse(val(id)) : [];
  }

  function date(id) {
    return val(id) ? new Date(val(id)) : null;
  }

  function toDate(value) {
    if (!value) return new Date(0);
    return typeof value.toDate === "function" ? value.toDate() : new Date(value);
  }

  function formatDate(value) {
    var dateValue = toDate(value);
    if (!dateValue || isNaN(dateValue.getTime())) return "未提供";
    return dateValue.toLocaleString("zh-TW", { hour12: false });
  }

  function formatDateTime(value) {
    var dateValue = toDate(value);
    if (isNaN(dateValue.getTime())) return "";
    return new Date(dateValue.getTime() - dateValue.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderPlatformOrders() {
    renderPlatformImportSummary();
    renderPlatformTodayStats();
    renderPlatformPendingMappings();
    renderPlatformRecentOrders();
    renderPlatformFailedRows();
    renderPlatformImportLogs();
  }

  function renderPlatformImportSummary() {
    var summary = data.latestPlatformImportSummary || {
      total_rows: 0,
      inserted_rows: 0,
      duplicate_rows: 0,
      failed_rows: 0,
      pending_mapping_rows: 0,
      file_warning: ""
    };
    if (!el.platform.summary) return;
    el.platform.summary.innerHTML = [
      detailCard("匯入總筆數", String(summary.total_rows || 0)),
      detailCard("成功新增筆數", String(summary.inserted_rows || 0)),
      detailCard("重複略過筆數", String(summary.duplicate_rows || 0)),
      detailCard("失敗筆數", String(summary.failed_rows || 0)),
      detailCard("待對應 SKU 筆數", String(summary.pending_mapping_rows || 0)),
      detailCard("重複檔案提醒", summary.file_warning || "無")
    ].join("");
  }

  function renderPlatformTodayStats() {
    if (!el.platform.todayStats) return;
    var todayKey = todayDateKey();
    var todayOrders = data.platformOrders.filter(function (order) {
      return orderDateKey(order.order_time) === todayKey;
    });
    var todayMovements = data.inventoryMovements.filter(function (movement) {
      return orderDateKey(movement.created_at) === todayKey;
    });
    var platformTotals = {};
    var skuTotals = {};
    todayOrders.forEach(function (order) {
      platformTotals[order.platform] = (platformTotals[order.platform] || 0) + Number(order.total_amount || 0);
    });
    todayMovements.forEach(function (movement) {
      skuTotals[movement.sku] = (skuTotals[movement.sku] || 0) + Math.abs(Number(movement.qty_change || 0));
    });
    var topSku = Object.keys(skuTotals).sort(function (left, right) { return skuTotals[right] - skuTotals[left]; }).slice(0, 5).map(function (sku) {
      return inventoryName(sku) + " x" + skuTotals[sku];
    }).join("、") || "無";
    el.platform.todayStats.innerHTML = [
      detailCard("今日平台總訂單數", String(todayOrders.length)),
      detailCard("Uber Eats 銷售額", "NT$ " + Number(platformTotals.ubereats || 0)),
      detailCard("Foodpanda 銷售額", "NT$ " + Number(platformTotals.foodpanda || 0)),
      detailCard("待對應品項數量", String(data.platformMappings.filter(function (item) { return item.status === "pending"; }).length)),
      detailCard("今日 SKU 售出數量", topSku)
    ].join("");
  }

  function renderPlatformPendingMappings() {
    if (!el.platform.pendingMappings) return;
    var skuOptions = skuOptionHtml();
    var pending = data.platformMappings.filter(function (item) { return item.status === "pending"; });
    el.platform.pendingMappings.innerHTML = pending.map(function (item) {
      return buildCard(item.platform_item_name || item.platform_item_id || item.id, [
        { label: "平台", value: item.platform || "" },
        { label: "平台品項名稱", value: item.platform_item_name || "" },
        { label: "平台品項編號", value: item.platform_item_id || "無" },
        { label: "對應狀態", value: statusPill("待對應", false), html: true }
      ], '<div class="admin-inline-form"><select id="platform-map-select-' + esc(item.id) + '">' + skuOptions + '</select><button type="button" data-platform-map="' + esc(item.id) + '">儲存對應</button><button type="button" data-platform-ignore="' + esc(item.id) + '">忽略</button></div>');
    }).join("") || emptyCard("目前沒有待對應品項");
  }

  function renderPlatformRecentOrders() {
    if (!el.platform.ordersList) return;
    el.platform.ordersList.innerHTML = data.platformOrders.slice(0, 20).map(function (order) {
      return buildCard(order.platform_order_id || order.id, [
        { label: "平台", value: order.platform || "" },
        { label: "訂單時間", value: formatDate(order.order_time) },
        { label: "訂單狀態", value: order.order_status || "未提供" },
        { label: "訂單金額", value: order.total_amount == null ? "未提供" : "NT$ " + Number(order.total_amount || 0) },
        { label: "待對應品項數", value: String(order.pending_mapping_count || 0) },
        { label: "匯入批次", value: order.import_batch_id || "" }
      ], "");
    }).join("") || emptyCard("目前沒有平台訂單");
  }

  function renderPlatformFailedRows() {
    if (!el.platform.failedRows) return;
    el.platform.failedRows.innerHTML = (data.latestPlatformFailedRows || []).map(function (item) {
      return buildCard("第 " + item.row_number + " 列", [
        { label: "失敗原因", value: item.reason || "未知" },
        { label: "原始資料", value: JSON.stringify(item.payload || {}) }
      ], "");
    }).join("") || emptyCard("目前沒有失敗資料列");
  }

  function renderPlatformImportLogs() {
    if (!el.platform.importLogs) return;
    el.platform.importLogs.innerHTML = data.importLogs.slice(0, 10).map(function (log) {
      return buildCard(log.file_name || log.import_batch_id, [
        { label: "平台", value: log.platform || "" },
        { label: "匯入時間", value: formatDate(log.imported_at) },
        { label: "新增筆數", value: String(log.inserted_rows || 0) },
        { label: "重複略過", value: String(log.duplicate_rows || 0) },
        { label: "失敗筆數", value: String(log.failed_rows || 0) },
        { label: "檔案雜湊", value: log.file_hash || "" }
      ], "");
    }).join("") || emptyCard("目前沒有匯入紀錄");
  }

  async function importPlatformCsv(platform) {
    if (!canManage()) return;
    var input = platform === "ubereats" ? el.platform.uberFile : el.platform.pandaFile;
    if (!input || !input.files || !input.files[0]) {
      window.alert("請先選擇 CSV 檔案");
      return;
    }

    try {
      msg("正在解析 " + platform + " CSV...");
      var file = input.files[0];
      var csvText = await file.text();
      var parsed = window.PlatformOrderModule.parseCsvText(csvText);
      var normalized = window.PlatformOrderModule.normalizeParsedRows(platform, storeId, parsed, file.name);
      if (!parsed.rows.length) {
        throw new Error("CSV 沒有可匯入的資料列");
      }
      if (normalized.orders.length === 0 || normalized.failedRows.length / parsed.rows.length > 0.5) {
        throw new Error("CSV 內容缺欄或格式異常過多，已中止匯入");
      }
      var fileHash = await window.PlatformOrderModule.computeFileHash(csvText);
      var batchId = "imp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      var importedBy = user && user.uid || "";
      var existingFileLogs = data.importLogs.filter(function (log) {
        return log.platform === platform && log.file_hash === fileHash;
      });
      var summary = await persistPlatformImport({
        platform: platform,
        fileName: file.name,
        fileHash: fileHash,
        batchId: batchId,
        normalized: normalized,
        totalRows: parsed.rows.length,
        importedBy: importedBy,
        fileWarning: existingFileLogs.length ? "此檔案疑似已匯入過，請確認是否重複操作" : ""
      });
      data.latestPlatformImportSummary = summary;
      data.latestPlatformFailedRows = normalized.failedRows;
      await loadScoped();
    } catch (error) {
      console.error("[PlatformOrders] CSV import failed.", error);
      data.latestPlatformImportSummary = {
        total_rows: 0,
        inserted_rows: 0,
        duplicate_rows: 0,
        failed_rows: 1,
        pending_mapping_rows: 0,
        file_warning: error.message || "匯入失敗"
      };
      data.latestPlatformFailedRows = [{ row_number: "-", reason: error.message || "匯入失敗", payload: {} }];
      renderPlatformOrders();
      msg("平台訂單匯入失敗");
    }
  }

  async function persistPlatformImport(options) {
    var platform = options.platform;
    var normalized = options.normalized;
    var insertedRows = 0;
    var duplicateRows = 0;
    var pendingMappingRows = 0;
    var mappingCache = {};
    var createdMappings = {};

    for (var i = 0; i < normalized.orders.length; i += 1) {
      var order = normalized.orders[i];
      var orderRef = db.collection("platform_orders").doc(order.id);
      var existingOrder = await orderRef.get();
      if (existingOrder.exists) {
        duplicateRows += 1;
        continue;
      }

      var mappedItems = [];
      var mappedCount = 0;
      var pendingCount = 0;
      for (var j = 0; j < order.normalized_items.length; j += 1) {
        var item = order.normalized_items[j];
        var mapping = await ensurePlatformMapping(platform, item, mappingCache, createdMappings);
        var mappedItem = {
          platform_item_name: item.platform_item_name,
          platform_item_id: item.platform_item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          modifiers: item.modifiers,
          notes: item.notes,
          mapping_key: item.mapping_key,
          source_item_key: item.source_item_key,
          internal_sku: mapping && mapping.status === "mapped" ? mapping.internal_sku : "",
          internal_item_name: mapping && mapping.status === "mapped" ? (mapping.internal_item_name || inventoryName(mapping.internal_sku)) : "",
          mapping_status: mapping ? mapping.status : "pending"
        };
        if (mappedItem.mapping_status === "mapped" && mappedItem.internal_sku) mappedCount += 1;
        if (mappedItem.mapping_status === "pending") pendingCount += 1;
        mappedItems.push(mappedItem);
      }

      await orderRef.set({
        platform: order.platform,
        store_id: order.store_id,
        platform_store_id: order.platform_store_id,
        platform_order_id: order.platform_order_id,
        order_time: order.order_time,
        order_status: order.order_status,
        subtotal_amount: order.subtotal_amount,
        total_amount: order.total_amount,
        delivery_fee: order.delivery_fee,
        service_fee: order.service_fee,
        discount_amount: order.discount_amount,
        refund_amount: order.refund_amount,
        customer_name: order.customer_name,
        raw_payload: {
          source_file_name: order.source_file_name,
          source_headers: normalized.headers || [],
          raw_rows: order.raw_rows
        },
        normalized_items: mappedItems,
        mapping_keys: order.mapping_keys,
        import_batch_id: options.batchId,
        pending_mapping_count: pendingCount,
        mapped_item_count: mappedCount,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      insertedRows += 1;
      if (pendingCount > 0) pendingMappingRows += pendingCount;
      await applyInventoryMovementsForOrder({
        platform: platform,
        platformOrderId: order.platform_order_id,
        storeId: storeId,
        items: mappedItems
      });
    }

    var summary = {
      import_batch_id: options.batchId,
      platform: platform,
      store_id: storeId,
      file_name: options.fileName,
      file_hash: options.fileHash,
      date_range_start: normalized.dateRangeStart,
      date_range_end: normalized.dateRangeEnd,
      total_rows: options.totalRows || (normalized.orders.length + normalized.failedRows.length),
      inserted_rows: insertedRows,
      duplicate_rows: duplicateRows,
      failed_rows: normalized.failedRows.length,
      pending_mapping_rows: pendingMappingRows,
      imported_by: options.importedBy,
      imported_at: firebase.firestore.FieldValue.serverTimestamp(),
      file_warning: options.fileWarning || ""
    };

    try {
      await db.collection("import_logs").doc(options.batchId).set(summary, { merge: true });
    } catch (error) {
      console.error("[PlatformOrders] Failed to write import log.", error);
    }
    return summary;
  }

  async function ensurePlatformMapping(platform, item, mappingCache, createdMappings) {
    if (mappingCache[item.mapping_key]) return mappingCache[item.mapping_key];
    var mappingRef = db.collection("platform_menu_mapping").doc(item.mapping_key);
    var existing = await mappingRef.get();
    if (existing.exists) {
      mappingCache[item.mapping_key] = existing.data();
      return mappingCache[item.mapping_key];
    }
    if (!createdMappings[item.mapping_key]) {
      var pendingPayload = {
        platform: platform,
        store_id: storeId,
        platform_item_name: item.platform_item_name,
        platform_item_id: item.platform_item_id || "",
        internal_sku: "",
        internal_item_name: "",
        status: "pending",
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      try {
        await mappingRef.set(pendingPayload, { merge: true });
        createdMappings[item.mapping_key] = true;
        mappingCache[item.mapping_key] = pendingPayload;
      } catch (error) {
        console.error("[PlatformOrders] Failed to create pending mapping.", error);
      }
    }
    return mappingCache[item.mapping_key] || null;
  }

  async function savePlatformMapping(mappingId) {
    if (!canManage()) return;
    var select = document.getElementById("platform-map-select-" + mappingId);
    var sku = select && select.value || "";
    if (!sku) {
      window.alert("請先選擇 internal_sku");
      return;
    }
    var mapping = data.platformMappings.find(function (item) { return item.id === mappingId; });
    if (!mapping) return;
    var internalName = inventoryName(sku);
    try {
      await db.collection("platform_menu_mapping").doc(mappingId).set({
        internal_sku: sku,
        internal_item_name: internalName,
        status: "mapped",
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await backfillInventoryForMapping({
        mappingId: mappingId,
        sku: sku,
        internalName: internalName
      });
      await loadScoped();
      msg("平台品項對應已儲存");
    } catch (error) {
      console.error("[PlatformOrders] Failed to save mapping.", error);
    }
  }

  async function ignorePlatformMapping(mappingId) {
    if (!canManage()) return;
    try {
      await db.collection("platform_menu_mapping").doc(mappingId).set({
        status: "ignored",
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await loadScoped();
      msg("已忽略平台品項");
    } catch (error) {
      console.error("[PlatformOrders] Failed to ignore mapping.", error);
    }
  }

  async function backfillInventoryForMapping(options) {
    var affectedOrders = data.platformOrders.filter(function (order) {
      return order.mapping_keys && order.mapping_keys.indexOf(options.mappingId) >= 0;
    });
    for (var i = 0; i < affectedOrders.length; i += 1) {
      var order = affectedOrders[i];
      var updatedItems = (order.normalized_items || []).map(function (item) {
        if (item.mapping_key !== options.mappingId) return item;
        return {
          ...item,
          internal_sku: options.sku,
          internal_item_name: options.internalName,
          mapping_status: "mapped"
        };
      });
      await db.collection("platform_orders").doc(order.id).set({
        normalized_items: updatedItems,
        pending_mapping_count: updatedItems.filter(function (item) { return item.mapping_status === "pending"; }).length,
        mapped_item_count: updatedItems.filter(function (item) { return item.mapping_status === "mapped"; }).length,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await applyInventoryMovementsForOrder({
        platform: order.platform,
        platformOrderId: order.platform_order_id,
        storeId: order.store_id,
        items: updatedItems
      });
    }
  }

  async function applyInventoryMovementsForOrder(options) {
    for (var i = 0; i < options.items.length; i += 1) {
      var item = options.items[i];
      if (item.mapping_status !== "mapped" || !item.internal_sku) continue;
      await ensureInventoryMovement({
        storeId: options.storeId,
        sku: item.internal_sku,
        qty: Number(item.quantity || 0),
        source: options.platform,
        sourceOrderId: options.platformOrderId,
        sourceItemKey: item.source_item_key
      });
    }
  }

  async function ensureInventoryMovement(options) {
    if (!options.qty) return;
    var movementId = window.PlatformOrderModule.buildMovementDocId(
      options.storeId,
      options.source,
      options.sourceOrderId,
      options.sku,
      options.sourceItemKey
    );
    var movementRef = db.collection("inventory_movements").doc(movementId);
    var inventoryRef = db.collection("inventory").doc(options.storeId + "_" + options.sku);

    await db.runTransaction(async function (tx) {
      var movementSnap = await tx.get(movementRef);
      if (movementSnap.exists) return;
      tx.set(movementRef, {
        store_id: options.storeId,
        sku: options.sku,
        qty_change: -Math.abs(options.qty),
        unit: "",
        reason: "sale",
        source_type: "platform_order",
        source: options.source,
        source_order_id: options.sourceOrderId,
        source_item_key: options.sourceItemKey,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(inventoryRef, {
        storeId: options.storeId,
        itemId: options.sku,
        stock: firebase.firestore.FieldValue.increment(-Math.abs(options.qty)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
  }

  function skuOptionHtml() {
    var items = data.menuItems.concat(data.comboTemplates);
    return ['<option value="">請選擇 internal_sku</option>'].concat(items.map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc((item.name || item.id) + " (" + item.id + ")") + "</option>";
    })).join("");
  }

  function detailCard(label, value) {
    return '<div class="admin-detail-item"><span class="admin-detail-label">' + esc(label) + '</span><span class="admin-detail-value">' + esc(value) + "</span></div>";
  }

  function todayDateKey() {
    return orderDateKey(new Date());
  }

  function orderDateKey(value) {
    var dateValue = toDate(value);
    if (!dateValue || isNaN(dateValue.getTime())) return "";
    return dateValue.getFullYear() + "-" + String(dateValue.getMonth() + 1).padStart(2, "0") + "-" + String(dateValue.getDate()).padStart(2, "0");
  }

  function msg(text) {
    if (el.status) el.status.textContent = text;
    console.log("[Admin]", text);
  }

  function renderOrders() {
    var archiveBtn = document.getElementById("orders-show-archived-btn");
    if (archiveBtn) archiveBtn.textContent = showArchivedOrders ? "隱藏封存訂單" : "顯示封存訂單";
    var testFilterBtn = document.getElementById("orders-show-test-btn");
    if (testFilterBtn) testFilterBtn.textContent = showTestOrdersOnly ? "顯示全部訂單" : "只顯示測試訂單";

    var displayed = data.orders.filter(function (order) {
      if (showTestOrdersOnly) return order.isTest === true;
      return showArchivedOrders ? !!order.archived : !order.archived;
    });

    el.lists.orders.innerHTML = displayed.map(function (order) {
      var normalizedOrder = window.LeLeShanOrders.normalizeOrder(order, order.id);
      var meta = window.LeLeShanOrders.statusMeta(normalizedOrder.status);
      if (window.LeLeShanOrderStatus && typeof window.LeLeShanOrderStatus.getLabel === "function") {
        meta = {
          tone: meta.tone,
          label: window.LeLeShanOrderStatus.getLabel(normalizedOrder.status)
        };
      }
      var archivedBadge = order.archived
        ? '<span style="background:#e5e5e5;color:#888;border-radius:4px;padding:1px 6px;font-size:0.75rem;margin-left:4px;">封存</span>'
        : "";
      var testBadge = order.isTest === true
        ? '<span style="background:#ff6b35;color:#fff;border-radius:4px;padding:1px 6px;font-size:0.75rem;margin-left:4px;font-weight:600;">測試單</span>'
        : "";
      var controls = "";
      if (canManage()) {
        var archiveBtnHtml = !order.archived
          ? '<button type="button" data-order-archive="' + esc(order.id) + '" style="background:#f5f5f5;color:#666;">封存</button>'
          : '<button type="button" data-order-unarchive="' + esc(order.id) + '" style="background:#f5f5f5;color:#666;">取消封存</button>';
        var permDeleteBtn = isOwner()
          ? '<button type="button" data-order-perm-delete="' + esc(order.id) + '" style="background:#fdecea;color:#c0392b;">永久刪除</button>'
          : "";
        var markTestBtn = (isOwner() && order.isTest !== true)
          ? '<button type="button" data-order-mark-test="' + esc(order.id) + '" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d;">標記測試單</button>'
          : "";
        controls = '<div class="admin-order-actions"><select data-order-status="' + esc(order.id) + '">'
          + ["new", "cooking", "packing", "ready", "picked_up", "cancelled"].map(function (status) {
            return '<option value="' + status + '"' + (normalizedOrder.status === status ? " selected" : "") + ">" + esc(orderStatusText(status)) + "</option>";
          }).join("")
          + '</select><button type="button" data-order-save="' + esc(order.id) + '">更新狀態</button>'
          + archiveBtnHtml + markTestBtn + permDeleteBtn + '</div>';
      }
      var pickupNumDisplay = order.pickupNumber
        ? '<strong style="font-size:1.1rem;color:var(--accent,#8B1A1A);">取餐號碼 ' + esc(order.pickupNumber) + '</strong>'
        : '<span style="color:#aaa;font-size:0.85rem;">舊單</span>';
      return buildCard(normalizedOrder.display_name || normalizedOrder.customer_name || normalizedOrder.id, [
        { label: "取餐號碼", value: pickupNumDisplay, html: true },
        { label: "訂單狀態", value: statusPill(meta.label, meta.tone === "ready" || meta.tone === "picked") + archivedBadge + testBadge, html: true },
        { label: "訂單金額", value: "NT$ " + Number(normalizedOrder.total || 0) },
        { label: "品項內容", value: orderItemsSummary(normalizedOrder.items, normalizedOrder.groups || order.groups), html: !!(normalizedOrder.groups || order.groups) },
        { label: "優惠結果", value: orderGiftPromotionSummary(normalizedOrder) },
        { label: "建立時間", value: formatDate(normalizedOrder.created_at || normalizedOrder.raw.createdAt) },
        { label: "預約取餐", value: normalizedOrder.scheduled_pickup_time ? (normalizedOrder.scheduled_pickup_date + " " + normalizedOrder.scheduled_pickup_time) : "未指定" },
        { label: "接單通知", value: renderNotifStatus(order), html: true },
        { label: "系統單號", value: '<span style="font-size:0.7rem;color:#bbb;word-break:break-all;">' + esc(order.id) + '</span>', html: true }
      ], controls);
    }).join("") || emptyCard(showTestOrdersOnly ? "沒有測試訂單" : showArchivedOrders ? "沒有封存訂單" : "目前沒有有效訂單");
  }

  function renderNotifStatus(order) {
    var ns = order.notificationStatus || {};
    if (!order.lineUserId) {
      return '<span style="color:#aaa;font-size:0.8rem;">無 LINE（不推播）</span>';
    }
    if (ns.receivedPushSent === true) {
      return '<span style="color:#27ae60;font-size:0.8rem;">✓ 已發送</span>';
    }
    if (ns.receivedPushError) {
      return '<span style="color:#e74c3c;font-size:0.8rem;" title="' + esc(ns.receivedPushError) + '">✗ 失敗</span>';
    }
    return '<span style="color:#f39c12;font-size:0.8rem;">⋯ 待發送</span>';
  }

  async function updateOrder(id, status) {
    if (!canManage()) return;

    try {
      await window.LeLeShanOrders.updateOrderStatus({
        db: db,
        orderId: id,
        storeId: storeId,
        nextStatus: status,
        actorUid: user && user.uid || "",
        actorName: admin && admin.name || ""
      });
      await loadScoped();
      msg("訂單狀態已更新");
    } catch (error) {
      console.error("[AdminOrders] Failed to update order status.", error);
      msg("訂單狀態更新失敗");
    }
  }

  async function archiveOrder(id, shouldArchive) {
    if (!canManage()) return;
    try {
      await db.collection("orders").doc(id).set({
        archived: shouldArchive === false ? false : true,
        archivedAt: shouldArchive === false ? null : firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      var order = data.orders.find(function (o) { return o.id === id; });
      if (order) { order.archived = shouldArchive === false ? false : true; }
      renderOrders();
      renderDashboard();
      msg(shouldArchive === false ? "已取消封存" : "訂單已封存");
    } catch (error) {
      console.error("[AdminOrders] Archive failed.", error);
      msg("封存失敗");
    }
  }

  async function permanentDeleteOrder(id) {
    if (!isOwner()) { msg("僅 owner 可永久刪除"); return; }
    var confirmed = window.confirm("⚠️ 確定要永久刪除此訂單？此操作無法復原，訂單資料將從資料庫完全移除。");
    if (!confirmed) return;
    var confirmed2 = window.confirm("再次確認：永久刪除訂單 " + id.slice(-8) + "？");
    if (!confirmed2) return;
    try {
      await db.collection("orders").doc(id).delete();
      data.orders = data.orders.filter(function (o) { return o.id !== id; });
      renderOrders();
      renderDashboard();
      msg("訂單已永久刪除");
    } catch (error) {
      console.error("[AdminOrders] Permanent delete failed.", error);
      msg("永久刪除失敗：" + (error.message || error));
    }
  }

  async function markAsTest(id) {
    if (!isOwner()) { msg("僅 owner 可標記測試單"); return; }
    try {
      await db.collection("orders").doc(id).set({
        isTest: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      var order = data.orders.find(function (o) { return o.id === id; });
      if (order) order.isTest = true;
      renderOrders();
      msg("已標記為測試單");
    } catch (error) {
      console.error("[AdminOrders] markAsTest failed.", error);
      msg("標記失敗：" + (error.message || error));
    }
  }

  async function deleteTestOrders() {
    if (!isOwner()) { msg("僅 owner 可刪除測試訂單"); return; }
    var confirmed = window.confirm("確定要刪除所有測試訂單？此操作無法復原，正式訂單不會受影響。");
    if (!confirmed) return;
    try {
      // 分批查詢 isTest === true，每批最多 300 筆
      var deleted = 0;
      var hasMore = true;
      while (hasMore) {
        var snap = await db.collection("orders")
          .where("isTest", "==", true)
          .limit(300)
          .get();
        if (snap.empty) { hasMore = false; break; }
        var batch = db.batch();
        snap.docs.forEach(function (doc) { batch.delete(doc.ref); });
        await batch.commit();
        deleted += snap.docs.length;
        if (snap.docs.length < 300) hasMore = false;
      }
      // 更新本地快取，同時刷新訂單列表與 Dashboard 統計
      data.orders = data.orders.filter(function (o) { return o.isTest !== true; });
      showTestOrdersOnly = false;
      renderOrders();
      renderDashboard();
      window.alert("測試訂單已刪除（共 " + deleted + " 筆）");
      msg("已刪除 " + deleted + " 筆測試訂單");
    } catch (error) {
      console.error("[AdminOrders] deleteTestOrders failed.", error);
      msg("刪除失敗：" + (error.message || error));
    }
  }

  function orderStatusText(status) {
    if (window.LeLeShanOrderStatus && typeof window.LeLeShanOrderStatus.getLabel === "function") {
      return window.LeLeShanOrderStatus.getLabel(status);
    }
    var meta = window.LeLeShanOrders.statusMeta(status);
    return meta.label;
  }

  function orderItemsSummary(items) {
    var lines = window.LeLeShanOrders.itemSummary(items, 4);
    return lines.length ? lines.join(" / ") : "無品項";
  }

  function orderGiftPromotionSummary(order) {
    var result = order && order.raw && order.raw.giftPromotionResult || order && order.giftPromotionResult || null;
    if (!result || !result.enabled) return "未套用";
    var items = Array.isArray(result.selectedGifts) ? result.selectedGifts.map(function (item) {
      return (item.giftType === "vegetable" ? "蔬菜：" : "主食：") + (item.name || item.itemId || "未選擇");
    }) : [];
    return items.length ? items.join(" / ") : "已達門檻，尚未選擇";
  }

  function describePointRule(rule) {
    if (!rule || rule.enabled === false) return "未啟用";
    var amount = Number(rule.amountPerPoint || rule.spendX_getY && rule.spendX_getY.x || 100) || 100;
    var points = Number(rule.pointsPerUnit || rule.spendX_getY && rule.spendX_getY.y || 1) || 1;
    return "每消費 " + amount + " 元得 " + points + " 點";
  }

  function activePointRule() {
    return data.pointRules.find(function (rule) {
      return rule.enabled && (!rule.activeRuleId || rule.activeRuleId === rule.id);
    }) || data.pointRules.find(function (rule) {
      return rule.enabled;
    }) || data.pointRules[0] || null;
  }

  function renderPointRuleSummary() {
    var currentRule = activePointRule();
    var amountInput = document.getElementById("point-rule-amount");
    var pointsInput = document.getElementById("point-rule-points");
    var enabledInput = document.getElementById("point-rule-enabled");
    var statusEl = document.getElementById("point-rule-status");
    if (!amountInput || !pointsInput || !enabledInput || !statusEl) return;
    amountInput.value = currentRule ? Number(currentRule.amountPerPoint || currentRule.spendX_getY && currentRule.spendX_getY.x || 100) : 100;
    pointsInput.value = currentRule ? Number(currentRule.pointsPerUnit || currentRule.spendX_getY && currentRule.spendX_getY.y || 1) : 1;
    enabledInput.checked = !!(currentRule && currentRule.enabled);
    syncSwitchLabels();
    statusEl.textContent = currentRule
      ? "目前規則：" + describePointRule(currentRule) + "（" + (currentRule.enabled ? "啟用中" : "未啟用") + "）"
      : "目前尚未設定點數規則";
  }

  async function savePointRule() {
    if (!canManage()) return;
    var amount = Number(document.getElementById("point-rule-amount").value || 100);
    var points = Number(document.getElementById("point-rule-points").value || 1);
    var enabled = !!document.getElementById("point-rule-enabled").checked;
    var currentRule = activePointRule();
    var ruleId = currentRule && currentRule.id ? currentRule.id : ("rule_" + storeId);
    try {
      await db.collection("point_rules").doc(ruleId).set({
        storeId: storeId,
        enabled: enabled,
        amountPerPoint: amount,
        pointsPerUnit: points,
        spendX_getY: { x: amount, y: points },
        roundingStrategy: "floor",
        activeRuleId: ruleId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await loadScoped();
      msg("點數規則已更新");
    } catch (error) {
      console.error("[Admin] Save point rule failed.", error);
      msg("點數規則儲存失敗");
    }
  }

  async function saveGiftPromotionSettings() {
    if (!canManage()) return;
    try {
      // Read current values from UI (rules already updated in-memory via event listeners)
      var enabledEl = document.getElementById("gift-promo-enabled");
      // Normalize rules for storage: generate clean IDs from names if empty
      var rulesToSave = giftPromoRules.map(function (r, idx) {
        var ruleId = (r.id || uid8()).trim();
        return {
          id: ruleId,
          name: r.name || ("區間 " + (idx + 1)),
          enabled: r.enabled !== false,
          minAmount: Number(r.minAmount || 0),
          maxAmount: r.maxAmount != null ? Number(r.maxAmount) : null,
          maxStaple: Number(r.maxStaple || 0),
          maxVegetable: Number(r.maxVegetable || 0),
          sort: idx + 1,
          items: (r.items || []).map(function (i, iIdx) {
            var itemId = (i.id || i.name || uid8()).trim();
            return {
              id: itemId,
              name: i.name || itemId,
              type: i.type === "vegetable" ? "vegetable" : "staple",
              enabled: i.enabled !== false,
              sort: iIdx + 1,
              priceAdjustment: Number(i.priceAdjustment || 0)
            };
          })
        };
      });
      await db.collection("settings").doc(storeId).set({
        storeId: storeId,
        giftPromotion: {
          enabled: enabledEl ? enabledEl.checked : false,
          rules: rulesToSave
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await loadScoped();
      msg("滿額贈送規則已儲存（共 " + rulesToSave.length + " 個區間）");
    } catch (error) {
      console.error("[Admin] Save gift promotion failed.", error);
      msg("滿額贈送設定儲存失敗");
    }
  }

  function openUserDetail(userId) {
    selectedUserId = userId;
    var item = data.users.find(function (u) { return u.id === userId; });
    if (!item) return;
    var panel = document.getElementById("user-detail-panel");
    panel.classList.remove("hidden");
    document.getElementById("user-detail-title").textContent = (item.name || item.displayName || "會員") + " 詳情";
    var points = Number(item.currentPoints || item.points || 0);
    document.getElementById("user-detail-info").innerHTML = [
      detailCard("會員編號", item.memberId || item.userId || item.id),
      detailCard("顯示名稱", item.name || item.displayName || "未設定"),
      detailCard("LINE ID", item.lineUserId || "未綁定"),
      detailCard("目前點數", String(points)),
      detailCard("累積得點", String(Number(item.totalEarnedPoints || 0))),
      detailCard("已用點數", String(Number(item.usedPoints || item.totalUsedPoints || 0))),
      detailCard("累積消費", "NT$ " + Number(item.totalSpent || 0)),
      detailCard("累積訂單", String(Number(item.totalOrders || 0))),
      detailCard("最後下單", item.lastOrderAt ? formatDate(item.lastOrderAt) : "—"),
      detailCard("最後點數異動", item.lastPointAt ? formatDate(item.lastPointAt) : "—"),
      detailCard("會員狀態", item.status === "disabled" ? "停用" : "啟用"),
      detailCard("會員等級", item.tier || "standard")
    ].join("");

    loadUserOrders(userId);
    loadUserPointHistory(userId);
  }

  function loadUserPointLogs(userId, limitCount) {
    return Promise.all([
      db.collection("point_logs").where("lineUserId", "==", userId).orderBy("createdAt", "desc").limit(limitCount || 20).get().catch(function () { return { docs: [] }; }),
      db.collection("point_transactions").where("lineUserId", "==", userId).orderBy("createdAt", "desc").limit(limitCount || 20).get().catch(function () { return { docs: [] }; })
    ]).then(function (snaps) {
      var merged = {};
      snaps.forEach(function (snap) {
        (snap.docs || []).forEach(function (doc) {
          var item = doc.data();
          item.id = doc.id;
          merged[item.id] = item;
        });
      });
      return Object.keys(merged).map(function (key) { return merged[key]; }).sort(function (left, right) {
        return toDate(right.createdAt) - toDate(left.createdAt);
      });
    });
  }

  function loadUserPointHistory(userId) {
    var container = document.getElementById("user-detail-points");
    container.innerHTML = '<p>載入中...</p>';
    loadUserPointLogs(userId, 20).then(function (txns) {
      if (!txns.length) { container.innerHTML = '<p>無點數紀錄</p>'; return; }
      container.innerHTML = txns.map(function (txn) {
        var amount = Number(txn.delta != null ? txn.delta : txn.amount || 0);
        var sign = amount >= 0 ? "+" : "";
        var reasonMap = { order_complete: "訂單完成", manual_add: "手動加點", manual_deduct: "手動扣點" };
        var label = reasonMap[txn.reason] || txn.reason || "異動";
        return '<div class="admin-list__row"><span>' + esc(label) + '</span><strong>' + sign + amount + ' 點</strong><span class="admin-list__muted">' + formatDate(txn.createdAt) + '</span></div>';
      }).join("");
    }).catch(function () { container.innerHTML = '<p>載入失敗</p>'; });
  }

  async function adjustUserPoints() {
    if (!canManage() || !selectedUserId) return;
    var amount = Number(document.getElementById("user-point-adjust-amount").value || 0);
    var reason = (document.getElementById("user-point-adjust-reason").value || "").trim();
    if (!amount) { msg("請輸入調整數量"); return; }
    if (!reason) { msg("請輸入調整原因"); return; }

    try {
      var adjustReason = amount >= 0 ? "manual_add" : "manual_deduct";
      var userRef = db.collection("users").doc(selectedUserId);
      var userSnap = await userRef.get();
      var beforePoints = userSnap.exists ? Number(userSnap.data().currentPoints || userSnap.data().points || 0) : 0;
      var afterPoints = beforePoints + amount;
      var batch = db.batch();
      batch.set(userRef, {
        memberId: selectedUserId,
        userId: selectedUserId,
        currentPoints: firebase.firestore.FieldValue.increment(amount),
        totalEarnedPoints: amount > 0 ? firebase.firestore.FieldValue.increment(amount) : firebase.firestore.FieldValue.increment(0),
        usedPoints: amount < 0 ? firebase.firestore.FieldValue.increment(Math.abs(amount)) : firebase.firestore.FieldValue.increment(0),
        totalUsedPoints: amount < 0 ? firebase.firestore.FieldValue.increment(Math.abs(amount)) : firebase.firestore.FieldValue.increment(0),
        points: firebase.firestore.FieldValue.increment(amount),
        lastPointAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      var txnId = "pt_manual_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      var pointLogPayload = {
        userId: selectedUserId,
        lineUserId: selectedUserId,
        storeId: storeId,
        orderId: "",
        delta: amount,
        amount: amount,
        beforePoints: beforePoints,
        afterPoints: afterPoints,
        reason: adjustReason,
        note: reason,
        source: "admin",
        operator: user && user.uid || "",
        operatorName: admin && admin.name || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      batch.set(db.collection("point_transactions").doc(txnId), pointLogPayload);
      batch.set(db.collection("point_logs").doc(txnId), pointLogPayload);

      await batch.commit();
      document.getElementById("user-point-adjust-amount").value = "";
      document.getElementById("user-point-adjust-reason").value = "";
      await loadScoped();
      openUserDetail(selectedUserId);
      msg("點數調整完成");
    } catch (error) {
      console.error("[Admin] Point adjust failed.", error);
      msg("點數調整失敗");
    }
  }

  function renderCombos() {
    el.lists.combos.innerHTML = data.comboTemplates.map(function (item) {
      var button = canManage()
        ? '<button type="button" data-edit="combos" data-id="' + esc(item.id) + '">編輯</button>'
        : "";
      var tags = (item.tags || []).join("、") || "無";
      return buildCard(item.name || item.id, [
        { label: "套餐名稱", value: item.name || "未命名套餐" },
        { label: "套餐售價", value: "NT$ " + Number(item.price || 0) },
        { label: "排序", value: String(item.sort || 0) },
        { label: "標籤", value: tags },
        { label: "套餐狀態", value: statusPill(item.enabled !== false ? "啟用中" : "未啟用", item.enabled !== false), html: true }
      ], button);
    }).join("") || emptyCard("目前沒有套餐資料");

    Array.prototype.slice.call(el.lists.combos.querySelectorAll(".admin-detail-item")).forEach(function (item) {
      var label = item.querySelector(".admin-detail-label");
      var text = label ? (label.textContent || "").trim() : "";
      if (text === "套餐編號" || text === "套餐加購群組" || text === "套餐說明" || text === "摘要") {
        item.remove();
      }
    });
  }

  // HELPER_MARKER

  // ── LINE Binding ─────────────────────────────────────────────

  var lineBindState = {
    targetCollection: null,
    targetDocId: null,
    targetName: null,
    token: null,
    expiresAt: null,
    countdownTimer: null,
    pollTimer: null,
    unsubscribeBinding: null
  };

  async function loadAdmins() {
    try {
      var snap = isOwner()
        ? await db.collection("admins").get()
        : await db.collection("admins").where("storeId", "==", storeId).get();
      data.admins = snap.docs.map(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        return d;
      });
    } catch (e) {
      console.warn("[AdminLine] loadAdmins failed.", e);
      data.admins = [];
    }
  }

  async function loadAndRenderAdmins() {
    await loadAdmins();
    renderAdminsLineSection();
  }

  function renderAdminsLineSection() {
    if (!el.adminsLineList) return;
    var admins = data.admins || [];
    if (!admins.length) {
      el.adminsLineList.innerHTML = '<article class="admin-empty-card" style="padding:12px 16px;font-size:.88rem;color:var(--admin-muted);">沒有管理員帳號資料</article>';
      return;
    }
    el.adminsLineList.innerHTML = admins.map(function (item) {
      return buildAdminLineCard(item, "admins");
    }).join("");
  }

  function renderEmployeeLineBinding() {
    if (!el.lists.employees) return;
    el.lists.employees.innerHTML = (data.employees || []).map(function (item) {
      var isBound = item.line_binding_status === "bound" && item.line_user_id;
      var notifyChecked = item.notify_line_new_orders ? " checked" : "";
      var confirmChecked = item.can_confirm_line_orders ? " checked" : "";
      var toggleDisabled = !isBound ? " disabled" : "";
      var toggleRowClass = !isBound ? " disabled" : "";

      var togglesHtml = canManage()
        ? '<div class="admin-line-item__toggles" style="margin-top:8px;">' +
            '<label class="line-toggle-row' + toggleRowClass + '" title="' + (isBound ? "" : "請先綁定 LINE 才能啟用通知") + '">' +
              '<input type="checkbox"' + notifyChecked + toggleDisabled +
                ' data-line-notify-toggle="true" data-target-collection="employees" data-target-id="' + esc(item.id) + '">' +
              '<span class="toggle-label-text">接收 LINE 新訂單通知</span>' +
            '</label>' +
            '<label class="line-toggle-row' + toggleRowClass + '" title="' + (isBound ? "" : "請先綁定 LINE 才能啟用") + '">' +
              '<input type="checkbox"' + confirmChecked + toggleDisabled +
                ' data-line-confirm-toggle="true" data-target-collection="employees" data-target-id="' + esc(item.id) + '">' +
              '<span class="toggle-label-text">可確認 LINE 訂單</span>' +
            '</label>' +
          '</div>'
        : "";

      var action = canManage()
        ? '<div class="admin-order-actions">' +
            '<button type="button" data-edit="employees" data-id="' + esc(item.id) + '">編輯</button>' +
            '<button type="button" data-employee-reset-pin="' + esc(item.id) + '">重設 PIN</button>' +
            buildLineBindButtonsHtml("employees", item.id, item.name || item.employeeId || item.id, item) +
          '</div>' +
          togglesHtml
        : "";
      return buildCard(item.name || item.employeeId || item.id, [
        { label: "員工姓名", value: item.name || "" },
        { label: "員工編號", value: item.employeeId || "" },
        { label: "所屬門市", value: item.storeId || "" },
        { label: "啟用狀態", value: statusPill(item.isActive !== false ? "啟用" : "停用", item.isActive !== false), html: true },
        { label: "LINE 綁定", value: buildLineBindStatusHtml(item), html: true },
        { label: "更新時間", value: item.updatedAt ? formatDate(item.updatedAt) : (item.createdAt ? formatDate(item.createdAt) : "—") }
      ], action);
    }).join("") || emptyCard("目前沒有員工資料");
  }

  function buildLineBindStatusHtml(item) {
    var isBound = item.line_binding_status === "bound" && item.line_user_id;
    if (isBound) {
      var masked = String(item.line_user_id).slice(0, 4) + "..." + String(item.line_user_id).slice(-4);
      return '<span class="line-bind-status-badge line-bind-status-badge--bound">✅ 已綁定 <span class="line-masked-uid">' + esc(masked) + '</span></span>';
    }
    return '<span class="line-bind-status-badge line-bind-status-badge--unbound">⬜ 未綁定</span>';
  }

  function buildLineBindButtonsHtml(collection, docId, name, item) {
    if (!canManage()) return "";
    var isBound = item.line_binding_status === "bound" && item.line_user_id;
    if (isBound) {
      return '<button type="button" class="line-bind-btn line-bind-btn--rebind" data-line-rebind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(docId) + '" data-target-name="' + esc(name) + '">重新綁定</button>' +
        '<button type="button" class="line-bind-btn line-bind-btn--unbind" data-line-unbind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(docId) + '" data-target-name="' + esc(name) + '">解除綁定</button>';
    }
    return '<button type="button" class="line-bind-btn line-bind-btn--bind" data-line-bind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(docId) + '" data-target-name="' + esc(name) + '">綁定 LINE</button>';
  }

  function buildAdminLineCard(item, collection) {
    var isBound = item.line_binding_status === "bound" && item.line_user_id;
    var masked = isBound ? (String(item.line_user_id).slice(0, 4) + "..." + String(item.line_user_id).slice(-4)) : "";
    var boundAt = (isBound && item.line_bound_at) ? formatDate(item.line_bound_at) : "";

    var statusHtml = isBound
      ? '<span class="line-bind-status-badge line-bind-status-badge--bound">✅ 已綁定</span>' +
        (masked ? ' <span class="line-masked-uid">' + esc(masked) + '</span>' : "") +
        (boundAt ? '<div class="line-bind-bound-at">綁定於 ' + esc(boundAt) + '</div>' : "")
      : '<span class="line-bind-status-badge line-bind-status-badge--unbound">⬜ 未綁定</span>';

    var bindActions = "";
    if (canManage()) {
      if (isBound) {
        bindActions = '<button type="button" class="line-bind-btn line-bind-btn--rebind" data-line-rebind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(item.id) + '" data-target-name="' + esc(item.name || item.id) + '">重新綁定</button>' +
          '<button type="button" class="line-bind-btn line-bind-btn--unbind" data-line-unbind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(item.id) + '" data-target-name="' + esc(item.name || item.id) + '">解除綁定</button>';
      } else {
        bindActions = '<button type="button" class="line-bind-btn line-bind-btn--bind" data-line-bind="true" data-target-collection="' + esc(collection) + '" data-target-id="' + esc(item.id) + '" data-target-name="' + esc(item.name || item.id) + '">綁定 LINE</button>';
      }
    }

    return '<article class="admin-line-item">' +
      '<div class="admin-line-item__info">' +
        '<div class="admin-line-item__name">' + esc(item.name || item.id) + '</div>' +
        '<div class="admin-line-item__meta">' +
          '<span class="admin-role-badge admin-role-badge--' + esc(item.role || "admin") + '">' + esc(item.role || "admin") + '</span>' +
          (item.storeId ? '<span style="font-size:.75rem;color:var(--admin-muted);">' + esc(item.storeId) + '</span>' : '') +
        '</div>' +
        '<div style="margin-top:8px;">' + statusHtml + '</div>' +
      '</div>' +
      '<div class="admin-line-item__actions">' + bindActions + '</div>' +
    '</article>';
  }

  function openLineBindModal(targetCollection, targetDocId, targetName) {
    if (!el.lineBindModal) return;
    lineBindState.targetCollection = targetCollection;
    lineBindState.targetDocId = targetDocId;
    lineBindState.targetName = targetName || "未知帳號";

    if (el.lineBindTargetLabel) el.lineBindTargetLabel.textContent = "綁定對象：" + (targetName || "未知帳號");
    setLineBindModalStatus("正在產生 QR Code...", "loading");
    if (el.lineBindQrCanvas) el.lineBindQrCanvas.innerHTML = "";
    if (el.lineBindCountdown) el.lineBindCountdown.textContent = "";
    if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.add("hidden");

    el.lineBindModal.classList.remove("hidden");
    generateLineBindToken(targetCollection, targetDocId, targetName);
  }

  function closeLineBindModal() {
    if (!el.lineBindModal) return;
    el.lineBindModal.classList.add("hidden");
    clearLineBindTimers();
  }

  function clearLineBindTimers() {
    if (lineBindState.countdownTimer) { clearInterval(lineBindState.countdownTimer); lineBindState.countdownTimer = null; }
    if (lineBindState.pollTimer) { clearInterval(lineBindState.pollTimer); lineBindState.pollTimer = null; }
    if (lineBindState.unsubscribeBinding) { try { lineBindState.unsubscribeBinding(); } catch (e) {} lineBindState.unsubscribeBinding = null; }
  }

  function setLineBindModalStatus(text, type) {
    if (!el.lineBindModalStatus) return;
    el.lineBindModalStatus.textContent = text;
    el.lineBindModalStatus.className = "line-bind-modal-status line-bind-modal-status--" + (type || "loading");
  }

  async function generateLineBindToken(targetCollection, targetDocId, targetName) {
    clearLineBindTimers();
    if (el.lineBindQrCanvas) el.lineBindQrCanvas.innerHTML = "";
    if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.add("hidden");
    setLineBindModalStatus("正在產生 QR Code...", "loading");

    try {
      var callable = functionsApi.httpsCallable("createLineBindingToken");
      var result = await callable({
        targetCollection: targetCollection || lineBindState.targetCollection,
        targetDocId: targetDocId || lineBindState.targetDocId,
        targetName: targetName || lineBindState.targetName
      });

      if (!result.data || !result.data.ok) {
        setLineBindModalStatus("❌ 產生 QR Code 失敗", "error");
        if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.remove("hidden");
        return;
      }

      lineBindState.token = result.data.token;
      lineBindState.expiresAt = new Date(result.data.expiresAt);
      var bindUrl = result.data.bindUrl;

      // Generate QR Code
      if (el.lineBindQrCanvas) {
        el.lineBindQrCanvas.innerHTML = "";
        el.lineBindQrCanvas.style.opacity = "1";
        if (typeof QRCode !== "undefined") {
          try {
            new QRCode(el.lineBindQrCanvas, {
              text: bindUrl,
              width: 200,
              height: 200,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.H
            });
            // Sanity check: QRCode renders a <canvas> or <svg> child; if nothing appeared, treat as failure
            setTimeout(function() {
              if (el.lineBindQrCanvas && el.lineBindQrCanvas.childNodes.length === 0) {
                console.warn("[AdminLine] QRCode render produced no output, showing URL fallback.");
                el.lineBindQrCanvas.innerHTML =
                  '<div style="padding:12px;font-size:.8rem;color:#e11d48;">⚠️ QR Code 顯示失敗，請複製下方連結</div>' +
                  '<div style="padding:8px 12px;font-size:.72rem;word-break:break-all;color:#333;">' + esc(bindUrl) + '</div>';
              }
            }, 300);
          } catch (qrErr) {
            console.error("[AdminLine] QRCode render failed:", qrErr);
            el.lineBindQrCanvas.innerHTML =
              '<div style="padding:12px;font-size:.8rem;color:#e11d48;">⚠️ QR Code 產生失敗，請複製下方連結</div>' +
              '<div style="padding:8px 12px;font-size:.72rem;word-break:break-all;color:#333;">' + esc(bindUrl) + '</div>';
          }
        } else {
          // QRCode library not loaded — show copyable URL
          console.warn("[AdminLine] QRCode library not loaded, falling back to URL display.");
          el.lineBindQrCanvas.innerHTML =
            '<div style="padding:12px;font-size:.8rem;color:#e11d48;">⚠️ QR Code 套件未載入，請複製下方連結</div>' +
            '<div style="padding:8px 12px;font-size:.72rem;word-break:break-all;color:#333;">' + esc(bindUrl) + '</div>';
        }
      }

      setLineBindModalStatus("⏳ 等待員工掃碼...", "waiting");
      startBindingCountdown();
      startBindingPoll(lineBindState.token);

    } catch (error) {
      console.error("[AdminLine] generateLineBindToken failed.", error);
      setLineBindModalStatus("❌ 產生 QR Code 失敗：" + ((error && error.message) || "未知錯誤"), "error");
      if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.remove("hidden");
    }
  }

  function startBindingCountdown() {
    if (lineBindState.countdownTimer) clearInterval(lineBindState.countdownTimer);
    var expiresAt = lineBindState.expiresAt;
    if (!expiresAt) return;

    function updateCountdown() {
      var remaining = Math.max(0, expiresAt.getTime() - Date.now());
      var mins = Math.floor(remaining / 60000);
      var secs = Math.floor((remaining % 60000) / 1000);
      if (!el.lineBindCountdown) return;
      if (remaining <= 0) {
        el.lineBindCountdown.textContent = "QR Code 已過期";
        el.lineBindCountdown.className = "line-bind-countdown urgent";
        clearInterval(lineBindState.countdownTimer);
        setLineBindModalStatus("⏰ QR Code 已過期，請重新產生", "expired");
        if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.remove("hidden");
        if (el.lineBindQrCanvas) el.lineBindQrCanvas.style.opacity = "0.3";
        clearLineBindTimers();
        return;
      }
      el.lineBindCountdown.textContent = "有效時間：" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
      el.lineBindCountdown.className = remaining < 60000 ? "line-bind-countdown urgent" : "line-bind-countdown";
    }
    updateCountdown();
    lineBindState.countdownTimer = setInterval(updateCountdown, 1000);
  }

  function startBindingPoll(token) {
    if (lineBindState.pollTimer) clearInterval(lineBindState.pollTimer);
    if (lineBindState.unsubscribeBinding) { try { lineBindState.unsubscribeBinding(); } catch (e) {} }

    // Use Firestore onSnapshot for real-time binding detection
    try {
      var unsubscribe = db.collection("line_bindings").doc(token).onSnapshot(function (snap) {
        if (!snap.exists) return;
        var data2 = snap.data() || {};
        if (data2.used === true) {
          setLineBindModalStatus("✅ 綁定成功！LINE 帳號已綁定完成", "success");
          if (el.lineBindCountdown) el.lineBindCountdown.textContent = "";
          if (el.lineBindRegenBtn) el.lineBindRegenBtn.classList.add("hidden");
          clearLineBindTimers();
          // Reload admins data to reflect new binding status
          setTimeout(function () {
            loadAndRenderAdmins();
            renderEmployeeLineBinding();
          }, 1000);
        }
      }, function (err) {
        console.warn("[AdminLine] onSnapshot error.", err);
        // Fall back to polling if onSnapshot fails
        lineBindState.pollTimer = setInterval(function () { pollBindingStatus(token); }, 3000);
      });
      lineBindState.unsubscribeBinding = unsubscribe;
    } catch (e) {
      // Fall back to polling
      lineBindState.pollTimer = setInterval(function () { pollBindingStatus(token); }, 3000);
    }
  }

  async function pollBindingStatus(token) {
    try {
      var snap = await db.collection("line_bindings").doc(token).get();
      if (!snap.exists) return;
      var bindData = snap.data() || {};
      if (bindData.used === true) {
        setLineBindModalStatus("✅ 綁定成功！LINE 帳號已綁定完成", "success");
        clearLineBindTimers();
        setTimeout(function () {
          loadAndRenderAdmins();
          renderEmployeeLineBinding();
        }, 1000);
      }
    } catch (e) {
      console.warn("[AdminLine] pollBindingStatus failed.", e);
    }
  }

  async function doUnbindLine(targetCollection, targetDocId, targetName) {
    if (!canManage()) return;
    try {
      var callable = functionsApi.httpsCallable("unbindLine");
      await callable({ targetCollection: targetCollection, targetDocId: targetDocId });
      msg("「" + (targetName || "帳號") + "」已解除 LINE 綁定");
      await loadAndRenderAdmins();
      await loadScoped();
    } catch (e) {
      console.error("[AdminLine] unbindLine failed.", e);
      msg((e && e.message) || "解除綁定失敗");
    }
  }

  async function saveLineNotificationSetting(targetCollection, targetDocId, field, value) {
    if (!canManage()) return;
    try {
      var callable = functionsApi.httpsCallable("updateLineNotificationSettings");
      var payload = { targetCollection: targetCollection, targetDocId: targetDocId };
      payload[field] = value;
      await callable(payload);
      // Update local data without full reload
      var items = targetCollection === "admins" ? data.admins : data.employees;
      var item = items && items.find(function (i) { return i.id === targetDocId; });
      if (item) item[field] = value;
    } catch (e) {
      console.error("[AdminLine] saveLineNotificationSetting failed.", e);
      msg((e && e.message) || "設定更新失敗");
    }
  }

})();
