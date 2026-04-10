(function () {
  // ── POS 現場點餐 ──────────────────────────────────────────────
  // 使用與 LIFF 完全相同的 orders / order_items / order_events 資料結構
  // source = "pos"；不需要 LIFF SDK

  var DEFAULT_STORE_ID = (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1";

  var state = {
    storeId:  DEFAULT_STORE_ID,
    context:  null,
    cart:     [],           // [{ itemId, name, unitPrice, qty, categoryName, type }]
    menu:     [],           // 所有菜單品項（flat list）
    combos:   [],           // 套餐
    submitting: false
  };

  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    window.LeLeShanStaffAuth.init({
      loadingEl: el.loading,
      errorEl:   el.error,
      onReady:   start
    });
  });

  function cache() {
    el.loading      = document.getElementById("auth-loading");
    el.error        = document.getElementById("auth-error");
    el.storeMeta    = document.getElementById("ops-store-meta");
    el.userMeta     = document.getElementById("ops-user-meta");
    el.menuLoading  = document.getElementById("pos-menu-loading");
    el.menuRoot     = document.getElementById("pos-menu-root");
    el.cartItems    = document.getElementById("pos-cart-items");
    el.cartTotal    = document.getElementById("pos-cart-total");
    el.customerName = document.getElementById("pos-customer-name");
    el.lineUserId   = document.getElementById("pos-line-user-id");
    el.pickupTime   = document.getElementById("pos-pickup-time");
    el.note         = document.getElementById("pos-note");
    el.submitBtn    = document.getElementById("pos-submit-btn");
    el.status       = document.getElementById("pos-status");
  }

  async function start(context) {
    state.storeId = context.storeId || DEFAULT_STORE_ID;
    state.context = context;
    el.storeMeta.textContent = "門市：" + state.storeId;
    el.userMeta.textContent  = "登入：" + (context.admin.name || context.user.email) + " ／ " + context.admin.role;

    await loadMenu(context.db);
    el.submitBtn.disabled = false;
    el.submitBtn.addEventListener("click", handleSubmit);
    el.cartItems.addEventListener("click", onCartClick);
  }

  // ── 載入菜單（menu_items + comboTemplates，storeId 過濾）───────

  async function loadMenu(db) {
    try {
      var snaps = await Promise.all([
        db.collection("menu_items").where("storeId", "==", state.storeId).get(),
        db.collection("menuItems").where("storeId", "==", state.storeId).get(),
        db.collection("comboTemplates").where("storeId", "==", state.storeId).get(),
        db.collection("categories").where("storeId", "==", state.storeId).get()
      ]);

      // 合併 menu_items + menuItems，去重
      var newItems  = mapDocs(snaps[0]).filter(function (i) { return i.enabled !== false; });
      var legacyItems = mapDocs(snaps[1]).filter(function (i) {
        return i.enabled !== false && !newItems.find(function (n) { return n.id === i.id; });
      });
      state.menu   = newItems.concat(legacyItems).sort(bySort);
      state.combos = mapDocs(snaps[2]).filter(function (i) { return i.enabled !== false; }).sort(bySort);

      var categories = mapDocs(snaps[3]).filter(function (i) { return i.enabled !== false; }).sort(bySort);

      el.menuLoading.style.display = "none";
      renderMenu(categories);
    } catch (e) {
      el.menuLoading.textContent = "菜單載入失敗：" + (e.message || e);
    }
  }

  function renderMenu(categories) {
    var html = [];

    // ── 套餐區塊 ──
    if (state.combos.length) {
      html.push('<div class="pos-section-title">套餐</div>');
      html.push('<div class="pos-menu-grid">');
      state.combos.forEach(function (combo) {
        html.push(menuTile(combo.id, combo.name, combo.price, "combo"));
      });
      html.push('</div>');
    }

    // ── 單點區塊（按分類）──
    if (categories.length) {
      categories.forEach(function (cat) {
        var items = state.menu.filter(function (i) { return i.categoryId === cat.id; });
        if (!items.length) return;
        html.push('<div class="pos-section-title">' + esc(cat.name) + '</div>');
        html.push('<div class="pos-menu-grid">');
        items.forEach(function (item) {
          html.push(menuTile(item.id, item.name, item.price, "single", cat.name));
        });
        html.push('</div>');
      });
    } else {
      // fallback: 無分類，直接列出所有單點
      if (state.menu.length) {
        html.push('<div class="pos-section-title">單點</div>');
        html.push('<div class="pos-menu-grid">');
        state.menu.forEach(function (item) {
          html.push(menuTile(item.id, item.name, item.price, "single", ""));
        });
        html.push('</div>');
      }
    }

    el.menuRoot.innerHTML = html.join("") || '<div class="pos-empty">尚無菜單資料</div>';
    el.menuRoot.addEventListener("click", onMenuClick);
  }

  function menuTile(id, name, price, type, category) {
    return '<div class="pos-menu-tile" data-item-id="' + esc(id) + '" data-type="' + esc(type) + '" data-category="' + esc(category || "") + '">' +
      '<div class="pos-menu-tile__name">' + esc(name) + '</div>' +
      '<div class="pos-menu-tile__price">NT$' + Number(price || 0) + '</div>' +
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
    var source = type === "combo" ? state.combos : state.menu;
    var found  = source.find(function (i) { return i.id === itemId; });
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
      el.cartItems.innerHTML = '<div class="pos-empty">尚未選取品項</div>';
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
    el.cartItems.innerHTML = html.join("");
    el.cartTotal.textContent = "合計：NT$" + total;
  }

  // ── 送出訂單 ─────────────────────────────────────────────────

  async function handleSubmit() {
    if (state.submitting || !state.cart.length) {
      if (!state.cart.length) showStatus("請先選取品項。", "err");
      return;
    }
    state.submitting = true;
    el.submitBtn.disabled = true;
    showStatus("送出中…");

    var ctx        = state.context;
    var db         = ctx.db;
    var storeId    = state.storeId;
    var customerName = (el.customerName.value || "").trim() || "現場顧客";
    var lineUserId = (el.lineUserId.value || "").trim() || null;
    var pickupTime = (el.pickupTime.value || "").trim();
    var note       = (el.note.value || "").trim();

    // 取今天日期（台灣時間 UTC+8）
    var now      = new Date();
    var tzOffset = 8 * 60;
    var local    = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60000);
    var todayStr = local.getFullYear() + "-" + pad(local.getMonth() + 1) + "-" + pad(local.getDate());

    var ref        = db.collection("orders").doc();
    var counterRef = db.collection("order_counters").doc(todayStr);

    // 組 items（與 LIFF 相同格式）
    var items = state.cart.map(function (c) {
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
          payload.pickupNumber = pickupNumber;
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

      // customers upsert（若有 lineUserId）
      upsertCustomer(db, { storeId: storeId, lineUserId: lineUserId, customerName: customerName, orderId: ref.id });

      showStatus("✅ 已送出！取餐號碼：" + pickupNumber, "ok");
      state.cart = [];
      renderCart();
      el.customerName.value = "";
      el.lineUserId.value   = "";
      el.pickupTime.value   = "";
      el.note.value         = "";

    } catch (err) {
      console.error("[POS] submitOrder failed.", err);
      showStatus("送單失敗：" + (err.message || err), "err");
    } finally {
      state.submitting    = false;
      el.submitBtn.disabled = false;
    }
  }

  // ── customers upsert ─────────────────────────────────────────

  function upsertCustomer(db, opts) {
    if (!opts.lineUserId) return;
    var ts  = firebase.firestore.FieldValue.serverTimestamp();
    var ref = db.collection("customers").doc(opts.lineUserId);
    ref.set({
      lineUserId:    opts.lineUserId,
      storeId:       opts.storeId,
      name:          opts.customerName || "",
      lastOrderId:   opts.orderId || "",
      lastOrderAt:   ts,
      updatedAt:     ts,
      createdAt:     ts
    }, { merge: true }).catch(function (e) { console.warn("[POS] customers upsert failed.", e); });
  }

  // ── helpers ──────────────────────────────────────────────────

  function mapDocs(snap) {
    return snap.docs.map(function (doc) { var d = doc.data(); d.id = doc.id; return d; });
  }

  function bySort(a, b) { return (Number(a.sort || 0)) - (Number(b.sort || 0)); }

  function pad(n) { return String(n).padStart(2, "0"); }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showStatus(msg, cls) {
    el.status.style.display = "block";
    el.status.textContent   = msg;
    el.status.className     = "pos-status" + (cls ? " " + cls : "");
  }
})();
