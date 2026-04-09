(function () {
  var STATUS_LABELS = {
    new: '新訂單',
    cooking: '製作中',
    packing: '包裝中',
    ready: '可取餐',
    completed: '已完成',
    picked_up: '已取餐',
    cancelled: '已取消'
  };

  var STATUS_COLORS = {
    new: '#8B6914',
    cooking: '#C0392B',
    packing: '#D35400',
    ready: '#27AE60',
    completed: '#7F8C8D',
    picked_up: '#7F8C8D',
    cancelled: '#95A5A6'
  };

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapStatus(status) {
    var legacy = { preparing: 'cooking', done: 'ready' };
    return legacy[status] || status || 'new';
  }

  function statusLabel(status) {
    var s = mapStatus(status);
    return STATUS_LABELS[s] || '未知';
  }

  function statusColor(status) {
    var s = mapStatus(status);
    return STATUS_COLORS[s] || '#666';
  }

  function generateUid() {
    return 'uid_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  }

  function formatDateTime(value) {
    if (!value) return '';
    var d = (typeof value.toDate === 'function') ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-TW', {
      hour12: false, month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // ── init ────────────────────────────────────────────────────────────────────

  function init(app) {
    app.el.memberNavBtn  = document.getElementById('member-nav-btn');
    app.el.myOrdersOverlay = document.getElementById('my-orders-overlay');
    app.el.myOrdersClose   = document.getElementById('my-orders-close');
    app.el.myOrdersList    = document.getElementById('my-orders-list');

    if (app.el.memberNavBtn) {
      app.el.memberNavBtn.addEventListener('click', function () { openMyOrders(app); });
    }
    if (app.el.myOrdersClose) {
      app.el.myOrdersClose.addEventListener('click', function () { closeMyOrders(app); });
    }
    if (app.el.myOrdersOverlay) {
      app.el.myOrdersOverlay.addEventListener('click', function (event) {
        if (event.target === app.el.myOrdersOverlay) closeMyOrders(app);
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && app.state.activeModal === 'my-orders') closeMyOrders(app);
    });

    // Expose for ui.js to call
    window.LeLeShanMember._app = app;
  }

  // ── overlay open / close ─────────────────────────────────────────────────

  function openMyOrders(app) {
    if (!app.state.profile || !app.el.myOrdersOverlay) return;
    app.el.myOrdersOverlay.classList.remove('hidden');
    app.el.myOrdersOverlay.setAttribute('aria-hidden', 'false');
    app.state.activeModal = 'my-orders';
    loadMyOrders(app);
  }

  function closeMyOrders(app) {
    if (!app.el.myOrdersOverlay) return;
    app.el.myOrdersOverlay.classList.add('hidden');
    app.el.myOrdersOverlay.setAttribute('aria-hidden', 'true');
    if (app.state.activeModal === 'my-orders') app.state.activeModal = null;
  }

  // ── load orders from Firestore ────────────────────────────────────────────

  async function loadMyOrders(app) {
    var listEl = app.el.myOrdersList;
    if (!listEl) return;
    listEl.innerHTML = '<p class="my-orders__loading">載入中…</p>';

    var lineUserId = app.state.profile && app.state.profile.userId;
    if (!lineUserId) {
      listEl.innerHTML = '<p class="my-orders__empty">尚未登入。</p>';
      return;
    }

    try {
      var snapshot = await app.state.db
        .collection('orders')
        .where('lineUserId', '==', lineUserId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      if (snapshot.empty) {
        listEl.innerHTML = '<p class="my-orders__empty">還沒有訂單紀錄 👀</p>';
        return;
      }

      var docsArr = snapshot.docs;
      var html = docsArr.map(function (doc) {
        return renderOrderCard(doc.id, doc.data());
      }).join('');
      listEl.innerHTML = html;

      // Bind reorder buttons
      listEl.querySelectorAll('[data-reorder-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var orderId = btn.getAttribute('data-reorder-id');
          var matched = docsArr.find(function (d) { return d.id === orderId; });
          if (matched) handleReorder(app, matched.data());
        });
      });

    } catch (err) {
      console.error('[Member] loadMyOrders failed', err);
      listEl.innerHTML = '<p class="my-orders__empty">訂單載入失敗，請稍後再試。</p>';
    }
  }

  // ── render one order card ─────────────────────────────────────────────────

  function renderOrderCard(docId, data) {
    var status  = mapStatus(data.status);
    var label   = statusLabel(status);
    var color   = statusColor(status);
    var pickupNum = data.pickupNumber || null;
    var items   = Array.isArray(data.items) ? data.items : [];
    var total   = Number(data.total || data.totalAmount || data.totalPrice || 0);
    var pickupDate = data.scheduled_pickup_date || data.pickupDateValue || '';
    var pickupTime = data.scheduled_pickup_time || data.pickupTime || '';
    var pickupStr  = [pickupDate, pickupTime].filter(Boolean).join(' ');
    var createdAt  = formatDateTime(data.createdAt || data.created_at);
    var isCancelled = (status === 'cancelled');

    // Items list (max 4 lines)
    var itemLines = items.slice(0, 4).map(function (item) {
      var name  = esc(item.name || '未知品項');
      var qty   = Number(item.qty || item.quantity || 1);
      var flavor = item.flavor || item.flavorName || '';
      return name + ' ×' + qty + (flavor ? ' <span class="my-orders__flavor">(' + esc(flavor) + ')</span>' : '');
    });
    if (items.length > 4) {
      itemLines.push('<span class="my-orders__more">…還有 ' + (items.length - 4) + ' 項</span>');
    }

    var reorderBtn = isCancelled ? '' :
      '<button class="my-orders__reorder-btn" data-reorder-id="' + esc(docId) + '" type="button">🔄 再來一單</button>';

    var parts = [];
    parts.push('<div class="my-orders__card">');
    parts.push('  <div class="my-orders__card-head">');
    if (pickupNum) {
      parts.push('    <strong class="my-orders__pickup-num">取餐號碼 ' + esc(pickupNum) + '</strong>');
    } else {
      parts.push('    <span class="my-orders__pickup-num my-orders__pickup-num--old">（舊單）</span>');
    }
    parts.push('    <span class="my-orders__status-badge" style="background:' + color + ';">' + esc(label) + '</span>');
    parts.push('  </div>');
    if (itemLines.length) {
      parts.push('  <ul class="my-orders__items">');
      itemLines.forEach(function (line) { parts.push('    <li>' + line + '</li>'); });
      parts.push('  </ul>');
    }
    parts.push('  <div class="my-orders__card-foot">');
    var metaParts = [];
    if (pickupStr) metaParts.push(esc(pickupStr) + ' 取餐');
    if (total)     metaParts.push('NT$' + total);
    if (createdAt) metaParts.push('<span class="my-orders__created">' + esc(createdAt) + '</span>');
    parts.push('    <span class="my-orders__meta">' + metaParts.join(' · ') + '</span>');
    parts.push('    ' + reorderBtn);
    parts.push('  </div>');
    parts.push('</div>');
    return parts.join('\n');
  }

  // ── reorder logic ─────────────────────────────────────────────────────────

  function handleReorder(app, orderData) {
    var items = Array.isArray(orderData.items) ? orderData.items : [];
    if (!items.length) {
      alert('這筆訂單沒有品項可以重新加入。');
      return;
    }

    // Build lookup maps from current menu state
    var comboMap  = {};
    (app.state.comboItems || []).forEach(function (c) { comboMap[c.id] = c; });

    var singleMap = {};
    (app.state.singleCategories || []).forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        singleMap[item.id] = { item: item, categoryTitle: cat.title || '' };
      });
    });

    var newCartItems = [];
    var skippedNames = [];

    items.forEach(function (orderItem) {
      var itemId    = orderItem.sku || orderItem.itemId || '';
      var qty       = Math.max(1, Number(orderItem.qty || orderItem.quantity || 1));
      var unitPrice = Number(orderItem.unit_price || orderItem.price || 0);
      var flavorName = orderItem.flavor || orderItem.flavorName || '';

      // Resolve flavorId from current flavors list
      var flavorId = '';
      if (flavorName) {
        var matched = (app.state.flavors || []).find(function (f) { return f.name === flavorName; });
        flavorId = matched ? matched.id : '';
      }

      // Resolve staple from options array
      var stapleId = '';
      var stapleName = '';
      var staplePriceAdj = 0;
      var optsArr = Array.isArray(orderItem.options) ? orderItem.options : [];
      var stapleOpt = optsArr.find(function (o) {
        return o.name === '主食' || o.name === 'staple';
      });
      if (stapleOpt) {
        stapleName = stapleOpt.value || '';
        staplePriceAdj = Number(stapleOpt.price || 0);
        var matchedStaple = (app.state.stapleOptions || []).find(function (s) { return s.name === stapleName; });
        stapleId = matchedStaple ? matchedStaple.id : '';
      }

      if (comboMap[itemId]) {
        var combo = comboMap[itemId];
        var cu    = Number(combo.price || 0) + staplePriceAdj;
        newCartItems.push({
          uid: generateUid(),
          itemId: itemId,
          type: 'combo',
          name: combo.name || orderItem.name || '',
          flavorId: flavorId,
          flavorName: flavorName,
          stapleId: stapleId,
          stapleName: stapleName,
          comboLabel: '套餐',
          priceAdjustment: staplePriceAdj,
          categoryName: '',
          quantity: qty,
          unitPrice: cu,
          price: cu * qty,
          detail: '',
          itemNote: '',
          options: stapleName ? [{ name: '主食', value: stapleName, price: staplePriceAdj }] : []
        });
      } else if (singleMap[itemId]) {
        var si  = singleMap[itemId];
        var su  = Number(si.item.price || unitPrice);
        newCartItems.push({
          uid: generateUid(),
          itemId: itemId,
          type: 'single',
          name: si.item.name || orderItem.name || '',
          flavorId: flavorId,
          flavorName: flavorName,
          stapleId: '',
          stapleName: '',
          comboLabel: '',
          priceAdjustment: 0,
          categoryName: si.categoryTitle,
          quantity: qty,
          unitPrice: su,
          price: su * qty,
          detail: si.item.unit || '',
          itemNote: '',
          options: []
        });
      } else {
        skippedNames.push(orderItem.name || itemId || '未知品項');
      }
    });

    if (!newCartItems.length) {
      var noItemMsg = skippedNames.length
        ? '以下品項目前已不在菜單上，無法重新加入：\n' + skippedNames.map(function (n) { return '・' + n; }).join('\n')
        : '無法重新加入任何品項。';
      alert(noItemMsg);
      return;
    }

    // If no flavor is selected yet, try to set one from the order items
    if (!app.state.selectedFlavor) {
      var firstFlavor = newCartItems.find(function (i) { return i.flavorId; });
      if (firstFlavor) app.state.selectedFlavor = firstFlavor.flavorId;
    }

    // Replace cart
    app.modules.cart.restoreCart(newCartItems);
    closeMyOrders(app);

    // Scroll to cart area
    setTimeout(function () {
      if (app.modules.ui && app.modules.ui.scrollToCartList) {
        app.modules.ui.scrollToCartList(app);
      }
    }, 300);

    // Notify if some items were skipped
    if (skippedNames.length) {
      setTimeout(function () {
        alert(
          '已加入 ' + newCartItems.length + ' 項餐點到購物車。\n\n' +
          '以下品項目前已不在菜單，已略過：\n' +
          skippedNames.map(function (n) { return '・' + n; }).join('\n')
        );
      }, 350);
    }
  }

  // ── public API ────────────────────────────────────────────────────────────

  window.LeLeShanMember = {
    init: init,
    openMyOrders: function () {
      var a = window.LeLeShanMember._app;
      if (a) openMyOrders(a);
    }
  };
})();
