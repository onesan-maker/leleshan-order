(function () {
  var PUBLIC_BOARD_STATUSES = ["cooking", "packing", "ready"];
  var ACTIVE_QUEUE_STATUSES = ["new", "cooking", "packing"];
  var STATUS_META = {
    new: { label: "新訂單", tone: "new" },
    cooking: { label: "製作中", tone: "cooking" },
    packing: { label: "包裝中", tone: "packing" },
    ready: { label: "可取餐", tone: "ready" },
    completed: { label: "已完成", tone: "picked" },
    picked_up: { label: "已取餐", tone: "picked" },
    cancelled: { label: "已取消", tone: "cancelled" }
  };
  var LEGACY_STATUS_MAP = {
    preparing: "cooking",
    done: "ready"
  };
  var SOURCE_LABELS = {
    liff: "你訂",
    onsite: "現場顧客",
    uber: "UberEats",
    foodpanda: "Foodpanda",
    manual: "人工建立"
  };
  var STATUS_DEFAULT_MINUTES = {
    new: 5,
    cooking: 6,
    packing: 2,
    ready: 0,
    completed: 0,
    picked_up: 0,
    cancelled: 0
  };

  function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function resolve(value, fallback) {
    return value == null || value === "" ? fallback : value;
  }

  function mapLegacyStatus(status) {
    return LEGACY_STATUS_MAP[status] || status || "new";
  }

  function sourceLabel(source) {
    return SOURCE_LABELS[source] || "現場顧客";
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function toMillis(value) {
    var dateValue = toDate(value);
    return dateValue ? dateValue.getTime() : 0;
  }

  function now() {
    return new Date();
  }

  function formatDateTime(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleString("zh-TW", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatTime(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleTimeString("zh-TW", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDate(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleDateString("zh-TW");
  }

  function elapsedMinutes(fromValue) {
    var millis = toMillis(fromValue);
    if (!millis) return 0;
    return Math.max(0, Math.floor((Date.now() - millis) / 60000));
  }

  function isFutureScheduled(order) {
    return toMillis(order.scheduled_pickup_at) > Date.now() + 5 * 60000;
  }

  function normalizeItem(item) {
    var unitPrice = Number(resolve(item && (item.unit_price || item.price), 0));
    var qty = Number(resolve(item && item.qty, 0));
    var subtotal = Number(resolve(item && item.subtotal, unitPrice * qty));
    return {
      sku: resolve(item && (item.sku || item.itemId), ""),
      itemId: resolve(item && (item.itemId || item.sku), ""),
      name: resolve(item && item.name, "未命名品項"),
      qty: qty,
      flavor: resolve(item && item.flavor, resolve(item && item.flavorName, "")),
      options: Array.isArray(item && item.options) ? item.options : [],
      unit_price: unitPrice,
      price: unitPrice,
      subtotal: subtotal,
      item_note: resolve(item && (item.item_note || item.note), "")
    };
  }

  function deriveDisplayName(data) {
    if (data.display_name) return data.display_name;
    if (data.customer_name && data.label) return data.label + " " + data.customer_name;
    if (data.customer_name) return data.customer_name;
    if (data.label) return data.label;
    return "現場顧客";
  }

  function normalizeOrder(input, docId) {
    var data = input || {};
    var items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];
    var subtotal = Number(resolve(data.subtotal, resolve(data.totalAmount, resolve(data.totalPrice, 0))));
    if (!subtotal && items.length) {
      subtotal = items.reduce(function (sum, item) { return sum + Number(item.subtotal || 0); }, 0);
    }
    var total = Number(resolve(data.total, resolve(data.totalAmount, resolve(data.totalPrice, subtotal))));
    var normalized = {
      id: resolve(data.id, docId || ""),
      storeId: resolve(data.storeId, data.store_id || (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1"),
      customer_name: resolve(data.customer_name, resolve(data.userName, resolve(data.pickupName, resolve(data.name, "")))),
      customer_phone: resolve(data.customer_phone, resolve(data.customerPhone, "")),
      label: resolve(data.label, sourceLabel(resolve(data.source, "liff"))),
      source: resolve(data.source, "liff"),
      display_name: resolve(data.display_name, ""),
      display_code: resolve(data.display_code, ""),
      status: mapLegacyStatus(data.status),
      items: items,
      subtotal: subtotal,
      total: total,
      note: resolve(data.note, ""),
      internal_note: resolve(data.internal_note, resolve(data.internalNote, "")),
      scheduled_pickup_date: resolve(data.scheduled_pickup_date, resolve(data.pickupDateValue, "")),
      scheduled_pickup_time: resolve(data.scheduled_pickup_time, resolve(data.pickupTime, "")),
      scheduled_pickup_at: resolve(data.scheduled_pickup_at, resolve(data.pickupDateTimeISO, "")),
      estimated_minutes: typeof data.estimated_minutes === "number" ? data.estimated_minutes : null,
      queue_number: resolve(data.queue_number, 0),
      created_at: resolve(data.created_at, data.createdAt),
      started_at: resolve(data.started_at, data.startedAt),
      packed_at: resolve(data.packed_at, data.packedAt),
      ready_at: resolve(data.ready_at, data.readyAt),
      completed_at: resolve(data.completed_at, data.completedAt),
      picked_up_at: resolve(data.picked_up_at, data.pickedUpAt),
      cancelled_at: resolve(data.cancelled_at, data.cancelledAt),
      updated_at: resolve(data.updated_at, data.updatedAt),
      inventoryAdjusted: !!data.inventoryAdjusted,
      pointsGranted: !!data.pointsGranted,
      userId: resolve(data.userId, ""),
      lineUserId: resolve(data.lineUserId, ""),
      raw: data
    };
    normalized.display_name = deriveDisplayName(normalized);
    return normalized;
  }

  function buildCreatePayload(options) {
    var status = mapLegacyStatus(options.status || "new");
    var source = options.source || "liff";
    var label = options.label || sourceLabel(source);
    var createdAt = serverTimestamp();
    var itemList = (options.items || []).map(normalizeItem);
    var subtotal = Number(resolve(options.subtotal, itemList.reduce(function (sum, item) {
      return sum + Number(item.subtotal || 0);
    }, 0)));
    var total = Number(resolve(options.total, subtotal));
    var payload = {
      id: options.id,
      storeId: options.storeId,
      customer_name: resolve(options.customer_name, ""),
      customer_phone: resolve(options.customer_phone, ""),
      label: label,
      source: source,
      display_name: resolve(options.display_name, label + (options.customer_name ? " " + options.customer_name : "")),
      display_code: resolve(options.display_code, ""),
      status: status,
      items: itemList,
      subtotal: subtotal,
      total: total,
      note: resolve(options.note, ""),
      internal_note: resolve(options.internal_note, ""),
      scheduled_pickup_date: resolve(options.scheduled_pickup_date, ""),
      scheduled_pickup_time: resolve(options.scheduled_pickup_time, ""),
      scheduled_pickup_at: resolve(options.scheduled_pickup_at, ""),
      estimated_minutes: STATUS_DEFAULT_MINUTES[status],
      queue_number: resolve(options.queue_number, Date.now()),
      created_at: createdAt,
      updated_at: createdAt,
      createdAt: createdAt,
      updatedAt: createdAt,
      totalAmount: total,
      totalPrice: total,
      memberId: resolve(options.memberId, resolve(options.userId, null)),
      userId: resolve(options.userId, null),
      lineUserId: resolve(options.lineUserId, null),
      userName: resolve(options.customer_name, ""),
      paymentMethod: resolve(options.paymentMethod, "cash"),
      inventoryAdjusted: false,
      pointsGranted: false,
      earnedPoints: Number(resolve(options.earnedPoints, Math.floor(total / 100))),
      pickupDateLabel: resolve(options.pickupDateLabel, ""),
      pickupDateValue: resolve(options.scheduled_pickup_date, ""),
      pickupTime: resolve(options.scheduled_pickup_time, ""),
      pickupDateTimeISO: resolve(options.scheduled_pickup_at, ""),
      storeStatusAtCheckout: resolve(options.storeStatusAtCheckout, ""),
      appliedPromotion: resolve(options.appliedPromotion, null)
    };
    return payload;
  }

  function sortOrdersByCreatedAsc(list) {
    return list.slice().sort(function (left, right) {
      return toMillis(left.created_at) - toMillis(right.created_at);
    });
  }

  function estimateMinutes(order, orders) {
    var status = mapLegacyStatus(order.status);
    if (status === "ready" || status === "completed" || status === "picked_up" || status === "cancelled") return 0;
    if (typeof order.estimated_minutes === "number" && order.estimated_minutes >= 0) return order.estimated_minutes;
    if (status === "packing") return 2;
    if (status === "cooking") {
      var elapsed = elapsedMinutes(order.started_at || order.created_at);
      return Math.max(3, 8 - Math.min(5, Math.floor(elapsed / 2)));
    }

    var queue = sortOrdersByCreatedAsc(orders || []).filter(function (item) {
      return ACTIVE_QUEUE_STATUSES.indexOf(mapLegacyStatus(item.status)) >= 0
        && toMillis(item.created_at) <= toMillis(order.created_at);
    });
    var ahead = Math.max(0, queue.length - 1);
    if (ahead <= 1) return 5;
    if (ahead <= 3) return 8;
    if (ahead <= 5) return 12;
    return 18;
  }

  function etaText(order, orders) {
    var status = mapLegacyStatus(order.status);
    if (status === "ready") return "可取餐";
    if (status === "completed") return "已完成";
    if (status === "picked_up") return "已取餐";
    if (status === "cancelled") return "已取消";
    var minutes = estimateMinutes(order, orders);
    if (status === "packing" && minutes <= 1) return "即將完成";
    if (minutes <= 0) return "即將完成";
    return "約 " + minutes + " 分";
  }

  function statusMeta(status) {
    return STATUS_META[mapLegacyStatus(status)] || STATUS_META.new;
  }

  function buildTimelineUpdates(order, nextStatus) {
    var updates = {
      status: nextStatus,
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      estimated_minutes: STATUS_DEFAULT_MINUTES[nextStatus]
    };
    if (!order.created_at && !order.raw.createdAt && !order.raw.created_at) {
      updates.created_at = serverTimestamp();
      updates.createdAt = serverTimestamp();
    }
    if (nextStatus === "cooking" && !order.started_at) {
      updates.started_at = serverTimestamp();
      updates.startedAt = serverTimestamp();
    }
    if (nextStatus === "packing") {
      updates.packed_at = serverTimestamp();
      updates.packedAt = serverTimestamp();
    }
    if (nextStatus === "ready") {
      updates.ready_at = serverTimestamp();
      updates.readyAt = serverTimestamp();
    }
    if (nextStatus === "completed") {
      updates.completed_at = serverTimestamp();
      updates.completedAt = serverTimestamp();
      if (!order.ready_at) {
        updates.ready_at = serverTimestamp();
        updates.readyAt = serverTimestamp();
      }
    }
    if (nextStatus === "picked_up") {
      updates.picked_up_at = serverTimestamp();
      updates.pickedUpAt = serverTimestamp();
    }
    if (nextStatus === "cancelled") {
      updates.cancelled_at = serverTimestamp();
      updates.cancelledAt = serverTimestamp();
    }
    return updates;
  }

  function subscribeStoreOrders(options) {
    var db = options.db;
    var storeId = options.storeId;
    return db.collection("orders").where("storeId", "==", storeId).onSnapshot(function (snapshot) {
      var orders = snapshot.docs.map(function (doc) {
        return normalizeOrder(doc.data(), doc.id);
      });
      console.log("[Orders] Snapshot received.", { storeId: storeId, count: orders.length });
      if (typeof options.onData === "function") options.onData(orders);
    }, function (error) {
      console.error("[Orders] Snapshot failed.", error);
      if (typeof options.onError === "function") options.onError(error);
    });
  }

  async function updateOrderStatus(options) {
    var db = options.db;
    var orderId = options.orderId;
    var storeId = options.storeId;
    var nextStatus = mapLegacyStatus(options.nextStatus);
    console.log("[Orders] Updating status.", {
      orderId: orderId,
      storeId: storeId,
      nextStatus: nextStatus
    });
    var ref = db.collection("orders").doc(orderId);
    await db.runTransaction(async function (tx) {
      var snap = await tx.get(ref);
      if (!snap.exists) throw new Error("找不到訂單資料");
      var order = normalizeOrder(snap.data(), snap.id);
      if (storeId && order.storeId !== storeId) throw new Error("訂單不屬於目前門市");

      var updates = buildTimelineUpdates(order, nextStatus);
      if (!order.inventoryAdjusted && ["cooking", "packing", "ready", "picked_up"].indexOf(nextStatus) >= 0) {
        order.items.forEach(function (item) {
          var sku = item.sku || item.itemId;
          if (!sku || !item.qty) return;
          tx.set(db.collection("inventory").doc(order.storeId + "_" + sku), {
            storeId: order.storeId,
            itemId: sku,
            stock: firebase.firestore.FieldValue.increment(-Math.abs(Number(item.qty || 0))),
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        updates.inventoryAdjusted = true;
      }

      if (!order.pointsGranted && nextStatus === "completed" && order.userId) {
        var pointRule = options.pointRule || { amountPerPoint: 100, pointsPerUnit: 1 };
        var amountPerPoint = Number(pointRule.amountPerPoint || pointRule.spendX_getY && pointRule.spendX_getY.x || 100) || 100;
        var pointsPerUnit = Number(pointRule.pointsPerUnit || pointRule.spendX_getY && pointRule.spendX_getY.y || 1) || 1;
        var earnedPoints = Math.floor(Number(order.total || 0) / amountPerPoint) * pointsPerUnit;
        var userRef = db.collection("users").doc(order.userId);
        var userSnap = await tx.get(userRef);
        var currentPoints = userSnap.exists ? Number(userSnap.data().currentPoints || userSnap.data().points || 0) : 0;
        tx.set(userRef, {
          memberId: order.memberId || order.userId,
          userId: order.userId,
          storeId: order.storeId,
          name: order.customer_name || "",
          lineUserId: order.lineUserId || "",
          currentPoints: firebase.firestore.FieldValue.increment(earnedPoints),
          totalEarnedPoints: firebase.firestore.FieldValue.increment(earnedPoints),
          points: firebase.firestore.FieldValue.increment(earnedPoints),
          lastPointAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });

        var pointLogPayload = {
          userId: order.userId,
          lineUserId: order.lineUserId || "",
          storeId: order.storeId,
          orderId: orderId,
          delta: earnedPoints,
          amount: earnedPoints,
          beforePoints: currentPoints,
          afterPoints: currentPoints + earnedPoints,
          reason: "order_complete",
          source: "system",
          operator: options.actorUid || "system",
          operatorName: options.actorName || "",
          createdAt: serverTimestamp()
        };
        var txnId = "pt_" + orderId + "_" + Date.now();
        tx.set(db.collection("point_transactions").doc(txnId), pointLogPayload);
        tx.set(db.collection("point_logs").doc(txnId), pointLogPayload);

        updates.pointsGranted = true;
        updates.earnedPoints = earnedPoints;
      }

      if (options.actorUid) updates.last_status_actor_uid = options.actorUid;
      if (options.actorName) updates.last_status_actor_name = options.actorName;
      tx.set(ref, updates, { merge: true });
    });
  }

  function safeName(order) {
    return order.display_name || order.customer_name || order.label || order.id;
  }

  function itemSummary(items, maxLines) {
    var normalized = Array.isArray(items) ? items.map(normalizeItem) : [];
    var lines = normalized.slice(0, maxLines || normalized.length).map(function (item) {
      var detail = [];
      if (item.flavor) detail.push(item.flavor);
      if (Array.isArray(item.options) && item.options.length) {
        detail.push(item.options.map(function (option) {
          return typeof option === "string" ? option : option.name || option.label || "";
        }).filter(Boolean).join(" / "));
      }
      return item.name + " x" + Number(item.qty || 0) + (detail.length ? " (" + detail.join("、") + ")" : "");
    });
    if (normalized.length > lines.length) lines.push("...還有 " + (normalized.length - lines.length) + " 項");
    return lines;
  }

  window.LeLeShanOrders = {
    PUBLIC_BOARD_STATUSES: PUBLIC_BOARD_STATUSES,
    ACTIVE_QUEUE_STATUSES: ACTIVE_QUEUE_STATUSES,
    mapLegacyStatus: mapLegacyStatus,
    sourceLabel: sourceLabel,
    normalizeItem: normalizeItem,
    normalizeOrder: normalizeOrder,
    buildCreatePayload: buildCreatePayload,
    sortOrdersByCreatedAsc: sortOrdersByCreatedAsc,
    estimateMinutes: estimateMinutes,
    etaText: etaText,
    statusMeta: statusMeta,
    buildTimelineUpdates: buildTimelineUpdates,
    subscribeStoreOrders: subscribeStoreOrders,
    updateOrderStatus: updateOrderStatus,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    formatTime: formatTime,
    elapsedMinutes: elapsedMinutes,
    isFutureScheduled: isFutureScheduled,
    safeName: safeName,
    itemSummary: itemSummary,
    toDate: toDate,
    toMillis: toMillis
  };
})();
