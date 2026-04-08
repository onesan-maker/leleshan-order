(function () {
  var state = { storeId: "", orders: [], filter: "all", keyword: "" };
  var el = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    bind();
    window.LeLeShanStaffAuth.init({
      loadingEl: el.loading,
      errorEl: el.error,
      onReady: start
    });
  });

  function cache() {
    el.loading = document.getElementById("auth-loading");
    el.error = document.getElementById("auth-error");
    el.storeMeta = document.getElementById("ops-store-meta");
    el.userMeta = document.getElementById("ops-user-meta");
    el.totalAll = document.getElementById("stat-all");
    el.totalOpen = document.getElementById("stat-open");
    el.totalReady = document.getElementById("stat-ready");
    el.totalDone = document.getElementById("stat-picked");
    el.search = document.getElementById("admin-order-search");
    el.list = document.getElementById("admin-orders-list");
    el.tabs = Array.prototype.slice.call(document.querySelectorAll("[data-admin-filter]"));
  }

  function bind() {
    el.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.filter = tab.getAttribute("data-admin-filter");
        render();
      });
    });
    el.search.addEventListener("input", function () {
      state.keyword = (el.search.value || "").trim().toLowerCase();
      render();
    });
  }

  function start(context) {
    state.storeId = context.storeId;
    el.storeMeta.textContent = "門市：" + state.storeId;
    el.userMeta.textContent = "登入：" + (context.admin.name || context.user.email || context.user.uid) + " / " + context.admin.role;
    window.LeLeShanOrders.subscribeStoreOrders({
      db: context.db,
      storeId: state.storeId,
      onData: function (orders) {
        state.orders = orders;
        render();
      },
      onError: handleError
    });
    el.list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-next-status]");
      if (button) changeStatus(context, button.getAttribute("data-order-id"), button.getAttribute("data-next-status"));
    });
  }

  async function changeStatus(context, orderId, nextStatus) {
    try {
      console.log("[AdminOrders] Changing order status.", { orderId: orderId, nextStatus: nextStatus });
      await window.LeLeShanOrders.updateOrderStatus({
        db: context.db,
        orderId: orderId,
        storeId: state.storeId,
        nextStatus: nextStatus,
        actorUid: context.user.uid,
        actorName: context.admin.name || context.user.email || ""
      });
    } catch (error) {
      console.error("[AdminOrders] Failed to change status.", error);
      handleError(error);
    }
  }

  function handleError(error) {
    el.error.textContent = "讀取或更新訂單失敗：" + (error && (error.message || error.code) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var visible = state.orders.slice().sort(function (left, right) {
      return window.LeLeShanOrders.toMillis(right.updated_at || right.created_at) - window.LeLeShanOrders.toMillis(left.updated_at || left.created_at);
    });
    var filtered = visible.filter(function (order) {
      var matchesFilter = state.filter === "all" ? true : order.status === state.filter;
      var haystack = [order.customer_name, order.display_name, order.label, order.id].join(" ").toLowerCase();
      var matchesKeyword = !state.keyword || haystack.indexOf(state.keyword) >= 0;
      return matchesFilter && matchesKeyword;
    });

    el.totalAll.textContent = String(visible.length);
    el.totalOpen.textContent = String(visible.filter(function (order) {
      return ["new", "cooking", "packing"].indexOf(order.status) >= 0;
    }).length);
    el.totalReady.textContent = String(visible.filter(function (order) { return order.status === "ready"; }).length);
    el.totalDone.textContent = String(visible.filter(function (order) { return order.status === "picked_up"; }).length);

    el.tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-admin-filter") === state.filter);
    });

    if (!filtered.length) {
      el.list.innerHTML = '<div class="empty-state">目前沒有符合條件的訂單。</div>';
      return;
    }

    el.list.innerHTML = filtered.map(function (order) {
      var meta = window.LeLeShanOrders.statusMeta(order.status);
      return '<article class="order-card order-card--' + esc(meta.tone) + '">' +
        '<div class="order-card__head"><div><h2>' + esc(window.LeLeShanOrders.safeName(order)) + '</h2><div class="order-card__meta">訂單編號：' + esc(order.id) + ' / ' + esc(order.label) + ' / ' + esc(order.source) + '</div></div>' +
        '<span class="status-pill status-pill--' + esc(meta.tone) + '">' + esc(meta.label) + '</span></div>' +
        '<div class="timeline"><span>建立：' + esc(window.LeLeShanOrders.formatDateTime(order.created_at)) + '</span><span>預約：' + esc(order.scheduled_pickup_time ? (order.scheduled_pickup_date + " " + order.scheduled_pickup_time) : "未指定") + '</span></div>' +
        '<div class="order-card__meta">品項：' + esc(window.LeLeShanOrders.itemSummary(order.items, 6).join("；")) + '</div>' +
        '<div class="order-card__note">顧客備註：' + esc(order.note || "無") + '<br>內部備註：' + esc(order.internal_note || "無") + '</div>' +
        '<div class="timeline"><span>開始：' + esc(window.LeLeShanOrders.formatDateTime(order.started_at) || "-") + '</span><span>包裝：' + esc(window.LeLeShanOrders.formatDateTime(order.packed_at) || "-") + '</span><span>完成：' + esc(window.LeLeShanOrders.formatDateTime(order.ready_at) || "-") + '</span></div>' +
        '<div class="order-card__actions">' + actionButtons(order) + '</div>' +
      "</article>";
    }).join("");
  }

  function actionButtons(order) {
    var actions = [];
    if (order.status === "new") actions.push(button(order.id, "開始製作", "cooking", "primary-btn"));
    if (order.status === "cooking") actions.push(button(order.id, "送往包裝", "packing", "secondary-btn"));
    if (order.status === "packing") actions.push(button(order.id, "標記完成", "ready", "primary-btn"));
    if (order.status === "ready") actions.push(button(order.id, "已取餐", "picked_up", "secondary-btn"));
    if (["new", "cooking", "packing", "ready"].indexOf(order.status) >= 0) {
      actions.push(button(order.id, "取消訂單", "cancelled", "danger-btn"));
    }
    return actions.join("");
  }

  function button(orderId, label, nextStatus, className) {
    return '<button class="' + className + '" type="button" data-order-id="' + esc(orderId) + '" data-next-status="' + esc(nextStatus) + '">' + esc(label) + "</button>";
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
