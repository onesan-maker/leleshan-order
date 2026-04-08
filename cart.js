(function () {
  function init(app) {
    app.modules.cart = api(app);
  }

  function api(app) {
    return {
      requestAddCombo: function (id) { requestAddCombo(app, id); },
      requestAddSingle: function (id) { requestAddSingle(app, id); },
      applyPendingQuantity: function (quantity) { applyPendingQuantity(app, quantity); },
      renderCart: function () { renderCart(app); },
      totalPrice: function () { return totalPrice(app); },
      computePromotion: function () { return computePromotion(app); },
      currentFlavor: function () { return currentFlavor(app); },
      getComboOptions: function (combo) { return getComboOptions(app, combo); },
      ensureFlavor: function () { return ensureFlavor(app); },
      allowOrder: function () { return allowOrder(app); },
      restoreCart: function (items) {
        app.state.cart = normalizeCartState(window.LeLeShanStorage.cloneJSON(items || []));
        renderCart(app);
      }
    };
  }

  function allowOrder(app) {
    if (app.state.storeOpenStatus !== app.STATUS.LOADING) return true;
    app.modules.ui.setMessage(app, "正在確認營業狀態，請稍候。", "error");
    return false;
  }

  function ensureFlavor(app) {
    if (app.state.selectedFlavor) return true;
    app.modules.ui.setMessage(app, "請先選擇口味。", "error");
    return false;
  }

  function currentFlavor(app) {
    return app.state.flavors.find(function (item) {
      return item.id === app.state.selectedFlavor;
    }) || { id: "", name: "" };
  }

  function getComboOptions(app, combo) {
    var group = (combo.optionGroups || []).find(function (item) {
      return item.id === "staple" || item.name === "主食";
    });
    return group && group.options && group.options.length ? group.options : app.state.stapleOptions;
  }

  function getFlavorById(app, flavorId) {
    return app.state.flavors.find(function (item) {
      return item.id === flavorId;
    }) || null;
  }

  function buildComboPendingSelection(app, combo) {
    var stapleOptions = getComboOptions(app, combo);
    var cardSelect = document.getElementById("staple-" + combo.id);
    var stapleId = cardSelect && cardSelect.value
      ? cardSelect.value
      : (stapleOptions[0] && stapleOptions[0].id) || "";
    var staple = stapleOptions.find(function (option) {
      return option.id === stapleId;
    }) || stapleOptions[0] || { id: "", name: "", price: 0 };
    var flavor = getFlavorById(app, app.state.selectedFlavor) || { id: "", name: "" };

    return {
      type: "combo",
      id: combo.id,
      name: combo.name,
      displayType: "套餐",
      basePrice: Number(combo.price || 0),
      flavorId: flavor.id || "",
      flavorName: flavor.name || "",
      stapleId: staple.id || "",
      stapleName: staple.name || "",
      staplePriceAdjustment: Number(staple.price || 0),
      stapleOptions: stapleOptions.map(function (option) {
        return {
          id: option.id,
          name: option.name,
          price: Number(option.price || 0)
        };
      })
    };
  }

  function buildSinglePendingSelection(app, item, categoryTitle) {
    var flavor = getFlavorById(app, app.state.selectedFlavor) || { id: "", name: "" };
    return {
      type: "single",
      id: item.id,
      name: item.name,
      displayType: "",
      basePrice: Number(item.price || 0),
      categoryName: categoryTitle || "",
      flavorId: flavor.id || "",
      flavorName: flavor.name || "",
      stapleId: "",
      stapleName: "",
      staplePriceAdjustment: 0,
      stapleOptions: []
    };
  }

  function syncPendingSelectionFromModal(app) {
    var pending = app.state.pendingCartSelection;
    if (!pending) return null;

    if (app.el.quantityModalFlavor && app.el.quantityModalFlavor.value) {
      var flavor = getFlavorById(app, app.el.quantityModalFlavor.value);
      pending.flavorId = flavor ? flavor.id : pending.flavorId;
      pending.flavorName = flavor ? flavor.name : pending.flavorName;
    }

    if (pending.type === "combo" && app.el.quantityModalStaple && app.el.quantityModalStaple.value) {
      var staple = (pending.stapleOptions || []).find(function (option) {
        return option.id === app.el.quantityModalStaple.value;
      }) || null;
      pending.stapleId = staple ? staple.id : pending.stapleId;
      pending.stapleName = staple ? staple.name : pending.stapleName;
      pending.staplePriceAdjustment = staple ? Number(staple.price || 0) : Number(pending.staplePriceAdjustment || 0);
    }

    return pending;
  }

  function requestAddCombo(app, id) {
    if (!allowOrder(app) || !ensureFlavor(app)) return;
    var combo = app.state.comboItems.find(function (item) {
      return item.id === id;
    });
    if (!combo) return;

    app.state.pendingCartSelection = buildComboPendingSelection(app, combo);
    app.modules.ui.openQuantityModal(app, app.state.pendingCartSelection);
  }

  function requestAddSingle(app, id) {
    if (!allowOrder(app) || !ensureFlavor(app)) return;
    var match = null;

    app.state.singleCategories.forEach(function (category) {
      category.items.forEach(function (item) {
        if (item.id === id) {
          match = item;
          match.__categoryTitle = category.title;
        }
      });
    });

    if (!match) return;

    app.state.pendingCartSelection = buildSinglePendingSelection(app, match, match.__categoryTitle || "");
    app.modules.ui.openQuantityModal(app, app.state.pendingCartSelection);
  }

  function applyPendingQuantity(app, quantity) {
    if (!app.state.pendingCartSelection || !quantity || app.state.pendingCartSelection.committed) return;

    app.state.pendingCartSelection.committed = true;
    var selection = syncPendingSelectionFromModal(app) || app.state.pendingCartSelection;

    if (selection.type === "combo") {
      addCombo(app, selection, quantity);
    } else {
      addSingle(app, selection, quantity);
    }

    app.modules.ui.showQuantityAddedSuccess(app, selection, quantity);
  }

  function addCombo(app, selection, quantity) {
    quantity = Number(quantity || 1);
    if (!allowOrder(app) || !ensureFlavor(app)) return;

    var combo = app.state.comboItems.find(function (item) {
      return item.id === selection.id;
    });
    if (!combo) return;

    var staple = (selection.stapleOptions || []).find(function (option) {
      return option.id === selection.stapleId;
    }) || { id: "", name: selection.stapleName || "", price: 0 };
    var unitPrice = Number(combo.price || 0) + Number(staple.price || 0);

    upsertCartItem(app, {
      uid: uid(),
      itemId: combo.id,
      type: "combo",
      name: combo.name,
      flavorId: selection.flavorId || "",
      flavorName: selection.flavorName || "",
      stapleId: staple.id || selection.stapleId || "",
      stapleName: staple.name || "",
      comboLabel: selection.displayType || "套餐",
      priceAdjustment: Number(staple.price || 0),
      categoryName: "",
      quantity: quantity,
      unitPrice: unitPrice,
      price: unitPrice * quantity,
      detail: combo.description || "",
      itemNote: "",
      options: staple.name ? [{ name: "主食", value: staple.name, price: staple.price || 0 }] : []
    });

    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();
  }

  function addSingle(app, selection, quantity) {
    quantity = Number(quantity || 1);
    if (!allowOrder(app) || !ensureFlavor(app)) return;

    var match = null;
    app.state.singleCategories.forEach(function (category) {
      category.items.forEach(function (item) {
        if (item.id === selection.id) {
          match = item;
        }
      });
    });
    if (!match) return;

    upsertCartItem(app, {
      uid: uid(),
      itemId: match.id,
      type: "single",
      name: match.name,
      flavorId: selection.flavorId || "",
      flavorName: selection.flavorName || "",
      stapleId: "",
      stapleName: "",
      comboLabel: "",
      priceAdjustment: 0,
      categoryName: selection.categoryName || "",
      quantity: quantity,
      unitPrice: Number(match.price || 0),
      price: Number(match.price || 0) * quantity,
      detail: match.unit || "",
      itemNote: "",
      options: []
    });

    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();
  }

  function buildCartMetaSummary(item) {
    var parts = [];

    if (item.flavorName) parts.push(item.flavorName);
    if (item.stapleName) parts.push("主食：" + item.stapleName);
    cloneOptions(item.options).forEach(function (option) {
      if (!option.value) return;
      if (option.name === "主食") return;
      parts.push(option.name ? (option.name + "：" + option.value) : option.value);
    });
    if (item.type !== "combo" && item.detail) parts.push(item.detail);
    if (item.itemNote) parts.push("備註：" + item.itemNote);

    return parts.filter(Boolean).join(" / ");
  }

  function normalizeCartType(value) {
    if (value === "combo") return "combo";
    if (value === "single") return "single";
    return "";
  }

  function buildCartItemKey(item) {
    return [
      String(normalizeCartType(item && item.type)),
      String(item && item.itemId || ""),
      String(item && (item.flavorId || item.flavorName) || ""),
      String(item && (item.stapleId || item.stapleName) || ""),
      String(Number(item && item.unitPrice || 0))
    ].join("::");
  }

  function cloneOptions(options) {
    return Array.isArray(options) ? options.map(function (option) {
      return {
        name: option && option.name || "",
        value: option && option.value || "",
        price: Number(option && option.price || 0)
      };
    }) : [];
  }

  function normalizeCartItem(item) {
    var quantity = Math.max(0, Number(item && item.quantity || 0));
    var unitPrice = Number(item && item.unitPrice || 0);
    return {
      uid: item && item.uid || uid(),
      itemId: item && item.itemId || "",
      type: normalizeCartType(item && item.type),
      name: item && item.name || "",
      flavorId: item && item.flavorId || "",
      flavorName: item && item.flavorName || "",
      stapleId: item && item.stapleId || "",
      stapleName: item && item.stapleName || "",
      comboLabel: item && item.comboLabel || "",
      priceAdjustment: Number(item && item.priceAdjustment || 0),
      categoryName: item && item.categoryName || "",
      quantity: quantity,
      unitPrice: unitPrice,
      price: unitPrice * quantity,
      detail: item && item.detail || "",
      itemNote: item && item.itemNote || "",
      options: cloneOptions(item && item.options)
    };
  }

  function normalizeCartState(items) {
    var merged = {};
    (items || []).forEach(function (item) {
      var normalized = normalizeCartItem(item);
      if (!normalized.itemId || !normalized.quantity) return;
      var key = buildCartItemKey(normalized);
      if (merged[key]) {
        merged[key].quantity += normalized.quantity;
        merged[key].price = Number(merged[key].unitPrice || 0) * Number(merged[key].quantity || 0);
        return;
      }
      merged[key] = normalized;
    });
    return Object.keys(merged).map(function (key) {
      return merged[key];
    });
  }

  function syncCartState(app) {
    app.state.cart = normalizeCartState(app.state.cart);
    return app.state.cart;
  }

  function upsertCartItem(app, item) {
    var normalized = normalizeCartItem(item);
    var key = buildCartItemKey(normalized);
    var existing = app.state.cart.find(function (cartItem) {
      return buildCartItemKey(cartItem) === key;
    });

    if (existing) {
      existing.quantity += normalized.quantity;
      existing.price = Number(existing.unitPrice || 0) * Number(existing.quantity || 0);
      return existing;
    }

    app.state.cart.push(normalized);
    return normalized;
  }

  function renderCartRow(item) {
    var quantity = Number(item.quantity || 0);
    var subtotal = Number(item.price || 0);
    var meta = buildCartMetaSummary(item);
    var badge = normalizeCartType(item.type) === "combo" ? '<span class="cart-receipt__badge">' + escapeHtml(item.comboLabel || "套餐") + "</span>" : "";

    return ''
      + '<article class="cart-receipt__row">'
      + '<div class="cart-receipt__top">'
      + '<div class="cart-receipt__name-area">'
      + badge
      + '<span class="cart-receipt__name">' + escapeHtml(item.name) + '</span>'
      + '</div>'
      + '<div class="cart-receipt__num-area">'
      + '<span class="cart-receipt__qty">x' + quantity + '</span>'
      + '<span class="cart-receipt__subtotal">NT$\u00a0' + subtotal + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="cart-receipt__bottom">'
      + (meta ? '<p class="cart-receipt__meta">' + escapeHtml(meta) + '</p>' : '<span></span>')
      + '<button class="cart-receipt__remove" type="button" data-remove="' + item.uid + '">移除</button>'
      + '</div>'
      + '</article>';
  }

  function renderCart(app) {
    if (!app.el.cartItems) return;
    syncCartState(app);

    var total = totalPrice(app);
    var count = app.state.cart.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
    var summary = count ? "共 " + count + " 項" : "購物車目前是空的";

    if (!app.state.cart.length) {
      app.el.cartItems.innerHTML = '<p class="empty-cart">尚未加入任何品項。<br>請在上方選擇口味，再加入套餐或單點。</p>';
    } else {
      app.el.cartItems.innerHTML = ''
        + '<div class="cart-receipt">'
        + app.state.cart.map(renderCartRow).join("")
        + '<div class="cart-receipt__footer">'
        + '<div class="cart-receipt__footer-label">合計</div>'
        + '<div class="cart-receipt__footer-value">NT$\u00a0' + total + '</div>'
        + '</div>'
        + '</div>';

      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-remove]")).forEach(function (button) {
        button.addEventListener("click", function () {
          app.state.cart = app.state.cart.filter(function (item) {
            return item.uid !== button.getAttribute("data-remove");
          });
          renderCart(app);
          app.modules.checkout.saveCheckoutDraftState();
        });
      });
    }

    if (app.el.cartTotalTop) app.el.cartTotalTop.textContent = "NT$\u00a0" + total;
    if (app.el.cartSummaryTop) app.el.cartSummaryTop.textContent = summary;
    if (app.el.cartTotalBottom) app.el.cartTotalBottom.textContent = "NT$\u00a0" + total;
    if (app.el.cartSummaryBottom) app.el.cartSummaryBottom.textContent = summary;
    if (app.el.cartSummaryInline) app.el.cartSummaryInline.textContent = summary;
    if (app.el.viewCartBtnSticky) app.el.viewCartBtnSticky.classList.toggle("hidden", !app.state.cart.length);

    app.state.appliedPromotion = computePromotion(app);
    app.modules.ui.updatePromoBanner(app);
    app.modules.ui.syncControls(app);
  }

  function totalPrice(app) {
    return app.state.cart.reduce(function (sum, item) {
      return sum + Number(item.price || 0);
    }, 0);
  }

  function computePromotion(app) {
    var now = new Date();
    return app.state.promotions.find(function (promo) {
      if (promo.enabled === false) return false;
      if (promo.startAt && toDate(promo.startAt) > now) return false;
      if (promo.endAt && toDate(promo.endAt) < now) return false;
      return totalPrice(app) >= Number((promo.condition && promo.condition.minAmount) || 0);
    }) || null;
  }

  function toDate(value) {
    return value && typeof value.toDate === "function" ? value.toDate() : new Date(value);
  }

  function uid() {
    return "id-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.LeLeShanCart = { init: init };
})();
