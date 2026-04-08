(function () {
  var state = { storeId: "", orders: [], filter: "all" };
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
    el.totalPacking = document.getElementById("stat-packing");
    el.totalReady = document.getElementById("stat-ready");
    el.totalVisible = document.getElementById("stat-visible");
    el.list = document.getElementById("packing-list");
    el.tabs = Array.prototype.slice.call(document.querySelectorAll("[data-packing-filter]"));
  }

  function bind() {
    el.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.filter = tab.getAttribute("data-packing-filter");
        render();
      });
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
      console.log("[Packing] Changing order status.", { orderId: orderId, nextStatus: nextStatus });
      await window.LeLeShanOrders.updateOrderStatus({
        db: context.db,
        orderId: orderId,
        storeId: state.storeId,
        nextStatus: nextStatus,
        actorUid: context.user.uid,
        actorName: context.admin.name || context.user.email || ""
      });
    } catch (error) {
      console.error("[Packing] Failed to change status.", error);
      handleError(error);
    }
  }

  function handleError(error) {
    el.error.textContent = "讀取或更新訂單失敗：" + (error && (error.message || error.code) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var visible = state.orders.filter(function (order) {
      return ["packing", "ready"].indexOf(order.status) >= 0;
    }).sort(function (left, right) {
      var leftValue = window.LeLeShanOrders.toMillis(left.packed_at) || window.LeLeShanOrders.toMillis(left.created_at);
      var rightValue = window.LeLeShanOrders.toMillis(right.packed_at) || window.LeLeShanOrders.toMillis(right.created_at);
      return leftValue - rightValue;
    });
    var filtered = visible.filter(function (order) {
      return state.filter === "all" ? true : order.status === state.filter;
    });

    el.totalPacking.textContent = String(visible.filter(function (order) { return order.status === "packing"; }).length);
    el.totalReady.textContent = String(visible.filter(function (order) { return order.status === "ready"; }).length);
    el.totalVisible.textContent = String(visible.length);

    el.tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-packing-filter") === state.filter);
    });

    if (!filtered.length) {
      el.list.innerHTML = '<div class="empty-state">目前沒有包裝或待取餐訂單。</div>';
      return;
    }

    el.list.innerHTML = filtered.map(function (order) {
      var meta = window.LeLeShanOrders.statusMeta(order.status);
      var actions = [];
      if (order.status === "packing") {
        actions.push(button(order.id, "標記完成", "ready", "primary-btn"));
        actions.push(button(order.id, "退回廚房", "cooking", "ghost-btn"));
      }
      if (order.status === "ready") actions.push(button(order.id, "已取餐", "picked_up", "secondary-btn"));

      return '<article class="order-card order-card--' + esc(meta.tone) + '">' +
        '<div class="order-card__head"><div><h2>' + esc(window.LeLeShanOrders.safeName(order)) + '</h2><div class="order-card__meta">' + esc(order.label) + ' / ' + esc(order.source) + '</div></div>' +
        '<span class="status-pill status-pill--' + esc(meta.tone) + '">' + esc(meta.label) + '</span></div>' +
        '<div class="timeline"><span>進包裝：' + esc(window.LeLeShanOrders.formatDateTime(order.packed_at || order.created_at)) + '</span><span>取餐：' + esc(order.scheduled_pickup_time ? (order.scheduled_pickup_date + " " + order.scheduled_pickup_time) : "未指定") + '</span></div>' +
        '<div class="order-card__meta">品項摘要：' + esc(window.LeLeShanOrders.itemSummary(order.items, 3).join("；")) + '</div>' +
        '<div class="order-card__note">備註：' + esc(order.note || order.internal_note || "無") + '</div>' +
        '<div class="timeline"><span>目前狀態：' + esc(meta.label) + '</span><span>預估：' + esc(window.LeLeShanOrders.etaText(order, visible)) + '</span></div>' +
        '<div class="order-card__actions">' + actions.join("") + "</div>" +
      "</article>";
    }).join("");
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
