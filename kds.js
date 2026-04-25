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

  // ── 音效開關 ─────────────────────────────────────────────────
  var audioUnlocked = false;

  function isSoundEnabled() {
    return localStorage.getItem("kds_sound") !== "off";
  }

  function toggleSound() {
    var next = isSoundEnabled() ? "off" : "on";
    localStorage.setItem("kds_sound", next);
    updateSoundUI();
  }

  function updateSoundUI() {
    var btn = document.getElementById("kds-sound-toggle");
    if (!btn) return;
    btn.textContent = isSoundEnabled() ? "🔊" : "🔇";
  }

  // ── 音效：snapshot diff helpers ──────────────────────────────
  var hasInitializedSoundBaseline = false;
  var previousOrderMap = new Map();

  function buildOrderMap(orders) {
    var map = new Map();
    orders.forEach(function (o) { map.set(String(o.id), o); });
    return map;
  }

  function getNewlyAppearedOrders(currentOrders, prevMap) {
    return currentOrders.filter(function (o) { return !prevMap.has(String(o.id)); });
  }

  function isOnlineOrderSource(source) {
    var v = String(source || "").trim().toLowerCase();
    return ["line_order", "line", "liff", "online", "line-liff", "line_liff"].indexOf(v) >= 0;
  }

  function isNewAcceptedOrder(order) {
    var v = String(order.status || "").trim().toLowerCase();
    return v === "accepted" && isOnlineOrderSource(order.source);
  }

  // ── 製作中逾時音效（單一音軌）────────────────────────────────
  var BELL_CYCLE_MS    = 10000;   // ring loop interval: 10s
  var workAlertMap    = new Map(); // orderId → { alerted5, alerted10, ringing }
  var globalRingHandle = null;    // 全局唯一 ring loop handle

  function startGlobalRing() {
    if (globalRingHandle && globalRingHandle.active) return;
    var handle = { active: true };
    globalRingHandle = handle;
    console.log("[KDS_WORK] global ring ON");
    (function ring() {
      if (!handle.active) return;
      if (isSoundEnabled()) {
        try { playNewOrderBell(); } catch (e) {}
      }
      setTimeout(ring, BELL_CYCLE_MS);
    })();
  }

  function stopGlobalRing() {
    if (!globalRingHandle) return;
    globalRingHandle.active = false;
    globalRingHandle = null;
    console.log("[KDS_WORK] global ring OFF");
  }

  function syncGlobalRing() {
    var anyRinging = false;
    workAlertMap.forEach(function (rec) { if (rec.ringing) anyRinging = true; });
    anyRinging ? startGlobalRing() : stopGlobalRing();
  }

  // 逾時聲響規則（以 pickupAt 為基準）：
  //   - 剛進入 overdue：短鳴 10 秒 burst
  //   - overdue 持續 >= overdueAlertAfterMinutes（預設 3）：持續鳴響，直到訂單離開製作中

  function tickWorkOrderAlerts() {
    if (!state.orders || !state.orders.length) {
      workAlertMap.clear();
      syncGlobalRing();
      return;
    }
    var helpers = window.LeLeShanOrders;
    var nowMs = Date.now();
    var env = buildTimingEnv();
    var workOrders = state.orders.filter(function (o) {
      return o.status === "accepted" || o.status === "preparing";
    });
    var activeIds = new Set(workOrders.map(function (o) { return String(o.id); }));

    workAlertMap.forEach(function (_, id) {
      if (!activeIds.has(id)) workAlertMap.delete(id);
    });

    workOrders.forEach(function (order) {
      var id = String(order.id);
      var meta = helpers.getKdsTimingMeta(order, nowMs, { queueInfo: env.queueInfo }, env.rules);
      if (!workAlertMap.has(id)) {
        workAlertMap.set(id, { alertedEnter: false, alertedSustain: false, ringing: false });
      }
      var rec = workAlertMap.get(id);

      if (meta.statusPhase !== "overdue") {
        // 還沒逾時：不響（即使是 should_start 或 waiting_to_start）
        if (rec.ringing) {
          rec.ringing = false;
          console.log("[KDS_ALERT] ring off (phase=" + meta.statusPhase + ")", id);
        }
        return;
      }

      // 已逾時
      var sustainThreshold = Number(env.rules && env.rules.overdueAlertAfterMinutes);
      if (!Number.isFinite(sustainThreshold) || sustainThreshold < 1) sustainThreshold = 3;
      if (meta.overdueMinutes >= sustainThreshold && !rec.alertedSustain) {
        rec.alertedSustain = true;
        rec.ringing = true;
        console.log("[KDS_ALERT] overdue sustained", id, meta.overdueMinutes + "min");
      } else if (!rec.alertedEnter) {
        rec.alertedEnter = true;
        rec.ringing = true;
        console.log("[KDS_ALERT] overdue enter", id, meta.overdueMinutes + "min");
        setTimeout(function () {
          var cur = workAlertMap.get(id);
          if (cur && !cur.alertedSustain) {
            cur.ringing = false;
            syncGlobalRing();
            console.log("[KDS_ALERT] overdue burst ended", id);
          }
        }, 10000);
      }
    });

    syncGlobalRing();
  }

  // ── 狀態分組定義 ────────────────────────────────────────────
  var KDS_VISIBLE        = ["accepted", "preparing", "ready"];
  var PREPARING_STATUSES = ["preparing"];
  var READY_STATUSES     = ["ready"];

  // source 標籤：改呼叫 window.LeLeShanOrders.sourceLabel(src, { short: true })
  //   若日後 KDS 需要顯示 source chip，一律走此 helper，不要在本檔再定義表。

  // ── 狀態機：每個狀態的按鈕動作 ──────────────────────────────
  var STATUS_ACTIONS = {
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

  var state = { storeId: "", orders: [], filter: "all", context: null, connectionState: "connected", station: "boil", currentSession: null, sessionUnsub: null, settings: null, settingsUnsub: null };
  // 本分頁 session 內已嘗試鎖定過的 orderId，避免重複觸發 transaction
  var lockAttemptIds = new Set();

  // ── Hub 輪詢 ─────────────────────────────────────────────────
  var HUB_URL = window.LELESHAN_HUB_URL || 'http://100.72.80.2:8080';
  var POLL_INTERVAL = 3000;
  var pollTimer = null;

  function resolveStationFromQuery() {
    var qs = new URLSearchParams(window.location.search);
    var raw = String(qs.get("kds") || "").toLowerCase();
    return raw === "pack" ? "pack" : "boil";
  }

  function stationLabel(station) {
    return station === "pack" ? "包裝站" : "烹煮站";
  }
  var el    = {};
  var itemCheckedState = {};
  var ITEM_CHECKED_STORAGE_KEY = "kds_item_checked";
  var expandedCol = null; // null | "work" | "ready"

  document.addEventListener("DOMContentLoaded", function () {
    cache();
    loadCheckedState();
    bind();
    var soundBtn = document.getElementById("kds-sound-toggle");
    if (soundBtn) {
      soundBtn.onclick = toggleSound;
      updateSoundUI();
    }
    bindCancelModal();
    window.LeLeShanStaffAuth.init({
      loadingEl: el.loading,
      errorEl:   el.error,
      onReady:   start
    });
    setInterval(tickWaitBars, 1000);
    setInterval(tickWorkOrderAlerts, 10000);
  });

  // ── Phase 導向警示 helpers ───────────────────────────────────
  var _overdueActiveIds = new Set();

  function isActiveWorkStatus(status) {
    var st = String(status || "").toLowerCase();
    return st === "accepted" || st === "preparing" || st === "pending_confirmation" || st === "new";
  }

  function getOrderPhase(order, nowMs, env) {
    if (!order) return null;
    var helpers = window.LeLeShanOrders;
    env = env || buildTimingEnv();
    return helpers.getKdsTimingMeta(order, nowMs, { queueInfo: env.queueInfo }, env.rules).statusPhase;
  }

  function tickWaitBars() {
    if (!state.orders || !state.orders.length) return;
    var nowMs = Date.now();
    var env = buildTimingEnv();
    var nodes = document.querySelectorAll(".kds-card[data-id]");
    nodes.forEach(function (card) {
      var oid = card.getAttribute("data-id");
      var o = null;
      for (var i = 0; i < state.orders.length; i++) {
        if (state.orders[i].id === oid) { o = state.orders[i]; break; }
      }
      if (!o) return;

      // 時間狀態區：主/次文案
      var bar = card.querySelector(".kds-card__wait-bar");
      if (bar) {
        var info = getWaitInfo(o, nowMs, env);
        var primaryEl = bar.querySelector(".kds-card__wait-primary");
        var secondaryEl = bar.querySelector(".kds-card__wait-secondary");
        if (primaryEl) primaryEl.textContent = info.text;
        else bar.textContent = info.text;
        if (secondaryEl) secondaryEl.textContent = info.secondary || "";
        bar.classList.remove("wait", "warn", "crit");
        bar.classList.add(info.cls || "wait");
        bar.setAttribute("data-phase", info.phase || "");
      }

      var isActive = isActiveWorkStatus(o.status);
      var phase = getOrderPhase(o, nowMs, env);

      // 紅色 breathing 只在真正逾時且訂單仍在製作中 / 待開做
      var overdue = isActive && phase === "overdue";
      if (overdue && !_overdueActiveIds.has(o.id)) {
        _overdueActiveIds.add(o.id);
        console.log("[KDS_ALERT] overdue on", { id: o.id, status: o.status });
      } else if (!overdue && _overdueActiveIds.has(o.id)) {
        _overdueActiveIds.delete(o.id);
        console.log("[KDS_ALERT] overdue off", { id: o.id, status: o.status });
      }
      card.classList.toggle("kds-card--overdue", overdue);
      // 舊 class 保留相容；新邏輯下不再啟用
      card.classList.remove("kds-card--late-work", "kds-card--alert-breathe");
      card.setAttribute("data-phase", phase || "");
    });
  }


  function cache() {
    el.loading    = document.getElementById("auth-loading");
    el.error      = document.getElementById("auth-error");
    el.storeMeta  = document.getElementById("ops-store-meta");
    el.userMeta   = document.getElementById("ops-user-meta");
    el.lastUpdate = document.getElementById("kds-last-update");
    el.connBanner = document.getElementById("kds-conn-banner");
    el.list       = document.getElementById("kds-list");
    el.tabs       = Array.prototype.slice.call(document.querySelectorAll("[data-kds-filter]"));
    el.enableAudio = document.getElementById("kds-enable-audio-btn");
    el.dutyText    = document.getElementById("kds-duty");
    el.stationBadge = document.getElementById("kds-station-badge");
    el.lockBar     = document.getElementById("kds-lock-bar");
  }

  function applyStationMode() {
    var station = state.station;
    document.body.classList.remove("kds-mode-boil", "kds-mode-pack");
    document.body.classList.add("kds-mode-" + station);
    if (el.stationBadge) el.stationBadge.textContent = stationLabel(station);
    if (el.lastUpdate) el.lastUpdate.setAttribute("data-station", station);
  }

  function updateDutyDisplay() {
    var sess = state.currentSession;
    var active = !!(sess && sess.sessionActive && sess.employeeId);
    if (el.dutyText) {
      if (active) {
        el.dutyText.textContent = "目前值班：" + sess.employeeName + " (" + sess.employeeId + ")";
        el.dutyText.classList.remove("kds-duty--empty");
      } else {
        el.dutyText.textContent = "目前值班：未登入";
        el.dutyText.classList.add("kds-duty--empty");
      }
    }
    document.body.classList.toggle("kds-locked", !active);
    if (el.lockBar) el.lockBar.style.display = active ? "none" : "";
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

    // 點 compact 卡取餐號：未展開 → 開預覽 modal；已展開 → 展開該欄
    document.addEventListener("click", function (e) {
      var num = e.target.closest(".kds-card--compact .kds-card__number[data-expand]");
      if (!num) return;
      e.stopPropagation();
      if (expandedCol === null) {
        var card = num.closest(".kds-card[data-id]");
        var oid  = card ? card.getAttribute("data-id") : null;
        var order = oid ? findOrderById(oid) : null;
        if (order) showPreviewModal(order);
      } else {
        expandedCol = num.getAttribute("data-expand");
        applyExpanded();
        render();
      }
    });

    // Audio unlock：首次點擊解鎖 AudioContext（iOS Safari 限制）
    document.addEventListener("click", function () {
      if (audioUnlocked) return;
      try {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        var ctx = new Ctor();
        var buffer = ctx.createBuffer(1, 1, 22050);
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        audioUnlocked = true;
      } catch (e) {}
    });

    // Preview modal 關閉
    var _closeBtn    = document.getElementById("kds-preview-close");
    var _backdrop    = document.getElementById("kds-preview-backdrop");
    if (_closeBtn)  _closeBtn.addEventListener("click",   hidePreviewModal);
    if (_backdrop)  _backdrop.addEventListener("click",   hidePreviewModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hidePreviewModal();
    });
  }

  function applyExpanded() {
    var board = document.getElementById("kds-board");
    if (!board) return;
    // 站別模式下只顯示單欄（另一欄 display:none），不做雙欄展開／收合
    if (state.station === "boil" || state.station === "pack") {
      board.removeAttribute("data-expanded");
      board.style.setProperty("grid-template-columns", "1fr", "important");
      return;
    }
    var widths = {
      work:  "minmax(0, 1fr) 60px",
      ready: "60px minmax(0, 1fr)"
    };
    if (expandedCol && widths[expandedCol]) {
      board.setAttribute("data-expanded", expandedCol);
      board.style.setProperty("grid-template-columns", widths[expandedCol], "important");
    } else {
      board.removeAttribute("data-expanded");
      board.style.removeProperty("grid-template-columns");
    }
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

  function todayBusinessDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  async function fetchHubOrders(storeId, businessDate) {
    try {
      var url = HUB_URL + '/orders?storeId=' + encodeURIComponent(storeId) + '&date=' + businessDate;
      var res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      return data.orders || [];
    } catch (e) {
      console.warn('[KDS] Hub fetch failed:', e.message);
      return null;
    }
  }

  function hubOrderToKdsFormat(hubOrder) {
    var payload = hubOrder.payload || {};
    var result = Object.assign({}, payload);
    result.id = hubOrder.id;
    result.pickupNumber = hubOrder.pickup_number;
    result.status = hubOrder.status;
    if (!result.customer_name && hubOrder.customer_name) result.customer_name = hubOrder.customer_name;
    if (!result.source && hubOrder.source) result.source = hubOrder.source;
    if (hubOrder.total != null) result.total = hubOrder.total;
    if (!result.created_at && hubOrder.created_at) {
      var ms = new Date(hubOrder.created_at).getTime();
      result.created_at = isNaN(ms) ? hubOrder.created_at : { seconds: Math.floor(ms / 1000) };
    }
    return result;
  }

  function handleOrdersUpdate(hubOrders) {
    var orders = hubOrders.map(hubOrderToKdsFormat);
    if (state.connectionState !== 'connected') setConnectionState('connected');
    state.orders = orders;
    if (el.lastUpdate) el.lastUpdate.textContent = '更新：' + new Date().toLocaleTimeString('zh-TW', { hour12: false });

    var currentMap = buildOrderMap(orders);
    if (!hasInitializedSoundBaseline) {
      previousOrderMap = currentMap;
      hasInitializedSoundBaseline = true;
      console.log('[KDS_SOUND] baseline initialized, ids:', orders.map(function (o) { return o.id; }));
    } else {
      var newlyAppeared = getNewlyAppearedOrders(orders, previousOrderMap);
      newlyAppeared.forEach(function (order) {
        var shouldPlay = isNewAcceptedOrder(order);
        console.log('[KDS_SOUND] evaluate new doc', { id: order.id, source: order.source, status: order.status, shouldPlay: shouldPlay });
        if (shouldPlay && isSoundEnabled()) {
          try { playNewOrderBeep(); } catch (e) {}
        }
      });
      previousOrderMap = currentMap;
    }
    render();
  }

  function updateHubStatus(online) {
    var indicator = document.getElementById('hub-status-indicator');
    if (!indicator) return;
    // W10-C: pill style — toggle .offline class (kds-refresh.css handles color)
    indicator.classList.toggle('offline', !online);
    indicator.title = online ? '本機 Hub 連線中' : '本機 Hub 連線異常';
    var text = document.getElementById('hub-status-text');
    if (text) text.textContent = online ? '本機 Hub 連線中' : '本機 Hub 離線';
  }

  function startHubPolling(storeId) {
    stopHubPolling();
    var tick = async function () {
      var businessDate = todayBusinessDate();
      var orders = await fetchHubOrders(storeId, businessDate);
      if (orders !== null) {
        handleOrdersUpdate(orders);
        updateHubStatus(true);
      } else {
        updateHubStatus(false);
      }
    };
    tick();
    pollTimer = setInterval(tick, POLL_INTERVAL);
  }

  function stopHubPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function start(context) {
    state.storeId = context.storeId;
    state.context = context;
    state.station = resolveStationFromQuery();
    applyStationMode();
    // 在訂閱回報前，一律視為「未登入值班員工」，鎖定所有狀態操作
    state.currentSession = null;
    updateDutyDisplay();
    el.storeMeta.textContent = "門市：" + state.storeId + "｜站別：" + stationLabel(state.station);
    if (el.userMeta) el.userMeta.textContent = "";

    // 訂閱全店目前當班員工（POS 控制），兩台 KDS 將同步顯示
    if (window.LeLeShanOpsSession) {
      if (state.sessionUnsub) { try { state.sessionUnsub(); } catch(_) {} }
      state.sessionUnsub = window.LeLeShanOpsSession.subscribeSession(
        context.db, state.storeId,
        function (sess) {
          state.currentSession = sess;
          state.sessionSubscribeError = null;
          updateDutyDisplay();
          console.log("[KDS] current_session update", sess);
        },
        function (err) {
          state.currentSession = null;
          state.sessionSubscribeError = err;
          console.error("[KDS] subscribe store_runtime failed", err);
          if (el.lockBar) {
            el.lockBar.textContent = "無法讀取值班員工狀態（" + (err && err.code || "error") + "），請確認 Firestore 規則已部署";
          }
          updateDutyDisplay();
        }
      );
    } else {
      console.warn("[KDS] LeLeShanOpsSession unavailable — kept locked");
    }

    // 訂閱店家設定（出餐時間規則等）
    if (state.settingsUnsub) { try { state.settingsUnsub(); } catch(_) {} }
    try {
      state.settingsUnsub = context.db.collection("settings").doc(state.storeId).onSnapshot(function (snap) {
        state.settings = snap && snap.exists ? snap.data() : null;
        console.log("[KDS] settings update", state.settings && state.settings.kdsTimingRules ? "has kdsTimingRules" : "defaults");
        render();
      }, function (err) {
        console.error("[KDS] subscribe settings failed", err);
        state.settings = null;
      });
    } catch (e) {
      console.warn("[KDS] settings subscribe exception", e);
    }

    // 訂單來源改為本機 Hub，每 3 秒輪詢（store_runtime 仍走 Firestore）
    startHubPolling(state.storeId);

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

    // 取消訂單：點擊 → 開啟原因選擇 modal
    el.list.addEventListener("click", function (event) {
      var cancelBtn = event.target.closest("[data-cancel-order]");
      if (!cancelBtn) return;
      var orderId = cancelBtn.getAttribute("data-order-id");
      if (orderId) showCancelModal(orderId);
    });
  }

  // ── 取消訂單 Modal ─────────────────────────────────────────────
  var _cancelModalOrderId = null;

  function showCancelModal(orderId) {
    // Hub 尚未實作取消，暫以提示代替
    alert("取消功能暫不支援，敬請見諒");
  }

  function hideCancelModal() {
    _cancelModalOrderId = null;
    var modal = document.getElementById("kds-cancel-modal");
    if (modal) modal.hidden = true;
  }

  function bindCancelModal() {
    var modal = document.getElementById("kds-cancel-modal");
    if (!modal) return;
    var backdrop = document.getElementById("kds-cancel-backdrop");
    var dismissBtn = document.getElementById("kds-cancel-dismiss");
    if (backdrop) backdrop.addEventListener("click", hideCancelModal);
    if (dismissBtn) dismissBtn.addEventListener("click", hideCancelModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideCancelModal();
    });
    modal.querySelectorAll("[data-reason]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var reason = btn.getAttribute("data-reason");
        var orderId = _cancelModalOrderId;
        hideCancelModal();
        if (orderId && reason) changeStatus(orderId, "cancelled", reason);
      });
    });
  }

  async function changeStatus(orderId, nextStatus, cancelReason) {
    if (!state.context) return;
    var sess = state.currentSession;
    if (!sess || !sess.sessionActive || !sess.employeeId) {
      handleError(new Error("尚未設定值班員工，請先至 POS 登入或交班"));
      return;
    }
    // Hub 尚未實作取消，暫不支援
    if (nextStatus === "cancelled") {
      alert("取消功能暫不支援，敬請見諒");
      return;
    }
    var employeeId = sess.employeeId;
    var employeeName = sess.employeeName || "";
    try {
      console.log("[KDS] Changing status via Hub.", { orderId: orderId, nextStatus: nextStatus, by: employeeId });
      var res = await fetch(HUB_URL + '/orders/' + encodeURIComponent(orderId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, actorId: employeeId, actorName: employeeName }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // 樂觀更新：等下一輪 poll（3s）自動反映
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

    var cols = { work: [], ready: [] };
    state.orders.forEach(function (o) {
      if (o.status === "completed" || o.status === "cancelled" || o.status === "picked_up") return;
      if (o.status === "ready") cols.ready.push(o);
      else if (o.status === "accepted" || o.status === "preparing" || o.status === "pending_confirmation" || o.status === "new") {
        // pending_confirmation/new: 舊資料相容 → 歸入製作中
        cols.work.push(o);
      }
    });

    console.log("[KDS] bucket counts:", {
      work: cols.work.length,
      ready: cols.ready.length
    });

    // 製作欄位排序：依 startCookAt 由近到遠。
    // 因 startCookAt = pickupAt - prep，overdue（pickupAt 在過去）的 startCookAt 最早，
    // 自然排到最前面；should_start 其次；waiting_to_start 殿後。
    var nowMs = Date.now();
    var env = buildTimingEnv();
    cols.work.sort(function (a, b) {
      var ma = helpers.getKdsTimingMeta(a, nowMs, { queueInfo: env.queueInfo }, env.rules);
      var mb = helpers.getKdsTimingMeta(b, nowMs, { queueInfo: env.queueInfo }, env.rules);
      return ma.startCookAtMs - mb.startCookAtMs;
    });
    cols.ready.sort(function (a, b) {
      return (helpers.toMillis(a.ready_at) || 0) - (helpers.toMillis(b.ready_at) || 0);
    });

    var emptyLabels = { work: "無製作中", ready: "無可取餐" };
    ["work", "ready"].forEach(function (k) {
      var col  = document.getElementById("kds-col-" + k);
      var body = document.getElementById("kds-body-" + k);
      if (!body) return;

      if (col) {
        col.classList.toggle("kds-is-expanded",  expandedCol === k);
        col.classList.toggle("kds-is-collapsed", expandedCol !== null && expandedCol !== k);
      }

      if (cols[k].length === 0) {
        if (col) col.classList.remove("kds-has-expanded-invoice");
        body.innerHTML = '<div class="kds-empty">' + esc(emptyLabels[k]) + '</div>';
      } else if (expandedCol === k) {
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
        if (col) col.classList.remove("kds-has-expanded-invoice");
        if (k === "ready") {
          body.innerHTML =
            '<div class="kds-ready-scroll-shell">' +
              '<div class="kds-ready-compact-grid">' +
                cols[k].map(function (o) { return renderCardCompact(o); }).join("") +
              '</div>' +
            '</div>';
        } else if (k === "work") {
          body.innerHTML =
            '<div class="kds-work-scroll-shell">' +
              '<div class="kds-work-compact-grid">' +
                cols[k].map(function (o) { return renderCardCompact(o); }).join("") +
              '</div>' +
            '</div>';
        } else {
          body.innerHTML = cols[k].map(function (o) { return renderCardCompact(o); }).join("");
        }
      }

      var ct = document.getElementById("kds-ct-" + k);
      if (ct) ct.textContent = String(cols[k].length);
      var sb = document.getElementById("kds-sb-" + k.charAt(0));
      if (sb) sb.textContent = String(cols[k].length);
    });

    var workCol = document.getElementById("kds-col-work");
    if (workCol) {
      workCol.classList.remove("kds-overload", "kds-busy");
      if (cols.work.length >= 6) workCol.classList.add("kds-overload");
      else if (cols.work.length >= 4) workCol.classList.add("kds-busy");
    }
    var readyCol = document.getElementById("kds-col-ready");
    if (readyCol) readyCol.classList.toggle("kds-full", cols.ready.length >= 4);
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

    // ⚠️ LEGACY FALLBACK — 僅為 pre-2026-04 訂單相容用。
    // 新訂單（P4, 2026-04-21 起）會有完整 order.groups[]，不會走到這裡。
    // 此函式讀取舊欄位（partId / sourceGroupId / groupKey / seatLabel / assignee / personIndex / seatIndex）
    // 做群組重建，請勿依賴它處理新資料；若有新需求請寫進正式 schema。
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

  // 收集目前活躍工作單（用來算 queuePosition）
  function getActiveWorkOrders() {
    return (state.orders || []).filter(function (o) {
      var st = String(o.status || "").toLowerCase();
      return st === "new" || st === "pending_confirmation" || st === "accepted" || st === "preparing";
    });
  }

  // 建立一個 render/tick 期間共用的 timing 環境：rules + queueInfo
  function buildTimingEnv() {
    var helpers = window.LeLeShanOrders;
    var rules = helpers.getKdsTimingRules(state.settings);
    var queueInfo = helpers.buildKdsQueueInfo(getActiveWorkOrders());
    return { rules: rules, queueInfo: queueInfo };
  }

  // 掃描所有活躍工作單，對「未鎖定估時」且本分頁未嘗試過的單觸發一次 ensureOrderTimingLocked
  // 注意：
  //   - 僅在首次需要時寫一次 Firestore
  //   - 已鎖定的訂單：normalizeOrder 會帶出 order.timing，helpers.hasLockedTiming 會檢出，快速路徑回傳
  //   - lockAttemptIds 避免同一分頁重複嘗試（即使 transaction 失敗也不重試）
  function tickEnsureLocks() {
    var helpers = window.LeLeShanOrders;
    if (!state.context || !state.context.db || !helpers || typeof helpers.ensureOrderTimingLocked !== "function") return;
    var actives = getActiveWorkOrders();
    if (!actives.length) return;
    var env = buildTimingEnv();
    var db = state.context.db;
    actives.forEach(function (order) {
      var id = String(order && order.id || "");
      if (!id) return;
      if (helpers.hasLockedTiming(order)) return;
      if (lockAttemptIds.has(id)) return;
      lockAttemptIds.add(id);
      console.log("[KDS_LOCK] attempt", { id: id, queuePosition: env.queueInfo.map[id] });
      helpers.ensureOrderTimingLocked({
        db: db,
        orderId: id,
        order: order,
        context: { queueInfo: env.queueInfo },
        rules: env.rules
      }).then(function (timing) {
        if (timing) {
          console.log("[KDS_LOCK] locked", { id: id, lockedPrepMinutes: timing.lockedPrepMinutes, queuePositionAtLock: timing.queuePositionAtLock });
        }
      });
    });
  }

  function getWaitInfo(order, nowMs, env) {
    var helpers = window.LeLeShanOrders;
    env = env || buildTimingEnv();
    var meta = helpers.getKdsTimingMeta(
      order,
      typeof nowMs === "number" ? nowMs : Date.now(),
      { queueInfo: env.queueInfo },
      env.rules
    );
    var isActive = order.status === "accepted" || order.status === "preparing" || order.status === "pending_confirmation" || order.status === "new";
    var cls = "wait";
    if (isActive) {
      if (meta.statusPhase === "overdue") cls = "crit";
      else if (meta.statusPhase === "should_start") cls = "warn";
      else cls = "wait";
    } else {
      cls = "wait";
    }
    return {
      cls: cls,
      text: meta.primaryLabel,
      secondary: meta.secondaryLabel,
      phase: meta.statusPhase,
      isScheduled: meta.isScheduled,
      meta: meta
    };
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
    var groups     = normalizeGroups(order);
    var allKeys    = collectAllItemKeys(order, groups);
    var allChecked = allKeys.length > 0 && allKeys.every(function (k) { return isItemChecked(k); });
    var wait       = getWaitInfo(order);

    var statusKey = status === "ready" ? "ready"
      : status === "preparing" ? "preparing"
      : "accepted";

    var cls = "kds-card kds-card--" + statusKey;
    if ((status === "preparing" || status === "accepted") && allChecked) cls += " all-checked";

    var primary = (STATUS_ACTIONS[status] || STATUS_ACTIONS["accepted"])[0] || null;
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
    if (wait.isScheduled && srcCode === "line") {
      srcHtml += '<span class="kds-src kds-src--reserve">LINE預約</span>';
    } else if (wait.isScheduled) {
      srcHtml += '<span class="kds-src kds-src--reserve">預約</span>';
    }

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

    return '<article class="' + cls + '" data-id="' + esc(order.id) + '" data-phase="' + esc(wait.phase) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '" data-phase="' + esc(wait.phase) + '">' +
          '<span class="kds-card__wait-primary">' + esc(wait.text) + '</span>' +
          '<span class="kds-card__wait-secondary">' + esc(wait.secondary || "") + '</span>' +
        '</div>' +
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
        '<button class="kds-btn kds-btn--cancel" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">取消</button>' +
      '</div>' +
      '</article>';
  }

  function renderCardInvoice(order) {
    var helpers    = window.LeLeShanOrders;
    var status     = order.status;
    var groups     = normalizeGroups(order);
    var allKeys    = collectAllItemKeys(order, groups);
    var allChecked = allKeys.length > 0 && allKeys.every(function (k) { return isItemChecked(k); });
    var wait       = getWaitInfo(order);

    var statusKey = status === "ready" ? "ready"
      : status === "preparing" ? "preparing"
      : "accepted";

    var cls = "kds-card kds-card--invoice kds-card--" + statusKey;
    if ((status === "preparing" || status === "accepted") && allChecked) cls += " all-checked";

    var primary = (STATUS_ACTIONS[status] || STATUS_ACTIONS["accepted"])[0] || null;
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
    if (wait.isScheduled && srcCode === "line") {
      srcHtml += '<span class="kds-src kds-src--reserve">LINE預約</span>';
    } else if (wait.isScheduled) {
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

    return '<article class="' + cls + '" data-id="' + esc(order.id) + '" data-phase="' + esc(wait.phase) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '" data-phase="' + esc(wait.phase) + '">' +
          '<span class="kds-card__wait-primary">' + esc(wait.text) + '</span>' +
          '<span class="kds-card__wait-secondary">' + esc(wait.secondary || "") + '</span>' +
        '</div>' +
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
        '<button class="kds-btn kds-btn--cancel" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">取消</button>' +
      '</div>' +
      '</article>';
  }

  function renderCardCompact(order) {
    var status    = order.status;
    var statusKey = status === "ready" ? "ready"
      : status === "preparing" ? "preparing" : "accepted";
    var wait    = getWaitInfo(order);
    var total   = Number(order.total || 0);
    var primary = (STATUS_ACTIONS[status] || STATUS_ACTIONS["accepted"])[0] || null;

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

    var compactSrcCode = getSourceCode(order);
    var compactSrcHtml = '<span class="kds-src kds-src--' + esc(compactSrcCode) + '">' + esc(getSourceLabel(order)) + '</span>';
    if (wait.isScheduled && compactSrcCode === "line") {
      compactSrcHtml += '<span class="kds-src kds-src--reserve">LINE預約</span>';
    } else if (wait.isScheduled) {
      compactSrcHtml += '<span class="kds-src kds-src--reserve">預約</span>';
    }

    return '<article class="kds-card kds-card--compact kds-card--' + statusKey + '" data-id="' + esc(order.id) + '" data-phase="' + esc(wait.phase) + '">' +
      '<div class="kds-card__hero">' +
        '<div class="kds-card__wait-bar ' + esc(wait.cls) + '" data-phase="' + esc(wait.phase) + '">' +
          '<span class="kds-card__wait-primary">' + esc(wait.text) + '</span>' +
          '<span class="kds-card__wait-secondary">' + esc(wait.secondary || "") + '</span>' +
        '</div>' +
        '<div class="kds-card__number" data-expand="' + statusKey + '">' + esc(getPickupNumber(order)) + '</div>' +
      '</div>' +
      '<div class="kds-card__meta kds-card__meta--compact">' +
        compactSrcHtml +
        '<span class="kds-card__name">' + esc(getCustomerName(order)) + '</span>' +
      '</div>' +
      '<div class="kds-card__amount">$ ' + total.toLocaleString() + '</div>' +
      '<div class="kds-card__cta">' + ctaHtml +
        '<button class="kds-btn kds-btn--cancel" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">取消</button>' +
      '</div>' +
      '</article>';
  }

  // ── 訂單預覽 Modal ─────────────────────────────────────────────

  function findOrderById(id) {
    for (var i = 0; i < state.orders.length; i++) {
      if (state.orders[i].id === id) return state.orders[i];
    }
    return null;
  }

  function renderPreviewBody(order) {
    var helpers    = window.LeLeShanOrders;
    var groups     = normalizeGroups(order);
    var wait       = getWaitInfo(order);
    var note       = getNoteText(order);
    var total      = Number(order.total || 0);
    var pickupStr  = getPickupTimeStr(order);
    var createdMs  = helpers.toMillis(order.created_at);
    var createdStr = "";
    if (createdMs) {
      var d = new Date(createdMs);
      createdStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
    var html = "";

    // 來源 + 姓名 + 等待時間
    html += '<div class="kds-pm__meta">';
    html += '<span class="kds-src kds-src--' + esc(getSourceCode(order)) + '">' + esc(getSourceLabel(order)) + '</span>';
    html += '<span class="kds-pm__name">' + esc(getCustomerName(order)) + '</span>';
    if (createdStr) {
      html += '<span class="kds-pm__time">建單 ' + esc(createdStr) + '・' + esc(wait.text) + '</span>';
    }
    html += '</div>';

    // 金額 + 取餐時段
    html += '<div class="kds-pm__amounts">';
    html += '<span class="kds-pm__total">$ ' + total.toLocaleString() + '</span>';
    if (pickupStr) html += '<span class="kds-pm__pickup">' + esc(pickupStr) + '</span>';
    html += '</div>';

    // 估時資訊（breakdown）
    var bd = wait.meta && wait.meta.breakdown;
    if (bd) {
      var matchedNames = Array.isArray(bd.longCookMatchedNames) ? bd.longCookMatchedNames : (Array.isArray(bd.longCookMatchedItems) ? bd.longCookMatchedItems.map(function (m) { return m.name || m; }) : []);
      html += '<div class="kds-pm__timing">';
      html += '<div class="kds-pm__timing-head">估時資訊' + (bd.locked ? '（已鎖定 ' + esc(bd.estimatedBy || "kds_rule_v2") + '）' : '（即時估算）') + '</div>';
      html += '<div class="kds-pm__timing-grid">';
      html += '<div><span>最終預估</span><strong>' + esc(wait.meta.prepMinutes) + ' 分</strong></div>';
      html += '<div><span>排隊位置</span><strong>第 ' + esc(bd.queuePosition || 0) + ' 張</strong></div>';
      html += '<div><span>隊列基礎</span><strong>' + esc(bd.queueBaseMinutes || 0) + ' 分</strong></div>';
      html += '<div><span>金額加時</span><strong>+' + esc(bd.amountMinutes || 0) + ' 分</strong></div>';
      html += '<div><span>超大單加時</span><strong>+' + esc(bd.extraLargeOrderMinutes || 0) + ' 分</strong></div>';
      html += '<div><span>group/item</span><strong>' + esc(bd.groupCount || 0) + ' / ' + esc(bd.itemCount || 0) + '</strong></div>';
      html += '<div><span>長煮下限</span><strong>' + (bd.longCookFloorApplied ? '命中' : '未命中') + '</strong></div>';
      html += '<div><span>命中食材</span><strong>' + esc(matchedNames.length ? matchedNames.join("、") : "—") + '</strong></div>';
      html += '</div>';
      html += '</div>';
    }

    // 備註
    if (note) html += '<div class="kds-pm__note">📝 ' + esc(note) + '</div>';

    // 群組 + 品項
    if (groups && groups.length) {
      groups.forEach(function (g, gi) {
        var badge    = GROUP_BADGE_LABELS[gi] || String(gi + 1);
        var flavor   = String(g.flavor || "").trim();
        var totalQty = (g.items || []).reduce(function (n, i) { return n + Number(i.qty || 0); }, 0);
        html += '<div class="kds-pm__group">';
        html += '<div class="kds-pm__group-head">';
        html += '<span class="kds-group__badge">' + esc(badge) + '</span>';
        if (flavor) html += '<span class="kds-pm__flavor">' + esc(flavor) + '</span>';
        html += '<span class="kds-pm__flavor" style="margin-left:auto;font-weight:700">' + esc(String(totalQty)) + ' 項</span>';
        html += '</div>';
        html += '<ul class="kds-pm__items">';
        (g.items || []).forEach(function (item) {
          var staple   = String(item.staple || item.selectedStaple || "").trim();
          var itemNote = String(item.item_note || item.note || "").trim();
          html += '<li>';
          html += '<span class="kds-pm__item-name">' + esc(item.name || "") + '</span>';
          html += '<span class="kds-pm__item-qty">×' + esc(String(Number(item.qty || 1))) + '</span>';
          if (staple)   html += '<span class="kds-pm__item-sub">主食：' + esc(staple)   + '</span>';
          if (itemNote) html += '<span class="kds-pm__item-sub">' + esc(itemNote) + '</span>';
          html += '</li>';
        });
        html += '</ul></div>';
      });
    } else {
      var flatItems = Array.isArray(order.items) ? order.items : [];
      if (flatItems.length) {
        html += '<ul class="kds-pm__items kds-pm__items--flat">';
        flatItems.forEach(function (item) {
          html += '<li>';
          html += '<span class="kds-pm__item-name">' + esc(item.name || "") + '</span>';
          html += '<span class="kds-pm__item-qty">×' + esc(String(Number(item.qty || 1))) + '</span>';
          html += '</li>';
        });
        html += '</ul>';
      }
    }
    return html;
  }

  function showPreviewModal(order) {
    var modal = document.getElementById("kds-preview-modal");
    if (!modal) return;

    document.getElementById("kds-preview-num").textContent = getPickupNumber(order);

    var statusKey = order.status === "ready" ? "ready"
      : order.status === "preparing" ? "preparing"
      : "accepted";
    var statusLabels = { accepted: "製作中", preparing: "製作中", ready: "可取餐" };
    var badge = document.getElementById("kds-preview-status");
    badge.textContent = statusLabels[statusKey] || "";
    badge.className   = "kds-modal__status-badge is-" + statusKey;

    var header = document.getElementById("kds-preview-header");
    if (header) header.setAttribute("data-status", statusKey);

    document.getElementById("kds-preview-body").innerHTML = renderPreviewBody(order);

    modal.hidden = false;
    var closeBtn = document.getElementById("kds-preview-close");
    if (closeBtn) closeBtn.focus();
  }

  function hidePreviewModal() {
    var modal = document.getElementById("kds-preview-modal");
    if (modal) modal.hidden = true;
  }

  // ── ──────────────────────────────────────────────────────────

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
