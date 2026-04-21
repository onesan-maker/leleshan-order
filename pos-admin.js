(function () {
  var VIEW_TITLE_MAP = {
    dashboard: "POS 後台管理中心",
    orders: "訂單管理",
    products: "商品管理",
    staff: "員工管理",
    settings: "營業設定"
  };

  var SOURCE_LABEL_MAP = {
    pos: "現場",
    onsite: "現場",
    manual: "現場",
    liff: "線上",
    ubereats: "UberEats",
    foodpanda: "Foodpanda",
    other: "其他"
  };

  var STATUS_LABEL_MAP = {
    new: "待製作",
    accepted: "待製作",
    preparing: "製作中",
    cooking: "製作中",
    packing: "製作中",
    ready: "可取餐",
    completed: "已完成",
    picked_up: "已完成",
    cancelled: "已取消",
    canceled: "已取消",
    unknown: "未知"
  };

  var PENDING_STATUS_SET = new Set(["new", "accepted", "preparing", "cooking", "packing"]);
  var MAKING_STATUS_SET = new Set(["preparing", "cooking", "packing"]);
  var READY_STATUS_SET = new Set(["ready"]);
  var DONE_STATUS_SET = new Set(["completed", "picked_up"]);
  var CANCELLED_STATUS_SET = new Set(["cancelled"]);
  var ONSITE_SOURCE_SET = new Set(["pos", "onsite", "manual"]);
  var DEFAULT_POS_RULE_TYPE_ROWS = [
    { code: "set", label: "套餐", flavorMode: "required", stapleMode: "required", allowAssignPart: true, enabled: true },
    { code: "addon", label: "單點", flavorMode: "inherit", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "staple_rice", label: "白飯類", flavorMode: "none", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "staple_noodle", label: "麵類主食", flavorMode: "inherit", stapleMode: "none", allowAssignPart: true, enabled: true },
    { code: "drink", label: "飲料", flavorMode: "none", stapleMode: "none", allowAssignPart: false, enabled: true },
    { code: "other", label: "其他", flavorMode: "none", stapleMode: "none", allowAssignPart: true, enabled: true }
  ];
  var DEFAULT_POS_GLOBAL_RULES = {
    enableAssignDifferentPeople: true,
    singleFlavorPerPart: true,
    setUpdatesPartFlavor: true,
    noodleRequiresFlavorIfPartMissing: true
  };
  var POS_TYPE_OPTIONS = ["set", "addon", "staple_rice", "staple_noodle", "drink", "other"];
  var POS_TYPE_LABELS = {
    set:          "套餐",
    addon:        "單點",
    staple_rice:  "白飯類",
    staple_noodle:"麵類主食",
    drink:        "飲料",
    other:        "其他"
  };
  var POS_TYPE_TOOLTIPS = {
    set:          "套餐：需要依套餐規則處理口味與主食",
    addon:        "單點：通常跟隨套餐口味，不需主食",
    staple_rice:  "白飯類：不處理口味與主食",
    staple_noodle:"麵類主食：依設定可能需要口味",
    drink:        "飲料：不處理口味與主食",
    other:        "其他：依一般規則處理"
  };

  var state = {
    auth: null,
    db: null,
    user: null,
    access: null,
    currentView: "dashboard",
    storeId: "",
    stores: [],
    allOrders: [],
    todayOrders: [],
    orderFilter: "all",
    expanded: {
      dashboard: {},
      orders: {}
    },
    products: {
      combos: [],
      items: [],
      globalFlavors: [],
      globalStaples: [],
      posRules: null,
      loaded: false,
      tab: "combos",
      expanded: {}
    }
  };

  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheDom();
    bindEvents();
    boot();
  });

  function cacheDom() {
    el.gate = document.getElementById("pa-gate");
    el.shell = document.getElementById("pa-shell");
    el.pageTitle = document.getElementById("pa-page-title");
    el.userMeta = document.getElementById("pa-user-meta");
    el.storeSelect = document.getElementById("pa-store-select");
    el.logoutBtn = document.getElementById("pa-logout-btn");

    el.navItems = Array.prototype.slice.call(document.querySelectorAll(".pa-nav__item[data-view]"));
    el.filterButtons = Array.prototype.slice.call(document.querySelectorAll(".pa-filter-btn[data-order-filter]"));

    el.views = {
      dashboard: document.getElementById("pa-view-dashboard"),
      orders: document.getElementById("pa-view-orders"),
      products: document.getElementById("pa-view-products"),
      staff: document.getElementById("pa-view-staff"),
      settings: document.getElementById("pa-view-settings")
    };

    el.metricOrders = document.getElementById("pa-metric-orders");
    el.metricRevenue = document.getElementById("pa-metric-revenue");
    el.metricAverage = document.getElementById("pa-metric-average");
    el.metricPending = document.getElementById("pa-metric-pending");

    el.subLastTime = document.getElementById("pa-sub-last-time");
    el.subOnsite = document.getElementById("pa-sub-onsite");
    el.subOnline = document.getElementById("pa-sub-online");
    el.subCompleted = document.getElementById("pa-sub-completed");

    el.dashboardBody = document.getElementById("pa-dashboard-orders-body");
    el.dashboardEmpty = document.getElementById("pa-dashboard-empty");
    el.ordersBody = document.getElementById("pa-orders-body");
    el.ordersEmpty = document.getElementById("pa-orders-empty");

    el.refreshDashboardBtn = document.getElementById("pa-refresh-dashboard-btn");
    el.refreshOrdersBtn = document.getElementById("pa-refresh-orders-btn");
    el.seedBtn = document.getElementById("pa-seed-btn");
    el.clearTestBtn = document.getElementById("pa-clear-test-btn");
    el.seedStatus = document.getElementById("pa-seed-status");

    el.globalFlavorsTA = document.getElementById("pa-global-flavors");
    el.globalStaplesTA = document.getElementById("pa-global-staples");
    el.globalOptsSave = document.getElementById("pa-global-opts-save");
    el.globalOptsStatus = document.getElementById("pa-global-opts-status");
    el.posRulesSave = document.getElementById("pa-pos-rules-save");
    el.posTypeRulesCards = document.getElementById("pa-pos-type-rules-cards");
    el.posRulesStatus = document.getElementById("pa-pos-rules-status");
    el.ruleEnableAssignPeople = document.getElementById("pa-rule-enable-assign-people");
    el.ruleSingleFlavorPerPart = document.getElementById("pa-rule-single-flavor-per-part");
    el.ruleSetUpdatesPartFlavor = document.getElementById("pa-rule-set-updates-part-flavor");
    el.ruleNoodleRequiresFlavor = document.getElementById("pa-rule-noodle-requires-flavor");
    el.productsLoading = document.getElementById("pa-products-loading");
    el.productsEmpty = document.getElementById("pa-products-empty");
    el.productsList = document.getElementById("pa-products-list");
    el.productsRefresh = document.getElementById("pa-products-refresh");
    el.productTabBtns = Array.prototype.slice.call(document.querySelectorAll("[data-product-tab]"));
  }

  function bindEvents() {
    if (el.navItems && el.navItems.length) {
      el.navItems.forEach(function (button) {
        button.addEventListener("click", function () {
          setView(button.getAttribute("data-view"));
        });
      });
    }

    if (el.storeSelect) {
      el.storeSelect.addEventListener("change", function () {
        state.storeId = String(el.storeSelect.value || "").trim();
        state.expanded.dashboard = {};
        state.expanded.orders = {};
        loadOrdersAndRender();
      });
    }

    if (el.logoutBtn) {
      el.logoutBtn.addEventListener("click", handleLogout);
    }

    if (el.refreshDashboardBtn) {
      el.refreshDashboardBtn.addEventListener("click", loadOrdersAndRender);
    }
    if (el.refreshOrdersBtn) {
      el.refreshOrdersBtn.addEventListener("click", loadOrdersAndRender);
    }

    if (el.seedBtn) el.seedBtn.addEventListener("click", seedTestOrders);
    if (el.clearTestBtn) el.clearTestBtn.addEventListener("click", clearTestOrders);

    if (el.globalOptsSave) {
      el.globalOptsSave.addEventListener("click", saveGlobalOpts);
    }
    if (el.posRulesSave) {
      el.posRulesSave.addEventListener("click", savePosRules);
    }
    if (el.productsRefresh) {
      el.productsRefresh.addEventListener("click", function () {
        state.products.loaded = false;
        state.products.expanded = {};
        loadProducts();
      });
    }
    if (el.productTabBtns && el.productTabBtns.length) {
      el.productTabBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.products.tab = btn.getAttribute("data-product-tab");
          el.productTabBtns.forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          renderProductList();
        });
      });
    }
    if (el.productsList) {
      el.productsList.addEventListener("change", onProductListChange);
      el.productsList.addEventListener("click", onProductListClick);
    }

    if (el.filterButtons && el.filterButtons.length) {
      el.filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          state.orderFilter = button.getAttribute("data-order-filter") || "all";
          renderOrderFilterActiveState();
          renderOrdersTable();
        });
      });
    }

    if (el.dashboardBody) {
      el.dashboardBody.addEventListener("click", function (event) {
        var button = event.target.closest("[data-toggle-dashboard]");
        if (!button) return;
        var orderId = button.getAttribute("data-toggle-dashboard");
        if (!orderId) return;
        state.expanded.dashboard[orderId] = !state.expanded.dashboard[orderId];
        renderDashboardTable();
      });
    }

    if (el.ordersBody) {
      el.ordersBody.addEventListener("click", function (event) {
        var button = event.target.closest("[data-toggle-orders]");
        if (!button) return;
        var orderId = button.getAttribute("data-toggle-orders");
        if (!orderId) return;
        state.expanded.orders[orderId] = !state.expanded.orders[orderId];
        renderOrdersTable();
      });
    }
  }

  function boot() {
    try {
      initFirebase();
    } catch (error) {
      setGateMessage("初始化失敗：" + safeMessage(error));
      return;
    }

    state.auth.onAuthStateChanged(async function (user) {
      if (!user) {
        redirectToLogin();
        return;
      }
      state.user = user;
      await guardAndStart();
    });
  }

  function initFirebase() {
    if (!window.APP_CONFIG || !window.APP_CONFIG.firebaseConfig) {
      throw new Error("缺少 Firebase 設定");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    }
    state.auth = firebase.auth();
    state.db = firebase.firestore();
  }

  async function guardAndStart() {
    if (!window.AdminAuthHelper || typeof window.AdminAuthHelper.fetchAdminAccess !== "function") {
      setGateMessage("授權模組載入失敗");
      return;
    }

    try {
      var access = await window.AdminAuthHelper.fetchAdminAccess(state.db, state.user.uid);
      if (!access || !access.allowed) {
        await safeSignOut();
        redirectToLogin();
        return;
      }

      state.access = access;
      await setupStoreSelector();
      fillUserMeta();
      showShell();
      setView("dashboard");
      await loadOrdersAndRender();
    } catch (error) {
      setGateMessage("權限驗證失敗：" + safeMessage(error));
    }
  }

  async function setupStoreSelector() {
    var role = normalizeString(state.access.role).toLowerCase();
    var data = state.access.data || {};
    var defaultStoreId = (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1";
    var queryStoreId = normalizeString(new URLSearchParams(window.location.search).get("storeId"));
    var preferredStoreId = queryStoreId || normalizeString(data.storeId) || defaultStoreId;

    var stores = [];
    if (role === "owner") {
      stores = await loadStores();
      if (!stores.length) {
        stores = [{ id: preferredStoreId, name: preferredStoreId }];
      }
    } else {
      stores = [{ id: normalizeString(data.storeId) || defaultStoreId, name: normalizeString(data.storeId) || defaultStoreId }];
    }

    state.stores = stores;
    state.storeId = chooseStore(stores, preferredStoreId);
    renderStoreOptions(role);
  }

  async function loadStores() {
    try {
      var snap = await state.db.collection("stores").limit(150).get();
      return snap.docs.map(function (doc) {
        var data = doc.data() || {};
        return {
          id: String(doc.id),
          name: normalizeString(data.name || data.storeName || doc.id)
        };
      }).filter(function (store) {
        return !!store.id;
      });
    } catch (error) {
      console.warn("[POS Admin] load stores failed.", error);
      return [];
    }
  }

  function chooseStore(stores, preferredStoreId) {
    if (!stores || !stores.length) return preferredStoreId;
    var found = stores.find(function (store) {
      return store.id === preferredStoreId;
    });
    return found ? found.id : stores[0].id;
  }

  function renderStoreOptions(role) {
    if (!el.storeSelect) return;
    el.storeSelect.innerHTML = (state.stores || []).map(function (store) {
      var selected = store.id === state.storeId ? " selected" : "";
      return "<option value=\"" + esc(store.id) + "\"" + selected + ">" + esc(store.name || store.id) + "</option>";
    }).join("");
    el.storeSelect.disabled = role !== "owner";
  }

  function fillUserMeta() {
    if (!el.userMeta) return;
    var data = state.access.data || {};
    var role = normalizeString(state.access.role).toLowerCase();
    var roleLabel = role === "owner" ? "Owner" : "Admin";
    var userName = normalizeString(data.name) || normalizeString(state.user.displayName) || normalizeString(state.user.email) || state.user.uid;
    el.userMeta.textContent = roleLabel + "｜" + userName;
  }

  function showShell() {
    if (el.gate) el.gate.classList.add("pa-hidden");
    if (el.shell) el.shell.classList.remove("pa-hidden");
  }

  function setGateMessage(message) {
    if (!el.gate) return;
    el.gate.classList.remove("pa-hidden");
    el.gate.textContent = message || "系統忙碌中";
  }

  function setView(view) {
    if (!VIEW_TITLE_MAP[view]) view = "dashboard";
    state.currentView = view;
    if (view === "products" && !state.products.loaded && state.db && state.storeId) {
      loadProducts();
    }

    if (el.pageTitle) el.pageTitle.textContent = VIEW_TITLE_MAP[view];

    if (el.navItems && el.navItems.length) {
      el.navItems.forEach(function (button) {
        var isActive = button.getAttribute("data-view") === view;
        button.classList.toggle("pa-active", isActive);
      });
    }

    Object.keys(el.views).forEach(function (key) {
      var viewEl = el.views[key];
      if (!viewEl) return;
      viewEl.classList.toggle("pa-hidden", key !== view);
    });
  }

  async function loadOrdersAndRender() {
    if (!state.storeId) return;
    renderLoadingState();

    try {
      var result = await fetchOrders(state.storeId);
      state.allOrders = result.allOrders;
      state.todayOrders = result.todayOrders;
      renderDashboardMetrics();
      renderDashboardTable();
      renderOrdersTable();
    } catch (error) {
      console.error("[POS Admin] load orders failed.", error);
      renderLoadError(error);
    }
  }

  function renderLoadingState() {
    if (el.metricOrders) el.metricOrders.textContent = "...";
    if (el.metricRevenue) el.metricRevenue.textContent = "NT$ ...";
    if (el.metricAverage) el.metricAverage.textContent = "NT$ ...";
    if (el.metricPending) el.metricPending.textContent = "...";

    if (el.subLastTime) el.subLastTime.textContent = "--:--";
    if (el.subOnsite) el.subOnsite.textContent = "...";
    if (el.subOnline) el.subOnline.textContent = "...";
    if (el.subCompleted) el.subCompleted.textContent = "...";

    if (el.dashboardBody) el.dashboardBody.innerHTML = "";
    if (el.ordersBody) el.ordersBody.innerHTML = "";

    toggleEmptyState(el.dashboardEmpty, false);
    toggleEmptyState(el.ordersEmpty, false);
  }

  async function fetchOrders(storeId) {
    var dayRange = getTaipeiDayRange();
    var attempts = [
      function () {
        return state.db.collection("orders")
          .where("storeId", "==", storeId)
          .where("createdAt", ">=", dayRange.start)
          .where("createdAt", "<", dayRange.end)
          .orderBy("createdAt", "desc")
          .limit(350)
          .get();
      },
      function () {
        return state.db.collection("orders")
          .where("storeId", "==", storeId)
          .where("created_at", ">=", dayRange.start)
          .where("created_at", "<", dayRange.end)
          .orderBy("created_at", "desc")
          .limit(350)
          .get();
      },
      function () {
        return state.db.collection("orders")
          .where("storeId", "==", storeId)
          .orderBy("createdAt", "desc")
          .limit(500)
          .get();
      },
      function () {
        return state.db.collection("orders")
          .where("storeId", "==", storeId)
          .orderBy("created_at", "desc")
          .limit(500)
          .get();
      },
      function () {
        return state.db.collection("orders")
          .where("storeId", "==", storeId)
          .limit(500)
          .get();
      }
    ];

    var list = [];
    var lastError = null;

    for (var i = 0; i < attempts.length; i += 1) {
      try {
        var snap = await attempts[i]();
        list = snap.docs.map(normalizeOrderDoc);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!list.length && lastError) throw lastError;

    list.sort(function (a, b) {
      return b.createdMillis - a.createdMillis;
    });

    var today = list.filter(function (order) {
      return order.createdMillis >= dayRange.startMillis && order.createdMillis < dayRange.endMillis;
    });

    return { allOrders: list, todayOrders: today };
  }

  function normalizeOrderDoc(doc) {
    var data = doc.data() || {};
    var createdDate = pickDate(data.createdAt, data.created_at, data.updatedAt, data.updated_at, data.pickupDateTimeISO);
    var createdMillis = createdDate ? createdDate.getTime() : 0;

    var status = normalizeStatus(data.status);
    var source = normalizeSource(data.source || data.orderSource || data.label);
    var sourceLabel = SOURCE_LABEL_MAP[source] || SOURCE_LABEL_MAP.other;
    var customerName = normalizeString(
      data.customer_name ||
      data.customerName ||
      data.display_name ||
      data.userName ||
      data.pickupName ||
      data.name
    ) || "未命名顧客";

    var items = normalizeItems(data.items, data.groups);
    var itemCount = items.reduce(function (sum, item) { return sum + safeNumber(item.qty, 0); }, 0);
    var total = resolveOrderTotal(data, items);
    var subtotal = resolveOrderSubtotal(data, items, total);
    var note = normalizeString(data.note || data.internal_note || data.internalNote) || "無";
    var orderNo = normalizeString(data.pickupNumber || data.orderNumber || data.display_code);
    if (!orderNo) orderNo = doc.id ? doc.id.slice(-8) : "-";

    return {
      id: doc.id,
      orderNo: orderNo,
      customerName: customerName,
      customerContact: normalizeString(data.customer_phone || data.customerPhone || data.lineUserId || ""),
      source: source,
      sourceLabel: sourceLabel,
      status: status,
      statusLabel: statusDisplayMeta(status).label,
      total: total,
      subtotal: subtotal,
      note: note,
      items: items,
      itemCount: itemCount,
      createdDate: createdDate,
      createdMillis: createdMillis
    };
  }

  function normalizeItems(items, groups) {
    if (Array.isArray(items) && items.length) {
      return items.map(function (item) {
        var quantity = safeNumber(item && (item.qty || item.quantity), 1);
        var price = safeNumber(item && (item.unit_price || item.price), 0);
        var lineTotal = safeNumber(item && (item.subtotal || item.lineTotal), price * quantity);
        return {
          name: normalizeString(item && (item.name || item.title)) || "未命名品項",
          qty: quantity,
          subtotal: lineTotal,
          flavor: normalizeString(item && (item.flavor || item.selectedFlavor || item.flavorName)),
          staple: normalizeString(item && (item.staple || item.selectedStaple || item.stapleName))
        };
      });
    }

    if (Array.isArray(groups) && groups.length) {
      var flat = [];
      groups.forEach(function (group) {
        var groupItems = Array.isArray(group && group.items) ? group.items : [];
        groupItems.forEach(function (item) {
          flat.push({
            name: normalizeString(item && (item.name || item.title)) || "未命名品項",
            qty: safeNumber(item && (item.qty || item.quantity), 1),
            subtotal: safeNumber(item && (item.subtotal || item.lineTotal), 0),
            flavor: normalizeString(item && (item.flavor || item.selectedFlavor || item.flavorName)),
            staple: normalizeString(item && (item.staple || item.selectedStaple || item.stapleName))
          });
        });
      });
      return flat;
    }

    return [];
  }

  function resolveOrderSubtotal(data, items, total) {
    var subtotal = safeNumber(data.subtotal, data.totalAmount, data.totalPrice, 0);
    if (subtotal > 0) return subtotal;
    var sum = items.reduce(function (acc, item) {
      return acc + safeNumber(item.subtotal, 0);
    }, 0);
    return sum || total;
  }

  function resolveOrderTotal(data, items) {
    var total = safeNumber(data.total, data.totalAmount, data.totalPrice, data.subtotal, 0);
    if (total > 0) return total;
    return items.reduce(function (acc, item) {
      return acc + safeNumber(item.subtotal, 0);
    }, 0);
  }

  function normalizeStatus(rawStatus) {
    var status = normalizeString(rawStatus).toLowerCase();
    if (!status) return "unknown";
    if (status === "canceled") return "cancelled";
    if (status === "cooking" || status === "packing") return "preparing";
    if (status === "done") return "ready";
    return status;
  }

  function statusDisplayMeta(status) {
    if (window.LeLeShanOrderStatus && typeof window.LeLeShanOrderStatus.getMeta === "function") {
      return window.LeLeShanOrderStatus.getMeta(status);
    }
    return {
      key: status,
      label: STATUS_LABEL_MAP[status] || STATUS_LABEL_MAP.unknown
    };
  }

  function normalizeSource(rawSource) {
    var source = normalizeString(rawSource).toLowerCase();
    if (!source) return "pos";
    if (source.indexOf("line") >= 0) return "liff";
    if (source.indexOf("現場") >= 0) return "pos";
    if (source.indexOf("手動") >= 0) return "manual";
    if (source.indexOf("uber") >= 0) return "ubereats";
    if (source.indexOf("panda") >= 0) return "foodpanda";
    if (SOURCE_LABEL_MAP[source]) return source;
    return "other";
  }

  function renderDashboardMetrics() {
    var orders = state.todayOrders || [];
    var orderCount = orders.length;
    var revenue = orders.reduce(function (sum, order) { return sum + safeNumber(order.total, 0); }, 0);
    var average = orderCount ? revenue / orderCount : 0;
    var pendingCount = orders.filter(function (order) {
      return PENDING_STATUS_SET.has(order.status);
    }).length;

    if (el.metricOrders) el.metricOrders.textContent = String(orderCount);
    if (el.metricRevenue) el.metricRevenue.textContent = "NT$ " + formatCurrency(revenue);
    if (el.metricAverage) el.metricAverage.textContent = "NT$ " + formatCurrency(average);
    if (el.metricPending) el.metricPending.textContent = String(pendingCount);

    var lastOrder = orders.length ? orders[0] : null;
    var onsiteCount = orders.filter(function (order) { return ONSITE_SOURCE_SET.has(order.source); }).length;
    var onlineCount = orders.filter(function (order) { return !ONSITE_SOURCE_SET.has(order.source); }).length;
    var doneCount = orders.filter(function (order) { return DONE_STATUS_SET.has(order.status); }).length;

    if (el.subLastTime) el.subLastTime.textContent = lastOrder ? formatTime(lastOrder.createdDate) : "--:--";
    if (el.subOnsite) el.subOnsite.textContent = String(onsiteCount);
    if (el.subOnline) el.subOnline.textContent = String(onlineCount);
    if (el.subCompleted) el.subCompleted.textContent = String(doneCount);
  }

  function renderDashboardTable() {
    if (!el.dashboardBody) return;
    var rows = (state.todayOrders || []).slice(0, 30);
    if (!rows.length) {
      el.dashboardBody.innerHTML = "";
      toggleEmptyState(el.dashboardEmpty, true);
      return;
    }

    toggleEmptyState(el.dashboardEmpty, false);
    var html = [];
    rows.forEach(function (order) {
      var expanded = !!state.expanded.dashboard[order.id];
      html.push(buildOrderRow(order, expanded, "dashboard"));
      if (expanded) {
        html.push(buildDetailRow(order, 7));
      }
    });
    el.dashboardBody.innerHTML = html.join("");
  }

  function renderOrdersTable() {
    if (!el.ordersBody) return;
    var filtered = filterOrders(state.allOrders || [], state.orderFilter);
    if (!filtered.length) {
      el.ordersBody.innerHTML = "";
      toggleEmptyState(el.ordersEmpty, true);
      return;
    }

    toggleEmptyState(el.ordersEmpty, false);
    var html = [];
    filtered.slice(0, 350).forEach(function (order) {
      var expanded = !!state.expanded.orders[order.id];
      html.push(buildOrderRow(order, expanded, "orders"));
      if (expanded) {
        html.push(buildDetailRow(order, 7));
      }
    });
    el.ordersBody.innerHTML = html.join("");
  }

  function buildOrderRow(order, expanded, scope) {
    var attrName = scope === "dashboard" ? "data-toggle-dashboard" : "data-toggle-orders";
    return "<tr>" +
      "<td>" + esc(formatDateTime(order.createdDate)) + "</td>" +
      "<td>" + esc(order.orderNo) + "</td>" +
      "<td>" + esc(order.customerName) + "</td>" +
      "<td>" + esc(order.sourceLabel) + "</td>" +
      "<td>NT$ " + esc(formatCurrency(order.total)) + "</td>" +
      "<td>" + renderStatusBadge(order.status, order.statusLabel) + "</td>" +
      "<td><button type=\"button\" class=\"pa-action-btn\" " + attrName + "=\"" + esc(order.id) + "\">" +
      (expanded ? "收合" : "展開") +
      "</button></td>" +
      "</tr>";
  }

  function buildDetailRow(order, colspan) {
    return "<tr class=\"pa-detail-row\"><td colspan=\"" + colspan + "\">" + renderOrderDetail(order) + "</td></tr>";
  }

  function renderOrderDetail(order) {
    var itemLines = "<span style=\"color:var(--pa-text-dim)\">無品項資料</span>";
    if (order.items && order.items.length) {
      var lines = order.items.slice(0, 12).map(function (item) {
        var spec = [];
        if (item.flavor) spec.push(item.flavor);
        if (item.staple) spec.push("主食：" + item.staple);
        var specStr = spec.length ? "（" + spec.join("／") + "）" : "";
        return "<li style=\"padding:3px 0\">" +
          "<strong>" + esc(item.name) + "</strong>" +
          " &times;" + safeNumber(item.qty, 0) +
          (specStr ? " <span style=\"color:var(--pa-text-soft);font-size:.85em\">" + esc(specStr) + "</span>" : "") +
          "<span style=\"float:right;color:var(--pa-text-dim)\">NT&nbsp;" + esc(formatCurrency(item.subtotal)) + "</span>" +
          "</li>";
      });
      if (order.items.length > 12) {
        lines.push("<li style=\"color:var(--pa-text-dim)\">...還有 " + (order.items.length - 12) + " 項</li>");
      }
      itemLines = "<ol style=\"margin:0;padding-left:1.3em;line-height:1.6\">" + lines.join("") + "</ol>";
    }

    return "<div class=\"pa-order-detail\">" +
      "<div class=\"pa-order-detail__grid\">" +
      "<div class=\"pa-order-detail__line\" style=\"grid-column:1/-1\"><strong>品項明細</strong><span>" + itemLines + "</span></div>" +
      "<div class=\"pa-order-detail__line\"><strong>備註</strong><span>" + esc(order.note || "無") + "</span></div>" +
      "<div class=\"pa-order-detail__line\"><strong>合計</strong><span>NT$ " + esc(formatCurrency(order.total)) + "</span></div>" +
      "<div class=\"pa-order-detail__line\"><strong>訂單來源</strong><span>" + esc(order.sourceLabel || "現場") + "</span></div>" +
      "<div class=\"pa-order-detail__line\"><strong>顧客資訊</strong><span>" + esc(order.customerContact || order.customerName || "未提供") + "</span></div>" +
      "</div>" +
      "</div>";
  }

  function renderStatusBadge(status, label) {
    var tone = "unknown";
    if (PENDING_STATUS_SET.has(status)) tone = "pending";
    else if (READY_STATUS_SET.has(status)) tone = "ready";
    else if (DONE_STATUS_SET.has(status)) tone = "done";
    else if (CANCELLED_STATUS_SET.has(status)) tone = "cancelled";
    else if (MAKING_STATUS_SET.has(status)) tone = "making";
    return "<span class=\"pa-badge pa-badge--" + tone + "\">" + esc(label || "未知") + "</span>";
  }

  function filterOrders(orders, filter) {
    if (!filter || filter === "all") return orders;
    return orders.filter(function (order) {
      if (filter === "pending") return PENDING_STATUS_SET.has(order.status);
      if (filter === "making") return MAKING_STATUS_SET.has(order.status);
      if (filter === "ready") return READY_STATUS_SET.has(order.status);
      if (filter === "done") return DONE_STATUS_SET.has(order.status);
      if (filter === "cancelled") return CANCELLED_STATUS_SET.has(order.status);
      return true;
    });
  }

  function renderOrderFilterActiveState() {
    if (!el.filterButtons || !el.filterButtons.length) return;
    el.filterButtons.forEach(function (button) {
      var active = button.getAttribute("data-order-filter") === state.orderFilter;
      button.classList.toggle("is-active", active);
    });
  }

  function toggleEmptyState(target, visible) {
    if (!target) return;
    target.classList.toggle("pa-hidden", !visible);
  }

  function renderLoadError(error) {
    var message = "讀取失敗：" + safeMessage(error);
    if (el.dashboardBody) el.dashboardBody.innerHTML = "";
    if (el.ordersBody) el.ordersBody.innerHTML = "";

    if (el.dashboardEmpty) {
      el.dashboardEmpty.querySelector(".pa-empty-state__title").textContent = "讀取失敗";
      el.dashboardEmpty.querySelector(".pa-empty-state__hint").textContent = message;
      toggleEmptyState(el.dashboardEmpty, true);
    }
    if (el.ordersEmpty) {
      el.ordersEmpty.querySelector(".pa-empty-state__title").textContent = "讀取失敗";
      el.ordersEmpty.querySelector(".pa-empty-state__hint").textContent = message;
      toggleEmptyState(el.ordersEmpty, true);
    }
  }

  async function handleLogout() {
    try {
      await safeSignOut();
    } finally {
      redirectToLogin();
    }
  }

  async function safeSignOut() {
    if (!state.auth) return;
    try {
      await state.auth.signOut();
    } catch (error) {
      console.warn("[POS Admin] sign out failed.", error);
    }
  }

  function redirectToLogin() {
    window.location.replace("/admin/login");
  }

  function getTaipeiDayRange() {
    var now = new Date();
    var taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    var y = taipeiNow.getFullYear();
    var m = taipeiNow.getMonth();
    var d = taipeiNow.getDate();
    var offsetMs = 8 * 60 * 60 * 1000;
    var startLocal = new Date(y, m, d, 0, 0, 0, 0);
    var endLocal = new Date(y, m, d + 1, 0, 0, 0, 0);
    var start = new Date(startLocal.getTime() - offsetMs);
    var end = new Date(endLocal.getTime() - offsetMs);
    return {
      start: start,
      end: end,
      startMillis: start.getTime(),
      endMillis: end.getTime()
    };
  }

  function pickDate() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      if (!value) continue;
      if (typeof value.toDate === "function") {
        var d1 = value.toDate();
        if (isValidDate(d1)) return d1;
      }
      if (typeof value === "object" && typeof value.seconds === "number") {
        var d2 = new Date(value.seconds * 1000);
        if (isValidDate(d2)) return d2;
      }
      if (typeof value === "number" && isFinite(value)) {
        var d3 = new Date(value);
        if (isValidDate(d3)) return d3;
      }
      if (typeof value === "string") {
        var d4 = new Date(value);
        if (isValidDate(d4)) return d4;
      }
    }
    return null;
  }

  function safeNumber() {
    for (var i = 0; i < arguments.length; i += 1) {
      var n = Number(arguments[i]);
      if (isFinite(n) && !isNaN(n)) return n;
    }
    return 0;
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isValidDate(dateValue) {
    return dateValue instanceof Date && !isNaN(dateValue.getTime());
  }

  function safeMessage(error) {
    if (!error) return "未知錯誤";
    return error.message || error.code || "未知錯誤";
  }

  function formatCurrency(value) {
    return Math.round(safeNumber(value, 0)).toLocaleString("zh-TW");
  }

  function formatTime(dateValue) {
    if (!isValidDate(dateValue)) return "--:--";
    return dateValue.toLocaleTimeString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDateTime(dateValue) {
    if (!isValidDate(dateValue)) return "--";
    return dateValue.toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Test Order Seeder ────────────────────────────────────────

  async function seedTestOrders() {
    if (!state.db || !state.storeId) return;
    var btn = el.seedBtn;
    if (btn) btn.disabled = true;
    setSeedStatus("建立中...");

    try {
      var ts = firebase.firestore.FieldValue.serverTimestamp();
      var sid = state.storeId;

      function item(name, qty, price, flavor, staple, type) {
        return {
          name: name, qty: qty, unit_price: price, price: price,
          subtotal: price * qty, type: type || "single",
          sku: name, itemId: name, item_note: "",
          flavor: flavor || "", selectedFlavor: flavor || "",
          staple: staple || "", selectedStaple: staple || ""
        };
      }

      var scenarios = [
        {
          customer_name: "測試A-套餐口味主食", source: "pos", status: "new", pickupNumber: "T01",
          items: [item("三倍肉", 1, 165, "紅油香辣", "白飯", "combo")],
          note: ""
        },
        {
          customer_name: "測試B-套餐口味無主食", source: "liff", status: "preparing", pickupNumber: "T02",
          items: [item("經典組合", 1, 130, "藤椒口味", "", "combo")],
          note: ""
        },
        {
          customer_name: "測試C-單點多品", source: "pos", status: "ready", pickupNumber: "T03",
          items: [
            item("脆口馬鈴薯", 2, 25, "", "", "single"),
            item("蝦餃", 1, 25, "", "", "single"),
            item("牛肉丸", 1, 15, "", "", "single")
          ],
          note: "湯底清淡"
        },
        {
          customer_name: "測試D-套餐加單點", source: "pos", status: "accepted", pickupNumber: "T04",
          items: [
            item("毛肚雙倍肉", 1, 180, "骨湯麻辣燙", "烏龍麵+15", "combo"),
            item("鑫鑫腸", 2, 30, "", "", "single")
          ],
          note: ""
        },
        {
          customer_name: "測試E-雙份套餐", source: "pos", status: "new", pickupNumber: "T05",
          items: [
            item("三倍肉", 1, 165, "鮮湯底", "泡麵", "combo"),
            item("三倍肉", 1, 165, "麻辣乾拌", "白飯", "combo"),
            item("毛肚", 1, 40, "", "", "special")
          ],
          note: "麻辣乾拌請多加醬"
        }
      ];

      var batch = state.db.batch();
      scenarios.forEach(function (s) {
        var ref = state.db.collection("orders").doc();
        var total = s.items.reduce(function (acc, i) { return acc + i.subtotal; }, 0);
        batch.set(ref, {
          storeId: sid,
          customer_name: s.customer_name,
          display_name: (s.source === "liff" ? "線上 " : "現場 ") + s.customer_name,
          label: s.source === "liff" ? "線上" : "現場",
          source: s.source,
          status: s.status,
          items: s.items,
          total: total, subtotal: total, totalAmount: total,
          note: s.note,
          pickupNumber: s.pickupNumber,
          paymentMethod: "cash",
          isTest: true,
          createdAt: ts, updatedAt: ts, created_at: ts, updated_at: ts
        });
      });
      await batch.commit();

      setSeedStatus("已建立 5 筆測試訂單（isTest=true）");
      setTimeout(function () { setSeedStatus(""); }, 5000);
      await loadOrdersAndRender();
    } catch (error) {
      console.error("[Seed] failed.", error);
      setSeedStatus("建立失敗：" + safeMessage(error));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function clearTestOrders() {
    if (!state.db || !state.storeId) return;
    if (!window.confirm("這將刪除所有 isTest=true 的測試訂單，確定要繼續嗎？")) return;
    if (!window.confirm("再次確認：只會刪除測試訂單（isTest=true），是否執行？")) return;

    if (el.clearTestBtn) el.clearTestBtn.disabled = true;
    setSeedStatus("清除中...");

    try {
      var totalDeleted = 0;
      var keepDeleting = true;

      while (keepDeleting) {
        var snap = await state.db.collection("orders")
          .where("storeId", "==", state.storeId)
          .where("isTest", "==", true)
          .limit(400)
          .get();

        if (snap.empty) {
          keepDeleting = false;
          break;
        }

        var batch = state.db.batch();
        snap.docs.forEach(function (doc) {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += snap.size;
        keepDeleting = snap.size === 400;
      }

      if (totalDeleted > 0) {
        setSeedStatus("已刪除 " + totalDeleted + " 筆測試訂單");
      } else {
        setSeedStatus("沒有找到測試訂單");
      }
      await loadOrdersAndRender();
    } catch (error) {
      console.error("[Seed] clear test orders failed.", error);
      setSeedStatus("清除失敗：" + safeMessage(error));
    } finally {
      if (el.clearTestBtn) el.clearTestBtn.disabled = false;
      setTimeout(function () { setSeedStatus(""); }, 5000);
    }
  }

  function setSeedStatus(message) {
    if (!el.seedStatus) return;
    if (!message) {
      el.seedStatus.textContent = "";
      el.seedStatus.style.display = "none";
      return;
    }
    el.seedStatus.textContent = message;
    el.seedStatus.style.display = "";
  }

  // ── Products Management ──────────────────────────────────────

  function buildDefaultPosRules() {
    return {
      typeRules: DEFAULT_POS_RULE_TYPE_ROWS.map(function (row) {
        return {
          code: row.code,
          label: row.label,
          flavorMode: row.flavorMode,
          stapleMode: row.stapleMode,
          allowAssignPart: !!row.allowAssignPart,
          enabled: row.enabled !== false
        };
      }),
      global: {
        enableAssignDifferentPeople: DEFAULT_POS_GLOBAL_RULES.enableAssignDifferentPeople,
        singleFlavorPerPart: DEFAULT_POS_GLOBAL_RULES.singleFlavorPerPart,
        setUpdatesPartFlavor: DEFAULT_POS_GLOBAL_RULES.setUpdatesPartFlavor,
        noodleRequiresFlavorIfPartMissing: DEFAULT_POS_GLOBAL_RULES.noodleRequiresFlavorIfPartMissing
      }
    };
  }

  function normalizePosRules(raw) {
    var defaults = buildDefaultPosRules();
    var sourceRows = raw && Array.isArray(raw.typeRules) ? raw.typeRules : [];
    var sourceGlobal = raw && raw.global ? raw.global : {};
    defaults.typeRules = defaults.typeRules.map(function (rule) {
      var matched = sourceRows.find(function (row) {
        return normalizeString(row && row.code) === rule.code;
      }) || {};
      var flavorMode = normalizeString(matched.flavorMode);
      var stapleMode = normalizeString(matched.stapleMode);
      return {
        code: rule.code,
        label: normalizeString(matched.label) || rule.label,
        flavorMode: ["required", "inherit", "none"].indexOf(flavorMode) >= 0 ? flavorMode : rule.flavorMode,
        stapleMode: ["required", "none"].indexOf(stapleMode) >= 0 ? stapleMode : rule.stapleMode,
        allowAssignPart: typeof matched.allowAssignPart === "boolean" ? matched.allowAssignPart : rule.allowAssignPart,
        enabled: typeof matched.enabled === "boolean" ? matched.enabled : rule.enabled
      };
    });
    defaults.global = {
      enableAssignDifferentPeople: typeof sourceGlobal.enableAssignDifferentPeople === "boolean" ? sourceGlobal.enableAssignDifferentPeople : defaults.global.enableAssignDifferentPeople,
      singleFlavorPerPart: typeof sourceGlobal.singleFlavorPerPart === "boolean" ? sourceGlobal.singleFlavorPerPart : defaults.global.singleFlavorPerPart,
      setUpdatesPartFlavor: typeof sourceGlobal.setUpdatesPartFlavor === "boolean" ? sourceGlobal.setUpdatesPartFlavor : defaults.global.setUpdatesPartFlavor,
      noodleRequiresFlavorIfPartMissing: typeof sourceGlobal.noodleRequiresFlavorIfPartMissing === "boolean" ? sourceGlobal.noodleRequiresFlavorIfPartMissing : defaults.global.noodleRequiresFlavorIfPartMissing
    };
    return defaults;
  }

  function hasCompletePosRules(raw) {
    if (!raw || !Array.isArray(raw.typeRules) || !raw.global) return false;
    var allCodesPresent = DEFAULT_POS_RULE_TYPE_ROWS.every(function (base) {
      return raw.typeRules.some(function (row) {
        return normalizeString(row && row.code) === base.code;
      });
    });
    if (!allCodesPresent) return false;
    var g = raw.global || {};
    return typeof g.enableAssignDifferentPeople === "boolean"
      && typeof g.singleFlavorPerPart === "boolean"
      && typeof g.setUpdatesPartFlavor === "boolean"
      && typeof g.noodleRequiresFlavorIfPartMissing === "boolean";
  }

  async function ensurePosRulesDefaults(raw) {
    if (hasCompletePosRules(raw)) return;
    await state.db.collection("settings").doc(state.storeId).set({
      posRules: state.products.posRules,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  var FLAVOR_LABEL = { required: "一定要選口味", inherit: "跟著套餐口味", none: "不需要口味" };
  var FLAVOR_DESC  = {
    required: "未選口味時無法加入訂單或結帳",
    inherit:  "不另外詢問，直接使用目前套餐口味",
    none:     "此類商品不處理口味"
  };
  var STAPLE_LABEL = { required: "一定要選主食", none: "不需要主食" };
  var STAPLE_DESC  = {
    required: "未選主食時無法加入訂單或結帳",
    none:     "此類商品不處理主食"
  };

  function renderPosRulesEditor() {
    var container = el.posTypeRulesCards;
    if (!container) return;
    var rules = state.products.posRules || buildDefaultPosRules();
    var rows = Array.isArray(rules.typeRules) ? rules.typeRules : [];

    container.innerHTML = rows.map(function (row) {
      var flavorModes = ["required", "inherit", "none"];
      var stapleModes = ["required", "none"];

      var flavorRadios = flavorModes.map(function (mode) {
        var checked = row.flavorMode === mode ? " checked" : "";
        var selected = row.flavorMode === mode ? " is-selected" : "";
        return "<label class=\"pa-rule-radio-item" + selected + "\">" +
          "<input type=\"radio\" name=\"flavor-" + esc(row.code) + "\" value=\"" + mode + "\"" + checked + " data-pos-rule-field=\"flavorMode\">" +
          "<span class=\"pa-rule-radio-item__text\">" +
            "<span class=\"pa-rule-radio-item__label\">" + esc(FLAVOR_LABEL[mode] || mode) + "</span>" +
            "<span class=\"pa-rule-radio-item__desc\">" + esc(FLAVOR_DESC[mode] || "") + "</span>" +
          "</span></label>";
      }).join("");

      var stapleRadios = stapleModes.map(function (mode) {
        var checked = row.stapleMode === mode ? " checked" : "";
        var selected = row.stapleMode === mode ? " is-selected" : "";
        return "<label class=\"pa-rule-radio-item" + selected + "\">" +
          "<input type=\"radio\" name=\"staple-" + esc(row.code) + "\" value=\"" + mode + "\"" + checked + " data-pos-rule-field=\"stapleMode\">" +
          "<span class=\"pa-rule-radio-item__text\">" +
            "<span class=\"pa-rule-radio-item__label\">" + esc(STAPLE_LABEL[mode] || mode) + "</span>" +
            "<span class=\"pa-rule-radio-item__desc\">" + esc(STAPLE_DESC[mode] || "") + "</span>" +
          "</span></label>";
      }).join("");

      return "<div class=\"pa-rule-card\" data-pos-rule-code=\"" + esc(row.code) + "\">" +
        "<div class=\"pa-rule-card__head\">" +
          "<span class=\"pa-rule-card__name\">" + esc(row.label) + "</span>" +
          "<span class=\"pa-rule-card__code\">" + esc(row.code) + "</span>" +
        "</div>" +
        "<div class=\"pa-rule-card__section\">" +
          "<div class=\"pa-rule-card__section-title\">🌶️ 口味設定</div>" +
          "<div class=\"pa-rule-radio-group\">" + flavorRadios + "</div>" +
        "</div>" +
        "<div class=\"pa-rule-card__section\">" +
          "<div class=\"pa-rule-card__section-title\">🍚 主食設定</div>" +
          "<div class=\"pa-rule-radio-group\">" + stapleRadios + "</div>" +
        "</div>" +
        "<div class=\"pa-rule-card__section pa-rule-card__checks\">" +
          "<label class=\"pa-rule-check-item\">" +
            "<input type=\"checkbox\" data-pos-rule-field=\"allowAssignPart\"" + (row.allowAssignPart ? " checked" : "") + ">" +
            "<span>👥 可以分給不同人</span>" +
          "</label>" +
          "<label class=\"pa-rule-check-item\">" +
            "<input type=\"checkbox\" data-pos-rule-field=\"enabled\"" + (row.enabled !== false ? " checked" : "") + ">" +
            "<span>✅ 啟用此類型</span>" +
          "</label>" +
        "</div>" +
      "</div>";
    }).join("");

    // Live radio highlight: update is-selected when user clicks
    Array.prototype.slice.call(container.querySelectorAll("input[type=\"radio\"]")).forEach(function (radio) {
      radio.addEventListener("change", function () {
        var group = radio.closest(".pa-rule-radio-group");
        if (!group) return;
        Array.prototype.slice.call(group.querySelectorAll(".pa-rule-radio-item")).forEach(function (item) {
          var r = item.querySelector("input[type=\"radio\"]");
          item.classList.toggle("is-selected", r === radio);
        });
      });
    });

    var global = rules.global || {};
    if (el.ruleEnableAssignPeople) el.ruleEnableAssignPeople.checked = !!global.enableAssignDifferentPeople;
    if (el.ruleSingleFlavorPerPart) el.ruleSingleFlavorPerPart.checked = !!global.singleFlavorPerPart;
    if (el.ruleSetUpdatesPartFlavor) el.ruleSetUpdatesPartFlavor.checked = !!global.setUpdatesPartFlavor;
    if (el.ruleNoodleRequiresFlavor) el.ruleNoodleRequiresFlavor.checked = !!global.noodleRequiresFlavorIfPartMissing;
  }

  function collectPosRulesFromEditor() {
    var container = el.posTypeRulesCards;
    var current = state.products.posRules || buildDefaultPosRules();
    var nextTypeRules = (current.typeRules || []).map(function (rule) {
      var card = container ? container.querySelector("[data-pos-rule-code=\"" + rule.code + "\"]") : null;
      if (!card) return rule;
      var flavorRadio = card.querySelector("[data-pos-rule-field=\"flavorMode\"]:checked");
      var stapleRadio = card.querySelector("[data-pos-rule-field=\"stapleMode\"]:checked");
      var allowCb = card.querySelector("[data-pos-rule-field=\"allowAssignPart\"]");
      var enabledCb = card.querySelector("[data-pos-rule-field=\"enabled\"]");
      var flavorMode = normalizeString(flavorRadio && flavorRadio.value);
      var stapleMode = normalizeString(stapleRadio && stapleRadio.value);
      return {
        code: rule.code,
        label: rule.label,
        flavorMode: ["required", "inherit", "none"].indexOf(flavorMode) >= 0 ? flavorMode : rule.flavorMode,
        stapleMode: ["required", "none"].indexOf(stapleMode) >= 0 ? stapleMode : rule.stapleMode,
        allowAssignPart: !!(allowCb && allowCb.checked),
        enabled: !!(enabledCb && enabledCb.checked)
      };
    });
    return {
      typeRules: nextTypeRules,
      global: {
        enableAssignDifferentPeople: !!(el.ruleEnableAssignPeople && el.ruleEnableAssignPeople.checked),
        singleFlavorPerPart: !!(el.ruleSingleFlavorPerPart && el.ruleSingleFlavorPerPart.checked),
        setUpdatesPartFlavor: !!(el.ruleSetUpdatesPartFlavor && el.ruleSetUpdatesPartFlavor.checked),
        noodleRequiresFlavorIfPartMissing: !!(el.ruleNoodleRequiresFlavor && el.ruleNoodleRequiresFlavor.checked)
      }
    };
  }

  async function savePosRules() {
    if (!state.db || !state.storeId) return;
    var payload = collectPosRulesFromEditor();
    showPosRulesStatus("儲存中...", "");
    if (el.posRulesSave) el.posRulesSave.disabled = true;
    try {
      await state.db.collection("settings").doc(state.storeId).set({
        posRules: payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      state.products.posRules = payload;
      showPosRulesStatus("已儲存 POS 規則設定", "ok");
      setTimeout(function () { showPosRulesStatus("", ""); }, 2600);
    } catch (error) {
      console.error("[POS Rules] save failed.", error);
      showPosRulesStatus("儲存失敗：" + safeMessage(error), "err");
    } finally {
      if (el.posRulesSave) el.posRulesSave.disabled = false;
    }
  }

  function showPosRulesStatus(message, tone) {
    if (!el.posRulesStatus) return;
    if (!message) {
      el.posRulesStatus.style.display = "none";
      return;
    }
    el.posRulesStatus.style.display = "";
    el.posRulesStatus.textContent = message;
    el.posRulesStatus.className = "pa-status-line" + (tone ? " pa-status-line--" + tone : "");
  }

  async function loadProducts() {
    if (!state.db || !state.storeId) return;
    showProductsLoading(true);
    try {
      var settingsSnap = await state.db.collection("settings").doc(state.storeId).get();
      var settingsData = settingsSnap.exists ? (settingsSnap.data() || {}) : {};
      var globalOptions = settingsData.globalOptions || {};
      state.products.globalFlavors = Array.isArray(globalOptions.flavors) ? globalOptions.flavors : [];
      state.products.globalStaples = Array.isArray(globalOptions.staples) ? globalOptions.staples : [];
      state.products.posRules = normalizePosRules(settingsData.posRules);
      if (el.globalFlavorsTA) el.globalFlavorsTA.value = state.products.globalFlavors.join("\n");
      if (el.globalStaplesTA) el.globalStaplesTA.value = state.products.globalStaples.join("\n");
      renderPosRulesEditor();
      await ensurePosRulesDefaults(settingsData.posRules);

      var combosSnap = await state.db.collection("comboTemplates").where("storeId", "==", state.storeId).get();
      state.products.combos = combosSnap.docs.map(function (doc) {
        var d = doc.data(); d.id = doc.id; d._collection = "comboTemplates"; return d;
      }).sort(function (a, b) {
        return Number(a.posSortOrder != null ? a.posSortOrder : (a.sort != null ? a.sort : 999)) -
               Number(b.posSortOrder != null ? b.posSortOrder : (b.sort != null ? b.sort : 999));
      });

      var itemSnaps = await Promise.all([
        state.db.collection("menu_items").where("storeId", "==", state.storeId).get(),
        state.db.collection("menuItems").where("storeId", "==", state.storeId).get()
      ]);
      var seenIds = {};
      var items = [];
      [["menu_items", itemSnaps[0]], ["menuItems", itemSnaps[1]]].forEach(function (pair) {
        var colName = pair[0];
        var snap = pair[1];
        snap.docs.forEach(function (doc) {
          if (!seenIds[doc.id]) {
            seenIds[doc.id] = true;
            var d = doc.data(); d.id = doc.id; d._collection = colName;
            items.push(d);
          }
        });
      });
      state.products.items = items.sort(function (a, b) {
        return Number(a.posSortOrder != null ? a.posSortOrder : (a.sort != null ? a.sort : 999)) -
               Number(b.posSortOrder != null ? b.posSortOrder : (b.sort != null ? b.sort : 999));
      });

      await initializeProductsPosTypeDefaults();
      state.products.loaded = true;
      showProductsLoading(false);
      renderProductList();
    } catch (error) {
      console.error("[Products] load failed.", error);
      showProductsLoading(false);
      if (el.productsEmpty) {
        el.productsEmpty.querySelector(".pa-empty-state__title").textContent = "載入失敗";
        el.productsEmpty.querySelector(".pa-empty-state__hint").textContent = safeMessage(error);
        toggleEmptyState(el.productsEmpty, true);
      }
    }
  }

  function showProductsLoading(visible) {
    if (el.productsLoading) el.productsLoading.classList.toggle("pa-hidden", !visible);
    if (el.productsList && visible) el.productsList.innerHTML = "";
    if (el.productsEmpty && visible) toggleEmptyState(el.productsEmpty, false);
  }

  function renderProductList() {
    if (!el.productsList) return;
    var products = state.products.tab === "combos" ? state.products.combos : state.products.items;
    toggleEmptyState(el.productsEmpty, !products.length);
    if (!products.length) { el.productsList.innerHTML = ""; return; }

    var rows = [];
    products.forEach(function (product) {
      var expanded = !!state.products.expanded[product.id];
      rows.push(buildProductRow(product, expanded));
      if (expanded) rows.push(buildProductEditorRow(product));
    });

    el.productsList.innerHTML =
      '<div class="pa-table-wrap"><table class="pa-prod-table">' +
      '<thead><tr>' +
      '<th style="min-width:180px">名稱</th>' +
      '<th>價格</th>' +
      '<th>需要口味</th>' +
      '<th>需要主食</th>' +
      '<th>POS 顯示</th>' +
      '<th>已售完</th>' +
      '<th>選項設定</th>' +
      '</tr></thead><tbody>' +
      rows.join("") +
      '</tbody></table></div>';
  }

  function buildProductRow(product, expanded) {
    var requiresFlavor = product.requiresFlavor === true;
    var requiresStaple = product.requiresStaple === true;
    var posVisible = product.posVisible !== false;
    var isSoldOut = product.isSoldOut === true;
    var price = Number(product.price || 0);
    var catLabel = product.categoryId ? (" <small style=\"color:var(--pa-text-dim)\">(" + esc(product.categoryId) + ")</small>") : "";

    function toggle(field, checked) {
      return '<label class="pa-prod-toggle">' +
        '<input type="checkbox"' + (checked ? " checked" : "") +
        ' data-prod-id="' + esc(product.id) + '"' +
        ' data-prod-col="' + esc(product._collection) + '"' +
        ' data-prod-field="' + esc(field) + '"></label>';
    }

    return "<tr>" +
      "<td><strong>" + esc(product.name || "未命名") + "</strong>" + catLabel + "</td>" +
      "<td>NT$" + price + "</td>" +
      "<td>" + toggle("requiresFlavor", requiresFlavor) + "</td>" +
      "<td>" + toggle("requiresStaple", requiresStaple) + "</td>" +
      "<td>" + toggle("posVisible", posVisible) + "</td>" +
      "<td>" + toggle("isSoldOut", isSoldOut) + "</td>" +
      '<td><button class="pa-prod-expand-btn" type="button" data-prod-toggle="' + esc(product.id) + '">' +
      (expanded ? "收合 ▲" : "設定 ▾") +
      "</button></td>" +
      "</tr>";
  }

  function buildProductEditorRow(product) {
    function optsToText(opts) {
      if (!Array.isArray(opts)) return "";
      return opts.map(function (o) {
        return typeof o === "string" ? o : (o && (o.name || o.id) || "");
      }).filter(Boolean).join("\n");
    }
    var flavorText = optsToText(product.flavorOptions);
    var stapleText = optsToText(product.stapleOptions);

    return '<tr class="pa-prod-editor-row"><td colspan="7"><div class="pa-prod-editor">' +
      '<div class="pa-prod-editor__hint">留空則套用全局設定；若此商品不需選擇，請取消上方「需要口味」或「需要主食」勾選。</div>' +
      '<label class="pa-field">' +
      '<span class="pa-field__label">口味選項（每行一個，空白=套用全局）</span>' +
      '<textarea class="pa-textarea" rows="5" data-prod-flavor-ta="' + esc(product.id) + '">' + esc(flavorText) + "</textarea>" +
      "</label>" +
      '<label class="pa-field">' +
      '<span class="pa-field__label">主食選項（每行一個，空白=套用全局）</span>' +
      '<textarea class="pa-textarea" rows="5" data-prod-staple-ta="' + esc(product.id) + '">' + esc(stapleText) + "</textarea>" +
      "</label>" +
      '<div class="pa-prod-editor__actions">' +
      '<button class="pa-prod-save-btn" type="button"' +
      ' data-prod-save="' + esc(product.id) + '"' +
      ' data-prod-col="' + esc(product._collection) + '">儲存選項設定</button>' +
      '<span class="pa-prod-status" id="pa-prod-status-' + esc(product.id) + '"></span>' +
      "</div>" +
      "</div></td></tr>";
  }

  function onProductListChange(event) {
    var checkbox = event.target;
    if (!checkbox || checkbox.type !== "checkbox") return;
    var prodId = checkbox.getAttribute("data-prod-id");
    var collection = checkbox.getAttribute("data-prod-col");
    var field = checkbox.getAttribute("data-prod-field");
    if (!prodId || !collection || !field) return;
    var value = checkbox.checked;

    var arr = collection === "comboTemplates" ? state.products.combos : state.products.items;
    var product = arr.find(function (p) { return p.id === prodId; });
    if (product) product[field] = value;

    var update = {};
    update[field] = value;
    update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    state.db.collection(collection).doc(prodId).set(update, { merge: true })
      .catch(function (error) {
        console.error("[Products] field update failed.", error);
        checkbox.checked = !value;
        if (product) product[field] = !value;
      });
  }

  function onProductListClick(event) {
    var toggleBtn = event.target.closest("[data-prod-toggle]");
    var saveBtn = event.target.closest("[data-prod-save]");
    if (toggleBtn) {
      var prodId = toggleBtn.getAttribute("data-prod-toggle");
      state.products.expanded[prodId] = !state.products.expanded[prodId];
      renderProductList();
    }
    if (saveBtn) {
      var prodId = saveBtn.getAttribute("data-prod-save");
      var collection = saveBtn.getAttribute("data-prod-col");
      saveProductOpts(prodId, collection);
    }
  }

  async function saveProductOpts(prodId, collection) {
    var statusEl = document.getElementById("pa-prod-status-" + prodId);
    var flavorTA = el.productsList ? el.productsList.querySelector("[data-prod-flavor-ta=\"" + prodId + "\"]") : null;
    var stapleTA = el.productsList ? el.productsList.querySelector("[data-prod-staple-ta=\"" + prodId + "\"]") : null;
    if (!flavorTA || !stapleTA) return;

    var flavorOpts = flavorTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var stapleOpts = stapleTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);

    if (statusEl) { statusEl.textContent = "儲存中..."; statusEl.className = "pa-prod-status"; }
    try {
      await state.db.collection(collection).doc(prodId).set({
        flavorOptions: flavorOpts,
        stapleOptions: stapleOpts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      var arr = collection === "comboTemplates" ? state.products.combos : state.products.items;
      var product = arr.find(function (p) { return p.id === prodId; });
      if (product) { product.flavorOptions = flavorOpts; product.stapleOptions = stapleOpts; }

      if (statusEl) { statusEl.textContent = "✓ 已儲存"; }
      setTimeout(function () { if (statusEl) statusEl.textContent = ""; }, 2500);
    } catch (error) {
      console.error("[Products] saveProductOpts failed.", error);
      if (statusEl) statusEl.textContent = "儲存失敗：" + safeMessage(error);
    }
  }

  function inferPosTypeForProduct(product, collectionName) {
    if (!product || typeof product !== "object") return "addon";
    if (collectionName === "comboTemplates") return "set";
    if (product.posType && POS_TYPE_OPTIONS.indexOf(product.posType) >= 0) return product.posType;

    var fullText = [
      product.name || "",
      product.category || "",
      product.categoryId || "",
      product.tags || ""
    ].join(" ").toLowerCase();
    var nameText = String(product.name || "");

    if (fullText.indexOf("套餐") >= 0 || fullText.indexOf("combo") >= 0 || fullText.indexOf("set") >= 0) {
      return "set";
    }

    if (nameText.indexOf("白飯") >= 0) {
      return "staple_rice";
    }

    var noodleKeywords = ["泡麵", "寬粉", "冬粉", "王子麵", "烏龍麵", "意麵", "拉麵", "粉絲", "米粉", "麵"];
    for (var i = 0; i < noodleKeywords.length; i++) {
      if (nameText.indexOf(noodleKeywords[i]) >= 0) return "staple_noodle";
    }

    var drinkKeywords = ["飲料", "可樂", "奶茶", "紅茶", "綠茶", "烏龍茶", "冬瓜", "汽水", "雪碧"];
    for (var j = 0; j < drinkKeywords.length; j++) {
      if (nameText.indexOf(drinkKeywords[j]) >= 0 || fullText.indexOf(drinkKeywords[j].toLowerCase()) >= 0) {
        return "drink";
      }
    }

    if (fullText.indexOf("其他") >= 0 || fullText.indexOf("other") >= 0) return "other";
    return "addon";
  }

  async function initializeProductsPosTypeDefaults() {
    if (!state.db || !state.storeId) return;
    var toPatch = [];

    function collectMissing(product, collectionName) {
      var inferred = inferPosTypeForProduct(product, collectionName);
      if (!product.posType || POS_TYPE_OPTIONS.indexOf(product.posType) < 0) {
        product.posType = inferred;
        toPatch.push({
          collection: collectionName,
          id: product.id,
          posType: inferred
        });
      }
    }

    state.products.combos.forEach(function (product) {
      collectMissing(product, "comboTemplates");
    });
    state.products.items.forEach(function (product) {
      collectMissing(product, product._collection || "menu_items");
    });

    if (!toPatch.length) return;

    var chunkSize = 350;
    for (var i = 0; i < toPatch.length; i += chunkSize) {
      var chunk = toPatch.slice(i, i + chunkSize);
      var batch = state.db.batch();
      chunk.forEach(function (item) {
        batch.set(state.db.collection(item.collection).doc(item.id), {
          posType: item.posType,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
    }
  }

  function renderProductList() {
    if (!el.productsList) return;
    var products = state.products.tab === "combos" ? state.products.combos : state.products.items;
    toggleEmptyState(el.productsEmpty, !products.length);
    if (!products.length) {
      el.productsList.innerHTML = "";
      return;
    }

    var rows = [];
    products.forEach(function (product) {
      var expanded = !!state.products.expanded[product.id];
      rows.push(buildProductRow(product, expanded));
      if (expanded) rows.push(buildProductEditorRow(product));
    });

    el.productsList.innerHTML =
      '<p class="pa-text-sm pa-text-dim" style="margin:0 0 10px;">POS 分類 會決定商品在點餐時如何套用口味、主食與分人規則。</p>' +
      '<div class="pa-table-wrap"><table class="pa-prod-table">' +
      "<thead><tr>" +
      '<th style="min-width:180px">品項</th>' +
      "<th>價格</th>" +
      '<th title="決定商品在 POS 點餐時套用的口味與主食規則">POS 分類</th>' +
      "<th>需口味</th>" +
      "<th>需主食</th>" +
      "<th>POS 顯示</th>" +
      "<th>售完</th>" +
      "<th>規格設定</th>" +
      "</tr></thead><tbody>" +
      rows.join("") +
      "</tbody></table></div>";
  }

  function buildProductRow(product, expanded) {
    var requiresFlavor = product.requiresFlavor === true;
    var requiresStaple = product.requiresStaple === true;
    var posVisible = product.posVisible !== false;
    var isSoldOut = product.isSoldOut === true;
    var price = Number(product.price || 0);
    var posType = POS_TYPE_OPTIONS.indexOf(product.posType) >= 0
      ? product.posType
      : inferPosTypeForProduct(product, product._collection);
    var catLabel = product.categoryId
      ? (" <small style=\"color:var(--pa-text-dim)\">(" + esc(product.categoryId) + ")</small>")
      : "";

    function toggle(field, checked) {
      return '<label class="pa-prod-toggle">' +
        '<input type="checkbox"' + (checked ? " checked" : "") +
        ' data-prod-id="' + esc(product.id) + '"' +
        ' data-prod-col="' + esc(product._collection) + '"' +
        ' data-prod-field="' + esc(field) + '"></label>';
    }

    function posTypeSelect() {
      var options = POS_TYPE_OPTIONS.map(function (value) {
        var label = POS_TYPE_LABELS[value] || value;
        return '<option value="' + esc(value) + '"' + (value === posType ? " selected" : "") + ">" + esc(label) + "</option>";
      }).join("");
      var tooltip = POS_TYPE_TOOLTIPS[posType] || "";
      return '<select class="pa-select pa-select--sm pa-select--pos-type" title="' + esc(tooltip) + '" data-prod-id="' + esc(product.id) + '"' +
        ' data-prod-col="' + esc(product._collection) + '" data-prod-field="posType">' + options + "</select>";
    }

    return "<tr>" +
      "<td><strong>" + esc(product.name || "未命名商品") + "</strong>" + catLabel + "</td>" +
      "<td>NT$" + price + "</td>" +
      "<td>" + posTypeSelect() + "</td>" +
      "<td>" + toggle("requiresFlavor", requiresFlavor) + "</td>" +
      "<td>" + toggle("requiresStaple", requiresStaple) + "</td>" +
      "<td>" + toggle("posVisible", posVisible) + "</td>" +
      "<td>" + toggle("isSoldOut", isSoldOut) + "</td>" +
      '<td><button class="pa-prod-expand-btn" type="button" data-prod-toggle="' + esc(product.id) + '">' +
      (expanded ? "收起" : "編輯") +
      "</button></td>" +
      "</tr>";
  }

  function buildProductEditorRow(product) {
    function optsToText(opts) {
      if (!Array.isArray(opts)) return "";
      return opts.map(function (o) {
        return typeof o === "string" ? o : (o && (o.name || o.id) || "");
      }).filter(Boolean).join("\n");
    }

    var flavorText = optsToText(product.flavorOptions);
    var stapleText = optsToText(product.stapleOptions);

    return '<tr class="pa-prod-editor-row"><td colspan="8"><div class="pa-prod-editor">' +
      '<div class="pa-prod-editor__hint">可編輯商品可用口味與主食選項，儲存後會同步到 POS 規格彈窗。</div>' +
      '<label class="pa-field">' +
      '<span class="pa-field__label">口味選項（每行一個）</span>' +
      '<textarea class="pa-textarea" rows="5" data-prod-flavor-ta="' + esc(product.id) + '">' + esc(flavorText) + "</textarea>" +
      "</label>" +
      '<label class="pa-field">' +
      '<span class="pa-field__label">主食選項（每行一個）</span>' +
      '<textarea class="pa-textarea" rows="5" data-prod-staple-ta="' + esc(product.id) + '">' + esc(stapleText) + "</textarea>" +
      "</label>" +
      '<div class="pa-prod-editor__actions">' +
      '<button class="pa-prod-save-btn" type="button"' +
      ' data-prod-save="' + esc(product.id) + '"' +
      ' data-prod-col="' + esc(product._collection) + '">儲存規格</button>' +
      '<span class="pa-prod-status" id="pa-prod-status-' + esc(product.id) + '"></span>' +
      "</div>" +
      "</div></td></tr>";
  }

  function onProductListChange(event) {
    var target = event.target;
    if (!target) return;

    var prodId = target.getAttribute("data-prod-id");
    var collection = target.getAttribute("data-prod-col");
    var field = target.getAttribute("data-prod-field");
    if (!prodId || !collection || !field) return;

    var arr = collection === "comboTemplates" ? state.products.combos : state.products.items;
    var product = arr.find(function (p) { return p.id === prodId; });
    var oldValue = product ? product[field] : undefined;
    var nextValue;

    if (target.type === "checkbox") {
      nextValue = target.checked;
    } else if (target.tagName === "SELECT" && field === "posType") {
      nextValue = target.value;
      if (POS_TYPE_OPTIONS.indexOf(nextValue) < 0) return;
    } else {
      return;
    }

    if (product) product[field] = nextValue;

    var update = {};
    update[field] = nextValue;
    update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    state.db.collection(collection).doc(prodId).set(update, { merge: true })
      .catch(function (error) {
        console.error("[Products] field update failed.", error);
        if (target.type === "checkbox") target.checked = !nextValue;
        if (target.tagName === "SELECT" && oldValue != null) target.value = oldValue;
        if (product) product[field] = oldValue;
      });
  }

  async function saveProductOpts(prodId, collection) {
    var statusEl = document.getElementById("pa-prod-status-" + prodId);
    var flavorTA = el.productsList ? el.productsList.querySelector("[data-prod-flavor-ta=\"" + prodId + "\"]") : null;
    var stapleTA = el.productsList ? el.productsList.querySelector("[data-prod-staple-ta=\"" + prodId + "\"]") : null;
    var posTypeSelect = el.productsList ? el.productsList.querySelector("[data-prod-id=\"" + prodId + "\"][data-prod-field=\"posType\"]") : null;
    if (!flavorTA || !stapleTA) return;

    var flavorOpts = flavorTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var stapleOpts = stapleTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var posType = posTypeSelect ? posTypeSelect.value : "";
    if (POS_TYPE_OPTIONS.indexOf(posType) < 0) {
      posType = inferPosTypeForProduct({ name: "" }, collection);
    }

    if (statusEl) {
      statusEl.textContent = "儲存中...";
      statusEl.className = "pa-prod-status";
    }
    try {
      await state.db.collection(collection).doc(prodId).set({
        posType: posType,
        flavorOptions: flavorOpts,
        stapleOptions: stapleOpts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      var arr = collection === "comboTemplates" ? state.products.combos : state.products.items;
      var product = arr.find(function (p) { return p.id === prodId; });
      if (product) {
        product.posType = posType;
        product.flavorOptions = flavorOpts;
        product.stapleOptions = stapleOpts;
      }

      if (statusEl) statusEl.textContent = "已儲存";
      setTimeout(function () { if (statusEl) statusEl.textContent = ""; }, 2500);
    } catch (error) {
      console.error("[Products] saveProductOpts failed.", error);
      if (statusEl) statusEl.textContent = "儲存失敗：" + safeMessage(error);
    }
  }

  async function saveGlobalOpts() {
    if (!state.db || !state.storeId) return;
    var flavors = el.globalFlavorsTA
      ? el.globalFlavorsTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    var staples = el.globalStaplesTA
      ? el.globalStaplesTA.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean)
      : [];

    showGlobalOptsStatus("儲存中...", "");
    try {
      await state.db.collection("settings").doc(state.storeId).set({
        globalOptions: { flavors: flavors, staples: staples },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      state.products.globalFlavors = flavors;
      state.products.globalStaples = staples;
      showGlobalOptsStatus("✓ 已儲存全局設定", "ok");
      setTimeout(function () { showGlobalOptsStatus("", ""); }, 3000);
    } catch (error) {
      console.error("[Products] saveGlobalOpts failed.", error);
      showGlobalOptsStatus("儲存失敗：" + safeMessage(error), "err");
    }
  }

  function showGlobalOptsStatus(message, tone) {
    if (!el.globalOptsStatus) return;
    if (!message) { el.globalOptsStatus.style.display = "none"; return; }
    el.globalOptsStatus.style.display = "";
    el.globalOptsStatus.textContent = message;
    el.globalOptsStatus.className = "pa-status-line" + (tone ? " pa-status-line--" + tone : "");
  }

})();
