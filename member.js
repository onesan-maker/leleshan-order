(function () {
  function init(app) {
    app.modules.member = api(app);
    cacheElements(app);
    bindEvents(app);
  }

  function api(app) {
    return {
      openMyOrders: function () { openMyOrders(app); },
      closeMyOrders: function () { closeMyOrders(app); },
      openMemberCenter: function () { openMemberCenter(app); },
      closeMemberCenter: function () { closeMemberCenter(app); },
      showOrderSuccess: function (orderId, cartSnapshot, pickupLabel) { showOrderSuccess(app, orderId, cartSnapshot, pickupLabel); },
      closeOrderSuccess: function () { closeOrderSuccess(app); },
      refreshMyOrders: function () { loadMyOrders(app); },
      refreshMemberData: function () { loadMemberData(app); }
    };
  }

  function cacheElements(app) {
    app.el.orderSuccessPanel = document.getElementById("order-success-panel");
    app.el.myOrdersOverlay = document.getElementById("my-orders-overlay");
    app.el.myOrdersList = document.getElementById("my-orders-list");
    app.el.memberOverlay = document.getElementById("member-center-overlay");
    app.el.memberPointsSummary = document.getElementById("member-points-summary");
    app.el.memberInfo = document.getElementById("member-info");
    app.el.memberPointHistory = document.getElementById("member-point-history");
    app.el.memberNavBtn = document.getElementById("member-nav-btn");
  }

  function bindEvents(app) {
    bind("order-success-orders-btn", function () { closeOrderSuccess(app); openMyOrders(app); });
    bind("order-success-menu-btn", function () { closeOrderSuccess(app); });
    bind("my-orders-close-btn", function () { closeMyOrders(app); });
    bind("member-center-close-btn", function () { closeMemberCenter(app); });
    bind("member-tab-orders", function () { switchMemberTab(app, "orders"); });
    bind("member-tab-points", function () { switchMemberTab(app, "points"); });
    bind("member-tab-info", function () { switchMemberTab(app, "info"); });
    if (app.el.memberNavBtn) {
      app.el.memberNavBtn.addEventListener("click", function () { openMemberCenter(app); });
    }
  }

  function bind(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  }

  // === ORDER SUCCESS ===
  function showOrderSuccess(app, orderId, cartSnapshot, pickupLabel) {
    var panel = app.el.orderSuccessPanel;
    if (!panel) return;

    var itemLines = (cartSnapshot || []).map(function (item) {
      var line = escapeHtml(item.name);
      if (item.flavorName) line += "（" + escapeHtml(item.flavorName) + "）";
      return "<li>" + line + " ×" + item.quantity + " — NT$\u00a0" + item.price + "</li>";
    }).join("");

    var orderIdShort = orderId ? orderId.slice(-8).toUpperCase() : "";

    panel.innerHTML = ''
      + '<div class="success-panel__card">'
      + '<div class="success-panel__icon">✓</div>'
      + '<h2>訂單已送出</h2>'
      + '<p class="success-panel__order-id">訂單編號：' + escapeHtml(orderIdShort) + '</p>'
      + (pickupLabel ? '<p class="success-panel__pickup">取餐時間：' + escapeHtml(pickupLabel) + '</p>' : '')
      + (itemLines ? '<div class="success-panel__items"><strong>品項摘要</strong><ul>' + itemLines + '</ul></div>' : '')
      + '<div class="success-panel__actions">'
      + '<button id="order-success-orders-btn" class="primary-btn" type="button">查看我的訂單</button>'
      + '<button id="order-success-menu-btn" class="ghost-btn" type="button">繼續點餐</button>'
      + '</div>'
      + '</div>';

    panel.classList.remove("hidden");
    if (app.el.checkoutSection) app.el.checkoutSection.classList.add("hidden");

    bind("order-success-orders-btn", function () { closeOrderSuccess(app); openMyOrders(app); });
    bind("order-success-menu-btn", function () { closeOrderSuccess(app); });

    requestAnimationFrame(function () {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeOrderSuccess(app) {
    if (app.el.orderSuccessPanel) app.el.orderSuccessPanel.classList.add("hidden");
    if (app.el.checkoutSection) app.el.checkoutSection.classList.remove("hidden");
  }

  // === MY ORDERS ===
  function openMyOrders(app) {
    if (!app.el.myOrdersOverlay) return;
    if (!app.state.profile || !app.state.profile.userId) {
      app.modules.ui.setMessage(app, "請先登入 LINE 才能查看訂單。", "error");
      return;
    }
    app.el.myOrdersOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    loadMyOrders(app);
  }

  function closeMyOrders(app) {
    if (!app.el.myOrdersOverlay) return;
    app.el.myOrdersOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function loadMyOrders(app) {
    if (!app.state.db || !app.state.profile) return;
    var listEl = app.el.myOrdersList;
    if (!listEl) return;
    listEl.innerHTML = '<p class="loading-text">載入中...</p>';

    var userId = app.state.profile.userId;
    app.state.db.collection("orders")
      .where("lineUserId", "==", userId)
      .limit(60)
      .get()
      .then(function (snap) {
        var allDocs = snap.docs.map(function (doc) { return { data: doc.data(), id: doc.id }; });
        var active = allDocs.filter(function (d) { return !d.data.customerHidden && !d.data.archived; })
          .sort(function (a, b) {
            var ta = a.data.createdAt && a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : Number(a.data.createdAt) || 0;
            var tb = b.data.createdAt && b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : Number(b.data.createdAt) || 0;
            return tb - ta;
          });
        // Auto-archive orders beyond the latest 5
        if (active.length > 5) {
          autoArchiveOldOrders(app.state.db, active.slice(5));
        }
        var orders = active.slice(0, 5).map(function (d) {
          return window.LeLeShanOrders.normalizeOrder(d.data, d.id);
        });
        renderMyOrders(app, listEl, orders);
      })
      .catch(function (error) {
        console.error("[Member] Failed to load orders.", error);
        listEl.innerHTML = '<p class="loading-text">載入訂單失敗，請稍後再試。</p>';
      });
  }

  function autoArchiveOldOrders(db, docsToArchive) {
    if (!docsToArchive || !docsToArchive.length) return;
    var batch = db.batch();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    docsToArchive.forEach(function (d) {
      batch.set(db.collection("orders").doc(d.id), {
        archived: true,
        archivedAt: now,
        updatedAt: now
      }, { merge: true });
    });
    batch.commit().catch(function (err) {
      console.warn("[Member] autoArchiveOldOrders failed.", err);
    });
  }

  function renderMyOrders(app, container, orders) {
    if (!orders.length) {
      container.innerHTML = '<p class="empty-text">目前沒有訂單紀錄。</p>';
      return;
    }

    container.innerHTML = orders.map(function (order) {
      var meta = window.LeLeShanOrders.statusMeta(order.status);
      var items = window.LeLeShanOrders.itemSummary(order.items, 3).join("、");
      var pickup = order.scheduled_pickup_time
        ? (order.scheduled_pickup_date + " " + order.scheduled_pickup_time)
        : "";
      var createdAt = window.LeLeShanOrders.formatDateTime(order.created_at || order.raw.createdAt);
      var isNew = order.status === "new";
      var idShort = order.id.slice(-8).toUpperCase();

      var actions = "";
      if (isNew) {
        actions = ''
          + '<div class="my-order__actions">'
          + '<button class="ghost-btn ghost-btn--sm" type="button" data-cancel-order="' + escapeHtml(order.id) + '">取消訂單</button>'
          + '<button class="ghost-btn ghost-btn--sm ghost-btn--muted" type="button" data-hide-order="' + escapeHtml(order.id) + '">刪除紀錄</button>'
          + '</div>';
      }

      return ''
        + '<article class="my-order">'
        + '<div class="my-order__head">'
        + '<span class="my-order__id">#' + escapeHtml(idShort) + '</span>'
        + '<span class="my-order__status my-order__status--' + escapeHtml(meta.tone) + '">' + escapeHtml(meta.label) + '</span>'
        + '</div>'
        + '<div class="my-order__body">'
        + '<div class="my-order__row"><span>品項</span><span>' + escapeHtml(items) + '</span></div>'
        + '<div class="my-order__row"><span>金額</span><strong>NT$\u00a0' + order.total + '</strong></div>'
        + (pickup ? '<div class="my-order__row"><span>取餐</span><span>' + escapeHtml(pickup) + '</span></div>' : '')
        + '<div class="my-order__row"><span>建立</span><span>' + escapeHtml(createdAt) + '</span></div>'
        + (order.pointsGranted ? '<div class="my-order__row"><span>點數</span><span>+' + Math.floor(order.total / 100) + ' 點</span></div>' : '')
        + '</div>'
        + actions
        + '</article>';
    }).join("");

    Array.prototype.slice.call(container.querySelectorAll("[data-cancel-order]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        cancelOrder(app, btn.getAttribute("data-cancel-order"));
      });
    });
    Array.prototype.slice.call(container.querySelectorAll("[data-hide-order]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        hideOrder(app, btn.getAttribute("data-hide-order"));
      });
    });
  }

  function cancelOrder(app, orderId) {
    if (!window.confirm("確定要取消這筆訂單嗎？")) return;
    app.state.db.collection("orders").doc(orderId).set({
      status: "cancelled",
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      cancelled_at: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      loadMyOrders(app);
    }).catch(function (error) {
      console.error("[Member] Cancel order failed.", error);
      window.alert("取消失敗：" + (error.message || "請稍後再試"));
    });
  }

  function hideOrder(app, orderId) {
    if (!window.confirm("確定要刪除這筆訂單紀錄嗎？（後台仍會保留）")) return;
    app.state.db.collection("orders").doc(orderId).set({
      customerHidden: true,
      customerDeletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      loadMyOrders(app);
    }).catch(function (error) {
      console.error("[Member] Hide order failed.", error);
      window.alert("刪除紀錄失敗：" + (error.message || "請稍後再試"));
    });
  }

  // === MEMBER CENTER ===
  function openMemberCenter(app) {
    if (!app.el.memberOverlay) return;
    if (!app.state.profile || !app.state.profile.userId) {
      app.modules.ui.setMessage(app, "請先登入 LINE 才能查看會員中心。", "error");
      return;
    }
    app.el.memberOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    switchMemberTab(app, "orders");
    loadMemberData(app);
    loadMyOrdersInMember(app);
  }

  function closeMemberCenter(app) {
    if (!app.el.memberOverlay) return;
    app.el.memberOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function switchMemberTab(app, tab) {
    var tabs = ["orders", "points", "info"];
    tabs.forEach(function (t) {
      var panel = document.getElementById("member-panel-" + t);
      var btn = document.getElementById("member-tab-" + t);
      if (panel) panel.classList.toggle("hidden", t !== tab);
      if (btn) btn.classList.toggle("member-tab--active", t === tab);
    });
    if (tab === "orders") loadMyOrdersInMember(app);
    if (tab === "points") loadPointHistory(app);
    if (tab === "info") renderMemberInfo(app);
  }

  function loadMemberData(app) {
    if (!app.state.db || !app.state.profile) return;
    var userId = app.state.profile.userId;
    app.state.db.collection("users").doc(userId).get().then(function (doc) {
      var memberData = doc.exists ? doc.data() : {};
      app.state.memberData = memberData;
      renderMemberSummary(app, memberData);
      renderMemberInfo(app);
    }).catch(function () {
      app.state.memberData = {};
      renderMemberSummary(app, {});
    });

    app.state.db.collection("point_rules")
      .where("storeId", "==", app.state.storeId)
      .where("enabled", "==", true)
      .limit(1).get()
      .then(function (snap) {
        if (snap.docs.length) {
          app.state.pointRule = snap.docs[0].data();
        }
      }).catch(function () {});
  }

  function renderMemberSummary(app, data) {
    var el = app.el.memberPointsSummary;
    if (!el) return;
    var points = Number(data.currentPoints || data.points || 0);
    var spent = Number(data.totalSpent || 0);
    var orderCount = Number(data.totalOrders || 0);
    var rule = app.state.pointRule;
    var ruleText = rule ? ("每消費 " + (rule.amountPerPoint || 100) + " 元得 " + (rule.pointsPerUnit || 1) + " 點") : "每消費 100 元得 1 點";

    el.innerHTML = ''
      + '<div class="member-stat"><strong>' + points + '</strong><span>目前點數</span></div>'
      + '<div class="member-stat"><strong>NT$\u00a0' + spent + '</strong><span>累積消費</span></div>'
      + '<div class="member-stat"><strong>' + orderCount + '</strong><span>訂單數</span></div>'
      + '<p class="member-rule-text">' + escapeHtml(ruleText) + '</p>';
  }

  function loadMyOrdersInMember(app) {
    var container = document.getElementById("member-orders-list");
    if (!container || !app.state.db || !app.state.profile) return;
    container.innerHTML = '<p class="loading-text">載入中...</p>';
    var userId = app.state.profile.userId;
    app.state.db.collection("orders")
      .where("lineUserId", "==", userId)
      .limit(60)
      .get()
      .then(function (snap) {
        var allDocs = snap.docs.map(function (doc) { return { data: doc.data(), id: doc.id }; });
        var active = allDocs.filter(function (d) { return !d.data.customerHidden && !d.data.archived; })
          .sort(function (a, b) {
            var ta = a.data.createdAt && a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : Number(a.data.createdAt) || 0;
            var tb = b.data.createdAt && b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : Number(b.data.createdAt) || 0;
            return tb - ta;
          });
        if (active.length > 5) {
          autoArchiveOldOrders(app.state.db, active.slice(5));
        }
        var orders = active.slice(0, 5).map(function (d) {
          return window.LeLeShanOrders.normalizeOrder(d.data, d.id);
        });
        renderMyOrders(app, container, orders);
      })
      .catch(function (error) {
        console.error("[Member] Load orders in member failed.", error);
        container.innerHTML = '<p class="loading-text">載入失敗</p>';
      });
  }

  function loadPointHistory(app) {
    var container = document.getElementById("member-point-history-list");
    if (!container || !app.state.db || !app.state.profile) return;
    container.innerHTML = '<p class="loading-text">載入中...</p>';
    var userId = app.state.profile.userId;
    app.state.db.collection("point_transactions")
      .where("lineUserId", "==", userId)
      .limit(50)
      .get()
      .then(function (snap) {
        var txns = snap.docs.map(function (doc) { var d = doc.data(); d.id = doc.id; return d; })
          .sort(function (a, b) {
            var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Number(a.createdAt) || 0;
            var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Number(b.createdAt) || 0;
            return tb - ta;
          }).slice(0, 30);
        renderPointHistory(container, txns);
      })
      .catch(function (error) {
        console.error("[Member] Load point history failed.", error);
        container.innerHTML = '<p class="loading-text">載入失敗</p>';
      });
  }

  function renderPointHistory(container, txns) {
    if (!txns.length) {
      container.innerHTML = '<p class="empty-text">目前沒有點數異動紀錄。</p>';
      return;
    }
    container.innerHTML = txns.map(function (txn) {
      var sign = txn.amount >= 0 ? "+" : "";
      var date = window.LeLeShanOrders.formatDateTime(txn.createdAt);
      var reason = txn.reason || "";
      var reasonMap = {
        order_complete: "訂單完成入點",
        manual_add: "後台手動加點",
        manual_deduct: "後台手動扣點"
      };
      var label = reasonMap[reason] || reason || "點數異動";
      return ''
        + '<div class="point-txn">'
        + '<div class="point-txn__left">'
        + '<strong>' + escapeHtml(label) + '</strong>'
        + '<span>' + escapeHtml(date) + '</span>'
        + (txn.orderId ? '<small>訂單 #' + escapeHtml(txn.orderId.slice(-8).toUpperCase()) + '</small>' : '')
        + '</div>'
        + '<span class="point-txn__amount point-txn__amount--' + (txn.amount >= 0 ? "plus" : "minus") + '">' + sign + txn.amount + ' 點</span>'
        + '</div>';
    }).join("");
  }

  function renderMemberInfo(app) {
    var el = document.getElementById("member-info-content");
    if (!el) return;
    var profile = app.state.profile || {};
    var data = app.state.memberData || {};
    var lastOrder = data.lastOrderAt ? window.LeLeShanOrders.formatDateTime(data.lastOrderAt) : "無";
    var createdAt = data.createdAt ? window.LeLeShanOrders.formatDateTime(data.createdAt) : "首次使用";
    el.innerHTML = ''
      + '<div class="member-info-row"><span>顯示名稱</span><strong>' + escapeHtml(profile.displayName || "未設定") + '</strong></div>'
      + '<div class="member-info-row"><span>會員編號</span><strong>' + escapeHtml(profile.userId ? profile.userId.slice(-10) : "—") + '</strong></div>'
      + '<div class="member-info-row"><span>目前點數</span><strong>' + Number(data.currentPoints || data.points || 0) + ' 點</strong></div>'
      + '<div class="member-info-row"><span>累積消費</span><strong>NT$\u00a0' + Number(data.totalSpent || 0) + '</strong></div>'
      + '<div class="member-info-row"><span>累積訂單</span><strong>' + Number(data.totalOrders || 0) + ' 筆</strong></div>'
      + '<div class="member-info-row"><span>最後下單</span><strong>' + escapeHtml(lastOrder) + '</strong></div>'
      + '<div class="member-info-row"><span>註冊時間</span><strong>' + escapeHtml(createdAt) + '</strong></div>';
  }

  function showOrderSuccess(app, orderId, cartSnapshot, pickupLabel) {
    var panel = app.el.orderSuccessPanel;
    if (!panel) return;

    var orderTotal = (cartSnapshot || []).reduce(function (sum, item) {
      return sum + Number(item.price || 0);
    }, 0);
    var itemLines = (cartSnapshot || []).map(function (item) {
      var detail = [];
      if (item.flavorName) detail.push(item.flavorName);
      if (item.stapleName) detail.push("主食：" + item.stapleName);
      return '<li><div><strong>' + escapeHtml(item.name) + '</strong>' + (detail.length ? '<span>' + escapeHtml(detail.join(" / ")) + '</span>' : '') + '</div><strong>×' + Number(item.quantity || 0) + ' / NT$\u00a0' + Number(item.price || 0) + "</strong></li>";
    }).join("");
    var orderIdShort = orderId ? orderId.slice(-8).toUpperCase() : "";

    panel.innerHTML = ''
      + '<div class="success-panel__card">'
      + '<div class="success-panel__icon">✓</div>'
      + '<h2>訂單已送出</h2>'
      + '<p class="success-panel__order-id">訂單編號：' + escapeHtml(orderIdShort) + '</p>'
      + (pickupLabel ? '<p class="success-panel__pickup">取餐時間：' + escapeHtml(pickupLabel) + '</p>' : '')
      + (itemLines ? '<div class="success-panel__items"><div class="success-panel__summary-head"><strong>訂單摘要</strong><strong>NT$\u00a0' + orderTotal + '</strong></div><ul>' + itemLines + '</ul></div>' : '')
      + '<div class="success-panel__actions">'
      + '<button id="order-success-orders-btn" class="primary-btn" type="button">查看我的訂單</button>'
      + '<button id="order-success-menu-btn" class="ghost-btn" type="button">返回菜單</button>'
      + '</div>'
      + '</div>';

    panel.classList.remove("hidden");
    if (app.el.checkoutSection) app.el.checkoutSection.classList.add("hidden");

    bind("order-success-orders-btn", function () { closeOrderSuccess(app); openMyOrders(app); });
    bind("order-success-menu-btn", function () { closeOrderSuccess(app); });

    requestAnimationFrame(function () {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function loadMemberData(app) {
    if (!app.state.db || !app.state.profile) return;
    var userId = app.state.profile.userId;
    app.state.db.collection("users").doc(userId).get().then(function (doc) {
      var memberData = doc.exists ? doc.data() : {};
      app.state.memberData = memberData;
      renderMemberSummary(app, memberData);
      renderMemberInfo(app);
    }).catch(function () {
      app.state.memberData = {};
      renderMemberSummary(app, {});
    });

    loadPointRule(app);
  }

  function loadPointRule(app) {
    app.state.db.collection("point_rules")
      .where("storeId", "==", app.state.storeId)
      .limit(5).get()
      .then(function (snap) {
        var rules = snap.docs.map(function (doc) {
          var item = doc.data();
          item.id = doc.id;
          return item;
        });
        app.state.pointRule = rules.find(function (rule) {
          return rule.enabled && (!rule.activeRuleId || rule.activeRuleId === rule.id);
        }) || rules.find(function (rule) {
          return rule.enabled;
        }) || rules[0] || null;
        renderMemberSummary(app, app.state.memberData || {});
      }).catch(function () {});
  }

  function describePointRule(rule) {
    if (!rule || rule.enabled === false) return "目前未啟用點數累積";
    var amount = Number(rule.amountPerPoint || rule.spendX_getY && rule.spendX_getY.x || 100) || 100;
    var points = Number(rule.pointsPerUnit || rule.spendX_getY && rule.spendX_getY.y || 1) || 1;
    return "每消費 " + amount + " 元得 " + points + " 點";
  }

  function renderMemberSummary(app, data) {
    var el = app.el.memberPointsSummary;
    if (!el) return;
    var points = Number(data.currentPoints || data.points || 0);
    var spent = Number(data.totalSpent || 0);
    var orderCount = Number(data.totalOrders || 0);
    var ruleText = describePointRule(app.state.pointRule);

    el.innerHTML = ''
      + '<div class="member-stat"><strong>' + points + '</strong><span>目前點數</span></div>'
      + '<div class="member-stat"><strong>NT$\u00a0' + spent + '</strong><span>累積消費</span></div>'
      + '<div class="member-stat"><strong>' + orderCount + '</strong><span>訂單數</span></div>'
      + '<p class="member-rule-text">' + escapeHtml(ruleText) + '</p>';
  }

  function loadPointHistory(app) {
    var container = document.getElementById("member-point-history-list");
    if (!container || !app.state.db || !app.state.profile) return;
    container.innerHTML = '<p class="loading-text">載入中...</p>';
    var userId = app.state.profile.userId;
    loadUserPointLogs(app.state.db, userId, 30)
      .then(function (txns) {
        renderPointHistory(container, txns);
      })
      .catch(function (error) {
        console.error("[Member] Load point history failed.", error);
        container.innerHTML = '<p class="loading-text">載入失敗</p>';
      });
  }

  function loadUserPointLogs(db, userId, limitCount) {
    return Promise.all([
      db.collection("point_logs").where("lineUserId", "==", userId).limit((limitCount || 30) * 2).get().catch(function () { return { docs: [] }; }),
      db.collection("point_transactions").where("lineUserId", "==", userId).limit((limitCount || 30) * 2).get().catch(function () { return { docs: [] }; })
    ]).then(function (snaps) {
      var merged = {};
      snaps.forEach(function (snap) {
        (snap.docs || []).forEach(function (doc) {
          var item = doc.data();
          item.id = doc.id;
          merged[item.id] = item;
        });
      });
      return Object.keys(merged).map(function (key) { return merged[key]; }).sort(function (left, right) {
        return toMillis(right.createdAt) - toMillis(left.createdAt);
      });
    });
  }

  function renderPointHistory(container, txns) {
    if (!txns.length) {
      container.innerHTML = '<p class="empty-text">目前沒有點數異動紀錄。</p>';
      return;
    }
    container.innerHTML = txns.map(function (txn) {
      var amount = Number(txn.delta != null ? txn.delta : txn.amount || 0);
      var sign = amount >= 0 ? "+" : "";
      var date = window.LeLeShanOrders.formatDateTime(txn.createdAt);
      var reason = txn.reason || "";
      var reasonMap = {
        order_complete: "訂單完成回饋",
        manual_add: "後台手動加點",
        manual_deduct: "後台手動扣點"
      };
      var label = reasonMap[reason] || reason || "點數異動";
      return ''
        + '<div class="point-txn">'
        + '<div class="point-txn__left">'
        + '<strong>' + escapeHtml(label) + '</strong>'
        + '<span>' + escapeHtml(date) + '</span>'
        + (txn.orderId ? '<small>訂單 #' + escapeHtml(txn.orderId.slice(-8).toUpperCase()) + '</small>' : '')
        + '</div>'
        + '<span class="point-txn__amount point-txn__amount--' + (amount >= 0 ? "plus" : "minus") + '">' + sign + amount + ' 點</span>'
        + '</div>';
    }).join("");
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    return new Date(value).getTime() || 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.LeLeShanMember = { init: init };
})();
