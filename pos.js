(function () {
  // ── POS 現場點餐 ──────────────────────────────────────────────
  // source = "pos"；不需要 LIFF SDK
  // 功能：新建訂單 / 今日訂單列表 / 查看詳情 / 追加既有訂單

  var DEFAULT_STORE_ID = (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1";

  var SOURCE_LABEL_MAP = {
    liff: "LIFF", pos: "POS", manual: "手動", onsite: "現場",
    ubereats: "UberEats", foodpanda: "Foodpanda"
  };
  var STATUS_LABEL_MAP = {
    new: "新訂單", accepted: "已接單", preparing: "製作中",
    cooking: "製作中", packing: "製作中", ready: "完成",
    completed: "已取餐", picked_up: "已取餐", cancelled: "已取消"
  };

  var state = {
    storeId:           DEFAULT_STORE_ID,
    context:           null,
    cart:              [],   // [{ itemId, name, unitPrice, qty, type, categoryName }]
    menu:              [],   // 所有菜單品項（flat list, posVisible / isSoldOut 過濾後）
    combos:            [],   // 套餐
    submitting:        false,
    appendTargetOrder: null, // 追加模式：目標訂單
    todaysOrders:      [],   // 今日訂單快取
    searchQuery:       ""
  };

  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    bindTabs();
    window.LeLeShanStaffAuth.init({
      loadingEl: el.loading,
      errorEl:   el.error,
      onReady:   start
    });
  });

  // ── DOM cache ─────────────────────────────────────────────────

  function cache() {
    el.loading           = document.getElementById("auth-loading");
    el.error             = document.getElementById("auth-error");
    el.storeMeta         = document.getElementById("ops-store-meta");
    el.userMeta          = document.getElementById("ops-user-meta");
    el.menuLoading       = document.getElementById("pos-menu-loading");
    el.menuRoot          = document.getElementById("pos-menu-root");
    el.cartTitle         = document.getElementById("pos-cart-title");
    el.cartItems         = document.getElementById("pos-cart-items");
    el.cartTotal         = document.getElementById("pos-cart-total");
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
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────

  async function start(context) {
    state.storeId = context.storeId || DEFAULT_STORE_ID;
    state.context = context;
    el.storeMeta.textContent = "門市：" + state.storeId;
    el.userMeta.textContent  = "登入：" + (context.admin.name || context.user.email) + " ／ " + context.admin.role;

    await loadMenu(context.db);
    el.submitBtn.disabled = false;
    el.submitBtn.addEventListener("click", handleSubmit);
    el.cartItems.addEventListener("click", onCartClick);
    el.appendCancelBtn.addEventListener("click", exitAppendMode);
    el.ordersRefresh.addEventListener("click", loadTodaysOrders);
    el.ordersSearch.addEventListener("input", function () {
      state.searchQuery = this.value.trim().toLowerCase();
      renderOrdersList();
    });
    el.detailClose.addEventListener("click", closeDetailOverlay);
    el.detailClose2.addEventListener("click", closeDetailOverlay);
    el.detailAppendBtn.addEventListener("click", function () {
      if (!state.detailCurrentOrder) return;
      startAppendMode(state.detailCurrentOrder);
    });
  }

  // ── 載入菜單（posVisible / isSoldOut 過濾）────────────────────

  async function loadMenu(db) {
    try {
      var snaps = await Promise.all([
        db.collection("menu_items").where("storeId", "==", state.storeId).get(),
        db.collection("menuItems").where("storeId", "==", state.storeId).get(),
        db.collection("comboTemplates").where("storeId", "==", state.storeId).get(),
        db.collection("categories").where("storeId", "==", state.storeId).get()
      ]);

      // 合併 menu_items + menuItems，去重
      var newItems     = mapDocs(snaps[0]);
      var legacyItems  = mapDocs(snaps[1]).filter(function (i) {
        return !newItems.find(function (n) { return n.id === i.id; });
      });
      var allItems = newItems.concat(legacyItems);

      // 過濾：isActive !== false, posVisible !== false（undefined 視為 true）, isSoldOut !== true
      state.menu = allItems.filter(function (i) {
        if (i.enabled === false) return false;
        if (i.isActive === false) return false;
        // posVisible: undefined/true 均顯示，明確 false 才隱藏
        if (i.posVisible === false) return false;
        return true;
      }).sort(bySort);

      // 套餐
      state.combos = mapDocs(snaps[2]).filter(function (i) {
        return i.enabled !== false && i.isActive !== false && i.posVisible !== false;
      }).sort(bySort);

      var categories = mapDocs(snaps[3]).filter(function (i) { return i.enabled !== false; }).sort(bySort);

      el.menuLoading.style.display = "none";
      renderMenu(categories);
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
    return '<div class="pos-menu-tile' + soldOutClass + '" ' +
      'data-item-id="' + esc(id) + '" data-type="' + esc(type) + '" data-category="' + esc(category || "") + '">' +
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
    addToCart(itemId, type, category);
  }

  function addToCart(itemId, type, category) {
    var source  = type === "combo" ? state.combos : state.menu;
    var found   = source.find(function (i) { return i.id === itemId; });
    if (!found) return;
    var existing = state.cart.find(function (c) { return c.itemId === itemId; });
    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({
        itemId:       itemId,
        name:         found.name,
        unitPrice:    Number(found.price || 0),
        qty:          1,
        categoryName: category,
        type:         type
      });
    }
    renderCart();
  }

  function onCartClick(event) {
    var inc = event.target.closest("[data-cart-inc]");
    var dec = event.target.closest("[data-cart-dec]");
    if (inc) changeQty(inc.getAttribute("data-cart-inc"), 1);
    if (dec) changeQty(dec.getAttribute("data-cart-dec"), -1);
  }

  function changeQty(itemId, delta) {
    var idx = state.cart.findIndex(function (c) { return c.itemId === itemId; });
    if (idx < 0) return;
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
    renderCart();
  }

  function renderCart() {
    if (!state.cart.length) {
      el.cartItems.innerHTML  = '<div class="pos-empty">尚未選取品項</div>';
      el.cartTotal.textContent = "合計：NT$0";
      return;
    }
    var total = 0;
    var html = state.cart.map(function (item) {
      var sub = item.unitPrice * item.qty;
      total += sub;
      return '<div class="pos-cart-item">' +
        '<span class="pos-cart-item__name">' + esc(item.name) + '</span>' +
        '<button class="pos-cart-item__qty-btn" data-cart-dec="' + esc(item.itemId) + '">−</button>' +
        '<span class="pos-cart-item__qty">' + item.qty + '</span>' +
        '<button class="pos-cart-item__qty-btn" data-cart-inc="' + esc(item.itemId) + '">＋</button>' +
        '<span class="pos-cart-item__price">NT$' + sub + '</span>' +
        '</div>';
    });
    el.cartItems.innerHTML   = html.join("");
    el.cartTotal.textContent = "合計：NT$" + total;
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
    state.submitting = true;
    el.submitBtn.disabled = true;
    showStatus("送出中…");

    var ctx          = state.context;
    var db           = ctx.db;
    var storeId      = state.storeId;
    var customerName = (el.customerName.value || "").trim() || "現場顧客";
    var lineUserId   = (el.lineUserId.value || "").trim() || null;
    var pickupTime   = (el.pickupTime.value || "").trim();
    var note         = (el.note.value || "").trim();

    var now       = new Date();
    var tzOffset  = 8 * 60;
    var local     = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60000);
    var todayStr  = local.getFullYear() + "-" + pad(local.getMonth() + 1) + "-" + pad(local.getDate());

    var ref        = db.collection("orders").doc();
    var counterRef = db.collection("order_counters").doc(todayStr);

    var items = cartToItems();
    var total = items.reduce(function (s, i) { return s + i.subtotal; }, 0);

    var payload = window.LeLeShanOrders.buildCreatePayload({
      id:             ref.id,
      storeId:        storeId,
      customer_name:  customerName,
      source:         "pos",
      label:          "現場",
      display_name:   "現場 " + customerName,
      items:          items,
      subtotal:       total,
      total:          total,
      status:         "new",
      lineUserId:     lineUserId,
      lineDisplayName: lineUserId ? customerName : null,
      paymentMethod:  "cash",
      note:           note,
      scheduled_pickup_date: todayStr,
      scheduled_pickup_time: pickupTime,
      scheduled_pickup_at:   pickupTime ? (todayStr + "T" + pickupTime + ":00+08:00") : "",
      isTest:         false
    });

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
            toStatus:   "new",
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

      showStatus("✅ 已送出！取餐號碼：" + pickupNumber, "ok");
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
    el.submitBtn.textContent = "追加到訂單 " + label;
    el.submitBtn.classList.add("pos-submit-btn--append");

    // 清空購物車
    state.cart = [];
    renderCart();
    showStatus("", "");
    el.status.style.display = "none";
  }

  function exitAppendMode() {
    state.appendTargetOrder = null;
    el.appendBanner.classList.add("hidden");
    el.cartTitle.textContent   = "購物車";
    el.cartFields.style.display = "";
    el.submitBtn.textContent   = "送出訂單";
    el.submitBtn.classList.remove("pos-submit-btn--append");
    state.cart = [];
    renderCart();
    el.status.style.display = "none";
  }

  async function handleAppendSubmit() {
    if (state.submitting || !state.cart.length) {
      if (!state.cart.length) showStatus("請先選取要追加的品項。", "err");
      return;
    }
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

  // ── 今日訂單列表 ─────────────────────────────────────────────

  async function loadTodaysOrders() {
    el.ordersList.innerHTML = '<div class="pos-empty">載入中…</div>';
    try {
      var db      = state.context.db;
      var now     = new Date();
      var tz      = 8 * 60;
      var local   = new Date(now.getTime() + (tz + now.getTimezoneOffset()) * 60000);
      // 今天 00:00 台灣時間 → 轉 UTC
      var todayLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate());
      var todayUTC   = new Date(todayLocal.getTime() - (tz + now.getTimezoneOffset()) * 60000);

      var snap = await db.collection("orders")
        .where("storeId", "==", state.storeId)
        .where("createdAt", ">=", todayUTC)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

      state.todaysOrders = snap.docs.map(function (doc) {
        var d = doc.data(); d.id = doc.id; return d;
      });
      renderOrdersList();
    } catch (e) {
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

    var completedSet = new Set(["completed", "cancelled", "picked_up"]);
    var rows = orders.map(function (o) {
      var status    = o.status || "new";
      var statusLbl = STATUS_LABEL_MAP[status] || status;
      var srcKey    = o.source || "pos";
      var srcLbl    = SOURCE_LABEL_MAP[srcKey] || srcKey;
      var canAppend = !completedSet.has(status);
      var createdAt = tsToTime(o.createdAt);
      var total     = Number(o.total || o.totalAmount || o.subtotal || 0);
      var no        = o.pickupNumber ? "#" + o.pickupNumber : o.id.slice(-6);
      var name      = esc(o.customer_name || o.display_name || "—");

      return '<tr>' +
        '<td><strong>' + esc(no) + '</strong></td>' +
        '<td>' + name + '</td>' +
        '<td><span class="pos-source-badge pos-source-badge--' + esc(srcKey) + '">' + esc(srcLbl) + '</span></td>' +
        '<td>NT$' + total + '</td>' +
        '<td><span class="pos-status-pill pos-status-pill--' + esc(status) + '">' + esc(statusLbl) + '</span></td>' +
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
    }
    if (appendBtn) {
      var orderId = appendBtn.getAttribute("data-append-order");
      var order   = state.todaysOrders.find(function (o) { return o.id === orderId; });
      if (order) startAppendMode(order);
    }
  }

  // ── 訂單詳情 Overlay ─────────────────────────────────────────

  async function openDetailOverlay(order) {
    state.detailCurrentOrder = order;
    var completedSet = new Set(["completed", "cancelled", "picked_up"]);
    var canAppend    = !completedSet.has(order.status || "new");

    var label    = order.pickupNumber ? "#" + order.pickupNumber : order.id.slice(-6);
    var status   = order.status || "new";
    var statusLbl= STATUS_LABEL_MAP[status] || status;
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

    // If order has groups (分組購物車), render grouped view directly
    if (order.groups && order.groups.length > 1) {
      el.detailItems.innerHTML = order.groups.map(function (g) {
        var gItems = g.items || [];
        if (!gItems.length) return "";
        return '<div class="pos-order-group-header">' + esc(g.label || "") + '</div>' +
          gItems.map(function (i) {
            var qty = Number(i.qty || 0);
            var sub = Number(i.subtotal || (Number(i.unit_price || 0) * qty));
            var note = i.item_note || "";
            return '<div class="pos-detail-item">' +
              '<span class="pos-detail-item__qty">' + qty + 'x</span>' +
              '<span class="pos-detail-item__name">' + esc(i.name || "") +
                (note ? ' <span style="color:var(--ops-muted);font-size:.8rem;">（' + esc(note) + '）</span>' : '') +
              '</span>' +
              '<span class="pos-detail-item__price">NT$' + sub + '</span>' +
              '</div>';
          }).join("");
      }).filter(Boolean).join("") || '<div class="pos-empty">無品項記錄</div>';
    } else {
    // 載入 order_items
    try {
      var db   = state.context.db;
      var snap = await db.collection("order_items")
        .where("orderId", "==", order.id)
        .orderBy("createdAt", "asc")
        .get();

      var orderItems = snap.docs.map(function (doc) { var d = doc.data(); d.id = doc.id; return d; });

      if (!orderItems.length) {
        // fallback: 從 orders.items 陣列顯示
        orderItems = (order.items || []).map(function (i) {
          return { name: i.name, qty: i.qty || i.quantity || 1, subtotal: i.subtotal || (i.unit_price * (i.qty || 1)) };
        });
      }

      if (!orderItems.length) {
        el.detailItems.innerHTML = '<div class="pos-empty">無品項記錄</div>';
      } else {
        el.detailItems.innerHTML = orderItems.map(function (i) {
          var qty    = Number(i.qty || i.quantity || 1);
          var sub    = Number(i.subtotal || 0);
          var note   = i.item_note || i.note || "";
          return '<div class="pos-detail-item">' +
            '<span class="pos-detail-item__qty">' + qty + 'x</span>' +
            '<span class="pos-detail-item__name">' + esc(i.name || "") +
              (note ? ' <span style="color:var(--ops-muted);font-size:.8rem;">（' + esc(note) + '）</span>' : '') +
            '</span>' +
            '<span class="pos-detail-item__price">NT$' + sub + '</span>' +
            '</div>';
        }).join("");
      }
    } catch (e) {
      // fallback: show from orders.items
      var fallback = (order.items || []);
      if (fallback.length) {
        el.detailItems.innerHTML = fallback.map(function (i) {
          return '<div class="pos-detail-item">' +
            '<span class="pos-detail-item__qty">' + (i.qty || 1) + 'x</span>' +
            '<span class="pos-detail-item__name">' + esc(i.name || "") + '</span>' +
            '<span class="pos-detail-item__price">NT$' + Number(i.subtotal || 0) + '</span>' +
            '</div>';
        }).join("");
      } else {
        el.detailItems.innerHTML = '<div class="pos-empty">品項載入失敗</div>';
      }
    }
    } // end else (no groups)

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
        name:       c.name,
        qty:        c.qty,
        flavor:     "",
        staple:     "",
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
