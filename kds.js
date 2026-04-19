(function () {
  // ── 音效 ─────────────────────────────────────────────────────
  var _audioCtx = null;

  function getAudioContextSafe() {
    if (_audioCtx) return _audioCtx;
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      _audioCtx = new Ctor();
    } catch (_) { _audioCtx = null; }
    return _audioCtx;
  }

  var _beepLock = false;

  function playSingleBeep(ctx, startTime) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(950, startTime);
    gain.gain.setValueAtTime(0.25, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
    osc.start(startTime);
    osc.stop(startTime + 0.12);
  }

  function playNewOrderBeep() {
    if (_beepLock) return;
    _beepLock = true;
    setTimeout(function () { _beepLock = false; }, 1000);
    try {
      var ctx = getAudioContextSafe();
      if (!ctx) { _beepLock = false; return; }
      if (ctx.state === "suspended") ctx.resume();
      var now = ctx.currentTime;
      playSingleBeep(ctx, now);
      playSingleBeep(ctx, now + 0.2);
      playSingleBeep(ctx, now + 0.4);
    } catch (_) { _beepLock = false; }
  }

  var _readyBeepLock = false;

  function playOrderReadyBeep() {
    if (_readyBeepLock) return;
    _readyBeepLock = true;
    setTimeout(function () { _readyBeepLock = false; }, 1000);
    try {
      var ctx = getAudioContextSafe();
      if (!ctx) { _readyBeepLock = false; return; }
      if (ctx.state === "suspended") ctx.resume();
      var now = ctx.currentTime;
      var osc1  = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(600, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.start(now); osc1.stop(now + 0.25);

      var osc2  = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(600, now + 0.4);
      gain2.gain.setValueAtTime(0.3, now + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.start(now + 0.4); osc2.stop(now + 0.65);
    } catch (_) { _readyBeepLock = false; }
  }

  function showReadyToast(order) {
    try {
      var root = document.getElementById("kds-toast-root");
      if (!root) return;
      var name = (order && (order.customer_name || order.display_name)) || "";
      var text = name ? ("✔ 已完成：" + name) : "✔ 訂單已完成";
      var div = document.createElement("div");
      div.className = "kds-toast";
      div.textContent = text;
      root.appendChild(div);
      setTimeout(function () {
        div.classList.add("kds-toast--out");
        setTimeout(function () {
          if (div.parentNode) div.parentNode.removeChild(div);
        }, 300);
      }, 2000);
    } catch (_) {}
  }

  // ── 新訂單追蹤 ───────────────────────────────────────────────
  var hasBootstrappedOrderStream = false;
  var prevNewOrderIds = {};

  // ── 狀態分組定義 ────────────────────────────────────────────
  // KDS 顯示的狀態（normalized 後）
  var KDS_VISIBLE = ["new", "accepted", "preparing", "ready"];
  var PENDING_STATUSES   = ["pending_confirmation", "new", "accepted"];
  var PREPARING_STATUSES = ["preparing"];
  var READY_STATUSES     = ["ready"];

  // source → 顯示標籤
  var SOURCE_LABELS = {
    walk_in:   "現場",
    phone:     "電話",
    line:      "LINE",
    liff:      "LINE",
    pos:       "現場",
    manual:    "人工",
    ubereats:  "UberEats",
    foodpanda: "Foodpanda"
  };

  // ── 狀態機：每個狀態的按鈕動作 ──────────────────────────────
  var STATUS_ACTIONS = {
    pending_confirmation: [
      { label: "✓ 接單", next: "accepted", cls: "primary-btn" }
    ],
    new: [
      { label: "✓ 接單", next: "accepted", cls: "secondary-btn" },
      { label: "▶ 開始製作", next: "preparing", cls: "primary-btn" }
    ],
    accepted: [
      { label: "🔔 完成出餐", next: "ready", cls: "primary-btn" }
    ],
    preparing: [
      { label: "🔔 完成出餐", next: "ready", cls: "primary-btn" }
    ],
    ready: [
      { label: "✓ 已取餐", next: "completed", cls: "secondary-btn" }
    ]
  };

  var state = { storeId: "", orders: [], filter: "all", context: null, connectionState: "connected" };
  var el    = {};
  var itemCheckedState = {};
  var ITEM_CHECKED_STORAGE_KEY = "kds_item_checked";
  var cancelPressTimer = null;
  var cancelPressTarget = null;
  var cancelPressTriggered = false;
  var expandedCol = null; // null | "pending" | "work" | "ready"

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    loadCheckedState();
    bind();
    window.LeLeShanStaffAuth.init({
      loadingEl: el.loading,
      errorEl:   el.error,
      onReady:   start
    });
    // 每秒更新等待時間文字（不重渲整張卡，避免閃爍）
    setInterval(tickWaitBars, 1000);
  });

  function tickWaitBars() {
    if (!state.orders || !state.orders.length) return;
    var nodes = document.querySelectorAll(".kds-card[data-id]");
    nodes.forEach(function (card) {
      var oid = card.getAttribute("data-id");
      var o = null;
      for (var i = 0; i < state.orders.length; i++) {
        if (state.orders[i].id === oid) { o = state.orders[i]; break; }
      }
      if (!o) return;
      var bar = card.querySelector(".kds-card__wait-bar");
      if (!bar) return;
      var info = getWaitInfo(o);
      bar.textContent = info.text;
      bar.classList.remove("warn", "crit");
      if (info.cls) bar.classList.add(info.cls);
    });
  }


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
    el.connBanner   = document.getElementById("kds-conn-banner");
    el.list         = document.getElementById("kds-list");
    el.tabs         = Array.prototype.slice.call(document.querySelectorAll("[data-kds-filter]"));
    el.enableAudio  = document.getElementById("kds-enable-audio-btn");
  }

  function loadCheckedState() {
    try {
      var raw = localStorage.getItem(ITEM_CHECKED_STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        itemCheckedState = parsed;
      }
    } catch (_) {
      itemCheckedState = {};
    }
  }

  function saveCheckedState() {
    try {
      localStorage.setItem(ITEM_CHECKED_STORAGE_KEY, JSON.stringify(itemCheckedState));
    } catch (_) {}
  }

  function isItemChecked(key) {
    return !!itemCheckedState[String(key || "")];
  }

  function toggleItemChecked(key) {
    var normalized = String(key || "");
    if (!normalized) return;
    itemCheckedState[normalized] = !itemCheckedState[normalized];
    if (!itemCheckedState[normalized]) delete itemCheckedState[normalized];
    saveCheckedState();
  }

  function bind() {
    el.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.filter = tab.getAttribute("data-kds-filter");
        render();
      });
    });

    if (el.enableAudio) {
      el.enableAudio.addEventListener("click", function () {
        var ctx = getAudioContextSafe();
        if (ctx) {
          if (ctx.state === "suspended") ctx.resume();
          el.enableAudio.textContent = "🔔 提示音已啟用";
          el.enableAudio.classList.add("kds-audio-enabled");
          el.enableAudio.disabled = true;
        }
      });
    }

    // 點欄位 header → 切換展開／收合
    document.querySelectorAll(".kds-col__head").forEach(function (h) {
      h.addEventListener("click", function () {
        var col = h.closest(".kds-col");
        if (!col) return;
        var key = col.id.replace("kds-col-", "");
        expandedCol = (expandedCol === key) ? null : key;
        applyExpanded();
        render();
      });
    });

    // 點 compact 卡取餐號 → 展開該欄
    document.addEventListener("click", function (e) {
      var num = e.target.closest(".kds-card--compact .kds-card__number[data-expand]");
      if (!num) return;
      expandedCol = num.getAttribute("data-expand");
      applyExpanded();
      render();
    });
  }

  function applyExpanded() {
    var board = document.getElementById("kds-board");
    if (!board) return;
    var widths = {
      pending: "minmax(0, 1fr) 60px 60px",
      work:    "60px minmax(0, 1fr) 60px",
      ready:   "60px 60px minmax(0, 1fr)"
    };
    if (expandedCol) {
      board.setAttribute("data-expanded", expandedCol);
      board.style.setProperty("grid-template-columns", widths[expandedCol], "important");
    } else {
      board.removeAttribute("data-expanded");
      board.style.removeProperty("grid-template-columns");
    }
  }

  function clearCancelPressVisual(button) {
    if (!button) return;
    button.style.outline = "";
    button.style.outlineOffset = "";
  }

  function clearCancelPressState() {
    if (cancelPressTimer) {
      clearTimeout(cancelPressTimer);
      cancelPressTimer = null;
    }
    clearCancelPressVisual(cancelPressTarget);
    cancelPressTarget = null;
    cancelPressTriggered = false;
  }

  function showConnectionBanner(message, tone) {
    if (!el.connBanner) return;
    var banner = el.connBanner;
    var nextText = String(message || "").trim();
    var nextTone = String(tone || "").trim().toLowerCase();
    if (banner.textContent !== nextText) {
      banner.textContent = nextText;
    }
    banner.classList.remove("kds-conn-banner--warning", "kds-conn-banner--error", "kds-conn-banner--ok");
    if (nextTone) {
      banner.classList.add("kds-conn-banner--" + nextTone);
    }
    if (banner.hidden) {
      banner.hidden = false;
    }
  }

  function hideConnectionBanner() {
    if (!el.connBanner) return;
    el.connBanner.hidden = true;
    el.connBanner.classList.remove("kds-conn-banner--warning", "kds-conn-banner--error", "kds-conn-banner--ok");
    el.connBanner.textContent = "";
  }

  function setConnectionState(stateKey, message) {
    var key = String(stateKey || "connected");
    if (state.connectionState === key && !message) return;
    state.connectionState = key;
    var presets = {
      connected: { visible: false, tone: "ok", message: "" },
      cloud_disconnected: { visible: true, tone: "warning", message: "⚠ 連線中斷，資料可能未更新，請重新整理" },
      local_mode: { visible: true, tone: "ok", message: "目前使用本地模式" },
      offline_emergency: { visible: true, tone: "error", message: "離線緊急模式，資料可能不同步" }
    };
    var preset = presets[key] || presets.connected;
    var text = typeof message === "string" && message.trim() ? message.trim() : preset.message;
    if (!preset.visible) {
      hideConnectionBanner();
      return;
    }
    showConnectionBanner(text, preset.tone);
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
        if (state.connectionState !== "connected") {
          setConnectionState("connected");
        }
        state.orders = orders;
        if (el.lastUpdate) el.lastUpdate.textContent = "更新：" + new Date().toLocaleTimeString("zh-TW", { hour12: false });

        // 新訂單音效追蹤
        var currentNewIds = {};
        orders.forEach(function (o) {
          if (o.status === "new" || o.status === "pending_confirmation") currentNewIds[o.id] = true;
        });
        if (!hasBootstrappedOrderStream) {
          hasBootstrappedOrderStream = true;
          prevNewOrderIds = currentNewIds;
        } else {
          var hasNewEntry = false;
          Object.keys(currentNewIds).forEach(function (id) {
            if (!prevNewOrderIds[id]) hasNewEntry = true;
          });
          if (hasNewEntry) playNewOrderBeep();
          prevNewOrderIds = currentNewIds;
        }

        render();
      },
      onError: function (error) {
        setConnectionState("cloud_disconnected");
        handleError(error);
      }
    });

    el.list.addEventListener("click", function (event) {
      // Handle status-change buttons first
      var btn = event.target.closest("[data-next-status]");
      if (btn) {
        var _oid  = btn.getAttribute("data-order-id");
        var _next = btn.getAttribute("data-next-status");
        changeStatus(_oid, _next);
        if (_next === "ready") {
          playOrderReadyBeep();
          var _order = state.orders.filter(function (o) { return o.id === _oid; })[0] || null;
          showReadyToast(_order);
        }
        return;
      }
      // Item tap-to-check (only when not clicking a button)
      if (!event.target.closest("button")) {
        var itemEl = event.target.closest("[data-item-key]");
        if (itemEl) {
          var itemKey = itemEl.getAttribute("data-item-key") || "";
          if (itemKey) {
            toggleItemChecked(itemKey);
            render();
          }
        }
      }
    });

    el.list.addEventListener("pointerdown", function (event) {
      var cancelBtn = event.target.closest("[data-cancel-order]");
      if (!cancelBtn) return;
      clearCancelPressState();
      cancelPressTarget = cancelBtn;
      cancelPressTriggered = false;
      cancelBtn.style.outline = "2px solid rgba(239,68,68,.6)";
      cancelBtn.style.outlineOffset = "2px";
      if (typeof cancelBtn.setPointerCapture === "function") {
        try { cancelBtn.setPointerCapture(event.pointerId); } catch (_) {}
      }
      cancelPressTimer = setTimeout(function () {
        if (!cancelPressTarget) return;
        var orderId = cancelPressTarget.getAttribute("data-order-id");
        clearCancelPressVisual(cancelPressTarget);
        cancelPressTimer = null;
        cancelPressTriggered = true;
        cancelPressTarget = null;
        if (orderId) {
          changeStatus(orderId, "cancelled");
        }
      }, 1500);
    });

    function cancelHoldIfPending(event, strictTarget) {
      if (!cancelPressTarget) return;
      if (strictTarget) {
        var targetBtn = event.target.closest ? event.target.closest("[data-cancel-order]") : null;
        if (targetBtn !== cancelPressTarget) return;
      }
      clearCancelPressState();
    }

    el.list.addEventListener("pointerup", function (event) {
      cancelHoldIfPending(event, true);
    });

    el.list.addEventListener("pointercancel", function (event) {
      cancelHoldIfPending(event, false);
    });

    el.list.addEventListener("pointerleave", function (event) {
      if (!cancelPressTarget) return;
      if (event.target !== cancelPressTarget) return;
      clearCancelPressState();
    }, true);
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

    // ── 嚴格三欄分桶（直接走 state.orders，避免 KDS_VISIBLE 漏掉 pending_confirmation） ──
    var cols = { pending: [], work: [], ready: [] };
    state.orders.forEach(function (o) {
      if (o.status === "completed" || o.status === "cancelled" || o.status === "picked_up") return;
      if (o.status === "pending_confirmation") cols.pending.push(o);
      else if (o.status === "ready") cols.ready.push(o);
      else if (o.status === "accepted" || o.status === "preparing") cols.work.push(o);
      // 其他狀態（如 "new"）不顯示，避免誤入待確認欄
    });

    // 自診斷：印出本次 render 的真實資料來源（協助對照 Firestore）
    try {
      var statusCount = {};
      state.orders.forEach(function (o) {
        statusCount[o.status] = (statusCount[o.status] || 0) + 1;
      });
      console.log("[KDS] render snapshot", {
        storeId: state.storeId,
        totalOrders: state.orders.length,
        statusCount: statusCount,
        bucket: { pending: cols.pending.length, work: cols.work.length, ready: cols.ready.length },
        pendingPickupNumbers: cols.pending.map(function (o) { return o.pickupNumber || o.id; }),
        readyPickupNumbers: cols.ready.map(function (o) { return o.pickupNumber || o.id; })
      });
    } catch (_) {}

    // 同步舊 stats DOM（仍隱藏，但保持一致）
    var visibleTotal = cols.pending.length + cols.work.length + cols.ready.length;
    if (el.statPending)   el.statPending.textContent   = String(cols.pending.length);
    if (el.statPreparing) el.statPreparing.textContent = String(cols.work.length);
    if (el.statReady)     el.statReady.textContent     = String(cols.ready.length);
    if (el.statVisible)   el.statVisible.textContent   = String(visibleTotal);
    cols.pending.sort(function (a, b) {
      return helpers.toMillis(a.created_at) - helpers.toMillis(b.created_at);
    });
    cols.work.sort(function (a, b) {
      return (helpers.toMillis(a.started_at) || helpers.toMillis(a.created_at))
           - (helpers.toMillis(b.started_at) || helpers.toMillis(b.created_at));
    });
    cols.ready.sort(function (a, b) {
      return (helpers.toMillis(a.ready_at) || 0) - (helpers.toMillis(b.ready_at) || 0);
    });

    var emptyLabels = { pending: "無待確認", work: "無製作中", ready: "無可取餐" };
    ["pending", "work", "ready"].forEach(function (k) {
      var col  = document.getElementById("kds-col-" + k);
      var body = document.getElementById("kds-body-" + k);
      if (!body) return;

      // expanded / collapsed 狀態
      if (col) {
        col.classList.toggle("kds-is-expanded",  expandedCol === k);
        col.classList.toggle("kds-is-collapsed", expandedCol !== null && expandedCol !== k);
      }

      if (cols[k].length === 0) {
        if (col) col.classList.remove("kds-has-expanded-invoice");
        body.innerHTML = '<div class="kds-empty">' + esc(emptyLabels[k]) + '</div>';
      } else if (expandedCol === k) {
        // 展開欄：最多 4 張 invoice 式直長卡橫排
        if (col) col.classList.add("kds-has-expanded-invoice");
        var VISIBLE_N = 4;
        var visible = cols[k].slice(0, VISIBLE_N);
        var hiddenCount = cols[k].length - visible.length;
        body.innerHTML =
          '<div class="kds-col__invoice-stack">' +
            visible.map(function (o) { return renderCardInvoice(o); }).join("") +
          '</div>' +
          (hiddenCount > 0
            ? '<div class="kds-hidden-count">+' + hiddenCount + ' 張較新訂單隱藏中（展開欄僅顯示最老 4 張）</div>'
            : '');
      } else {
        // 其他欄（或全部未展開）：compact 卡
        if (col) col.classList.remove("kds-has-expanded-invoice");
        body.innerHTML = cols[k].map(function (o) { return renderCardCompact(o); }).join("");
      }

      var ct = document.getElementById("kds-ct-" + k);
      if (ct) ct.textContent = String(cols[k].length);
      var sb = document.getElementById("kds-sb-" + k.charAt(0));
      if (sb) sb.textContent = String(cols[k].length);
    });

    document.body.classList.toggle("kds-pending-mode", cols.pending.length > 0);
    var pendingCol = document.getElementById("kds-col-pending");
    if (pendingCol) pendingCol.classList.toggle("kds-active", cols.pending.length > 0);

    var workCol = document.getElementById("kds-col-work");
    if (workCol) {
      workCol.classList.remove("kds-overload", "kds-busy");
      if (cols.work.length >= 6) workCol.classList.add("kds-overload");
      else if (cols.work.length >= 4) workCol.classList.add("kds-busy");
    }
    var readyCol = document.getElementById("kds-col-ready");
    if (readyCol) readyCol.classList.toggle("kds-full", cols.ready.length >= 4);

    updateAlertStrip(cols.pending);
    updateOldestStat(cols.pending);
  }

  function updateAlertStrip(pendingList) {
    var helpers = window.LeLeShanOrders;
    var strip = document.getElementById("kds-alert-strip");
    if (!strip) return;
    if (!pendingList || pendingList.length === 0) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    var count = document.getElementById("kds-alert-count");
    var oldest = document.getElementById("kds-alert-oldest");
    var marquee = document.getElementById("kds-alert-marquee");
    if (count) count.textContent = pendingList.length + " 筆";
    if (oldest) {
      var mins = Math.floor((Date.now() - helpers.toMillis(pendingList[0].created_at)) / 60000);
      oldest.textContent = "最老 " + mins + " 分";
    }
    if (marquee) {
      marquee.textContent = pendingList.map(function (o) {
        return getPickupNumber(o) + " " + getCustomerName(o);
      }).join("  ·  ") + "    ····   ";
    }
  }

  function updateOldestStat(pendingList) {
    var helpers = window.LeLeShanOrders;
    var oldestEl = document.getElementById("kds-sb-oldest");
    if (!oldestEl) return;
    if (!pendingList || pendingList.length === 0) {
      oldestEl.textContent = "—";
      oldestEl.style.color = "var(--kds-muted)";
      return;
    }
    var mins = Math.floor((Date.now() - helpers.toMillis(pendingList[0].created_at)) / 60000);
    oldestEl.textContent = mins + " 分";
    oldestEl.style.color = mins >= 5 ? "var(--kds-pending)" : mins >= 3 ? "#f59e0b" : "var(--kds-text)";
  }

  // ── Group normalization ──────────────────────────────────────
  // Priority:
  //   1. order.groups (written by POS since 20260418)
  //   2. Reconstruct from items[].partId  (older orders)
  //   3. null → fallback flat list

  function normalizeGroups(order) {
    // 1. Use order.groups if it contains valid items
    if (Array.isArray(order.groups) && order.groups.length > 0) {
      var valid = order.groups.filter(function (g) {
        return Array.isArray(g.items) && g.items.length > 0;
      });
      if (valid.length > 0) return valid;
    }

    // 2. Reconstruct from item-level hints (LINE/front-end fallback-safe)
    var items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return null;

    function asText(value) {
      return String(value == null ? "" : value).trim();
    }

    function parsePositive(value) {
      var n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }

    function parseIndexFromPartId(partId) {
      var text = asText(partId);
      var match = text.match(/^part_(\d+)$/);
      return match ? parsePositive(match[1]) : 0;
    }

    function rebuildByHints(orderRef, itemList) {
      var sourceGroupMeta = {};
      var sourceGroupMetaByLabel = {};
      if (Array.isArray(orderRef.groups)) {
        orderRef.groups.forEach(function (g, idx) {
          if (!g) return;
          var gid = asText(g.id);
          var glabel = asText(g.label);
          var gindex = parsePositive(g.index) || (idx + 1);
          var meta = {
            id: gid || ("group_" + gindex),
            label: glabel || ("第" + gindex + "組"),
            index: gindex
          };
          if (gid) sourceGroupMeta[gid] = meta;
          if (glabel) sourceGroupMetaByLabel[glabel] = meta;
        });
      }

      var map = {};
      var orderKeys = [];
      var lineToGroup = {};
      var nextAutoIndex = 1;

      function ensureGroup(groupId, hint) {
        var key = asText(groupId);
        if (!key) key = "__auto_" + nextAutoIndex;
        if (!map[key]) {
          var meta = sourceGroupMeta[key] || null;
          var idx = parsePositive(hint && hint.groupIndex)
            || parsePositive(meta && meta.index)
            || parseIndexFromPartId(key)
            || nextAutoIndex;
          if (idx >= nextAutoIndex) nextAutoIndex = idx + 1;
          map[key] = {
            id: key,
            index: idx,
            label: asText(hint && hint.groupLabel) || asText(meta && meta.label) || ("第" + idx + "組"),
            flavor: "",
            staple: "",
            items: [],
            _order: orderKeys.length
          };
          orderKeys.push(key);
        }
        return map[key];
      }

      function collectHint(item, itemIndex) {
        var partId = asText(item.partId);
        var sourceGroupId = asText(item.sourceGroupId);
        var groupId = asText(item.groupId);
        var groupKey = asText(item.groupKey);
        var groupLabel = asText(item.sourceGroupLabel || item.partLabel || item.groupLabel || item.seatLabel || item.assignee);
        var lineId = asText(item.lineId || item.itemLineId);
        var parentLineId = asText(item.parentLineId || item.parentItemId || item.attachTo || item.bundleId);
        var groupIndex = parsePositive(item.partIndex)
          || parsePositive(item.sourceGroupIndex)
          || parsePositive(item.groupIndex)
          || parsePositive(item.personIndex)
          || parsePositive(item.seatIndex)
          || parseIndexFromPartId(partId);
        var explicitKey = sourceGroupId || partId || groupId || groupKey;
        if (!explicitKey && groupLabel && sourceGroupMetaByLabel[groupLabel]) {
          explicitKey = sourceGroupMetaByLabel[groupLabel].id;
        }
        if (!groupIndex && explicitKey && sourceGroupMeta[explicitKey]) {
          groupIndex = parsePositive(sourceGroupMeta[explicitKey].index);
        }
        return {
          explicitKey: explicitKey,
          groupIndex: groupIndex,
          groupLabel: groupLabel,
          lineId: lineId,
          parentLineId: parentLineId,
          flavor: asText(item.flavor || item.selectedFlavor),
          staple: asText(item.staple || item.selectedStaple),
          itemIndex: itemIndex
        };
      }

      function assign(item, hint, groupId) {
        var group = ensureGroup(groupId, hint);
        var isSet = item.posType === "set" || item.type === "set";
        var itemFlavor = asText(item.flavor || item.selectedFlavor || hint.flavor);
        var itemStaple = asText(item.staple || item.selectedStaple || hint.staple);
        if (isSet) {
          if (!group.flavor && itemFlavor) group.flavor = itemFlavor;
          if (!group.staple && itemStaple) group.staple = itemStaple;
        } else if (!group.flavor && itemFlavor) {
          group.flavor = itemFlavor;
        }
        group.items.push(item);
        if (hint.lineId) lineToGroup[hint.lineId] = group.id;
      }

      var unresolved = [];
      itemList.forEach(function (item, itemIndex) {
        var hint = collectHint(item, itemIndex);
        if (hint.explicitKey) {
          assign(item, hint, hint.explicitKey);
          return;
        }
        if (hint.groupIndex) {
          assign(item, hint, "__idx_" + hint.groupIndex);
          return;
        }
        unresolved.push({ item: item, hint: hint });
      });

      var unresolved2 = [];
      unresolved.forEach(function (entry) {
        var parentGroupId = entry.hint.parentLineId ? lineToGroup[entry.hint.parentLineId] : "";
        if (parentGroupId) {
          assign(entry.item, entry.hint, parentGroupId);
          return;
        }
        unresolved2.push(entry);
      });

      var unresolved3 = [];
      unresolved2.forEach(function (entry) {
        if (!entry.hint.flavor) {
          unresolved3.push(entry);
          return;
        }
        var candidates = orderKeys.filter(function (gid) {
          return asText(map[gid] && map[gid].flavor) === entry.hint.flavor;
        });
        if (candidates.length === 1) {
          assign(entry.item, entry.hint, candidates[0]);
          return;
        }
        unresolved3.push(entry);
      });

      // Stable fallback: never push unresolved items into first group by default.
      unresolved3.forEach(function (entry) {
        var fallbackKey = entry.hint.flavor
          ? "__fallback_flavor_" + entry.hint.flavor
          : "__fallback_unassigned";
        assign(entry.item, entry.hint, fallbackKey);
      });

      var grouped = orderKeys.sort(function (a, b) {
        var ga = map[a] || {};
        var gb = map[b] || {};
        if ((ga.index || 0) !== (gb.index || 0)) return (ga.index || 0) - (gb.index || 0);
        return (ga._order || 0) - (gb._order || 0);
      }).map(function (key) {
        var g = map[key];
        return {
          id: g.id,
          index: g.index,
          label: g.label,
          flavor: g.flavor,
          staple: g.staple,
          items: g.items
        };
      });
      return grouped.length ? grouped : null;
    }

    var hintedGroups = rebuildByHints(order, items);
    if (hintedGroups) return hintedGroups;

    var hasPartInfo = items.some(function (i) { return i.partId; });
    if (!hasPartInfo) return null;

    var groupMap = {};
    var groupOrder = [];
    items.forEach(function (item) {
      var pid = item.partId || "part_1";
      if (!groupMap[pid]) {
        var idx = Number(String(pid).replace(/^part_/, "") || 1) || 1;
        groupMap[pid] = {
          id: pid, index: idx,
          label: item.partLabel || ("第" + idx + "組"),
          flavor: "", staple: "", items: []
        };
        groupOrder.push(pid);
      }
      var g = groupMap[pid];
      // Set items set the group flavor/staple
      var isSet = item.posType === "set" || item.type === "set";
      var itemFlavor = (item.flavor || item.selectedFlavor || "").trim();
      var itemStaple = (item.staple || item.selectedStaple || "").trim();
      if (isSet) {
        if (!g.flavor && itemFlavor) g.flavor = itemFlavor;
        if (!g.staple && itemStaple) g.staple = itemStaple;
      } else {
        if (!g.flavor && itemFlavor) g.flavor = itemFlavor;
      }
      g.items.push(item);
    });

    var result = groupOrder.sort(function (a, b) {
      return (groupMap[a].index || 0) - (groupMap[b].index || 0);
    }).map(function (pid) { return groupMap[pid]; });
    return result.length > 0 ? result : null;
  }

  function buildGroupHeader(group) {
    var label = group.label || ("第" + (group.index || 1) + "組");
    var flavor = (group.flavor || "").trim();
    var parts = [label];
    if (flavor) parts.push(flavor);
    return parts.join("｜");
  }

  function toOrdinalGroupLabel(index) {
    var n = Number(index);
    if (!Number.isFinite(n) || n <= 0) n = 1;
    n = Math.floor(n);
    var zh = {
      1: "一",
      2: "二",
      3: "三",
      4: "四",
      5: "五",
      6: "六",
      7: "七",
      8: "八",
      9: "九",
      10: "十"
    };
    return "第" + (zh[n] || String(n)) + "組";
  }

  function deriveGroupDisplayIndex(group, fallbackIndex) {
    var direct = Number(group && group.index);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

    var label = String(group && group.label || "").trim();
    if (label) {
      var mDigit = label.match(/^第\s*(\d+)\s*[組份点點]?$/);
      if (mDigit) return Number(mDigit[1]) || 1;

      var zhMap = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
      var mZh = label.match(/^第\s*([一二三四五六七八九十])\s*[組份点點]?$/);
      if (mZh && zhMap[mZh[1]]) return zhMap[mZh[1]];

      var mABC = label.match(/^([A-Ca-c])[點点]?$/);
      if (mABC) return mABC[1].toUpperCase().charCodeAt(0) - 64;
    }

    var id = String(group && group.id || "").trim();
    if (id) {
      var mPart = id.match(/^part_(\d+)$/);
      if (mPart) return Number(mPart[1]) || 1;

      var mGa = id.match(/^g-([a-z])$/i);
      if (mGa) return mGa[1].toUpperCase().charCodeAt(0) - 64;
    }

    var fb = Number(fallbackIndex);
    if (Number.isFinite(fb) && fb > 0) return Math.floor(fb);
    return 1;
  }

  function buildGroupHeader(group, fallbackIndex) {
    var label = toOrdinalGroupLabel(deriveGroupDisplayIndex(group, fallbackIndex));
    var flavor = (group.flavor || "").trim();
    var parts = [label];
    if (flavor) parts.push(flavor);
    return parts.join("｜");
  }

  function buildGroupItemLine(item, group) {
    var groupFlavor = (group.flavor || "").trim();
    var groupHasSet = (group.items || []).some(function (i) {
      return i.posType === "set" || i.type === "set";
    });
    var groupStaple = (group.staple || "").trim();
    var itemFlavor  = (item.flavor || item.selectedFlavor || "").trim();
    var itemStaple  = (item.staple || item.selectedStaple || "").trim();
    var itemIsSet   = item.posType === "set" || item.type === "set";
    var note        = (item.item_note || item.note || "").trim();

    var extras = [];
    // Only show flavor if it differs from the group-level flavor
    if (itemFlavor && itemFlavor !== groupFlavor) extras.push(itemFlavor);
    // Set staple should be shown on the set item line, not in group header.
    if (itemStaple && (itemIsSet || !(groupHasSet && itemStaple === groupStaple))) {
      extras.push("主食：" + itemStaple);
    }
    // Always show item-specific notes
    if (note) extras.push(note);

    var suffix = extras.length ? "（" + extras.join("、") + "）" : "";
    return esc(String(item.name || "") + " x" + Number(item.qty || 1) + suffix);
  }

  // ── P2-A: KDS v3 卡片渲染 ─────────────────────────────────────
  function getPickupNumber(order) {
    if (order.pickupNumber) return String(order.pickupNumber);
    if (order.queue_number) return "#" + String(order.queue_number);
    if (order.display_code) return String(order.display_code);
    return String(order.id || "—").slice(-4).toUpperCase();
  }

  function getCustomerName(order) {
    return String(order.customer_name || order.display_name || order.label || "—");
  }

  function getSourceCode(order) {
    var s = String(order.source || "").toLowerCase();
    if (s === "liff" || s === "line") return "line";
    if (s === "phone") return "phone";
    return "pos";
  }

  function getSourceLabel(order) {
    var c = getSourceCode(order);
    return c === "line" ? "LINE" : c === "phone" ? "電話" : "現場";
  }

  function getNoteText(order) {
    return String(order.note || "").trim();
  }

  function getPickupTimeStr(order) {
    var helpers = window.LeLeShanOrders;
    if (order.scheduled_pickup_time) return String(order.scheduled_pickup_time) + " 取";
    var d = helpers.toDate(order.scheduled_pickup_at);
    if (d) {
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + " 取";
    }
    return "";
  }

  function getWaitInfo(order) {
    var helpers = window.LeLeShanOrders;
    var ms = helpers.toMillis(order.created_at);
    if (!ms) return { cls: "", text: "—" };
    var secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    var mins = Math.floor(secs / 60);
    var text = mins + ":" + String(secs % 60).padStart(2, "0");
    var cls = "";
    if (order.status === "pending_confirmation" || order.status === "new") {
      if (mins >= 5) cls = "crit";
      else if (mins >= 3) cls = "warn";
    } else if (order.status === "preparing") {
      if (mins >= 20) cls = "crit";
      else if (mins >= 12) cls = "warn";
    }
    return { cls: cls, text: text };
  }

  function collectAllItemKeys(order, groups) {
    var keys = [];
    if (groups && groups.length) {
      groups.forEach(function (g) {
        (g.items || []).forEach(function (_, ii) {
          keys.push(String(order.id || "") + "_" + String(g.index || 0) + "_" + String(ii));
        });
      });
    } else {
      (order.items || []).forEach(function (_, ii) {
        keys.push(String(order.id || "") + "_" + String(ii));
      });
    }
    return keys;
  }

  var GROUP_BADGE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

  function renderCard(order /* , visible */) {
    var helpers    = window.LeLeShanOrders;
    var status     = order.status;
    var isPending  = status === "pending_confirmation" || status === "new";
    var groups     = isPending ? [] : normalizeGroups(order);
    var allKeys    = collectAllItemKeys(order, groups);
    var allChecked = allKeys.length > 0 && allKeys.every(function (k) { return isItemChecked(k); });
    var wait       = getWaitInfo(order);
    var elapsedMin = Math.floor((Date.now() - helpers.toMillis(order.created_at)) / 60000);

    var statusKey = isPending ? "pending"
      : status === "ready" ? "ready"
      : status === "preparing" ? "preparing"
      : "accepted";

    var cls = "kds-card kds-card--" + statusKey;
    if (status === "preparing" && allChecked) cls += " all-checked";
    if (isPending && elapsedMin >= 8) cls += " kds-critical";

    // CTA
    var primary = (STATUS_ACTIONS[status] || [])[0] || null;
    var ctaHtml = "";
    if (primary) {
      var ctaClass = "";
      if (primary.next === "accepted") ctaClass = "accept";
      else if (primary.next === "ready") ctaClass = "ready" + (allChecked ? " armed" : "");
      else if (primary.next === "completed") ctaClass = "pickup";
      ctaHtml = '<button class="kds-btn kds-btn--main ' + ctaClass + '" type="button" ' +
        'data-order-id="' + esc(order.id) + '" ' +
        'data-next-status="' + esc(primary.next) + '">' +
        esc(primary.label) + '</button>';
    } else {
      ctaHtml = '<button class="kds-btn kds-btn--main pickup" type="button" disabled style="opacity:0.5">—</button>';
    }

    // 來源 badge（pending 不顯示預約）
    var srcCode = getSourceCode(order);
    var srcHtml = '<span class="kds-src kds-src--' + esc(srcCode) + '">' + esc(getSourceLabel(order)) + '</span>';
    if (!isPending && helpers.isFutureScheduled(order)) {
      srcHtml += '<span class="kds-src kds-src--reserve">預約</span>';
    }

    // body：pending 顯示金額；製作/完成 顯示品項
    var bodyHtml = "";
    if (isPending) {
      var total = Number(order.total || 0);
      bodyHtml = '<div class="kds-card__amount">$ ' + total.toLocaleString() + '</div>';
    } else if (groups && groups.length) {
      bodyHtml = groups.map(function (g, gi) {
        var badge = GROUP_BADGE_LABELS[gi] || String(gi + 1);
        var totalQty = (g.items || []).reduce(function (n, i) { return n + Number(i.qty || 0); }, 0);
        var flavor = String(g.flavor || "").trim();
        var itemsHtml = (g.items || []).map(function (item, ii) {
          var key = String(order.id || "") + "_" + String(g.index || 0) + "_" + String(ii);
          var checked = isItemChecked(key);
          var staple = String(item.staple || item.selectedStaple || "").trim();
          var noteItem = String(item.item_note || item.note || "").trim();
          var subParts = [];
          if (staple) subParts.push("主食：" + staple);
          if (noteItem) subParts.push(noteItem);
          var subHtml = subParts.length ? '<span class="sub">' + esc(subParts.join("、")) + '</span>' : "";
          return '<li class="' + (checked ? "done" : "") + '" data-item-key="' + esc(key) + '">' +
            '<span>' + esc(item.name || "") + '</span>' +
            '<span class="qty">×' + esc(String(Number(item.qty || 1))) + '</span>' +
            subHtml +
            '</li>';
        }).join("");
        return '<div class="kds-group">' +
          '<div class="kds-group__head">' +
            '<span class="kds-group__badge">' + esc(badge) + '</span>' +
            '<span class="kds-group__flavor">' + esc(flavor || "—") + '</span>' +
            '<span class="kds-group__count">' + esc(String(totalQty)) + ' 項</span>' +
          '</div>' +
          '<ul class="kds-items">' + itemsHtml + '</ul>' +
          '</div>';
      }).join("");
    } else {
      var flatItems = Array.isArray(order.items) ? order.items : [];
      var flatHtml = flatItems.map(function (item, ii) {
        var key = String(order.id || "") + "_" + String(ii);
        var checked = isItemChecked(key);
        return '<li class="kds-item' + (checked ? " done" : "") + '" data-item-key="' + esc(key) + '">' +
          '<span>' + esc(item.name || "") + '</span>' +
          '<span class="qty">×' + esc(String(Number(item.qty || 1))) + '</span>' +
          '</li>';
      }).join("");
      bodyHtml = '<div class="kds-group"><ul class="kds-items">' + flatHtml + '</ul></div>';
    }

    var note = getNoteText(order);

    return '<article class="' + cls + '" data-id="' + esc(order.id) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '">' + esc(wait.text) + '</div>' +
        '<div class="kds-card__number">' + esc(getPickupNumber(order)) + '</div>' +
      '</div>' +
      '<div class="kds-card__meta">' +
        '<span class="kds-card__name">' + esc(getCustomerName(order)) + '</span>' +
        srcHtml +
      '</div>' +
      '<div class="kds-card__body">' + bodyHtml + '</div>' +
      (note ? '<div class="kds-note">' + esc(note) + '</div>' : '') +
      '<div class="kds-card__cta">' +
        ctaHtml +
        '<button class="kds-btn kds-btn--sub" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">✕</button>' +
      '</div>' +
      '</article>';
  }

  function renderCardInvoice(order) {
    var helpers    = window.LeLeShanOrders;
    var status     = order.status;
    var isPending  = status === "pending_confirmation" || status === "new";
    var groups     = normalizeGroups(order);
    var allKeys    = collectAllItemKeys(order, groups);
    var allChecked = allKeys.length > 0 && allKeys.every(function (k) { return isItemChecked(k); });
    var wait       = getWaitInfo(order);
    var elapsedMin = Math.floor((Date.now() - helpers.toMillis(order.created_at)) / 60000);

    var statusKey = isPending ? "pending"
      : status === "ready" ? "ready"
      : status === "preparing" ? "preparing"
      : "accepted";

    var cls = "kds-card kds-card--invoice kds-card--" + statusKey;
    if (status === "preparing" && allChecked) cls += " all-checked";
    if (isPending && elapsedMin >= 8) cls += " kds-critical";

    var primary = (STATUS_ACTIONS[status] || [])[0] || null;
    var ctaHtml = "";
    if (primary) {
      var ctaClass = "";
      if (primary.next === "accepted") ctaClass = "accept";
      else if (primary.next === "ready") ctaClass = "ready" + (allChecked ? " armed" : "");
      else if (primary.next === "completed") ctaClass = "pickup";
      ctaHtml = '<button class="kds-btn kds-btn--main ' + ctaClass + '" type="button" ' +
        'data-order-id="' + esc(order.id) + '" ' +
        'data-next-status="' + esc(primary.next) + '">' +
        esc(primary.label) + '</button>';
    } else {
      ctaHtml = '<button class="kds-btn kds-btn--main pickup" type="button" disabled style="opacity:0.5">—</button>';
    }

    var srcCode = getSourceCode(order);
    var srcHtml = '<span class="kds-src kds-src--' + esc(srcCode) + '">' + esc(getSourceLabel(order)) + '</span>';
    if (!isPending && helpers.isFutureScheduled(order)) {
      srcHtml += '<span class="kds-src kds-src--reserve">預約</span>';
    }

    // invoice 模式永遠顯示完整品項
    var bodyHtml = "";
    if (groups && groups.length) {
      bodyHtml = groups.map(function (g, gi) {
        var badge = GROUP_BADGE_LABELS[gi] || String(gi + 1);
        var totalQty = (g.items || []).reduce(function (n, i) { return n + Number(i.qty || 0); }, 0);
        var flavor = String(g.flavor || "").trim();
        var itemsHtml = (g.items || []).map(function (item, ii) {
          var key = String(order.id || "") + "_" + String(g.index || 0) + "_" + String(ii);
          var checked = isItemChecked(key);
          var staple = String(item.staple || item.selectedStaple || "").trim();
          var noteItem = String(item.item_note || item.note || "").trim();
          var subParts = [];
          if (staple) subParts.push("主食：" + staple);
          if (noteItem) subParts.push(noteItem);
          var subHtml = subParts.length ? '<span class="sub">' + esc(subParts.join("、")) + '</span>' : "";
          return '<li class="' + (checked ? "done" : "") + '" data-item-key="' + esc(key) + '">' +
            '<span>' + esc(item.name || "") + '</span>' +
            '<span class="qty">×' + esc(String(Number(item.qty || 1))) + '</span>' +
            subHtml + '</li>';
        }).join("");
        return '<div class="kds-group">' +
          '<div class="kds-group__head">' +
            '<span class="kds-group__badge">' + esc(badge) + '</span>' +
            '<span class="kds-group__flavor">' + esc(flavor || "—") + '</span>' +
            '<span class="kds-group__count">' + esc(String(totalQty)) + ' 項</span>' +
          '</div>' +
          '<ul class="kds-items">' + itemsHtml + '</ul>' +
          '</div>';
      }).join("");
    } else {
      var flatItems = Array.isArray(order.items) ? order.items : [];
      var flatHtml = flatItems.map(function (item, ii) {
        var key = String(order.id || "") + "_" + String(ii);
        var checked = isItemChecked(key);
        return '<li class="kds-item' + (checked ? " done" : "") + '" data-item-key="' + esc(key) + '">' +
          '<span>' + esc(item.name || "") + '</span>' +
          '<span class="qty">×' + esc(String(Number(item.qty || 1))) + '</span>' +
          '</li>';
      }).join("");
      bodyHtml = '<div class="kds-group"><ul class="kds-items">' + flatHtml + '</ul></div>';
    }

    var note = getNoteText(order);

    return '<article class="' + cls + '" data-id="' + esc(order.id) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '">' + esc(wait.text) + '</div>' +
        '<div class="kds-card__number">' + esc(getPickupNumber(order)) + '</div>' +
      '</div>' +
      '<div class="kds-card__meta">' +
        srcHtml +
        '<span class="kds-card__name">' + esc(getCustomerName(order)) + '</span>' +
      '</div>' +
      '<div class="kds-card__body">' + bodyHtml + '</div>' +
      (note ? '<div class="kds-note">' + esc(note) + '</div>' : '') +
      '<div class="kds-card__cta">' +
        ctaHtml +
        '<button class="kds-btn kds-btn--sub" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">✕</button>' +
      '</div>' +
      '</article>';
  }

  function renderCardCompact(order) {
    var status    = order.status;
    var isPending = status === "pending_confirmation" || status === "new";
    var statusKey = isPending ? "pending"
      : status === "ready" ? "ready"
      : status === "preparing" ? "preparing" : "accepted";
    var wait    = getWaitInfo(order);
    var total   = Number(order.total || 0);
    var primary = (STATUS_ACTIONS[status] || [])[0] || null;

    var ctaClass = "";
    if (primary) {
      if (primary.next === "accepted")       ctaClass = "accept";
      else if (primary.next === "ready")     ctaClass = "ready";
      else if (primary.next === "completed") ctaClass = "pickup";
    }

    var ctaHtml = primary
      ? '<button class="kds-btn kds-btn--main ' + ctaClass + '" type="button" ' +
          'data-order-id="' + esc(order.id) + '" ' +
          'data-next-status="' + esc(primary.next) + '">' + esc(primary.label) + '</button>'
      : '<button class="kds-btn kds-btn--main pickup" type="button" disabled style="opacity:0.5">—</button>';

    return '<article class="kds-card kds-card--compact kds-card--' + statusKey + '" data-id="' + esc(order.id) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '">' + esc(wait.text) + '</div>' +
        '<div class="kds-card__number" data-expand="' + statusKey + '">' + esc(getPickupNumber(order)) + '</div>' +
      '</div>' +
      '<div class="kds-card__meta kds-card__meta--compact">' +
        '<span class="kds-src kds-src--' + esc(getSourceCode(order)) + '">' + esc(getSourceLabel(order)) + '</span>' +
        '<span class="kds-card__name">' + esc(getCustomerName(order)) + '</span>' +
      '</div>' +
      '<div class="kds-card__amount">$ ' + total.toLocaleString() + '</div>' +
      '<div class="kds-card__cta">' + ctaHtml +
        '<button class="kds-btn kds-btn--sub" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">✕</button>' +
      '</div>' +
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
