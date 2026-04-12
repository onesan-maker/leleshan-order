(function () {
  // ── 狀態分組定義 ────────────────────────────────────────────
  // KDS 顯示的狀態（normalized 後）
  var KDS_VISIBLE = ["new", "accepted", "preparing", "ready"];
  var PENDING_STATUSES   = ["new", "accepted"];
  var PREPARING_STATUSES = ["preparing"];
  var READY_STATUSES     = ["ready"];

  // source → 顯示標籤
  var SOURCE_LABELS = {
    liff:      "LINE訂",
    pos:       "現場",
    manual:    "人工",
    ubereats:  "UberEats",
    foodpanda: "Foodpanda"
  };

  // ── 狀態機：每個狀態的按鈕動作 ──────────────────────────────
  var STATUS_ACTIONS = {
    new: [
      { label: "確認接單", next: "accepted", cls: "secondary-btn" },
      { label: "直接製作", next: "preparing", cls: "primary-btn" }
    ],
    accepted: [
      { label: "開始製作", next: "preparing", cls: "primary-btn" }
    ],
    preparing: [
      { label: "餐點完成", next: "ready", cls: "primary-btn" }
    ],
    ready: [
      { label: "完成取餐", next: "completed", cls: "secondary-btn" }
    ]
  };

  var state = { storeId: "", orders: [], filter: "all", context: null };
  var el    = {};

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    bind();
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
    el.lastUpdate   = document.getElementById("kds-last-update");
    el.statPending  = document.getElementById("stat-pending");
    el.statPreparing= document.getElementById("stat-preparing");
    el.statReady    = document.getElementById("stat-ready");
    el.statVisible  = document.getElementById("stat-visible");
    el.list         = document.getElementById("kds-list");
    el.tabs         = Array.prototype.slice.call(document.querySelectorAll("[data-kds-filter]"));
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
    state.context = context;
    el.storeMeta.textContent = "門市：" + state.storeId;
    el.userMeta.textContent  = "登入：" + (context.admin.name || context.user.email || context.user.uid) +
                               " ／ " + context.admin.role;

    window.LeLeShanOrders.subscribeStoreOrders({
      db:      context.db,
      storeId: state.storeId,
      onData:  function (orders) {
        state.orders = orders;
        if (el.lastUpdate) el.lastUpdate.textContent = "更新：" + new Date().toLocaleTimeString("zh-TW", { hour12: false });
        render();
      },
      onError: handleError
    });

    el.list.addEventListener("click", function (event) {
      var btn    = event.target.closest("[data-next-status]");
      var cancel = event.target.closest("[data-cancel-order]");
      if (btn)    changeStatus(btn.getAttribute("data-order-id"), btn.getAttribute("data-next-status"));
      if (cancel && window.confirm("確定要取消這筆訂單嗎？")) {
        changeStatus(cancel.getAttribute("data-order-id"), "cancelled");
      }
    });
  }

  async function changeStatus(orderId, nextStatus) {
    var ctx = state.context;
    if (!ctx) return;
    try {
      console.log("[KDS] Changing status.", { orderId: orderId, nextStatus: nextStatus });
      await window.LeLeShanOrders.updateOrderStatus({
        db:        ctx.db,
        orderId:   orderId,
        storeId:   state.storeId,
        nextStatus: nextStatus,
        actorType: "staff",
        actorUid:  ctx.user.uid,
        actorName: ctx.admin.name || ctx.user.email || ""
      });
    } catch (error) {
      console.error("[KDS] changeStatus failed.", error);
      handleError(error);
    }
  }

  function handleError(error) {
    el.error.textContent = "讀取或更新訂單失敗：" + (error && (error.message || error.code) || "未知錯誤");
    el.error.classList.remove("hidden");
  }

  function render() {
    var helpers = window.LeLeShanOrders;

    // 只顯示 KDS_VISIBLE 狀態，按建立時間排序
    var visible = state.orders.filter(function (order) {
      return KDS_VISIBLE.indexOf(order.status) >= 0;
    }).sort(function (a, b) {
      return helpers.toMillis(a.created_at) - helpers.toMillis(b.created_at);
    });

    // 統計
    var pendingCount   = visible.filter(function (o) { return PENDING_STATUSES.indexOf(o.status) >= 0; }).length;
    var preparingCount = visible.filter(function (o) { return PREPARING_STATUSES.indexOf(o.status) >= 0; }).length;
    var readyCount     = visible.filter(function (o) { return READY_STATUSES.indexOf(o.status) >= 0; }).length;
    el.statPending.textContent   = String(pendingCount);
    el.statPreparing.textContent = String(preparingCount);
    el.statReady.textContent     = String(readyCount);
    el.statVisible.textContent   = String(visible.length);

    // Tab 高亮
    el.tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-kds-filter") === state.filter);
    });

    // 篩選
    var filtered = visible.filter(function (order) {
      if (state.filter === "all")       return true;
      if (state.filter === "pending")   return PENDING_STATUSES.indexOf(order.status) >= 0;
      if (state.filter === "preparing") return PREPARING_STATUSES.indexOf(order.status) >= 0;
      if (state.filter === "ready")     return READY_STATUSES.indexOf(order.status) >= 0;
      return order.status === state.filter;
    });

    if (!filtered.length) {
      var hint = state.filter === "all" ? "目前沒有待處理訂單" : "此分類目前沒有訂單";
      el.list.innerHTML = '<div class="empty-state">' + esc(hint) + '，畫面即時更新。</div>';
      return;
    }

    el.list.innerHTML = filtered.map(function (order) {
      return renderCard(order, visible);
    }).join("");
  }

  function renderCard(order, visible) {
    var helpers    = window.LeLeShanOrders;
    var meta       = helpers.statusMeta(order.status);
    var sourceTag  = SOURCE_LABELS[order.source] || "現場";
    var itemsGroups = order.groups && order.groups.length > 1 ? order.groups : null;
    var scheduled  = helpers.isFutureScheduled(order);
    var pickupStr  = order.scheduled_pickup_time
      ? (order.scheduled_pickup_date + " " + order.scheduled_pickup_time)
      : "未指定";
    var elapsed    = helpers.elapsedMinutes(order.created_at);
    var eta        = helpers.etaText(order, visible);

    // 取餐號碼
    var pickupNumHtml = order.pickupNumber
      ? '<div class="kds-pickup-num">' + esc(order.pickupNumber) + '</div>'
      : "";

    // source badge
    var sourceBadge = '<span class="kds-source kds-source--' + esc(order.source || "pos") + '">' + esc(sourceTag) + '</span>';

    // 預約標記
    var scheduledBadge = scheduled
      ? '<span class="tag-pill tag-pill--scheduled">預約單</span>'
      : "";

    // 動作按鈕
    var actions = (STATUS_ACTIONS[order.status] || []).map(function (act) {
      return '<button class="' + act.cls + '" type="button" ' +
        'data-order-id="' + esc(order.id) + '" ' +
        'data-next-status="' + esc(act.next) + '">' +
        esc(act.label) + '</button>';
    });
    actions.push(
      '<button class="danger-btn" type="button" ' +
      'data-cancel-order="true" data-order-id="' + esc(order.id) + '">取消</button>'
    );

    return [
      '<article class="order-card order-card--' + esc(meta.tone) + '">',
      '  <div class="order-card__head">',
      '    <div class="order-card__head-left">',
      pickupNumHtml,
      '      <h2>' + esc(order.customer_name || order.display_name || "顧客") + '</h2>',
      '      <div class="order-card__meta">' + sourceBadge + ' ' + scheduledBadge + '</div>',
      '    </div>',
      '    <div class="order-card__status-row">',
      '      <span class="status-pill status-pill--' + esc(meta.tone) + '">' + esc(meta.label) + '</span>',
      '    </div>',
      '  </div>',
      '  <div class="timeline">',
      '    <span>建立：' + esc(helpers.formatDateTime(order.created_at)) + '</span>',
      '    <span>等待：' + esc(String(elapsed)) + ' 分</span>',
      '    <span>預計：' + esc(eta) + '</span>',
      '  </div>',
      '  <div class="timeline">',
      '    <span>取餐：' + esc(pickupStr) + '</span>',
      '  </div>',
      itemsGroups
        ? itemsGroups.map(function (g, gIdx) {
            var displayLabel = "第" + (gIdx + 1) + "份";
            var gLines = (g.items || []).map(function (i) {
              var detail = [];
              if (i.flavor) detail.push(i.flavor);
              if (i.staple) detail.push("主食：" + i.staple);
              var suffix = detail.length ? "（" + detail.join("／") + "）" : "";
              return esc((i.name || "") + " x" + Number(i.qty || 0) + suffix);
            });
            return '  <div class="order-card__group-block">' +
              '<div class="order-card__group-label">' + esc(displayLabel) + '</div>' +
              '<ol class="order-card__items">' +
              gLines.map(function (line) { return '<li>' + line + '</li>'; }).join("") +
              '</ol>' +
              '</div>';
          }).join("\n")
        : '  <ol class="order-card__items">\n' +
          helpers.itemSummary(order.items, 8).map(function (line) { return '    <li>' + esc(line) + '</li>'; }).join("\n") +
          '\n  </ol>',
      '  <div class="order-card__note">備註：' + esc(order.note || "無") + '</div>',
      '  <div class="order-card__actions">' + actions.join("") + '</div>',
      '</article>'
    ].join("\n");
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
