(function () {
  'use strict';

  var HUB_URL = window.LELESHAN_HUB_URL || 'http://100.72.80.2:8080';
  var POLL_INTERVAL = 3000;
  var READY_LIMIT = 6;
  var PREPARING_LIMIT = 8;

  var params = new URLSearchParams(window.location.search);
  var STORE_ID = params.get('storeId') ||
    (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) ||
    'store_1';

  var pollTimer = null;
  var lastReadyIds = new Set();
  var audioUnlocked = false;

  // ── Helpers ─────────────────────────────────────────────────

  function todayBusinessDate() {
    var tz = 8 * 60 * 60 * 1000;
    var now = new Date(Date.now() + tz);
    return now.toISOString().slice(0, 10);
  }

  function estimateMinutes(positionInQueue) {
    var base = 5 + positionInQueue * 3;
    return Math.ceil(base * 1.3);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPickupNumber(order) {
    return order.pickup_number ||
      (order.payload && order.payload.pickup_number) ||
      String(order.id || '').slice(-4).toUpperCase() ||
      '---';
  }

  // ── Clock ────────────────────────────────────────────────────

  function updateClock() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    var el = document.getElementById('pb-clock');
    if (el) el.textContent = h + ':' + m + ':' + s;
  }

  // ── Render ───────────────────────────────────────────────────

  function renderReady(orders) {
    var container = document.getElementById('pb-ready');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = '<div class="pb-empty">目前無可取餐訂單</div>';
      lastReadyIds = new Set();
      return;
    }

    var newReadyIds = new Set();
    var hasNew = false;

    var html = orders.slice(0, READY_LIMIT).map(function (o) {
      var id = String(o.id);
      var isNew = !lastReadyIds.has(id);
      newReadyIds.add(id);
      if (isNew) hasNew = true;
      return '<div class="pb-card' + (isNew ? ' pb-card-just-ready' : '') + '" data-id="' + esc(id) + '">' +
        '<div class="pb-card-number">' + esc(getPickupNumber(o)) + '</div>' +
        '</div>';
    }).join('');

    container.innerHTML = html;

    // 首次載入（baseline 為空 Set）不播聲，避免重整時整批響
    if (hasNew && lastReadyIds.size > 0 && typeof window.playNotifyDing === 'function') {
      window.playNotifyDing();
    }

    lastReadyIds = newReadyIds;
  }

  function renderPreparing(orders) {
    var container = document.getElementById('pb-preparing');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = '<div class="pb-empty">目前無製作中訂單</div>';
      return;
    }

    container.innerHTML = orders.slice(0, PREPARING_LIMIT).map(function (o, idx) {
      var mins = estimateMinutes(idx);
      return '<div class="pb-card" data-id="' + esc(String(o.id)) + '">' +
        '<div class="pb-card-number">' + esc(getPickupNumber(o)) + '</div>' +
        '<div class="pb-card-time">約 ' + mins + ' 分鐘</div>' +
        '</div>';
    }).join('');
  }

  function updateQueueInfo(preparingCount, readyCount) {
    var el = document.getElementById('pb-queue-info');
    if (el) el.textContent = '目前等候 ' + preparingCount + ' 單　可取餐 ' + readyCount + ' 單';
  }

  function updateStatus(online) {
    var el = document.getElementById('pb-status-indicator');
    if (!el) return;
    el.classList.toggle('pb-status-online', online);
    el.classList.toggle('pb-status-offline', !online);
    el.textContent = online ? '\u25CF 連線中' : '\u25CF 本機離線';
  }

  // ── Hub polling ──────────────────────────────────────────────

  function fetchOrders(callback) {
    var date = todayBusinessDate();
    var url = HUB_URL + '/orders?storeId=' + encodeURIComponent(STORE_ID) + '&date=' + date;
    var ctrl = new AbortController();
    var timeoutId = setTimeout(function () { ctrl.abort(); }, 5000);
    fetch(url, { signal: ctrl.signal })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        callback(null, data.orders || []);
      })
      .catch(function (e) {
        clearTimeout(timeoutId);
        console.warn('[pickup-board] Hub fetch failed:', e.message);
        callback(e, null);
      });
  }

  function tick() {
    fetchOrders(function (err, orders) {
      if (err || orders === null) {
        updateStatus(false);
        return;
      }
      updateStatus(true);

      var ready = orders
        .filter(function (o) { return o.status === 'ready'; })
        .sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });

      var preparing = orders
        .filter(function (o) { return o.status === 'preparing' || o.status === 'accepted'; })
        .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

      renderReady(ready);
      renderPreparing(preparing);
      updateQueueInfo(preparing.length, ready.length);
    });
  }

  // ── Boot ─────────────────────────────────────────────────────

  function start() {
    updateClock();
    setInterval(updateClock, 1000);

    tick();
    pollTimer = setInterval(tick, POLL_INTERVAL);

    // 滑鼠靜止 3 秒後自動隱藏游標（移動時恢復）
    var cursorTimeout = null;
    function showCursor() {
      document.body.style.cursor = 'default';
      if (cursorTimeout) clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(function () {
        document.body.style.cursor = 'none';
      }, 3000);
    }
    document.addEventListener('mousemove', showCursor);
    showCursor();

    // 首次點擊解鎖 AudioContext（瀏覽器自動播放策略）
    document.addEventListener('click', function () {
      if (audioUnlocked) return;
      audioUnlocked = true;
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
      } catch (e) {}
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
