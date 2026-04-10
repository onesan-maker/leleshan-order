(function () {
  function init(app) {
    app.modules.checkout = api(app);
  }

  function api(app) {
    return {
      initializePickupSelection: function () { initializePickupSelection(app); },
      getAvailablePickupDates: function () { return getAvailablePickupDates(app); },
      generatePickupSlots: function (dateValue) { return generatePickupSlots(app, dateValue); },
      savePendingCheckoutState: function () { savePendingCheckoutState(app); },
      restorePendingCheckoutState: function () { return restorePendingCheckoutState(app); },
      clearPendingCheckoutState: function () { return clearPendingCheckoutState(app); },
      saveCheckoutDraftState: function () { saveCheckoutDraftState(app); },
      restoreCheckoutDraftState: function () { return restoreCheckoutDraftState(app); },
      handleSubmit: function (event) { return handleSubmit(app, event); },
      scrollToCheckoutArea: function () { scrollToCheckoutArea(app); }
    };
  }

  function initializePickupSelection(app) {
    app.state.pickupDateOptions = getAvailablePickupDates(app);
    if (!app.state.pickupDateOptions.length) {
      app.state.pickupDateLabel = "";
      app.state.pickupDateValue = "";
      app.state.pickupTimeOptions = [];
      app.state.pickupTime = "";
      return;
    }
    app.state.pickupDateLabel = app.state.pickupDateOptions[0].label;
    app.state.pickupDateValue = app.state.pickupDateOptions[0].value;
    app.state.pickupTimeOptions = generatePickupSlots(app, app.state.pickupDateValue);
    app.state.pickupTime = app.state.pickupTimeOptions[0] || "";
  }

  function getAvailablePickupDates(app) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var closingTime = (app && app.state.settings && app.state.settings.openTo) || "22:50";
    var todayEnd = buildPickupDateTime(today, closingTime);
    var options = [];
    if (now <= todayEnd) options.push({ label: formatDateValue(today), value: formatDateValue(today) });
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    options.push({ label: formatDateValue(tomorrow), value: formatDateValue(tomorrow) });
    return options;
  }

  function generatePickupSlots(app, dateValue) {
    if (!dateValue) return [];
    var now = new Date();
    var targetDate = parseDateValue(dateValue);
    if (!targetDate) return [];
    var openFrom = (app.state.settings && app.state.settings.openFrom) || "17:40";
    var openTo = (app.state.settings && app.state.settings.openTo) || "22:50";
    var fromParts = openFrom.split(":").map(Number);
    var toParts = openTo.split(":").map(Number);
    var startMinutes = fromParts[0] * 60 + (fromParts[1] || 0);
    var endMinutes = toParts[0] * 60 + (toParts[1] || 0);
    var minimumMinutes = startMinutes;

    if (isSameDate(targetDate, now)) {
      if (now.getHours() * 60 + now.getMinutes() > endMinutes) return [];
      if (now >= buildPickupDateTime(targetDate, openFrom) && now <= buildPickupDateTime(targetDate, openTo)) {
        minimumMinutes = Math.max(startMinutes, roundMinutesUp(now.getHours() * 60 + now.getMinutes(), 10));
      }
    }

    var slots = [];
    for (var minutes = startMinutes; minutes <= endMinutes; minutes += 10) {
      if (minutes < minimumMinutes) continue;
      slots.push(formatMinutes(minutes));
    }
    console.log("[Pickup] Generated pickup slots.", {
      dateValue: dateValue,
      slotCount: slots.length,
      firstSlot: slots[0] || "",
      lastSlot: slots[slots.length - 1] || ""
    });
    return slots;
  }

  function snapshotCheckoutForm(app) {
    return {
      customerName: app.el.customerName ? (app.el.customerName.value || "").trim() : "",
      pickupName: app.el.customerName ? (app.el.customerName.value || "").trim() : "",
      pickupDate: app.state.pickupDateValue || "",
      pickupDateLabel: app.state.pickupDateLabel || "",
      pickupTime: app.state.pickupTime || "",
      note: app.el.orderNote ? (app.el.orderNote.value || "").trim() : ""
    };
  }

  function savePendingCheckoutState(app) {
    window.LeLeShanStorage.savePendingCheckoutState({
      cart: app.state.cart,
      form: snapshotCheckoutForm(app),
      returnTo: { step: 4, scrollToBottom: true, focusField: "customerName" },
      timestamp: Date.now()
    });
    console.log("[Checkout] Pending checkout state saved before LINE login.", {
      cartItems: app.state.cart.length,
      pickupDate: app.state.pickupDateValue,
      pickupTime: app.state.pickupTime
    });
  }

  function restorePendingCheckoutState(app) {
    if (app.state.pendingCheckoutRestored) return false;
    var pending = window.LeLeShanStorage.loadPendingCheckoutState();
    if (window.LeLeShanStorage.isPendingCheckoutExpired(pending.timestamp)) {
      console.log("[Checkout] Pending checkout state expired and will be cleared.");
      clearPendingCheckoutState(app);
      return false;
    }
    if (!Array.isArray(pending.cart) || !pending.form) return false;

    applyRestoredCheckoutState(app, pending.cart, pending.form, true);
    app.state.pendingCheckoutRestored = true;
    clearPendingCheckoutState(app);

    if (pending.returnTo && pending.returnTo.scrollToBottom) {
      scrollToCheckoutArea(app);
    }
    console.log("[Checkout] Pending checkout restored after LINE login.", {
      cartItems: app.state.cart.length,
      pickupDate: app.state.pickupDateValue,
      pickupTime: app.state.pickupTime
    });
    return true;
  }

  function clearPendingCheckoutState() {
    window.LeLeShanStorage.clearPendingCheckoutState();
  }

  function saveCheckoutDraftState(app) {
    window.LeLeShanStorage.saveCheckoutDraft({
      cart: app.state.cart,
      form: snapshotCheckoutForm(app)
    });
  }

  function restoreCheckoutDraftState(app) {
    var pending = window.LeLeShanStorage.loadPendingCheckoutState();
    if (Array.isArray(pending.cart)) return false;
    var draft = window.LeLeShanStorage.loadCheckoutDraft();
    if (!Array.isArray(draft.cart) || !draft.form) return false;
    applyRestoredCheckoutState(app, draft.cart, draft.form, false);
    console.log("[Checkout] General checkout draft restored.", {
      cartItems: app.state.cart.length,
      pickupDate: app.state.pickupDateValue,
      pickupTime: app.state.pickupTime
    });
    return true;
  }

  function applyRestoredCheckoutState(app, cartSnapshot, formSnapshot, preferProfileDisplayName) {
    app.state.cart = window.LeLeShanStorage.cloneJSON(cartSnapshot || []);
    if (typeof formSnapshot.pickupDate === "string" && formSnapshot.pickupDate) {
      app.state.pickupDateValue = formSnapshot.pickupDate;
      app.state.pickupDateLabel = formSnapshot.pickupDateLabel || formSnapshot.pickupDate;
    }
    app.modules.ui.renderPickupDateOptions(app);
    if (typeof formSnapshot.pickupDate === "string" && formSnapshot.pickupDate && app.el.pickupDate) {
      if (app.state.pickupDateOptions.some(function (item) { return item.value === formSnapshot.pickupDate; })) {
        app.el.pickupDate.value = formSnapshot.pickupDate;
        app.state.pickupDateValue = formSnapshot.pickupDate;
        app.state.pickupDateLabel = formSnapshot.pickupDateLabel || formSnapshot.pickupDate;
      }
    }
    app.modules.ui.renderPickupTimeOptions(app);
    if (typeof formSnapshot.pickupTime === "string" && formSnapshot.pickupTime && app.el.pickupTime) {
      if (app.state.pickupTimeOptions.indexOf(formSnapshot.pickupTime) >= 0) {
        app.el.pickupTime.value = formSnapshot.pickupTime;
        app.state.pickupTime = formSnapshot.pickupTime;
      }
    }
    if (app.el.orderNote) app.el.orderNote.value = formSnapshot.note || "";
    if (app.el.customerName) {
      var restoredName = formSnapshot.customerName || formSnapshot.pickupName || "";
      if (!restoredName && preferProfileDisplayName && app.state.profile && app.state.profile.displayName) {
        restoredName = app.state.profile.displayName;
      }
      if (restoredName) app.el.customerName.value = restoredName;
      else if (!app.el.customerName.value && app.state.profile && app.state.profile.displayName) app.el.customerName.value = app.state.profile.displayName;
    }
    app.modules.cart.renderCart();
    saveCheckoutDraftState(app);
  }

  function scrollToCheckoutArea(app) {
    var target = app.el.checkoutSection || app.el.submitBtn;
    if (!target) return;
    requestAnimationFrame(function () {
      setTimeout(function () {
        target.scrollIntoView({ behavior: "smooth", block: "end" });
        setTimeout(function () {
          window.scrollBy({ top: 48, left: 0, behavior: "smooth" });
          if (app.el.customerName) app.el.customerName.focus();
        }, 280);
      }, 60);
    });
  }

  function validatePickupSelection(app) {
    if (!app.state.pickupDateValue) {
      app.modules.ui.setMessage(app, "請先選擇取餐日期。", "error");
      return false;
    }
    if (!app.state.pickupTime) {
      app.modules.ui.setMessage(app, "請先選擇取餐時間。", "error");
      return false;
    }
    return true;
  }

  async function handleSubmit(app, event) {
    event.preventDefault();
    console.log("[Order] handleSubmit triggered.");
    if (!app.modules.cart.allowOrder()) return;
    if (app.state.submitting) return;
    if (!app.state.db) {
      app.modules.ui.setMessage(app, "Firestore 尚未初始化完成。", "error");
      return;
    }
    if (!app.state.cart.length) {
      app.modules.ui.setMessage(app, "請先加入購物車品項。", "error");
      return;
    }
    if (!window.liff) {
      app.modules.ui.setMessage(app, "LIFF SDK 尚未載入，請稍後再試。", "error");
      return;
    }
    if (!liff.isLoggedIn()) {
      app.modules.ui.openLoginRequiredModal(app);
      return;
    }

    var customerName = (app.el.customerName && app.el.customerName.value || "").trim();
    if (!customerName) {
      app.modules.ui.setMessage(app, "請先填寫取餐稱呼。", "error");
      return;
    }
    if (!validatePickupSelection(app)) return;

    app.state.submitting = true;
    app.modules.ui.syncControls(app);

    var totalPrice = app.modules.cart.totalPrice();
    var ref = app.state.db.collection("orders").doc();
    var todayStr = getTodayDateStr();
    var counterRef = app.state.db.collection("order_counters").doc(todayStr);

    var payload = window.LeLeShanOrders.buildCreatePayload({
      id: ref.id,
      storeId: app.state.storeId,
      customer_name: customerName,
      source: "liff",
      label: "你訂",
      display_name: "你訂 " + customerName,
      items: app.state.cart.map(function (item) {
        var quantity = Number(item.quantity || 0);
        var unitPrice = Number(item.unitPrice || 0);
        return {
          sku: item.itemId,
          itemId: item.itemId,
          type: item.type || "",
          name: item.name,
          qty: quantity,
          flavorId: item.flavorId || "",
          flavor: item.flavorName,
          stapleId: item.stapleId || "",
          staple: item.stapleName || "",
          priceAdjustment: Number(item.priceAdjustment || 0),
          options: item.options || [],
          unit_price: unitPrice,
          price: unitPrice,
          subtotal: unitPrice * quantity,
          item_note: item.itemNote || ""
        };
      }),
      subtotal: totalPrice,
      total: totalPrice,
      status: "new",
      userId: app.state.profile ? app.state.profile.userId : null,
      lineUserId: app.state.profile ? app.state.profile.userId : null,
      lineDisplayName: app.state.profile ? (app.state.profile.displayName || null) : null,
      linePictureUrl: app.state.profile ? (app.state.profile.pictureUrl || null) : null,
      paymentMethod: "cash",
      note: app.el.orderNote ? (app.el.orderNote.value || "").trim() : "",
      internal_note: "",
      scheduled_pickup_date: app.state.pickupDateValue,
      scheduled_pickup_time: app.state.pickupTime,
      scheduled_pickup_at: buildPickupDateTimeISO(app.state.pickupDateValue, app.state.pickupTime),
      pickupDateLabel: app.state.pickupDateLabel,
      storeStatusAtCheckout: app.state.storeOpenStatus,
      appliedPromotion: app.state.appliedPromotion ? {
        promoId: app.state.appliedPromotion.id,
        name: app.state.appliedPromotion.name,
        type: app.state.appliedPromotion.type,
        reward: app.state.appliedPromotion.reward || {}
      } : null
    });

    var pickupNumber = null;

    try {
      console.log("[Order] Writing order with transaction.", { docId: ref.id, date: todayStr });

      // Transaction：原子取得流水號 + 寫入訂單，確保不重號
      await app.state.db.runTransaction(function (tx) {
        return tx.get(counterRef).then(function (counterDoc) {
          var seq = counterDoc.exists ? ((counterDoc.data().seq || 0) + 1) : 1;
          pickupNumber = String(seq).padStart(3, "0");
          // 更新每日計數器
          tx.set(counterRef, {
            seq: seq,
            date: todayStr,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          // 寫入訂單（含取餐號碼）
          payload.pickupNumber = pickupNumber;
          payload.pickupSequence = seq;
          tx.set(ref, payload);
          // 寫入 order_events: order_created
          var eventRef = app.state.db.collection("order_events").doc();
          tx.set(eventRef, window.LeLeShanOrders.buildOrderEventPayload({
            orderId:   ref.id,
            storeId:   payload.storeId || "",
            type:      "order_created",
            actorType: "customer",
            actorId:   payload.lineUserId || "",
            actorName: payload.customer_name || "",
            fromStatus: null,
            toStatus:   "new",
            message:    "LIFF 建單，取餐號碼 " + pickupNumber
          }));
        });
      });

      // 建單成功後，批次寫入 order_items（不在 transaction 內，避免讀寫限制）
      try {
        var itemsPayload = window.LeLeShanOrders.buildOrderItemsPayload({
          orderId: ref.id,
          storeId: payload.storeId || "",
          source:  "liff",
          items:   payload.items || []
        });
        if (itemsPayload.length) {
          var batch = app.state.db.batch();
          itemsPayload.forEach(function (itemDoc) {
            var itemRef = app.state.db.collection("order_items").doc();
            batch.set(itemRef, itemDoc);
          });
          batch.commit().catch(function (e) {
            console.warn("[Order] order_items write failed (non-critical).", e);
          });
        }
      } catch (e) {
        console.warn("[Order] order_items batch skipped.", e);
      }

      // customers upsert（有 lineUserId 時記錄顧客資料）
      try {
        var lineUid = app.state.profile && app.state.profile.userId;
        if (lineUid) {
          var ts = firebase.firestore.FieldValue.serverTimestamp();
          app.state.db.collection("customers").doc(lineUid).set({
            lineUserId:    lineUid,
            storeId:       payload.storeId || app.state.storeId,
            name:          customerName || "",
            displayName:   (app.state.profile && app.state.profile.displayName) || "",
            pictureUrl:    (app.state.profile && app.state.profile.pictureUrl) || "",
            lastOrderId:   ref.id,
            lastOrderAt:   ts,
            updatedAt:     ts,
            createdAt:     ts
          }, { merge: true }).catch(function (e) {
            console.warn("[Order] customers upsert failed (non-critical).", e);
          });
        }
      } catch (e) {
        console.warn("[Order] customers upsert skipped.", e);
      }

      console.log("[Order] Firestore write success.", { documentId: ref.id, pickupNumber: pickupNumber });
      var pickupLabel = (app.state.pickupDateLabel || app.state.pickupDateValue || "") + (app.state.pickupTime ? " " + app.state.pickupTime : "");
      var cartSnapshot = app.state.cart.slice();

      app.state.cart = [];
      if (app.el.orderForm) app.el.orderForm.reset();
      initializePickupSelection(app);
      app.modules.ui.renderPickupDateOptions(app);
      app.modules.ui.renderPickupTimeOptions(app);
      if (app.el.customerName) {
        if (customerName) app.el.customerName.value = customerName;
        else if (app.state.profile && app.state.profile.displayName) app.el.customerName.value = app.state.profile.displayName;
      }
      app.modules.ui.renderProfile(app);
      app.modules.cart.renderCart();
      app.modules.ui.showOrderSuccess(app, pickupNumber, cartSnapshot, pickupLabel);
      clearPendingCheckoutState(app);
      window.LeLeShanStorage.clearCheckoutDraft();
      if (app.el.submitMessage) {
        requestAnimationFrame(function () {
          app.el.submitMessage.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } catch (error) {
      console.error("[Order] Firestore write failed.", error);
      app.modules.ui.setMessage(app, "送單失敗：" + detail(error), "error");
    } finally {
      app.state.submitting = false;
      app.modules.ui.syncControls(app);
    }
  }

  function getTodayDateStr() {
    var now = new Date();
    // 使用台灣時間（UTC+8）計算日期
    var tzOffset = 8 * 60;
    var local = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60000);
    return local.getFullYear() + "-" + pad(local.getMonth() + 1) + "-" + pad(local.getDate());
  }

  function parseDateValue(value) {
    if (!value) return null;
    var parts = String(value).split("-").map(function (item) { return Number(item); });
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateValue(dateValue) {
    return dateValue.getFullYear() + "-" + pad(dateValue.getMonth() + 1) + "-" + pad(dateValue.getDate());
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatMinutes(totalMinutes) {
    return pad(Math.floor(totalMinutes / 60)) + ":" + pad(totalMinutes % 60);
  }

  function roundMinutesUp(totalMinutes, step) {
    return Math.ceil(totalMinutes / step) * step;
  }

  function buildPickupDateTime(baseDate, timeText) {
    var dateValue = baseDate instanceof Date ? new Date(baseDate) : parseDateValue(baseDate);
    if (!dateValue || !timeText) return null;
    var parts = String(timeText).split(":");
    dateValue.setHours(Number(parts[0] || 0), Number(parts[1] || 0), 0, 0);
    return dateValue;
  }

  function buildPickupDateTimeISO(dateValue, timeText) {
    var date = buildPickupDateTime(dateValue, timeText);
    if (!date) return "";
    return formatDateValue(date) + "T" + timeText + ":00+08:00";
  }

  function isSameDate(left, right) {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  function detail(error) {
    return error && (error.message || error.code || String(error)) || "未知錯誤";
  }

  window.LeLeShanCheckout = { init: init };
})();
