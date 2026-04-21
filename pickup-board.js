(function () {
  var BOARD_STATUSES = ["accepted", "preparing", "ready"];

  var state = {
    storeId: (window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1",
    orders: [],
    readySeen: {},
    prevReadyMap: {},
    recentReady: []
  };
  var el = {};
  var MAX_RECENT = 5;

  // source 標籤：改呼叫 window.LeLeShanOrders.sourceLabel(src) 取得長版
  //   （全站單一真相定義於 order-helpers.js，請勿在此覆寫）
  var BOARD_SOURCE_TAGS = {
    walk_in: "pos", phone: "phone", line: "line",
    liff: "line", pos: "pos", manual: "manual"
  };

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    startClock();
    if (!firebase.apps.length) firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    firebase.firestore()
      .collection("orders")
      .where("storeId", "==", state.storeId)
      .where("status", "in", BOARD_STATUSES)
      .onSnapshot(function (snapshot) {
        state.orders = snapshot.docs.map(function (doc) {
          return window.LeLeShanOrders.normalizeOrder
            ? window.LeLeShanOrders.normalizeOrder(doc.data(), doc.id)
            : Object.assign({ id: doc.id }, doc.data());
        });
        render();
      }, handleError);
  });

  function cache() {
    el.clock      = document.getElementById("board-clock");
    el.error      = document.getElementById("board-error");
    el.processing = document.getElementById("board-processing");
    el.ready      = document.getElementById("board-ready");
    el.recentWrap = document.getElementById("board-recent-wrap");
    el.recent     = document.getElementById("board-recent");
    el.processingCol = el.processing && el.processing.closest(".board-column");
    el.readyCol      = el.ready      && el.ready.closest(".board-column");
  }

  function startClock() {
    tick();
    setInterval(tick, 1000);
    // 每 30 秒重繪卡片，讓「約 X 分」隨時間自然遞減，不必等 snapshot
    setInterval(function () {
      if (state.orders && state.orders.length) render();
    }, 30 * 1000);
  }

  function tick() {
    el.clock.textContent = new Date().toLocaleString("zh-TW", {
      hour12: false, month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  // 與 KDS 同步的 ETA 計算：
  //   Priority 1：order.timing.estimatedReadyAt（locked 快照）
  //   Priority 2：order.timing.lockedPrepMinutes + created_at
  //   Priority 3：window.LeLeShanOrders.getKdsTimingMeta 的 minutesToPickup
  //   Priority 4：舊 etaText fallback
  function getPickupBoardEtaLabel(order, now, fallbackList) {
    if (!order) return "";
    var st = String(order.status || "").toLowerCase();
    if (st === "ready" || st === "completed" || st === "picked_up" || st === "cancelled") return "";
    var helpers = window.LeLeShanOrders;
    var nowMs = typeof now === "number" ? now : Date.now();

    function formatRemaining(remainingMs) {
      var mins = Math.ceil(remainingMs / 60000);
      if (!Number.isFinite(mins)) return "";
      if (mins <= 0) return "即將完成";
      return "約 " + mins + " 分";
    }

    var timing = order.timing;

    // P1: estimatedReadyAt
    if (timing && timing.estimatedReadyAt) {
      var readyMs = helpers && typeof helpers.toMillis === "function"
        ? helpers.toMillis(timing.estimatedReadyAt)
        : Date.parse(timing.estimatedReadyAt) || 0;
      if (readyMs > 0) return formatRemaining(readyMs - nowMs);
    }

    // P2: lockedPrepMinutes + created_at
    if (timing && Number.isFinite(Number(timing.lockedPrepMinutes)) && Number(timing.lockedPrepMinutes) > 0) {
      var createdMs = helpers && typeof helpers.toMillis === "function" ? helpers.toMillis(order.created_at) : 0;
      if (createdMs > 0) {
        var targetMs = createdMs + Number(timing.lockedPrepMinutes) * 60000;
        return formatRemaining(targetMs - nowMs);
      }
    }

    // P3: getKdsTimingMeta（同 KDS 規則）
    if (helpers && typeof helpers.getKdsTimingMeta === "function") {
      try {
        var meta = helpers.getKdsTimingMeta(order, nowMs);
        if (meta) {
          if (meta.statusPhase === "overdue") return "即將完成";
          if (Number.isFinite(meta.minutesToPickup) && meta.minutesToPickup > 0) {
            return "約 " + meta.minutesToPickup + " 分";
          }
          if (Number.isFinite(meta.prepMinutes) && meta.prepMinutes > 0) {
            return "約 " + meta.prepMinutes + " 分";
          }
        }
      } catch (e) { /* fall through to legacy */ }
    }

    // P4: legacy fallback
    if (helpers && typeof helpers.etaText === "function") {
      return helpers.etaText(order, fallbackList) || "";
    }
    return "";
  }

  function handleError(error) {
    console.error("[PickupBoard] Failed to read orders.", error);
    el.error.textContent = "取餐看板讀取失敗：" + ((error && (error.message || error.code)) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var processing = state.orders.filter(function (o) {
      return ["accepted", "preparing"].indexOf(o.status) >= 0;
    }).sort(function (a, b) {
      return window.LeLeShanOrders.toMillis(a.created_at) - window.LeLeShanOrders.toMillis(b.created_at);
    }).slice(0, 12);

    var ready = state.orders.filter(function (o) {
      return o.status === "ready";
    }).sort(function (a, b) {
      return window.LeLeShanOrders.toMillis(b.ready_at || b.updated_at || b.created_at) -
             window.LeLeShanOrders.toMillis(a.ready_at || a.updated_at || a.created_at);
    }).slice(0, 12);

    // Track recently-completed: orders that left the ready list (likely picked up)
    var currentReadyIds = {};
    ready.forEach(function (o) { currentReadyIds[o.id] = true; });
    Object.keys(state.prevReadyMap).forEach(function (id) {
      if (!currentReadyIds[id] && !state.recentReady.some(function (r) { return r.id === id; })) {
        var o = state.prevReadyMap[id];
        state.recentReady.unshift({
          id: id,
          pickupNum: o.pickupNumber || o.pickup_number || o.display_code || String(o.id || "").slice(-4).toUpperCase(),
          customerName: (o.customer_name || "").trim()
        });
        if (state.recentReady.length > MAX_RECENT) state.recentReady.length = MAX_RECENT;
      }
    });
    state.prevReadyMap = {};
    ready.forEach(function (o) { state.prevReadyMap[o.id] = o; });

    el.processing.innerHTML = processing.length
      ? processing.map(function (o) { return boardCard(o, false, false, processing); }).join("")
      : '<div class="board-empty"><div class="board-empty__icon">⏳</div><p>目前沒有製作中的餐點</p></div>';

    el.ready.innerHTML = ready.length
      ? ready.map(function (o) {
          var isFlash = !state.readySeen[o.id];
          state.readySeen[o.id] = true;
          return boardCard(o, true, isFlash, ready);
        }).join("")
      : '<div class="board-empty"><div class="board-empty__icon">☑</div><p>目前尚無可取餐餐點</p></div>';

    if (el.recentWrap && el.recent) {
      if (state.recentReady.length > 0) {
        el.recentWrap.classList.remove("hidden");
        el.recent.innerHTML = state.recentReady.map(recentChip).join("");
      } else {
        el.recentWrap.classList.add("hidden");
      }
    }

    var COMPACT_THRESHOLD = 3;
    if (el.processingCol) el.processingCol.classList.toggle("board-column--compact", processing.length >= COMPACT_THRESHOLD);
    if (el.readyCol)      el.readyCol.classList.toggle("board-column--compact",      ready.length >= COMPACT_THRESHOLD);
  }

  function boardCard(order, isReady, isFlash, list) {
    var pickupNum    = order.pickupNumber || order.pickup_number || order.display_code || "";
    var customerName = (order.customer_name || "").trim();
    var shortId      = String(order.id || "").slice(-4).toUpperCase();
    var sourceText   = (window.LeLeShanOrders && window.LeLeShanOrders.sourceLabel)
      ? window.LeLeShanOrders.sourceLabel(order.source)
      : "現場顧客";
    var sourceTag    = BOARD_SOURCE_TAGS[order.source]   || "pos";

    var displayNum = pickupNum || shortId;
    var numClass   = "board-item__num" + (pickupNum ? "" : " board-item__num--id");
    var hasName    = customerName && customerName !== "現場顧客";
    var etaText    = isReady ? "請至櫃台取餐" : getPickupBoardEtaLabel(order, Date.now(), list);
    var statusText = isReady ? "可取餐" : "製作中";
    var cardClass  = "board-item" +
      (isReady  ? " board-item--ready"      : " board-item--processing") +
      (isFlash  ? " board-item--flash"      : "");

    var secondaryHtml = hasName
      ? '<span class="board-item__customer">' + esc(customerName) + '</span>' +
        '<span class="board-item__src-tag board-item__src-tag--' + sourceTag + '">' + esc(sourceText) + '</span>'
      : '<span class="board-item__customer">' + esc(sourceText) + '</span>';

    return '<article class="' + cardClass + '">' +
      '<div class="' + numClass + '">' + esc(displayNum) + '</div>' +
      '<div class="board-item__secondary">' + secondaryHtml + '</div>' +
      '<div class="board-item__footer">' +
        '<span class="board-item__pill board-item__pill--' + (isReady ? "ready" : "proc") + '">' + esc(statusText) + '</span>' +
        (etaText ? '<span class="board-item__note">' + esc(etaText) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function recentChip(item) {
    return '<div class="board-recent-chip">' +
      '<span class="board-recent-chip__num">' + esc(item.pickupNum) + '</span>' +
      (item.customerName ? '<span class="board-recent-chip__name">' + esc(item.customerName) + '</span>' : '') +
      '<span class="board-recent-chip__done">已取餐</span>' +
    '</div>';
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
