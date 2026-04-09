(function () {
  var db;
  var auth;
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
  var OWNER_ROLE = "owner";
  var ADMIN_ROLE = "admin";
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

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    initFirebase();
    bind();
    renderCategoryColorOptions();
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
      users: document.getElementById("users-list"),
      promotions: document.getElementById("promotions-list")
    };
  }

  function initFirebase() {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
  }

  function bind() {
    var reloginButton = document.getElementById("admin-access-relogin-btn");

    el.logoutBtn.addEventListener("click", async function () {
      await auth.signOut();
      window.location.href = "/admin/login";
    });

    if (reloginButton) {
      reloginButton.addEventListener("click", signOutToLogin);
    }

    el.seedBtn.addEventListener("click", seedDefaults);

    el.storeSelect.addEventListener("change", function () {
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

    el.modalClose.addEventListener("click", closeModal);
    el.modal.addEventListener("click", function (event) {
      if (event.target && event.target.getAttribute("data-close-modal") === "true") {
        closeModal();
      }
    });

    document.getElementById("store-form").addEventListener("submit", saveStore);
    document.getElementById("category-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveDoc("categories", "category", buildCategory());
    });
    document.getElementById("menu-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveMenuItem();
    });
    document.getElementById("combo-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveDoc("comboTemplates", "combo", buildCombo());
    });
    document.getElementById("flavor-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveDoc("flavors", "flavor", buildFlavor());
    });
    document.getElementById("inventory-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveDoc("inventory", "inventory", buildInventory());
    });
    document.getElementById("promotion-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveDoc("promotions", "promotion", buildPromotion());
    });
    document.getElementById("settings-form").addEventListener("submit", saveSettings);

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
    bindSwitchLabel("point-rule-enabled", "point-rule-enabled-label", "啟用中", "未啟用");

    var userSearchBtn = document.getElementById("user-search-btn");
    if (userSearchBtn) {
      userSearchBtn.addEventListener("click", function () { renderUsers(); });
    }
    var userDetailClose = document.getElementById("user-detail-close");
    if (userDetailClose) {
      userDetailClose.addEventListener("click", function () {
        document.getElementById("user-detail-panel").classList.add("hidden");
      });
    }
    var userPointAdjustBtn = document.getElementById("user-point-adjust-btn");
    if (userPointAdjustBtn) {
      userPointAdjustBtn.addEventListener("click", adjustUserPoints);
    }

    document.addEventListener("click", onDocumentClick);
    el.comboAddOptionBtn.addEventListener("click", function () {
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
    bindSwitchLabel("menu-enabled", "menu-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("combo-enabled", "combo-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("flavor-enabled", "flavor-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("promotion-enabled", "promotion-enabled-label", "啟用中", "停用中");
    bindSwitchLabel("settings-open", "settings-open-label", "營業中", "休息中");
    bindSwitchLabel("settings-promo-enabled", "settings-promo-enabled-label", "啟用中", "未啟用");
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
    el.views.forEach(function (view) {
      view.classList.toggle("hidden", view.id !== "view-" + name);
    });
    el.nav.forEach(function (link) {
      link.classList.toggle("active", link.dataset.view === name);
    });
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

    shell.classList.add("hidden");
    state.classList.remove("hidden");
    titleEl.textContent = title;
    descriptionEl.textContent = description;
    retryButton.classList.toggle("hidden", !showRetry);
  }

  function showAdminShell() {
    document.getElementById("admin-access-state").classList.add("hidden");
    document.getElementById("admin-shell").classList.remove("hidden");
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
      el.userMeta.textContent = (admin.name || "未命名管理員") + " / " + admin.role;

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
    data.comboTemplates = mapDocs(results[3]).sort(bySort);
    data.flavors = mapDocs(results[4]).sort(bySort);
    data.inventory = mapDocs(results[5]);
    data.promotions = mapDocs(results[6]);
    data.users = mapDocs(results[7]).sort(byCreatedDesc);
    data.orders = mapDocs(results[8]).sort(byCreatedDesc);
    data.settings = results[9].exists ? results[9].data() : null;
    data.platformOrders = mapDocs(results[10]).sort(byCreatedDesc);
    data.platformMappings = mapDocs(results[11]).sort(byCreatedDesc);
    data.inventoryMovements = mapDocs(results[12]).sort(byCreatedDesc);
    data.importLogs = mapDocs(results[13]).sort(byCreatedDesc);
    data.pointRules = results[14] ? mapDocs(results[14]) : [];

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

    renderAll();
    msg("已載入 " + storeId + " 的資料");
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
      batch.set(db.collection("comboTemplates").doc(item.id), withStore(item), { merge: true });
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
    renderPlatformOrders();
    renderUsers();
    renderSettingsSummary();
    renderCategoryOptions();
    renderPointRuleSummary();
  }

  function renderDashboard() {
    var start = new Date();
    start.setHours(0, 0, 0, 0);

    var todayOrders = data.orders.filter(function (order) {
      var createdAt = toDate(order.createdAt);
      return createdAt && createdAt >= start && order.status !== "cancelled";
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

  function renderSettingsSummary() {
    document.getElementById("settings-open").checked = !!(data.settings && data.settings.isOpen);
    document.getElementById("settings-promo-enabled").checked = !!(data.settings && data.settings.promoEnabled);
    document.getElementById("settings-open-notice").value = data.settings && data.settings.openNotice || "";
    document.getElementById("settings-promo-text").value = data.settings && data.settings.promoText || "";
    document.getElementById("settings-open-from").value = data.settings && data.settings.openFrom || "";
    document.getElementById("settings-open-to").value = data.settings && data.settings.openTo || "";
    syncSwitchLabels();

    el.settingsSummary.innerHTML = [
      statusPill(data.settings && data.settings.isOpen ? "營業中" : "休息中", !!(data.settings && data.settings.isOpen)),
      "<p><strong>營業公告：</strong>" + esc(data.settings && data.settings.openNotice || "未設定") + "</p>",
      "<p><strong>優惠提示：</strong>" + esc(data.settings && data.settings.promoText || "未設定") + "</p>",
      "<p><strong>優惠提示狀態：</strong>" + (data.settings && data.settings.promoEnabled ? "啟用中" : "未啟用") + "</p>",
      "<p><strong>接單時間：</strong>" + esc((data.settings && data.settings.openFrom) || "17:40") + " – " + esc((data.settings && data.settings.openTo) || "22:50") + "</p>"
    ].join("");
  }

  function renderCategoryOptions() {
    document.getElementById("menu-category").innerHTML = ['<option value="未分類">未分類</option>'].concat(data.categories.map(function (item) {
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
  }

  function openCreateForm(type) {
    resetForm(type);
    if (type === "settings") {
      document.getElementById("settings-open").checked = !!(data.settings && data.settings.isOpen);
      document.getElementById("settings-promo-enabled").checked = !!(data.settings && data.settings.promoEnabled);
      document.getElementById("settings-open-notice").value = data.settings && data.settings.openNotice || "";
      document.getElementById("settings-promo-text").value = data.settings && data.settings.promoText || "";
      document.getElementById("settings-open-from").value = data.settings && data.settings.openFrom || "";
      document.getElementById("settings-open-to").value = data.settings && data.settings.openTo || "";
      syncSwitchLabels();
    }
    openModal(type, type === "settings" ? "編輯" : "新增");
  }

  function edit(type, id) {
    var item = findItem(type, id);
    if (!item) return;

    resetForm(type);

    if (type === "stores") {
      document.getElementById("store-id").value = item.id;
      document.getElementById("store-name").value = item.name || "";
      document.getElementById("store-active").checked = item.isActive !== false;
    } else if (type === "categories") {
      document.getElementById("category-id").value = item.id;
      document.getElementById("category-name").value = item.name || "";
      document.getElementById("category-sort").value = item.sort || 0;
      document.getElementById("category-bg-color").value = categoryColorMeta(item.colorTheme || item.bgColor || item.themeColor).value;
      updateCategoryColorPreview(document.getElementById("category-bg-color").value);
      document.getElementById("category-enabled").checked = item.enabled !== false;
    } else if (type === "menu") {
      document.getElementById("menu-id").value = item.id;
      document.getElementById("menu-name").value = item.name || "";
      document.getElementById("menu-price").value = item.price || 0;
      document.getElementById("menu-category").value = item.category || "";
      document.getElementById("menu-sort").value = item.sortOrder || 999;
      document.getElementById("menu-image-url").value = item.imageUrl || "";
      document.getElementById("menu-tags").value = (item.tags || []).join(",");
      document.getElementById("menu-unit").value = item.unit || "";
      document.getElementById("menu-description").value = item.description || "";
      document.getElementById("menu-option-groups").value = JSON.stringify(item.optionGroups || [], null, 2);
      document.getElementById("menu-enabled").checked = !!item.isActive;
    } else if (type === "combos") {
      document.getElementById("combo-id").value = item.id;
      document.getElementById("combo-name").value = item.name || "";
      document.getElementById("combo-price").value = item.price || 0;
      document.getElementById("combo-sort").value = item.sort || 0;
      document.getElementById("combo-tags").value = (item.tags || []).join(",");
      document.getElementById("combo-description").value = item.description || "";
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
    }

    syncSwitchLabels();
    openModal(type, "編輯");
  }

  async function saveStore(event) {
    event.preventDefault();
    if (!isOwner()) return;

    var docId = val("store-id");
    await db.collection("stores").doc(docId).set({
      name: val("store-name"),
      isActive: document.getElementById("store-active").checked,
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

  async function saveMenuItem() {
    if (!canManage()) return;

    var docId = val("menu-id") || db.collection("menu_items").doc().id;
    var isNew = !val("menu-id");
    var payload = buildMenuItem();

    try {
      await db.collection("menu_items").doc(docId).set({
        storeId: storeId,
        name: payload.name,
        price: payload.price,
        category: payload.category,
        categoryId: payload.category,
        sortOrder: payload.sortOrder,
        sort: payload.sortOrder,
        isActive: payload.isActive,
        enabled: payload.isActive,
        description: payload.description,
        imageUrl: payload.imageUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user && user.uid || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        tags: payload.tags,
        unit: payload.unit,
        optionGroups: payload.optionGroups
      }, { merge: true });

      console.log("[AdminMenu] Saved menu item.", { docId: docId, action: isNew ? "create" : "update" });
      closeModal();
      await loadScoped();
      msg(isNew ? "新增成功" : "更新成功");
    } catch (error) {
      console.error("[AdminMenu] Save failed.", error);
      msg("儲存失敗，請稍後再試");
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
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    closeModal();
    await loadScoped();
    msg("營業狀態設定已儲存");
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
      isActive: checked("menu-enabled")
    };
  }

  function buildCombo() {
    return {
      name: val("combo-name"),
      price: num("combo-price"),
      sort: num("combo-sort"),
      description: val("combo-description"),
      tags: csv("combo-tags"),
      optionGroups: readComboGroups(),
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
    var map = { stores: "store", categories: "category", combos: "combo", flavors: "flavor", promotions: "promotion" };
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
      settings: "營業設定"
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
      ["menu-enabled", "menu-enabled-label", "啟用中", "停用中"],
      ["combo-enabled", "combo-enabled-label", "啟用中", "停用中"],
      ["flavor-enabled", "flavor-enabled-label", "啟用中", "停用中"],
      ["promotion-enabled", "promotion-enabled-label", "啟用中", "停用中"],
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

  function normalizeMenuItem(item) {
    var normalized = { ...item };
    normalized.name = normalized.name || "";
    normalized.price = Number(normalized.price || 0);
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
    var map = {
      new: "新訂單",
      preparing: "準備中",
      done: "已完成",
      cancelled: "已取消"
    };
    return map[status] || status;
  }

  function orderItemsSummary(items) {
    if (!items || !items.length) return "無";
    return items.map(function (item) {
      return (item.name || item.itemId || "未命名品項") + " x" + Number(item.qty || 0);
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
    el.status.textContent = text;
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
      return buildCard(normalizedOrder.display_name || normalizedOrder.customer_name || normalizedOrder.id, [
        { label: "訂單編號", value: order.id },
        { label: "訂單狀態", value: statusPill(meta.label, meta.tone === "ready" || meta.tone === "picked") + archivedBadge + testBadge, html: true },
        { label: "訂單金額", value: "NT$ " + Number(normalizedOrder.total || 0) },
        { label: "品項內容", value: orderItemsSummary(normalizedOrder.items) },
        { label: "建立時間", value: formatDate(normalizedOrder.created_at || normalizedOrder.raw.createdAt) },
        { label: "預約取餐", value: normalizedOrder.scheduled_pickup_time ? (normalizedOrder.scheduled_pickup_date + " " + normalizedOrder.scheduled_pickup_time) : "未指定" },
        { label: "接單通知", value: renderNotifStatus(order), html: true }
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
      // 更新本地快取
      data.orders = data.orders.filter(function (o) { return o.isTest !== true; });
      showTestOrdersOnly = false;
      renderOrders();
      window.alert("測試訂單已刪除（共 " + deleted + " 筆）");
      msg("已刪除 " + deleted + " 筆測試訂單");
    } catch (error) {
      console.error("[AdminOrders] deleteTestOrders failed.", error);
      msg("刪除失敗：" + (error.message || error));
    }
  }

  function orderStatusText(status) {
    var meta = window.LeLeShanOrders.statusMeta(status);
    return meta.label;
  }

  function orderItemsSummary(items) {
    var lines = window.LeLeShanOrders.itemSummary(items, 4);
    return lines.length ? lines.join(" / ") : "無品項";
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
})();
