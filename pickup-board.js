(function () {
  var state = {
    storeId: (window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1",
    orders: [],
    readySeen: {}
  };
  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    startClock();
    if (!firebase.apps.length) firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    window.LeLeShanOrders.subscribeStoreOrders({
      db: firebase.firestore(),
      storeId: state.storeId,
      onData: function (orders) {
        state.orders = orders;
        render();
      },
      onError: handleError
    });
  });

  function cache() {
    el.clock = document.getElementById("board-clock");
    el.error = document.getElementById("board-error");
    el.processing = document.getElementById("board-processing");
    el.ready = document.getElementById("board-ready");
  }

  function startClock() {
    tick();
    setInterval(tick, 1000);
  }

  function tick() {
    el.clock.textContent = new Date().toLocaleString("zh-TW", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function handleError(error) {
    console.error("[PickupBoard] Failed to read orders.", error);
    el.error.textContent = "取餐看板讀取失敗：" + (error && (error.message || error.code) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var processing = state.orders.filter(function (order) {
      return ["cooking", "packing"].indexOf(order.status) >= 0;
    }).sort(function (left, right) {
      return window.LeLeShanOrders.toMillis(left.created_at) - window.LeLeShanOrders.toMillis(right.created_at);
    }).slice(0, 10);
    var ready = state.orders.filter(function (order) {
      return order.status === "ready";
    }).sort(function (left, right) {
      return window.LeLeShanOrders.toMillis(right.ready_at || right.updated_at || right.created_at) - window.LeLeShanOrders.toMillis(left.ready_at || left.updated_at || left.created_at);
    }).slice(0, 10);

    el.processing.innerHTML = processing.length
      ? processing.map(function (order) { return boardCard(order, false, false, processing); }).join("")
      : '<div class="board-empty"><p>目前沒有製作中的訂單</p></div>';

    el.ready.innerHTML = ready.length
      ? ready.map(function (order) {
        var isFlash = !state.readySeen[order.id];
        state.readySeen[order.id] = true;
        return boardCard(order, true, isFlash, ready);
      }).join("")
      : '<div class="board-empty"><p>目前沒有待取餐訂單</p></div>';
  }

  function boardCard(order, isReady, isFlash, list) {
    var meta = window.LeLeShanOrders.statusMeta(order.status);
    var cardClass = "board-item" + (isReady ? " board-item--ready" : "") + (isFlash ? " board-item--flash" : "");
    var statusText = isReady ? "可取餐" : meta.label;
    var etaText = isReady ? "請至櫃台取餐" : window.LeLeShanOrders.etaText(order, list);
    return '<article class="' + cardClass + '">' +
      '<h3 class="board-item__name">' + esc(order.display_code || window.LeLeShanOrders.safeName(order)) + '</h3>' +
      '<div class="board-item__status">' + esc(statusText) + '</div>' +
      '<div class="board-item__meta">' + esc(etaText) + '</div>' +
    '</article>';
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
