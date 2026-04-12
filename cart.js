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
      validateGiftSelection: function () { return validateGiftSelection(app); },
      giftPromotionResult: function () { return app.state.giftPromotionResult || null; },
      currentFlavor: function () { return currentFlavor(app); },
      getComboOptions: function (combo) { return getComboOptions(app, combo); },
      ensureFlavor: function () { return ensureFlavor(app); },
      allowOrder: function () { return allowOrder(app); },
      quickAddSingle: function (id) { quickAddSingle(app, id); },
      restoreCart: function (items) {
        var defaultGroupId = (app.state.cartGroups && app.state.cartGroups[0] && app.state.cartGroups[0].id) || "g-a";
        var raw = (window.LeLeShanStorage.cloneJSON(items || [])).map(function (item) {
          if (!item.groupId) item.groupId = defaultGroupId;
          return item;
        });
        app.state.cart = normalizeCartState(raw);
        renderCart(app);
      },
      setActiveGroup: function (id) { setActiveGroup(app, id); },
      addGroup: function (label) { addCartGroup(app, label); },
      cartGroups: function () { return (app.state.cartGroups || []).slice(); },
      activeGroupId: function () { return app.state.activeGroupId || "g-a"; }
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

  function allSingleItems(app) {
    var list = [];
    app.state.singleCategories.forEach(function (category) {
      category.items.forEach(function (item) {
        list.push(item);
      });
    });
    return list;
  }

  function matchesNamedItem(item, name) {
    return !!(item && (item.name === name || String(item.name || "").indexOf(name) >= 0));
  }

  function recommendGapFillItem(app, gap) {
    var items = allSingleItems(app).filter(function (item) {
      return Number(item && item.price || 0) <= Number(gap || 0) + 20;
    });
    if (!items.length) return null;
    return items.sort(function (left, right) {
      var leftDiff = Math.abs(Number(left.price || 0) - Number(gap || 0));
      var rightDiff = Math.abs(Number(right.price || 0) - Number(gap || 0));
      if (leftDiff !== rightDiff) return leftDiff - rightDiff;
      return Number(left.price || 0) - Number(right.price || 0);
    })[0] || null;
  }

  function recommendBoostItems(app) {
    var names = ["玉米筍", "王子麵", "白飯"];
    var items = allSingleItems(app);
    return names.map(function (name) {
      return items.find(function (item) { return matchesNamedItem(item, name); }) || null;
    }).filter(Boolean).slice(0, 3);
  }

  function recommendFirstNudgeItems(app) {
    var names = ["白飯", "玉米筍"];
    var items = allSingleItems(app);
    return names.map(function (name) {
      return items.find(function (item) { return matchesNamedItem(item, name); }) || null;
    }).filter(Boolean).slice(0, 2);
  }

  function hasPendingStapleSelection(app) {
    var result = app.state.giftPromotionResult || null;
    if (!result || !result.enabled || !result.entitlement) return false;
    var selectedStaples = (result.selectedGifts || []).filter(function (item) {
      return item.giftType === "staple";
    }).length;
    return Number(result.entitlement.stapleCount || 0) > selectedStaples;
  }

  function maybeShowFirstAddNudge(app, hadItemsBefore) {
    if (hadItemsBefore || app.state.firstAddNudgeShown) return;
    app.state.firstAddNudgeShown = true;
    var actions = recommendFirstNudgeItems(app).map(function (item) {
      return { label: "+ " + item.name, itemId: item.id };
    });
    window.LeLeShanUI.showToast("再加一個更剛好 👍", actions, 2200);
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

  function normalizeGiftPoolOption(item, prefix) {
    if (!item) return null;
    if (typeof item === "string") {
      return {
        id: item,
        name: item,
        priceAdjustment: 0
      };
    }
    var id = (item.id || item.itemId || item.sku || "").trim();
    var name = item.name || item.label || id || (prefix || "gift");
    if (!id && !name) return null;
    return {
      id: id || name,
      name: name,
      priceAdjustment: Number(item.priceAdjustment || item.price || 0)
    };
  }

  function normalizeGiftRules(rules) {
    return (rules || []).filter(function (r) {
      return r && r.enabled !== false;
    }).map(function (r) {
      return {
        id: ((r.id || r.name || "")).trim(),
        name: r.name || "",
        minAmount: Number(r.minAmount || 0),
        maxAmount: (r.maxAmount != null && r.maxAmount !== "") ? Number(r.maxAmount) : null,
        maxStaple: Number(r.maxStaple || 0),
        maxVegetable: Number(r.maxVegetable || 0),
        sort: Number(r.sort != null ? r.sort : 9999),
        items: (r.items || []).filter(function (i) {
          return i && i.enabled !== false;
        }).map(function (i) {
          return {
            id: ((i.id || i.name || "")).trim(),
            name: i.name || i.id || "",
            type: i.type === "vegetable" ? "vegetable" : "staple",
            priceAdjustment: Number(i.priceAdjustment || 0)
          };
        })
      };
    }).sort(function (a, b) { return a.sort - b.sort; });
  }

  function findMatchingRule(rules, singleAmount) {
    var matched = null;
    rules.forEach(function (rule) {
      if (singleAmount < rule.minAmount) return;
      if (rule.maxAmount !== null && singleAmount > rule.maxAmount) return;
      if (!matched || rule.minAmount > matched.minAmount) matched = rule;
    });
    return matched;
  }

  function giftPromotionConfig(app) {
    var settings = app.state.settings || {};
    var promo = settings.giftPromotion || {};
    return {
      enabled: promo.enabled === true,
      rules: normalizeGiftRules(promo.rules || [])
    };
  }

  function isGiftItem(item) {
    return normalizeCartType(item && item.type) === "gift" || !!(item && item.isGift);
  }

  function singleEligibleAmount(app) {
    return app.state.cart.reduce(function (sum, item) {
      if (normalizeCartType(item && item.type) !== "single") return sum;
      if (isGiftItem(item)) return sum;
      // Exclude staple-type menu items (白飯/泡麵/寬粉/滷肉飯 etc.) using the item's own isStaple flag
      if (item && item.menuItemIsStaple) return sum;
      return sum + Number(item.price || 0);
    }, 0);
  }

  function buildGiftEntitlement(app) {
    var config = giftPromotionConfig(app);
    var singleAmount = singleEligibleAmount(app);
    var empty = { enabled: config.enabled, singleAmount: singleAmount, stapleCount: 0, vegetableCount: 0, staplePool: [], vegetablePool: [], matchedRule: null };
    if (!config.enabled || !config.rules.length) return empty;
    var rule = findMatchingRule(config.rules, singleAmount);
    if (!rule) return empty;
    return {
      enabled: true,
      singleAmount: singleAmount,
      stapleCount: rule.maxStaple,
      vegetableCount: rule.maxVegetable,
      staplePool: rule.items.filter(function (i) { return i.type === "staple"; }),
      vegetablePool: rule.items.filter(function (i) { return i.type === "vegetable"; }),
      matchedRule: rule
    };
  }

  function giftSlots(type, count) {
    return Array.from({ length: Math.max(0, Number(count || 0)) }, function (_, index) {
      return type + "-" + (index + 1);
    });
  }

  function buildGiftItem(option, giftType, slotKey) {
    return normalizeCartItem({
      uid: "gift-" + slotKey,
      itemId: option.id,
      type: "gift",
      isGift: true,
      giftType: giftType,
      giftSlot: slotKey,
      giftLabel: giftType === "vegetable" ? "贈送蔬菜" : "贈送主食",
      comboLabel: "優惠贈品",
      name: option.name,
      quantity: 1,
      unitPrice: 0,
      price: 0,
      priceAdjustment: Number(option.priceAdjustment || 0),
      detail: "滿額贈送",
      itemNote: "",
      options: []
    });
  }

  function selectedGiftMap(app) {
    var map = {};
    app.state.cart.forEach(function (item) {
      if (!isGiftItem(item) || !item.giftSlot) return;
      map[item.giftSlot] = item;
    });
    return map;
  }

  function syncGiftItems(app) {
    var entitlement = buildGiftEntitlement(app);
    var allowedSlots = giftSlots("staple", entitlement.stapleCount).concat(giftSlots("vegetable", entitlement.vegetableCount));
    var allowedLookup = {};
    allowedSlots.forEach(function (slotKey) { allowedLookup[slotKey] = true; });
    var staplePoolLookup = {};
    var vegetablePoolLookup = {};
    entitlement.staplePool.forEach(function (item) { staplePoolLookup[(item.id || "").trim()] = true; });
    entitlement.vegetablePool.forEach(function (item) { vegetablePoolLookup[(item.id || "").trim()] = true; });
    app.state.cart = app.state.cart.filter(function (item) {
      if (!isGiftItem(item)) return true;
      if (!(item.giftSlot && allowedLookup[item.giftSlot])) return false;
      if (item.giftType === "vegetable") return !!vegetablePoolLookup[(item.itemId || "").trim()];
      return !!staplePoolLookup[(item.itemId || "").trim()];
    });
    app.state.giftPromotionResult = buildGiftPromotionResult(app, entitlement);
    return entitlement;
  }

  function buildGiftPromotionResult(app, entitlement) {
    var current = entitlement || buildGiftEntitlement(app);
    var selected = app.state.cart.filter(isGiftItem).map(function (item) {
      return {
        slot: item.giftSlot || "",
        giftType: item.giftType || "",
        itemId: item.itemId || "",
        name: item.name || "",
        priceAdjustment: Number(item.priceAdjustment || 0)
      };
    }).sort(function (left, right) {
      return String(left.slot).localeCompare(String(right.slot));
    });
    var selectedStaples = selected.filter(function (item) { return item.giftType === "staple"; }).length;
    var selectedVegetables = selected.filter(function (item) { return item.giftType === "vegetable"; }).length;
    var incomplete = current.enabled && ((selectedStaples < current.stapleCount) || (selectedVegetables < current.vegetableCount));
    var summaryParts = [];
    if (current.stapleCount) summaryParts.push("主食 " + selectedStaples + "/" + current.stapleCount);
    if (current.vegetableCount) summaryParts.push("蔬菜 " + selectedVegetables + "/" + current.vegetableCount);
    return {
      id: "gift-promo",
      name: "自由單點滿額贈品",
      type: "gift_selection",
      enabled: current.enabled,
      singleAmount: current.singleAmount,
      matchedRule: current.matchedRule ? {
        id: current.matchedRule.id,
        name: current.matchedRule.name,
        minAmount: current.matchedRule.minAmount,
        maxAmount: current.matchedRule.maxAmount,
        maxStaple: current.matchedRule.maxStaple,
        maxVegetable: current.matchedRule.maxVegetable
      } : null,
      entitlement: {
        stapleCount: current.stapleCount,
        vegetableCount: current.vegetableCount
      },
      selectedGifts: selected,
      incomplete: incomplete,
      summaryText: summaryParts.join(" / ")
    };
  }

  function validateGiftSelection(app) {
    syncGiftItems(app);
    var result = app.state.giftPromotionResult;
    if (!result || !result.enabled) return true;
    if (!result.incomplete) return true;
    app.modules.ui.setMessage(app, "請先選完本次滿額贈送的主食／蔬菜，再送出訂單。", "error");
    return false;
  }

  function setGiftSelection(app, giftType, slotKey, optionId) {
    app.state.cart = app.state.cart.filter(function (item) {
      return !(isGiftItem(item) && item.giftSlot === slotKey);
    });
    if (!optionId) {
      renderCart(app);
      app.modules.checkout.saveCheckoutDraftState();
      return;
    }
    var entitlement = buildGiftEntitlement(app);
    var pool = giftType === "vegetable" ? entitlement.vegetablePool : entitlement.staplePool;
    var option = pool.find(function (item) { return (item.id || "").trim() === (optionId || "").trim(); });
    if (!option) {
      console.warn("[Cart] Gift pool option not found.", { giftType: giftType, optionId: optionId });
      app.modules.ui.setMessage(app, "找不到該贈品選項，請重新選擇。", "error");
      renderCart(app);
      app.modules.checkout.saveCheckoutDraftState();
      return;
    }
    app.state.cart.push(buildGiftItem(option, giftType, slotKey));
    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();
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
      displayType: "🔥 套餐（最划算）",
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
    var requiresFlavor = item.requiresFlavor !== false;
    var flavor = requiresFlavor ? (getFlavorById(app, app.state.selectedFlavor) || { id: "", name: "" }) : { id: "", name: "" };
    return {
      type: "single",
      id: item.id,
      name: item.name,
      displayType: "",
      basePrice: Number(item.price || 0),
      categoryName: categoryTitle || "",
      requiresFlavor: requiresFlavor,
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

  // quickAdd: directly add item to cart without modal or flavor validation
  function quickAddSingle(app, id) {
    if (!allowOrder(app)) return;
    var hadItemsBefore = !!app.state.cart.length;
    var match = null;
    app.state.singleCategories.forEach(function (category) {
      category.items.forEach(function (item) {
        if (item.id === id) match = item;
      });
    });
    if (!match) return;

    var groupId = app.state.activeGroupId
      || (app.state.cartGroups && app.state.cartGroups[0] && app.state.cartGroups[0].id)
      || "g-a";

    upsertCartItem(app, {
      uid: uid(),
      itemId: match.id,
      type: "single",
      name: match.name,
      groupId: groupId,
      flavorId: "",
      flavorName: "",
      stapleId: "",
      stapleName: "",
      comboLabel: "",
      priceAdjustment: 0,
      categoryName: "",
      menuItemIsStaple: !!(match.isStaple) || (function () {
        var catId = (match.categoryId || "").toLowerCase();
        return catId === "staples" || catId === "staple" || catId.indexOf("staple") !== -1;
      })(),
      quantity: 1,
      unitPrice: Number(match.price || 0),
      price: Number(match.price || 0),
      detail: match.unit || "",
      itemNote: "",
      options: []
    });

    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();

    // Find actual quantity after upsert (may have been merged)
    var cartItem = app.state.cart.find(function (i) {
      return i.itemId === match.id && i.type === "single" && !i.flavorId;
    });
    var qty = cartItem ? cartItem.quantity : 1;
    window.LeLeShanUI.showToast("✔ 已加入 " + match.name + " ×" + qty);
    maybeShowFirstAddNudge(app, hadItemsBefore);
  }

  function requestAddSingle(app, id) {
    if (!allowOrder(app)) return;
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

    // Only require flavor selection for items that need it
    if (match.requiresFlavor !== false && !ensureFlavor(app)) return;

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
    var hadItemsBefore = !!app.state.cart.length;

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
      groupId: app.state.activeGroupId || (app.state.cartGroups && app.state.cartGroups[0] && app.state.cartGroups[0].id) || "g-a",
      flavorId: selection.flavorId || "",
      flavorName: selection.flavorName || "",
      stapleId: staple.id || selection.stapleId || "",
      stapleName: staple.name || "",
      comboLabel: selection.displayType || "🔥 套餐（最划算）",
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
    maybeShowFirstAddNudge(app, hadItemsBefore);
  }

  function addSingle(app, selection, quantity) {
    quantity = Number(quantity || 1);
    if (!allowOrder(app)) return;
    if (selection.requiresFlavor !== false && !ensureFlavor(app)) return;
    var hadItemsBefore = !!app.state.cart.length;

    var match = null;
    app.state.singleCategories.forEach(function (category) {
      category.items.forEach(function (item) {
        if (item.id === selection.id) {
          match = item;
        }
      });
    });
    if (!match) return;

    // If user chose a specific group in the modal, honour it and enable portion mode
    var chosenGroupId = selection.targetGroupId
      || app.state.activeGroupId
      || (app.state.cartGroups && app.state.cartGroups[0] && app.state.cartGroups[0].id)
      || "g-a";
    if (selection.targetGroupId) {
      app.state.portionMode = true;
    }

    upsertCartItem(app, {
      uid: uid(),
      itemId: match.id,
      type: "single",
      name: match.name,
      groupId: chosenGroupId,
      flavorId: selection.requiresFlavor !== false ? (selection.flavorId || "") : "",
      flavorName: selection.requiresFlavor !== false ? (selection.flavorName || "") : "",
      stapleId: "",
      stapleName: "",
      comboLabel: "",
      priceAdjustment: 0,
      categoryName: selection.categoryName || "",
      menuItemIsStaple: !!(match.isStaple) || (function () {
        var catId = (match.categoryId || "").toLowerCase();
        return catId === "staples" || catId === "staple" || catId.indexOf("staple") !== -1;
      })(),
      quantity: quantity,
      unitPrice: Number(match.price || 0),
      price: Number(match.price || 0) * quantity,
      detail: match.unit || "",
      itemNote: "",
      options: []
    });

    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();
    maybeShowFirstAddNudge(app, hadItemsBefore);
  }

  function buildCartMetaSummary(item) {
    var parts = [];

    if (isGiftItem(item) && item.giftLabel) parts.push(item.giftLabel);
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
    if (value === "gift") return "gift";
    return "";
  }

  function buildCartItemKey(item) {
    return [
      String(item && item.groupId || ""),
      String(normalizeCartType(item && item.type)),
      String(item && item.giftSlot || ""),
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
      isGift: !!(item && item.isGift),
      giftType: item && item.giftType || "",
      giftSlot: item && item.giftSlot || "",
      giftLabel: item && item.giftLabel || "",
      comboLabel: item && item.comboLabel || "",
      priceAdjustment: Number(item && item.priceAdjustment || 0),
      groupId: item && item.groupId || "",
      categoryName: item && item.categoryName || "",
      menuItemIsStaple: !!(item && item.menuItemIsStaple),
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
      if (isGiftItem(normalized)) {
        merged["gift::" + normalized.giftSlot] = normalized;
        return;
      }
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
    // Normalize empty groupId to the active group for non-gifts
    if (!normalized.groupId && !isGiftItem(normalized)) {
      normalized.groupId = app.state.activeGroupId || (app.state.cartGroups && app.state.cartGroups[0] && app.state.cartGroups[0].id) || "g-a";
    }
    if (isGiftItem(normalized)) {
      app.state.cart = app.state.cart.filter(function (cartItem) {
        return !(isGiftItem(cartItem) && cartItem.giftSlot === normalized.giftSlot);
      });
      app.state.cart.push(normalized);
      return normalized;
    }
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

  function renderCartRow(item, portionContext) {
    var quantity = Number(item.quantity || 0);
    var subtotal = Number(item.price || 0);
    var meta = buildCartMetaSummary(item);
    var type = normalizeCartType(item.type);
    var badge = "";
    if (type === "combo") badge = '<span class="cart-receipt__badge">' + escapeHtml(item.comboLabel || "🔥 套餐（最划算）") + "</span>";
    if (type === "gift") badge = '<span class="cart-receipt__badge">' + escapeHtml(item.comboLabel || "優惠贈品") + "</span>";

    // In portion mode, show group-assign buttons for single items
    var assignHtml = "";
    if (portionContext && portionContext.portionMode && type === "single" && !isGiftItem(item) && portionContext.groups.length > 1) {
      assignHtml = '<div class="cart-receipt__assign">'
        + '<span class="cart-receipt__assign-label">給誰：</span>'
        + portionContext.groups.map(function (g, gIdx) {
          var isCurrent = item.groupId === g.id;
          var cls = "cart-receipt__assign-btn" + (isCurrent ? " cart-receipt__assign-btn--active" : "");
          return '<button class="' + cls + '" type="button"'
            + ' data-reassign="' + escapeHtml(item.uid) + '"'
            + ' data-to-group="' + escapeHtml(g.id) + '">'
            + escapeHtml(customerGroupLabel(gIdx))
            + '</button>';
        }).join("")
        + '</div>';
    }

    return ''
      + '<article class="cart-receipt__row">'
      + '<div class="cart-receipt__top">'
      + '<div class="cart-receipt__name-area">'
      + badge
      + '<span class="cart-receipt__name">' + escapeHtml(item.name) + '</span>'
      + '</div>'
      + '<div class="cart-receipt__num-area">'
      + '<div class="cart-receipt__qty-ctrl">'
      + '<button class="cart-receipt__qty-btn" type="button" data-qty-dec="' + escapeHtml(item.uid) + '">−</button>'
      + '<span class="cart-receipt__qty">×' + quantity + '</span>'
      + '<button class="cart-receipt__qty-btn" type="button" data-qty-inc="' + escapeHtml(item.uid) + '">+1</button>'
      + '</div>'
      + '<span class="cart-receipt__subtotal">NT$\u00a0' + subtotal + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="cart-receipt__bottom">'
      + (meta ? '<p class="cart-receipt__meta">' + escapeHtml(meta) + '</p>' : '<span></span>')
      + (type === "gift"
        ? '<button class="cart-receipt__remove" type="button" data-remove-gift="' + escapeHtml(item.giftSlot || item.uid) + '">清除</button>'
        : '<button class="cart-receipt__remove" type="button" data-remove="' + item.uid + '">移除</button>')
      + '</div>'
      + assignHtml
      + '</article>';
  }

  function renderGiftSelectRow(slotKey, label, giftType, selectedId, pool) {
    return ''
      + '<label class="field gift-selection__field">'
      + '<span>' + escapeHtml(label) + '</span>'
      + '<select class="pickup-select" data-gift-slot="' + escapeHtml(slotKey) + '" data-gift-type="' + escapeHtml(giftType) + '">'
      + '<option value="">請選擇</option>'
      + (pool || []).map(function (option) {
        var selected = option.id === selectedId ? " selected" : "";
        return '<option value="' + escapeHtml(option.id) + '"' + selected + '>' + escapeHtml(option.name) + '</option>';
      }).join("")
      + '</select>'
      + '</label>';
  }

  function renderGiftSelectionPanel(app, entitlement) {
    if (!app.el.giftSelectionPanel) return;
    var result = app.state.giftPromotionResult || buildGiftPromotionResult(app, entitlement);
    if (!entitlement.enabled || (!entitlement.stapleCount && !entitlement.vegetableCount)) {
      app.el.giftSelectionPanel.innerHTML = "";
      app.el.giftSelectionPanel.classList.add("hidden");
      return;
    }

    var selected = selectedGiftMap(app);
    var rows = [];
    giftSlots("staple", entitlement.stapleCount).forEach(function (slotKey, index) {
      rows.push(renderGiftSelectRow(slotKey, "滿額贈送主食 " + (index + 1), "staple", selected[slotKey] ? selected[slotKey].itemId : "", entitlement.staplePool));
    });
    giftSlots("vegetable", entitlement.vegetableCount).forEach(function (slotKey, index) {
      rows.push(renderGiftSelectRow(slotKey, "滿額贈送蔬菜 " + (index + 1), "vegetable", selected[slotKey] ? selected[slotKey].itemId : "", entitlement.vegetablePool));
    });

    var ruleLabel = entitlement.matchedRule ? '（' + escapeHtml(entitlement.matchedRule.name) + '）' : '';
    var statusText = result.incomplete
      ? '需選擇：' + escapeHtml(result.summaryText || "贈品") + '。'
      : '贈品已選完：' + escapeHtml(result.summaryText || "贈品") + '。';
    app.el.giftSelectionPanel.classList.remove("hidden");
    app.el.giftSelectionPanel.innerHTML = ''
      + '<div class="promo-banner gift-selection">'
      + '<strong>滿額贈送' + ruleLabel + '</strong>'
      + '<p>本次單點金額 NT$ ' + Number(entitlement.singleAmount || 0) + '，' + statusText + ' ※ 主食不列入滿額計算</p>'
      + '<div class="gift-selection__grid">' + rows.join("") + '</div>'
      + (result.incomplete ? '<p class="submit-message error">贈品尚未選完，完成後才可送出訂單。</p>' : "")
      + '</div>';

    Array.prototype.slice.call(app.el.giftSelectionPanel.querySelectorAll("[data-gift-slot]")).forEach(function (select) {
      select.addEventListener("change", function () {
        setGiftSelection(app, select.getAttribute("data-gift-type"), select.getAttribute("data-gift-slot"), select.value);
      });
    });
  }

  function customerGroupLabel(index) {
    return "第" + (index + 1) + "份";
  }

  function enterPortionMode(app) {
    app.state.portionMode = true;
    app.state.portionPromptDismissed = false;
    // Ensure at least 2 groups exist
    if ((app.state.cartGroups || []).length < 2) {
      var PRESET_LABELS2 = ["A點", "B點", "C點"];
      var nextLabel = PRESET_LABELS2[(app.state.cartGroups || []).length] || "D點";
      var newId0 = "g-" + Math.random().toString(36).slice(2, 8);
      (app.state.cartGroups = app.state.cartGroups || []).push({ id: newId0, label: nextLabel });
    }
    renderCart(app);
    app.modules.checkout.saveCheckoutDraftState();
  }

  function renderGroupSelector(app) {
    var el = document.getElementById("cart-group-selector");
    if (!el) return;

    // Check whether cart has any single (non-gift, non-combo) items
    var hasSingles = app.state.cart.some(function (i) {
      return !isGiftItem(i) && normalizeCartType(i.type) === "single";
    });

    // No single items → hide the whole group UI
    if (!hasSingles) {
      el.innerHTML = "";
      return;
    }

    // --- PORTION MODE ON: show group tabs + add-group button ---
    if (app.state.portionMode) {
      var groups = app.state.cartGroups || [];
      var activeId = app.state.activeGroupId;
      var PRESET_LABELS = ["A點", "B點", "C點"];
      var html = '<div class="cgs-wrap cgs-wrap--portion">';
      html += '<div class="cgs-tabs">';
      groups.forEach(function (g, idx) {
        var active = g.id === activeId ? " cgs-tab--active" : "";
        html += '<button class="cgs-tab' + active + '" data-group-id="' + escapeHtml(g.id) + '">' + escapeHtml(customerGroupLabel(idx)) + '</button>';
      });
      html += '</div>';
      var nextLabel = PRESET_LABELS[groups.length];
      if (nextLabel) {
        html += '<button class="cgs-add-btn" data-add-group="' + escapeHtml(nextLabel) + '">＋ 再分一份</button>';
      }
      html += '</div>';
      el.innerHTML = html;
      Array.prototype.slice.call(el.querySelectorAll("[data-group-id]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          app.state.activeGroupId = this.getAttribute("data-group-id");
          renderCart(app);
        });
      });
      Array.prototype.slice.call(el.querySelectorAll("[data-add-group]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var label = this.getAttribute("data-add-group");
          var newId = "g-" + Math.random().toString(36).slice(2, 8);
          (app.state.cartGroups = app.state.cartGroups || []).push({ id: newId, label: label });
          app.state.activeGroupId = newId;
          renderCart(app);
          app.modules.checkout.saveCheckoutDraftState();
        });
      });
      return;
    }

    // --- PORTION MODE OFF: show subtle link (primary entry is now the single-item modal) ---
    el.innerHTML = '<div class="cgs-wrap"><button class="cgs-enter-btn" type="button">幫我分給不同人</button></div>';
    var linkBtn = el.querySelector(".cgs-enter-btn");
    if (linkBtn) linkBtn.addEventListener("click", function () {
      enterPortionMode(app);
    });
  }

  function setActiveGroup(app, id) {
    if ((app.state.cartGroups || []).some(function (g) { return g.id === id; })) {
      app.state.activeGroupId = id;
      renderCart(app);
    }
  }

  function addCartGroup(app, label) {
    var newId = "g-" + Math.random().toString(36).slice(2, 8);
    (app.state.cartGroups = app.state.cartGroups || []).push({ id: newId, label: label });
    app.state.activeGroupId = newId;
    renderCart(app);
  }

  function renderCart(app) {
    if (!app.el.cartItems) return;
    syncCartState(app);
    var entitlement = syncGiftItems(app);

    renderGroupSelector(app);

    var total = totalPrice(app);
    var count = app.state.cart.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
    var summary = count ? "共 " + count + " 項" : "購物車目前是空的";

    var groups = app.state.cartGroups || [];
    var firstGroupId = (groups[0] && groups[0].id) || "g-a";
    var nonGiftItems = app.state.cart.filter(function (i) { return !isGiftItem(i); });
    var giftItems = app.state.cart.filter(function (i) { return isGiftItem(i); });

    // Reset portion mode when there are no single items
    var hasSingles = nonGiftItems.some(function (i) { return normalizeCartType(i.type) === "single"; });
    if (!hasSingles) {
      app.state.portionMode = false;
      app.state.portionPromptDismissed = false;
    }

    var showGroups = app.state.portionMode && groups.length > 1;
    var portionContext = app.state.portionMode ? { portionMode: true, groups: groups } : null;

    if (!app.state.cart.length) {
      app.el.cartItems.innerHTML = '<p class="empty-cart">尚未加入任何品項。<br>請在上方選擇口味，再加入🔥 套餐（最划算）或自由單點。</p>';
    } else {
      var html = '<div class="cart-receipt">';
      if (showGroups) {
        groups.forEach(function (group, gIdx) {
          var groupItems = nonGiftItems.filter(function (item) {
            return (item.groupId || firstGroupId) === group.id;
          });
          if (!groupItems.length) return;
          var groupSubtotal = groupItems.reduce(function (s, i) { return s + Number(i.price || 0); }, 0);
          html += '<div class="cart-group-header">' + escapeHtml(customerGroupLabel(gIdx)) + '</div>';
          html += groupItems.map(function (item) { return renderCartRow(item, portionContext); }).join("");
          html += '<div class="cart-group-subtotal">小計\u00a0NT$\u00a0' + groupSubtotal + '</div>';
        });
        if (giftItems.length) {
          html += '<div class="cart-group-header cart-group-header--gifts">贈品</div>';
          html += giftItems.map(function (item) { return renderCartRow(item, null); }).join("");
        }
      } else {
        html += app.state.cart.map(function (item) { return renderCartRow(item, portionContext); }).join("");
      }
      html += '<div class="cart-receipt__footer">'
        + '<div class="cart-receipt__footer-label">合計</div>'
        + '<div class="cart-receipt__footer-value">NT$\u00a0' + total + '</div>'
        + '</div></div>';
      app.el.cartItems.innerHTML = html;

      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-remove]")).forEach(function (button) {
        button.addEventListener("click", function () {
          app.state.cart = app.state.cart.filter(function (item) {
            return item.uid !== button.getAttribute("data-remove");
          });
          renderCart(app);
          app.modules.checkout.saveCheckoutDraftState();
        });
      });
      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-qty-dec]")).forEach(function (button) {
        button.addEventListener("click", function () {
          var targetUid = button.getAttribute("data-qty-dec");
          var found = app.state.cart.find(function (i) { return i.uid === targetUid; });
          if (!found) return;
          found.quantity -= 1;
          if (found.quantity <= 0) {
            app.state.cart = app.state.cart.filter(function (i) { return i.uid !== targetUid; });
          } else {
            found.price = Number(found.unitPrice || 0) * found.quantity;
          }
          renderCart(app);
          app.modules.checkout.saveCheckoutDraftState();
        });
      });
      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-qty-inc]")).forEach(function (button) {
        button.addEventListener("click", function () {
          var targetUid = button.getAttribute("data-qty-inc");
          var found = app.state.cart.find(function (i) { return i.uid === targetUid; });
          if (!found) return;
          found.quantity += 1;
          found.price = Number(found.unitPrice || 0) * found.quantity;
          renderCart(app);
          app.modules.checkout.saveCheckoutDraftState();
        });
      });
      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-remove-gift]")).forEach(function (button) {
        button.addEventListener("click", function () {
          setGiftSelection(app, "", button.getAttribute("data-remove-gift"), "");
        });
      });
      // Reassign single items to a different group in portion mode
      Array.prototype.slice.call(app.el.cartItems.querySelectorAll("[data-reassign]")).forEach(function (button) {
        button.addEventListener("click", function () {
          var targetUid = button.getAttribute("data-reassign");
          var toGroupId = button.getAttribute("data-to-group");
          var found = app.state.cart.find(function (i) { return i.uid === targetUid; });
          if (found && toGroupId) {
            found.groupId = toGroupId;
            app.state.cart = normalizeCartState(app.state.cart);
            renderCart(app);
            app.modules.checkout.saveCheckoutDraftState();
          }
        });
      });
    }

    renderGiftSelectionPanel(app, entitlement);

    if (app.el.cartTotalTop) app.el.cartTotalTop.textContent = "NT$\u00a0" + total;
    if (app.el.cartSummaryTop) app.el.cartSummaryTop.textContent = summary;
    if (app.el.cartTotalBottom) app.el.cartTotalBottom.textContent = "NT$\u00a0" + total;
    if (app.el.cartSummaryBottom) app.el.cartSummaryBottom.textContent = summary;
    if (app.el.cartSummaryInline) app.el.cartSummaryInline.textContent = summary;
    var singleAmount = Number(app.state.giftPromotionResult && app.state.giftPromotionResult.singleAmount || 0);
    var gap = Math.max(0, 150 - singleAmount);
    var gapItem = gap > 0 ? recommendGapFillItem(app, gap) : null;
    var boostItems = singleAmount >= 80 && singleAmount < 150 ? recommendBoostItems(app).slice(0, 3) : [];
    var upsellMainHtml = singleAmount < 150
      ? '還差 ' + gap + ' 元送主食 🎯' + (gapItem ? ' <button type="button" class="cart-boost-hint__action" data-gap-fill="' + escapeHtml(gapItem.id) + '">補差額 👉</button>' : '')
      : '🎉 已達滿額！記得選主食';
    var boostLineHtml = boostItems.length
      ? '<div class="cart-boost-hint__line">推薦補差：' + boostItems.map(function (item) {
        return '<button type="button" class="cart-boost-hint__chip" data-gap-add="' + escapeHtml(item.id) + '">+ ' + escapeHtml(item.name) + ' NT$' + Number(item.price || 0) + '</button>';
      }).join("") + '</div>'
      : '';
    var stapleWarnHtml = singleAmount >= 150 && hasPendingStapleSelection(app)
      ? '<div class="cart-boost-hint__line">👉 主食還沒選 ⚠️</div>'
      : '';
    if (app.el.upsellProgressBottom) app.el.upsellProgressBottom.innerHTML = upsellMainHtml + stapleWarnHtml;
    if (app.el.upsellProgressInline) app.el.upsellProgressInline.innerHTML = upsellMainHtml + boostLineHtml + stapleWarnHtml;
    if (app.el.viewCartBtnSticky) app.el.viewCartBtnSticky.classList.toggle("hidden", !app.state.cart.length);
    Array.prototype.slice.call(document.querySelectorAll("[data-gap-fill],[data-gap-add]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var itemId = button.getAttribute("data-gap-fill") || button.getAttribute("data-gap-add");
        if (itemId) quickAddSingle(app, itemId);
      });
    });

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
    var result = app.state.giftPromotionResult || buildGiftPromotionResult(app);
    if (result && result.enabled && (result.entitlement.stapleCount || result.entitlement.vegetableCount)) return result;
    return null;
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
