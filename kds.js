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
    el.totalNew = document.getElementById("stat-new");
    el.totalCooking = document.getElementById("stat-cooking");
    el.totalVisible = document.getElementById("stat-visible");
    el.list = document.getElementById("kds-list");
    el.tabs = Array.prototype.slice.call(document.querySelectorAll("[data-kds-filter]"));
  }

  function bind() {
    el.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.filter = tab.getAttribute("data-kds-filter");
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
      var cancelButton = event.target.closest("[data-cancel-order]");
      if (button) changeStatus(context, button.getAttribute("data-order-id"), button.getAttribute("data-next-status"));
      if (cancelButton && window.confirm("確定要取消這筆訂單嗎？")) {
        changeStatus(context, cancelButton.getAttribute("data-order-id"), "cancelled");
      }
    });
  }

  async function changeStatus(context, orderId, nextStatus) {
    try {
      console.log("[KDS] Changing order status.", { orderId: orderId, nextStatus: nextStatus });
      await window.LeLeShanOrders.updateOrderStatus({
        db: context.db,
        orderId: orderId,
        storeId: state.storeId,
        nextStatus: nextStatus,
        actorUid: context.user.uid,
        actorName: context.admin.name || context.user.email || ""
      });
    } catch (error) {
      console.error("[KDS] Failed to change status.", error);
      handleError(error);
    }
  }

  function handleError(error) {
    el.error.textContent = "讀取或更新訂單失敗：" + (error && (error.message || error.code) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var visible = state.orders.filter(function (order) {
      return ["new", "cooking"].indexOf(order.status) >= 0;
    }).sort(function (left, right) {
      return window.LeLeShanOrders.toMillis(left.created_at) - window.LeLeShanOrders.toMillis(right.created_at);
    });
    var filtered = visible.filter(function (order) {
      return state.filter === "all" ? true : order.status === state.filter;
    });

    el.totalNew.textContent = String(visible.filter(function (order) { return order.status === "new"; }).length);
    el.totalCooking.textContent = String(visible.filter(function (order) { return order.status === "cooking"; }).length);
    el.totalVisible.textContent = String(visible.length);

    el.tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-kds-filter") === state.filter);
    });

    if (!filtered.length) {
      el.list.innerHTML = '<div class="empty-state">目前沒有待處理訂單，廚房畫面會自動即時更新。</div>';
      return;
    }

    el.list.innerHTML = filtered.map(function (order) {
      var meta = window.LeLeShanOrders.statusMeta(order.status);
      var items = window.LeLeShanOrders.itemSummary(order.items, 8);
      var scheduledTag = window.LeLeShanOrders.isFutureScheduled(order)
        ? '<span class="tag-pill tag-pill--scheduled">預約單</span>'
        : "";
      var actions = [];
      if (order.status === "new") actions.push(button(order.id, "開始製作", "cooking", "primary-btn"));
      if (order.status === "cooking") actions.push(button(order.id, "送往包裝", "packing", "secondary-btn"));
      actions.push('<button class="danger-btn" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">取消訂單</button>');

      return '<article class="order-card order-card--' + esc(meta.tone) + '">' +
        '<div class="order-card__head"><div><h2>' + esc(window.LeLeShanOrders.safeName(order)) + '</h2><div class="order-card__meta">' + esc(order.label) + ' / ' + esc(order.source) + '</div></div>' +
        '<div class="order-card__status-row"><span class="status-pill status-pill--' + esc(meta.tone) + '">' + esc(meta.label) + '</span>' + scheduledTag + '</div></div>' +
        '<div class="timeline"><span>建立：' + esc(window.LeLeShanOrders.formatDateTime(order.created_at)) + '</span><span>已等待：' + esc(String(window.LeLeShanOrders.elapsedMinutes(order.created_at))) + ' 分</span></div>' +
        '<div class="timeline"><span>預約：' + esc(order.scheduled_pickup_time ? (order.scheduled_pickup_date + " " + order.scheduled_pickup_time) : "未指定") + '</span><span>預估：' + esc(window.LeLeShanOrders.etaText(order, visible)) + '</span></div>' +
        '<ol class="order-card__items">' + items.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") + "</ol>" +
        '<div class="order-card__note">備註：' + esc(order.note || "無") + '</div>' +
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
