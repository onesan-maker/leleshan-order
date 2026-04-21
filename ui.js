(function () {
  var activeApp = null;
  var CATEGORY_COLOR_OPTIONS = [
    { value: "cream", label: "奶油米", bgColor: "#F7F1E3", buttonColor: "#B9853C", textColor: "#5A3418", buttonTextColor: "#FFFFFF" },
    { value: "warm-beige", label: "暖米色", bgColor: "#EFE3D3", buttonColor: "#A66A46", textColor: "#5B3723", buttonTextColor: "#FFFFFF" },
    { value: "light-wheat", label: "淡麥色", bgColor: "#F3E4C8", buttonColor: "#C9922E", textColor: "#5A3418", buttonTextColor: "#FFFFFF" },
    { value: "soft-yellow", label: "柔黃", bgColor: "#F6E8B1", buttonColor: "#B8891F", textColor: "#584110", buttonTextColor: "#FFFFFF" },
    { value: "pale-apricot", label: "淡杏色", bgColor: "#F3D9C3", buttonColor: "#C67A50", textColor: "#5D3424", buttonTextColor: "#FFFFFF" },
    { value: "light-blush", label: "淡粉膚", bgColor: "#F2DDD7", buttonColor: "#B46A66", textColor: "#5B3130", buttonTextColor: "#FFFFFF" },
    { value: "soft-olive", label: "淡橄欖", bgColor: "#E7E4C8", buttonColor: "#8F8A4D", textColor: "#494522", buttonTextColor: "#FFFFFF" },
    { value: "sage-light", label: "淺鼠尾草", bgColor: "#DDE5D6", buttonColor: "#759065", textColor: "#33442C", buttonTextColor: "#FFFFFF" },
    { value: "mist-blue", label: "霧藍灰", bgColor: "#DCE6E8", buttonColor: "#6F8D96", textColor: "#2E4850", buttonTextColor: "#FFFFFF" },
    { value: "pale-latte", label: "淺拿鐵", bgColor: "#E8D8C8", buttonColor: "#9D7156", textColor: "#4E3223", buttonTextColor: "#FFFFFF" }
  ];
  var DEFAULT_CATEGORY_COLOR = "warm-beige";

  function init(app) {
    activeApp = app;
    var el = app.el;
    el.profileName = document.getElementById("profile-name");
    el.profileMeta = document.getElementById("profile-meta");
    el.logoutBtn = document.getElementById("logout-btn");
    el.flavorOptions = document.getElementById("flavor-options");
    el.productFlavorTabs = document.getElementById("product-flavor-tabs");
    el.stickyFlavorBar = document.getElementById("sticky-flavor-bar");
    el.stickyFlavorTabs = document.getElementById("sticky-flavor-tabs");
    el.flavorStepCard = document.getElementById("flavor-step-card");
    el.comboSection = document.getElementById("combo-section");
    el.comboThresholdHint = document.getElementById("combo-threshold-hint");
    el.singleSection = document.getElementById("single-section");
    el.singleSectionToggle = document.getElementById("single-section-toggle");
    el.singleSectionContent = document.getElementById("single-section-content");
    el.comboRoot = document.getElementById("combo-root");
    el.comboUpsellRoot = document.getElementById("combo-upsell-root");
    el.singleRoot = document.getElementById("single-root");
    el.cartItems = document.getElementById("cart-items");
    el.giftSelectionPanel = document.getElementById("gift-selection-panel");
    el.customerName = document.getElementById("customer-name");
    el.orderNote = document.getElementById("order-note");
    el.pickupDate = document.getElementById("pickup-date");
    el.pickupTime = document.getElementById("pickup-time");
    el.orderForm = document.getElementById("order-form");
    el.checkoutSection = document.getElementById("checkout-section");
    el.submitBtn = document.getElementById("submit-btn");
    el.submitMessage = document.getElementById("submit-message");
    el.cartTotalTop = document.getElementById("cart-total-top");
    el.cartSummaryTop = document.getElementById("cart-summary-top");
    el.cartTotalBottom = document.getElementById("cart-total-bottom");
    el.cartSummaryBottom = document.getElementById("cart-summary-bottom");
    el.cartSummaryInline = document.getElementById("cart-summary-inline");
    el.upsellProgressBottom = document.getElementById("upsell-progress-bottom");
    el.upsellProgressInline = document.getElementById("upsell-progress-inline");
    el.floatingCart = document.querySelector(".floating-cart");
    el.promoBanner = document.getElementById("promo-banner");
    el.promoBannerText = document.getElementById("promo-banner-text");
    el.storeStatusText = document.getElementById("storeStatusText");
    el.storeStatusSubText = document.getElementById("storeStatusSubText");
    el.storeStatusModal = document.getElementById("store-status-modal");
    el.storeStatusModalTitle = document.getElementById("store-status-modal-title");
    el.storeStatusModalText = document.getElementById("store-status-modal-text");
    el.storeStatusModalClose = document.getElementById("store-status-modal-close");
    el.loginRequiredModal = document.getElementById("login-required-modal");
    el.loginRequiredConfirm = document.getElementById("login-required-confirm");
    el.loginRequiredCancel = document.getElementById("login-required-cancel");
    el.quantityModal = document.getElementById("quantity-modal");
    el.quantityModalItemName = document.getElementById("quantity-modal-item-name");
    el.quantityModalItemMeta = document.getElementById("quantity-modal-item-meta");
    el.quantityModalPrice = document.getElementById("quantity-modal-price");
    el.quantityModalDetail = document.getElementById("quantity-modal-detail");
    el.quantityModalType = document.getElementById("quantity-modal-type");
    el.quantityModalFlavorField = document.getElementById("quantity-modal-flavor-field");
    el.quantityModalFlavor = document.getElementById("quantity-modal-flavor");
    el.quantityModalStapleField = document.getElementById("quantity-modal-staple-field");
    el.quantityModalStaple = document.getElementById("quantity-modal-staple");
    el.quantityModalPortion = document.getElementById("quantity-modal-portion");
    el.quantityModalOptions = document.getElementById("quantity-modal-options");
    el.quantityModalActions = document.getElementById("quantity-modal-actions");
    el.quantityModalCancel = document.getElementById("quantity-modal-cancel");
    el.quantityModalSuccess = document.getElementById("quantity-modal-success");
    el.quantityModalSuccessText = document.getElementById("quantity-modal-success-text");
    el.quantityModalConfirm = document.getElementById("quantity-modal-confirm");
    el.flavorConfirmModal = document.getElementById("flavor-confirm-modal");
    el.flavorConfirmItemName = document.getElementById("flavor-confirm-item-name");
    el.flavorConfirmCurrent = document.getElementById("flavor-confirm-current");
    el.flavorConfirmOptions = document.getElementById("flavor-confirm-options");
    el.flavorConfirmCancel = document.getElementById("flavor-confirm-cancel");
    el.flavorConfirmSubmit = document.getElementById("flavor-confirm-submit");
    el.viewCartBtnSticky = document.getElementById("view-cart-btn-sticky");
    el.cartListStart = document.getElementById("cart-list-start");
    el.pickupReservationNotice = document.getElementById("pickup-reservation-notice");
    el.memberNavBtn = document.getElementById("member-nav-btn");
    bindSingleSectionToggle(app);
    setupStickyFlavorBar(app);
  }

  function bindModalDismiss(app, overlay, closeFn) {
    if (!overlay) return;
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeFn(app);
    });
  }

  function handleDocumentKeydown(app, event) {
    if (event.key !== "Escape") return;
    if (app.state.activeModal === "login-required") closeLoginRequiredModal(app);
    if (app.state.activeModal === "store-status") closeStoreStatusModal(app);
    if (app.state.activeModal === "quantity-select") closeQuantityModal(app);
    if (app.state.activeModal === "flavor-confirm" && app.modules && app.modules.cart) app.modules.cart.cancelFlavorSelection();
  }

  function setMessage(app, message, type) {
    if (!app.el.submitMessage) return;
    app.el.submitMessage.textContent = message || "";
    app.el.submitMessage.className = "submit-message" + (type ? " " + type : "");
  }

  function updateStoreStatusUI(app, status) {
    if (!app.el.storeStatusText || !app.el.storeStatusSubText) return;
    var meta = app.state.storeStatusMeta || {};

    if (status === app.STATUS.OPEN) {
      if (meta.displayState === "closing_soon") {
        app.el.storeStatusText.innerText = "🟠 即將打烊";
        app.el.storeStatusSubText.innerText = meta.subtitle || "營業中，請留意最後點餐時間。";
      } else {
        app.el.storeStatusText.innerText = "🟢 目前營業中";
        app.el.storeStatusSubText.innerText = meta.subtitle || "可以正常點餐。";
      }
    } else if (status === app.STATUS.CLOSED) {
      if (meta.displayState === "opening_soon") {
        app.el.storeStatusText.innerText = "🟡 即將開始營業";
        app.el.storeStatusSubText.innerText = meta.subtitle || "稍後就會開放點餐。";
      } else if (meta.displayState === "before_open") {
        app.el.storeStatusText.innerText = "🟡 尚未開始營業";
        app.el.storeStatusSubText.innerText = meta.subtitle || "目前尚未開始營業。";
      } else {
        app.el.storeStatusText.innerText = "🔴 今日休息";
        app.el.storeStatusSubText.innerText = meta.subtitle || "目前休息中，可預約取餐";
      }
    } else if (status === app.STATUS.LOADING) {
      app.el.storeStatusText.innerText = "⏳ 正在確認營業狀態";
      app.el.storeStatusSubText.innerText = "請稍候。";
    } else {
      app.el.storeStatusText.innerText = "⚪ 營業資訊同步中";
      app.el.storeStatusSubText.innerText = meta.subtitle || "目前沒有足夠資料，請稍後再試。";
    }
  }

  function setCustomerNamePlaceholder(app, isLoggedIn) {
    if (!app.el.customerName) return;
    app.el.customerName.placeholder = isLoggedIn ? "可自動帶入 LINE 顯示名稱" : "例如：王先生、小美";
  }

  function renderProfile(app) {
    if (!app.el.profileName || !app.el.profileMeta || !app.el.logoutBtn) return;
    if (app.state.profile) {
      app.el.profileName.textContent = app.state.profile.displayName || "LINE 使用者";
      app.el.profileMeta.textContent = "已登入 LINE，可直接送出訂單";
      app.el.logoutBtn.classList.remove("hidden");
      if (app.el.memberNavBtn) app.el.memberNavBtn.classList.remove("hidden");
      setCustomerNamePlaceholder(app, true);
    } else {
      app.el.profileName.textContent = "尚未登入";
      app.el.profileMeta.textContent = "送出訂單前會提示你登入 LINE。";
      app.el.logoutBtn.classList.add("hidden");
      if (app.el.memberNavBtn) app.el.memberNavBtn.classList.add("hidden");
      setCustomerNamePlaceholder(app, false);
    }
  }

  function resolveCategoryTheme(value) {
    var exact = CATEGORY_COLOR_OPTIONS.find(function (option) { return option.value === value; });
    if (exact) return exact;
    var byLegacyColor = CATEGORY_COLOR_OPTIONS.find(function (option) {
      return option.bgColor === value || option.buttonColor === value;
    });
    if (byLegacyColor) return byLegacyColor;
    return CATEGORY_COLOR_OPTIONS.find(function (option) { return option.value === DEFAULT_CATEGORY_COLOR; }) || CATEGORY_COLOR_OPTIONS[0];
  }

  function openStoreStatusModalOnce(app) {
    if (app.state.storeClosedModalShown || !app.el.storeStatusModal) return;
    app.state.storeClosedModalShown = true;
    app.el.storeStatusModal.classList.remove("hidden");
    app.el.storeStatusModal.setAttribute("aria-hidden", "false");
    app.state.activeModal = "store-status";
    if (app.el.storeStatusModalTitle) app.el.storeStatusModalTitle.textContent = "目前非營業時間";
    if (app.el.storeStatusModalText) app.el.storeStatusModalText.textContent = "目前休息中，可預約取餐";
  }

  function closeStoreStatusModal(app) {
    if (!app.el.storeStatusModal) return;
    app.el.storeStatusModal.classList.add("hidden");
    app.el.storeStatusModal.setAttribute("aria-hidden", "true");
    if (app.state.activeModal === "store-status") app.state.activeModal = null;
  }

  function openLoginRequiredModal(app) {
    if (!app.el.loginRequiredModal) return;
    app.el.loginRequiredModal.classList.remove("hidden");
    app.el.loginRequiredModal.setAttribute("aria-hidden", "false");
    app.state.activeModal = "login-required";
    if (app.el.loginRequiredConfirm) app.el.loginRequiredConfirm.focus();
  }

  function closeLoginRequiredModal(app) {
    if (!app.el.loginRequiredModal) return;
    app.el.loginRequiredModal.classList.add("hidden");
    app.el.loginRequiredModal.setAttribute("aria-hidden", "true");
    if (app.state.activeModal === "login-required") app.state.activeModal = null;
  }

  function fillSelectOptions(select, options, selectedValue) {
    if (!select) return;
    select.innerHTML = (options || []).map(function (option) {
      var selected = option.id === selectedValue ? " selected" : "";
      var priceLabel = option.price ? " +NT$" + option.price : "";
      return '<option value="' + escapeHtml(option.id) + '"' + selected + ">" + escapeHtml(option.name) + priceLabel + "</option>";
    }).join("");
  }

  function renderQuantityModalDetail(app, payload) {
    if (!app.el.quantityModalDetail || !payload) return;
    var isCombo = payload.type === "combo";
    var flavorOptions = (Array.isArray(payload.flavorOptions) && payload.flavorOptions.length ? payload.flavorOptions : app.state.flavors).map(function (flavor) {
      return { id: flavor.id, name: flavor.name };
    });

    // 口味欄位：只有 requiresFlavor=true 且有口味選項才顯示
    var showFlavor = payload.requiresFlavor === true && flavorOptions.length > 0;
    // 主食欄位：requiresStaple=true 時顯示
    var showStaple = payload.requiresStaple === true && payload.stapleOptions && payload.stapleOptions.length > 0;
    // detail 區塊：只有有東西要顯示才顯示
    // 注意：直接用 style.display 以免 display:grid 的 CSS 比 .hidden 優先序更高而蓋掉
    var showDetail = showFlavor || showStaple || isCombo;
    app.el.quantityModalDetail.style.display = showDetail ? "" : "none";

    if (app.el.quantityModalType) {
      app.el.quantityModalType.textContent = isCombo ? "🔥 套餐（最划算）" : "";
      if (app.el.quantityModalType.parentElement) {
        app.el.quantityModalType.parentElement.classList.toggle("hidden", !isCombo);
      }
    }

    if (app.el.quantityModalFlavorField && app.el.quantityModalFlavor) {
      if (showFlavor) {
        app.el.quantityModalFlavorField.classList.remove("hidden");
        fillSelectOptions(app.el.quantityModalFlavor, flavorOptions, payload.flavorId);
      } else {
        // requiresFlavor=false 或無口味選項：完全隱藏口味區塊
        app.el.quantityModalFlavorField.classList.add("hidden");
        app.el.quantityModalFlavor.innerHTML = "";
      }
    }

    if (app.el.quantityModalStapleField && app.el.quantityModalStaple) {
      if (showStaple) {
        app.el.quantityModalStapleField.classList.remove("hidden");
        fillSelectOptions(app.el.quantityModalStaple, payload.stapleOptions, payload.stapleId);
      } else {
        app.el.quantityModalStapleField.classList.add("hidden");
        app.el.quantityModalStaple.innerHTML = "";
      }
    }
  }

  function updateQuantityModalPrice(app, payload) {
    if (!app.el.quantityModalPrice || !payload) return;
    var pending = app.state.pendingCartSelection || payload;
    var basePrice = Number(payload.basePrice || 0);
    var adjustment = 0;

    if (pending.type === "combo") {
      var stapleId = app.el.quantityModalStaple && app.el.quantityModalStaple.value
        ? app.el.quantityModalStaple.value
        : pending.stapleId;
      var staple = (pending.stapleOptions || []).find(function (option) {
        return option.id === stapleId;
      }) || null;
      if (staple) {
        pending.stapleId = staple.id;
        pending.stapleName = staple.name;
        pending.staplePriceAdjustment = Number(staple.price || 0);
        adjustment = pending.staplePriceAdjustment;
      }
    }

    if (app.el.quantityModalFlavor && app.el.quantityModalFlavor.value) {
      pending.flavorId = app.el.quantityModalFlavor.value;
      var flavor = (pending.flavorOptions || app.state.flavors || []).find(function (item) {
        return item.id === pending.flavorId;
      }) || null;
      pending.flavorName = flavor ? flavor.name : pending.flavorName;
    }

    var totalPrice = basePrice + adjustment;
    app.el.quantityModalPrice.textContent = pending.type === "combo"
      ? "NT$ " + totalPrice + (adjustment ? "（含主食加價 NT$ " + adjustment + "）" : "（含主食）")
      : "NT$ " + totalPrice;
    app.el.quantityModalPrice.classList.remove("hidden");
  }

  function renderQuantityChoices(app, payload) {
    if (!app.el.quantityModalOptions || !payload) return;
    var selectedQuantity = Number((app.state.pendingCartSelection && app.state.pendingCartSelection.selectedQuantity) || payload.selectedQuantity || 1);
    var requiresConfirm = payload.requiresFlavor === true || payload.requiresStaple === true;
    app.el.quantityModalOptions.innerHTML = [1, 2, 3, 4, 5].map(function (quantity) {
      var activeClass = selectedQuantity === quantity ? " quantity-modal__choice--selected" : "";
      return '<button type="button" class="quantity-modal__choice' + activeClass + '" data-quantity-choice="' + quantity + '">' + quantity + '份</button>';
    }).join("");
    Array.prototype.slice.call(app.el.quantityModalOptions.querySelectorAll("[data-quantity-choice]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var quantity = Number(button.getAttribute("data-quantity-choice"));
        if (requiresConfirm) {
          if (app.state.pendingCartSelection) app.state.pendingCartSelection.selectedQuantity = quantity;
          renderQuantityChoices(app, payload);
          return;
        }
        app.modules.cart.applyPendingQuantity(quantity);
      });
    });
  }

  function portionGroupLabel(index) {
    return "第" + (index + 1) + "份";
  }

  function renderPortionSection(app, payload) {
    var el = app.el.quantityModalPortion;
    if (!el) return;

    if (!payload) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }

    el.classList.remove("hidden");

    var PRESET_LABELS = ["A點", "B點", "C點"];
    var inPortionMode = app.state.portionMode;

    // Default: if already in portion mode, pre-select active group; otherwise direct add
    var initialTargetGroupId = inPortionMode
      ? (app.state.activeGroupId || ((app.state.cartGroups[0]) && app.state.cartGroups[0].id) || "g-a")
      : null;
    if (app.state.pendingCartSelection) {
      app.state.pendingCartSelection.targetGroupId = initialTargetGroupId;
    }

    function buildGroupButtons(targetGroupId) {
      var gs = app.state.cartGroups || [];
      var html = gs.map(function (g, idx) {
        var active = targetGroupId === g.id ? " qm-group-btn--active" : "";
        return '<button class="qm-group-btn' + active + '" type="button" data-qm-group="' + escapeHtml(g.id) + '">' + escapeHtml(portionGroupLabel(idx)) + '</button>';
      }).join("");
      if (gs.length < PRESET_LABELS.length) {
        var nextLabel = PRESET_LABELS[gs.length];
        html += '<button class="qm-group-add-btn" type="button" data-qm-add="' + escapeHtml(nextLabel) + '">＋ 新增一位</button>';
      }
      return html;
    }

    function rebind(targetGroupId) {
      var inner = el.querySelector(".qm-groups-inner");
      if (inner) inner.innerHTML = buildGroupButtons(targetGroupId);
      Array.prototype.slice.call(el.querySelectorAll("[data-qm-group]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var gid = btn.getAttribute("data-qm-group");
          if (app.state.pendingCartSelection) app.state.pendingCartSelection.targetGroupId = gid;
          rebind(gid);
        });
      });
      Array.prototype.slice.call(el.querySelectorAll("[data-qm-add]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var label = btn.getAttribute("data-qm-add");
          var newId = "g-" + Math.random().toString(36).slice(2, 8);
          (app.state.cartGroups = app.state.cartGroups || []).push({ id: newId, label: label });
          if (app.state.pendingCartSelection) app.state.pendingCartSelection.targetGroupId = newId;
          rebind(newId);
        });
      });
    }

    var isSplit = inPortionMode;
    var directActive = !isSplit ? " qm-toggle-btn--active" : "";
    var splitActive  =  isSplit ? " qm-toggle-btn--active" : "";

    // Pre-build group buttons for split view
    var groupsHtml = buildGroupButtons(initialTargetGroupId);

    el.innerHTML = ''
      + '<div class="qm-portion-header">這份給誰？</div>'
      + '<div class="qm-portion-toggle">'
      + '<button class="qm-toggle-btn' + directActive + '" type="button" data-portion-mode="direct">直接加入</button>'
      + '<button class="qm-toggle-btn' + splitActive  + '" type="button" data-portion-mode="split">分給不同人</button>'
      + '</div>'
      + '<div class="qm-portion-groups' + (isSplit ? "" : " hidden") + '">'
      + '<div class="qm-groups-inner">' + groupsHtml + '</div>'
      + '</div>';

    var directBtn = el.querySelector('[data-portion-mode="direct"]');
    var splitBtn  = el.querySelector('[data-portion-mode="split"]');
    var groupsEl  = el.querySelector(".qm-portion-groups");

    if (directBtn) directBtn.addEventListener("click", function () {
      directBtn.classList.add("qm-toggle-btn--active");
      splitBtn.classList.remove("qm-toggle-btn--active");
      groupsEl.classList.add("hidden");
      if (app.state.pendingCartSelection) app.state.pendingCartSelection.targetGroupId = null;
    });

    if (splitBtn) splitBtn.addEventListener("click", function () {
      splitBtn.classList.add("qm-toggle-btn--active");
      directBtn.classList.remove("qm-toggle-btn--active");

      // Ensure at least 2 groups
      var gs = app.state.cartGroups || [];
      if (gs.length < 2) {
        var nextLabel = PRESET_LABELS[gs.length] || "D點";
        var newId = "g-" + Math.random().toString(36).slice(2, 8);
        (app.state.cartGroups = app.state.cartGroups || []).push({ id: newId, label: nextLabel });
      }

      // Default to first group
      var targetId = (app.state.cartGroups[0] && app.state.cartGroups[0].id) || "g-a";
      if (app.state.pendingCartSelection) app.state.pendingCartSelection.targetGroupId = targetId;

      groupsEl.classList.remove("hidden");
      rebind(targetId);
    });

    rebind(initialTargetGroupId);
  }

  function openQuantityModal(app, payload) {
    if (!app.el.quantityModal || !payload) return;
    app.state.activeModal = "quantity-select";
    app.el.quantityModal.classList.remove("hidden");
    app.el.quantityModal.setAttribute("aria-hidden", "false");
    var confirmMode = payload.requiresFlavor === true || payload.requiresStaple === true;
    var currentTitle = document.getElementById("quantity-modal-title");
    if (currentTitle) currentTitle.textContent = confirmMode ? "請選擇這份內容" : "請選擇數量";
    app.el.quantityModalItemName.textContent = payload.name || "請選擇品項";
    if (app.el.quantityModalItemMeta) {
      var metaText = (payload.detailDisplay || payload.detail || "").trim();
      app.el.quantityModalItemMeta.textContent = metaText;
      app.el.quantityModalItemMeta.classList.toggle("hidden", !metaText);
    }
    if (app.el.quantityModalPrice) {
      var basePrice = Number(payload.basePrice || 0);
      if (basePrice > 0) {
        app.el.quantityModalPrice.textContent = "NT$ " + basePrice + (payload.type === "combo" ? "（主食另計）" : "");
        app.el.quantityModalPrice.classList.remove("hidden");
      } else {
        app.el.quantityModalPrice.classList.add("hidden");
      }
    }
    if (app.state.pendingCartSelection) {
      if (!app.state.pendingCartSelection.selectedQuantity) app.state.pendingCartSelection.selectedQuantity = 1;
      app.state.pendingCartSelection.committed = false;
    }
    app.el.quantityModalSuccess.classList.add("hidden");
    app.el.quantityModalOptions.classList.remove("hidden");
    if (app.el.quantityModalActions) {
      app.el.quantityModalActions.classList.toggle("hidden", !(payload.requiresFlavor === true || payload.requiresStaple === true));
    }
    renderQuantityModalDetail(app, payload);
    renderPortionSection(app, payload);
    if (app.el.quantityModalFlavor) {
      app.el.quantityModalFlavor.onchange = function () {
        updateQuantityModalPrice(app, payload);
      };
    }
    if (app.el.quantityModalStaple) {
      app.el.quantityModalStaple.onchange = function () {
        updateQuantityModalPrice(app, payload);
      };
    }
    updateQuantityModalPrice(app, payload);
    renderQuantityChoices(app, payload);
  }

  function showQuantityAddedSuccess(app, selection, quantity) {
    if (!app.el.quantityModalSuccess || !app.el.quantityModalSuccessText || !app.el.quantityModalOptions) return;
    app.el.quantityModalOptions.classList.add("hidden");
    if (app.el.quantityModalActions) app.el.quantityModalActions.classList.add("hidden");
    Array.prototype.slice.call(app.el.quantityModalOptions.querySelectorAll("[data-quantity-choice]")).forEach(function (button) {
      button.disabled = true;
    });
    app.el.quantityModalSuccess.classList.remove("hidden");
    if (app.el.quantityModalDetail) app.el.quantityModalDetail.style.display = "none";
    var label = selection && selection.type === "combo"
      ? '已加入 ' + quantity + '份 ' + (selection.name || "") + '（🔥 套餐（最划算））'
      : '已加入 ' + quantity + '份 ' + (((selection && selection.name) || ""));
    app.el.quantityModalSuccessText.textContent = label;
    showToast("✔ 已加入 " + (((selection && selection.name) || "")) + " ×" + quantity);
    setTimeout(function () {
      if (app.state.activeModal === "quantity-select") closeQuantityModal(app);
    }, 1000);
  }

  function showOrderSuccess(app, pickupNumber, cartSnapshot, pickupLabel, groupsSnapshot) {
    var screen = document.getElementById('order-success-screen');
    if (!screen) {
      if (!app.el.submitMessage) return;
      var numDisplay = pickupNumber ? '取餐號碼 ' + escapeHtml(String(pickupNumber)) : '訂單已送出';
      var itemLines = (cartSnapshot || []).map(function (item) { return escapeHtml(item.name) + ' x' + item.quantity; }).join('、');
      app.el.submitMessage.innerHTML = '<strong>✓ ' + numDisplay + '</strong>' + (pickupLabel ? '<br>取餐時間：' + escapeHtml(pickupLabel) : '') + (itemLines ? '<br><small class="order-success-items">' + itemLines + '</small>' : '');
      app.el.submitMessage.className = 'submit-message success';
      return;
    }

    var numEl = document.getElementById('order-success-number');
    if (numEl) numEl.textContent = pickupNumber ? String(pickupNumber) : '—';

    var labelEl = document.getElementById('order-success-label');
    if (labelEl) labelEl.textContent = pickupLabel ? '取餐時間：' + pickupLabel : '';

    var total = (cartSnapshot || []).reduce(function (sum, item) { return sum + Number(item.price || 0); }, 0);
    var totalEl = document.getElementById('order-success-total');
    if (totalEl) totalEl.textContent = 'NT$ ' + total;

    var itemsEl = document.getElementById('order-success-items');
    if (itemsEl) {
      var regularItems = (cartSnapshot || []).filter(function (item) { return !item.isGift; });
      var giftItems = (cartSnapshot || []).filter(function (item) { return !!item.isGift; });
      var CHINESE_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      var multipleGroups = groupsSnapshot && groupsSnapshot.length > 1;
      var html = '';
      if (multipleGroups) {
        groupsSnapshot.forEach(function (group, idx) {
          var groupItems = regularItems.filter(function (item) { return item.groupId === group.id; });
          if (!groupItems.length) return;
          html += '<div class="oss-group-header">第' + (CHINESE_NUMS[idx] || (idx + 1)) + '份</div>';
          html += groupItems.map(function (item) {
            var meta = item.flavorName ? '（' + escapeHtml(item.flavorName) + '）' : '';
            return '<div class="oss-item"><span>' + escapeHtml(item.name) + meta + ' x' + Number(item.quantity || 0) + '</span><span>NT$ ' + Number(item.price || 0) + '</span></div>';
          }).join('');
        });
      } else {
        html = regularItems.map(function (item) {
          var meta = item.flavorName ? '（' + escapeHtml(item.flavorName) + '）' : '';
          return '<div class="oss-item"><span>' + escapeHtml(item.name) + meta + ' x' + Number(item.quantity || 0) + '</span><span>NT$ ' + Number(item.price || 0) + '</span></div>';
        }).join('');
      }
      html += giftItems.length ? '<div class="oss-gifts">贈品：' + giftItems.map(function (i) { return escapeHtml(i.name); }).join('、') + '</div>' : '';
      itemsEl.innerHTML = html;
    }

    // Enter success page-state: hide everything except success screen
    document.body.classList.add('success-mode');
    if (app.el.submitMessage) { app.el.submitMessage.textContent = ''; app.el.submitMessage.className = 'submit-message'; }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    var backBtn = document.getElementById('order-success-back-btn');
    if (backBtn) {
      backBtn.onclick = function () {
        document.body.classList.remove('success-mode');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
  }

  function openFlavorConfirmModal(app, payload) {
    if (!app.el.flavorConfirmModal || !payload) return;
    app.state.activeModal = "flavor-confirm";
    app.el.flavorConfirmModal.classList.remove("hidden");
    app.el.flavorConfirmModal.setAttribute("aria-hidden", "false");
    if (app.el.flavorConfirmItemName) app.el.flavorConfirmItemName.textContent = payload.name || "";
    var currentFlavor = app.state.flavors.find(function (item) {
      return item.id === app.state.selectedFlavor;
    }) || app.state.flavors[0] || { id: "", name: "" };
    if (app.el.flavorConfirmCurrent) {
      app.el.flavorConfirmCurrent.innerHTML = '目前口味：<strong>' + escapeHtml(currentFlavor.name || "") + '</strong>';
    }
    if (app.el.flavorConfirmOptions) {
      var selectedFlavorId = payload.flavorId || currentFlavor.id || "";
      app.el.flavorConfirmOptions.innerHTML = app.state.flavors.map(function (flavor) {
        var selectedClass = selectedFlavorId === flavor.id ? " flavor-confirm__choice--selected" : "";
        return '<button type="button" class="option-pill flavor-confirm__choice' + selectedClass + '" data-flavor-confirm="' + escapeHtml(flavor.id) + '">' + escapeHtml(flavor.name) + '</button>';
      }).join("");
      Array.prototype.slice.call(app.el.flavorConfirmOptions.querySelectorAll("[data-flavor-confirm]")).forEach(function (button) {
        button.addEventListener("click", function () {
          var flavorId = button.getAttribute("data-flavor-confirm") || "";
          app.state.pendingFlavorChoice = flavorId;
          Array.prototype.slice.call(app.el.flavorConfirmOptions.querySelectorAll("[data-flavor-confirm]")).forEach(function (choice) {
            choice.classList.toggle("flavor-confirm__choice--selected", choice.getAttribute("data-flavor-confirm") === flavorId);
          });
        });
      });
      app.state.pendingFlavorChoice = selectedFlavorId;
    }
  }

  function closeFlavorConfirmModal(app) {
    if (!app.el.flavorConfirmModal) return;
    app.el.flavorConfirmModal.classList.add("hidden");
    app.el.flavorConfirmModal.setAttribute("aria-hidden", "true");
    if (app.state.activeModal === "flavor-confirm") app.state.activeModal = null;
    app.state.pendingFlavorChoice = null;
    if (app.el.flavorConfirmOptions) app.el.flavorConfirmOptions.innerHTML = "";
  }

  function closeQuantityModal(app) {
    if (!app.el.quantityModal) return;
    app.el.quantityModal.classList.add("hidden");
    app.el.quantityModal.setAttribute("aria-hidden", "true");
    if (app.state.activeModal === "quantity-select") app.state.activeModal = null;
    app.state.pendingCartSelection = null;
    app.el.quantityModalOptions.innerHTML = "";
    if (app.el.quantityModalActions) app.el.quantityModalActions.classList.add("hidden");
    if (app.el.quantityModalDetail) app.el.quantityModalDetail.style.display = "none";
    if (app.el.quantityModalItemMeta) {
      app.el.quantityModalItemMeta.textContent = "";
      app.el.quantityModalItemMeta.classList.add("hidden");
    }
    if (app.el.quantityModalPortion) { app.el.quantityModalPortion.classList.add("hidden"); app.el.quantityModalPortion.innerHTML = ""; }
    if (app.el.quantityModalFlavor) app.el.quantityModalFlavor.onchange = null;
    if (app.el.quantityModalStaple) app.el.quantityModalStaple.onchange = null;
  }

  function applyCategoryButtonThemes(root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll("[data-button-color]")).forEach(function (button) {
      var backgroundColor = button.getAttribute("data-button-color") || "";
      var buttonTextColor = button.getAttribute("data-button-text-color") || "#FFFFFF";
      if (!backgroundColor) return;
      button.style.background = backgroundColor;
      button.style.backgroundColor = backgroundColor;
      button.style.backgroundImage = "none";
      button.style.color = buttonTextColor;
      button.style.borderColor = backgroundColor;
    });
  }

  function scrollToCartList(app) {
    if (!app.state.cart.length) {
      setMessage(app, "購物車目前是空的。", "error");
      return;
    }
    var target = app.el.cartListStart || app.el.cartItems || app.el.checkoutSection;
    if (!target) return;
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () {
        window.scrollBy({ top: -72, left: 0, behavior: "smooth" });
      }, 220);
    });
  }

  function syncControls(app) {
    var blocked = app.state.storeOpenStatus === app.STATUS.LOADING;
    if (app.el.floatingCart) app.el.floatingCart.classList.toggle("interaction-disabled", blocked);
    if (app.el.submitBtn) {
      app.el.submitBtn.disabled = app.state.submitting || blocked;
      app.el.submitBtn.textContent = app.state.submitting ? "送出中..." : "送出訂單";
    }
    if (app.el.pickupDate) app.el.pickupDate.disabled = blocked;
    if (app.el.pickupTime) app.el.pickupTime.disabled = blocked;
    if (app.el.pickupReservationNotice) {
      app.el.pickupReservationNotice.classList.toggle("hidden", app.state.storeOpenStatus !== app.STATUS.CLOSED);
    }
  }

  function updatePromoBanner(app) {
    if (!app.el.promoBanner || !app.el.promoBannerText) return;
    var text = "";
    if (app.state.appliedPromotion && app.state.appliedPromotion.type === "gift_selection") {
      var result = app.state.appliedPromotion;
      var selectedCount = Array.isArray(result.selectedGifts) ? result.selectedGifts.length : 0;
      var requiredCount = Number(result.entitlement && result.entitlement.stapleCount || 0) + Number(result.entitlement && result.entitlement.vegetableCount || 0);
      text = result.incomplete
        ? "已達贈品門檻，請先選完贈品再送單。"
        : "本次滿額贈送已選擇完成，共 " + selectedCount + " / " + requiredCount + " 份。";
    } else if (app.state.appliedPromotion) text = "已符合優惠：" + app.state.appliedPromotion.name;
    else if (app.state.settings && app.state.settings.promoEnabled && app.state.settings.promoText) text = app.state.settings.promoText;
    if (!text) {
      app.el.promoBanner.classList.add("hidden");
      return;
    }
    app.el.promoBanner.classList.remove("hidden");
    app.el.promoBannerText.textContent = text;
  }

  function renderFlavorOptions(app) {
    if (!app.el.flavorOptions && !app.el.productFlavorTabs && !app.el.stickyFlavorTabs) return;
    if (!app.state.selectedFlavor && app.state.flavors.length) {
      app.state.selectedFlavor = app.state.flavors[0].id;
    }
    var tabsHtml = app.state.flavors.map(function (flavor) {
      var selectedClass = app.state.selectedFlavor === flavor.id ? " flavor-tab--selected" : "";
      var label = app.state.selectedFlavor === flavor.id ? "✓ " + flavor.name : flavor.name;
      return '<button class="option-pill flavor-tab' + selectedClass + '" type="button" data-flavor-id="' + flavor.id + '">' + escapeHtml(label) + "</button>";
    }).join("");
    var productTabsHtml = app.state.flavors.map(function (flavor) {
      var selectedClass = app.state.selectedFlavor === flavor.id ? " flavor-switch-bar__tab--selected" : "";
      var label = app.state.selectedFlavor === flavor.id ? "✓ " + flavor.name : flavor.name;
      return '<button class="flavor-switch-bar__tab' + selectedClass + '" type="button" data-product-flavor-id="' + flavor.id + '">' + escapeHtml(label) + "</button>";
    }).join("");
    var stickyTabsHtml = app.state.flavors.map(function (flavor) {
      var selectedClass = app.state.selectedFlavor === flavor.id ? " flavor-switch-bar__tab--selected" : "";
      var label = app.state.selectedFlavor === flavor.id ? "✓ " + flavor.name : flavor.name;
      return '<button class="flavor-switch-bar__tab' + selectedClass + '" type="button" data-sticky-flavor-id="' + flavor.id + '">' + escapeHtml(label) + "</button>";
    }).join("");
    if (app.el.flavorOptions) app.el.flavorOptions.innerHTML = tabsHtml;
    if (app.el.productFlavorTabs) app.el.productFlavorTabs.innerHTML = productTabsHtml;
    if (app.el.stickyFlavorTabs) app.el.stickyFlavorTabs.innerHTML = stickyTabsHtml;

    function bindFlavorSwitch(button) {
      button.addEventListener("click", function () {
        app.state.selectedFlavor = button.getAttribute("data-flavor-id") || button.getAttribute("data-product-flavor-id");
        if (!app.state.selectedFlavor) app.state.selectedFlavor = button.getAttribute("data-sticky-flavor-id");
        renderFlavorOptions(app);
        renderComboItems(app);
        renderSingleItems(app);
        setMessage(app, "");
        setTimeout(function () {
          var step3 = document.getElementById("step3-section");
          if (step3) {
            step3.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
            step3.classList.add("highlight-step");
            setTimeout(function () {
              step3.classList.remove("highlight-step");
            }, 1200);
            setTimeout(function () { window.scrollBy({ top: -72, left: 0, behavior: "smooth" }); }, 200);
          }
        }, 150);
      });
    }

    Array.prototype.slice.call((app.el.flavorOptions || document.createElement("div")).querySelectorAll("[data-flavor-id]")).forEach(function (button) {
      bindFlavorSwitch(button);
    });
    Array.prototype.slice.call((app.el.productFlavorTabs || document.createElement("div")).querySelectorAll("[data-product-flavor-id]")).forEach(function (button) {
      bindFlavorSwitch(button);
    });
    Array.prototype.slice.call((app.el.stickyFlavorTabs || document.createElement("div")).querySelectorAll("[data-sticky-flavor-id]")).forEach(function (button) {
      bindFlavorSwitch(button);
    });
  }

  function setStickyFlavorBarVisible(app, visible) {
    if (!app.el.stickyFlavorBar) return;
    app.el.stickyFlavorBar.classList.toggle("hidden", !visible);
    app.el.stickyFlavorBar.classList.toggle("sticky-active", !!visible);
    app.el.stickyFlavorBar.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function setupStickyFlavorBar(app) {
    if (!app.el.stickyFlavorBar || !app.el.flavorStepCard) return;
    setStickyFlavorBarVisible(app, false);
    if (typeof IntersectionObserver === "function") {
      var observer = new IntersectionObserver(function (entries) {
        var entry = entries[0];
        setStickyFlavorBarVisible(app, !(entry && entry.isIntersecting));
      }, {
        root: null,
        threshold: 0.01
      });
      observer.observe(app.el.flavorStepCard);
      app._stickyFlavorObserver = observer;
      return;
    }
    function syncSticky() {
      if (!app.el.flavorStepCard) return;
      var rect = app.el.flavorStepCard.getBoundingClientRect();
      setStickyFlavorBarVisible(app, rect.bottom < 0 || rect.top < 0);
    }
    window.addEventListener("scroll", syncSticky, { passive: true });
    syncSticky();
  }

  function updateSingleSectionUI(app) {
    if (!app.el.singleSection || !app.el.singleSectionToggle || !app.el.singleSectionContent) return;
    var hasItems = !!(app.state.singleCategories && app.state.singleCategories.length);
    app.el.singleSection.classList.toggle("hidden", !hasItems);
    if (!hasItems) return;
    var expanded = app.state.singleSectionExpanded === true;
    var totalSingles = 0;
    app.state.singleCategories.forEach(function (category) {
      totalSingles += Array.isArray(category.items) ? category.items.length : 0;
    });
    var defaultVisible = 6;
    var remaining = Math.max(0, totalSingles - defaultVisible);
    var canExpand = remaining > 0;
    app.el.singleSectionToggle.classList.toggle("hidden", !canExpand);
    if (canExpand) {
      if (expanded) {
        app.el.singleSectionToggle.innerHTML =
          '<span class="single-section-toggle__copy"><span class="single-section-toggle__title">已顯示全部單點商品</span>' +
          '<span class="single-section-toggle__desc">單點商品都在這裡</span></span>';
      } else {
        app.el.singleSectionToggle.innerHTML =
          '<span class="single-section-toggle__copy"><span class="single-section-toggle__title">還有更多單點商品</span>' +
          '<span class="single-section-toggle__desc">點這裡展開全部單點（還有 ' + remaining + ' 項）</span></span>' +
          '<span class="single-section-toggle__arrow" aria-hidden="true">›</span>';
      }
    }
    app.el.singleSectionToggle.classList.toggle("single-section-toggle--expanded", canExpand && expanded);
    app.el.singleSectionToggle.classList.toggle("single-section-toggle--breathing", canExpand && !expanded);
    app.el.singleSectionToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    app.el.singleSectionContent.classList.remove("hidden");
  }

  function renderComboItems(app) {
    if (!app.el.comboRoot) return;
    if (app.el.comboSection) app.el.comboSection.classList.toggle("hidden", !app.state.comboItems.length);
    var selectedFlavor = app.state.flavors.find(function (item) {
      return item.id === app.state.selectedFlavor;
    }) || app.state.flavors[0] || { name: "" };
    var comboChip = document.getElementById("combo-flavor-chip");
    if (comboChip) comboChip.textContent = selectedFlavor.name ? ("口味：" + selectedFlavor.name) : "";
    app.el.comboRoot.innerHTML = app.state.comboItems.map(function (item, idx) {
      var options = app.modules.cart.getComboOptions(item).map(function (option) {
        return '<option value="' + option.id + '">' + escapeHtml(option.name) + (option.price ? " +NT$" + option.price : "") + "</option>";
      }).join("");
      var flavorLine = item.requiresFlavor === true ? '<p class="item-card__flavor">套用：' + escapeHtml(selectedFlavor.name || "") + '</p>' : '';
      var numBadge = '<span class="combo-num">' + (idx + 1) + '</span>';
      var itemBadge = item.badge ? '<span class="item-badge">' + escapeHtml(item.badge) + '</span>' : '';
      return '<article class="item-card item-card--combo">' + numBadge + itemBadge + '<div class="item-card__body"><h3>' + escapeHtml(item.name) + '</h3>' + flavorLine + '<p class="item-card__meta">' + escapeHtml(item.description || "") + '</p></div><div class="item-card__footer"><strong class="item-card__price">NT$ ' + Number(item.price || 0) + '</strong><label class="option-group"><span>主食</span><select id="staple-' + item.id + '">' + options + '</select></label><button class="secondary-btn secondary-btn--full" type="button" data-add-combo="' + item.id + '">加入🔥 套餐（最划算）</button></div></article>';
    }).join("");

    Array.prototype.slice.call(app.el.comboRoot.querySelectorAll("[data-add-combo]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.modules.cart.requestAddCombo(button.getAttribute("data-add-combo"));
      });
    });
  }

  function renderSingleTile(item, theme, flavorName) {
    var priceText = 'NT$ ' + Number(item.price || 0) + (item.unit ? ' / ' + escapeHtml(item.unit) : '');
    // Show flavor indicator for all items when a flavor is selected (applies to whole order).
    var flavorLine = flavorName ? '<small class="menu-tile__flavor">套用：' + escapeHtml(flavorName) + '</small>' : '';
    return '<article class="menu-tile"><div class="menu-tile__body"><strong>' + escapeHtml(item.name) + '</strong>' + flavorLine + (item.unit ? '<span>' + escapeHtml(item.unit) + '</span>' : '') + '</div><div class="menu-tile__footer"><strong>' + priceText + '</strong><button class="mini-btn menu-tile__add-btn" type="button" data-add-single="' + item.id + '" data-category-theme="' + escapeHtml(theme.value) + '" data-button-color="' + escapeHtml(theme.buttonColor) + '" data-button-text-color="' + escapeHtml(theme.buttonTextColor) + '">加入</button></div></article>';
  }

  function findComboUpsellEntries(app) {
    var names = ["毛肚", "玉米筍", "經典豬肉片", "王子麵"];
    var flat = [];
    app.state.singleCategories.forEach(function (category) {
      var theme = resolveCategoryTheme(category.colorTheme || category.bgColor || category.themeColor);
      category.items.forEach(function (item) {
        flat.push({ item: item, theme: theme });
      });
    });
    return names.map(function (name) {
      return flat.find(function (entry) {
        return entry.item && (entry.item.name === name || String(entry.item.name || "").indexOf(name) >= 0);
      }) || null;
    }).filter(Boolean);
  }

  function renderComboUpsell(app) {
    if (!app.el.comboUpsellRoot) return;
    if (!app.state.comboUpsellVisible) {
      app.el.comboUpsellRoot.classList.add("hidden");
      app.el.comboUpsellRoot.innerHTML = "";
      return;
    }

    var entries = findComboUpsellEntries(app);
    if (!entries.length) {
      app.el.comboUpsellRoot.classList.add("hidden");
      app.el.comboUpsellRoot.innerHTML = "";
      return;
    }

    app.el.comboUpsellRoot.classList.remove("hidden");
    app.el.comboUpsellRoot.innerHTML = '<section class="combo-upsell"><div class="combo-upsell__head"><h3>再加一點，更滿足</h3><p>熱門加點，直接加入</p></div><div class="combo-upsell__list">' + entries.map(function (entry) {
      return '<article class="combo-upsell__item"><div class="combo-upsell__body"><strong>' + escapeHtml(entry.item.name) + '</strong><span>NT$ ' + Number(entry.item.price || 0) + '</span></div><button class="mini-btn combo-upsell__btn" type="button" data-upsell-add-single="' + entry.item.id + '">+ 加入</button></article>';
    }).join("") + '</div></section>';

    Array.prototype.slice.call(app.el.comboUpsellRoot.querySelectorAll("[data-upsell-add-single]")).forEach(function (button) {
      var itemId = button.getAttribute("data-upsell-add-single");
      button.addEventListener("click", function () {
        var match = null;
        app.state.singleCategories.forEach(function (category) {
          category.items.forEach(function (item) {
            if (item.id === itemId) match = item;
          });
        });
        if (!match) return;
        if (match.quickAdd === true) app.modules.cart.quickAddSingle(itemId);
        else app.modules.cart.requestAddSingle(itemId);
      });
    });
  }

  function singlePriorityRank(name) {
    var names = ["玉米筍", "毛肚", "王子麵", "白飯"];
    var idx = names.findIndex(function (item) {
      return name === item || String(name || "").indexOf(item) >= 0;
    });
    return idx >= 0 ? idx : 999;
  }

  function sortSingleItemsForDisplay(items) {
    return (items || []).slice().sort(function (left, right) {
      var leftRank = singlePriorityRank(left && left.name);
      var rightRank = singlePriorityRank(right && right.name);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left && left.name || "").localeCompare(String(right && right.name || ""), "zh-Hant");
    });
  }

  function visibleSingleCategories(app) {
    var expanded = app.state.singleSectionExpanded === true;
    var remaining = expanded ? Infinity : 6;
    return app.state.singleCategories.map(function (category) {
      var sortedItems = sortSingleItemsForDisplay(category.items);
      var visibleItems = expanded ? sortedItems : sortedItems.slice(0, remaining);
      if (!expanded) remaining = Math.max(0, remaining - visibleItems.length);
      return {
        id: category.id,
        title: category.title,
        colorTheme: category.colorTheme,
        bgColor: category.bgColor,
        themeColor: category.themeColor,
        items: visibleItems
      };
    }).filter(function (category) { return category.items.length; });
  }

  function findPopularAddOns(app) {
    var names = ["玉米筍", "毛肚", "王子麵", "白飯"];
    var flat = [];
    app.state.singleCategories.forEach(function (category) {
      var theme = resolveCategoryTheme(category.colorTheme || category.bgColor || category.themeColor);
      category.items.forEach(function (item) {
        flat.push({ item: item, theme: theme });
      });
    });
    return names.map(function (name) {
      return flat.find(function (entry) {
        return entry.item && (entry.item.name === name || String(entry.item.name || "").indexOf(name) >= 0);
      }) || null;
    }).filter(Boolean);
  }

  function renderSingleItems(app) {
    if (!app.el.singleRoot) return;
    var selectedFlavor = app.state.flavors.find(function (item) {
      return item.id === app.state.selectedFlavor;
    }) || app.state.flavors[0] || { name: "" };
    var singleChip = document.getElementById("single-flavor-chip");
    if (singleChip) singleChip.textContent = selectedFlavor.name ? ("口味：" + selectedFlavor.name) : "";
    var popular = findPopularAddOns(app);
    var expanded = app.state.singleSectionExpanded === true;
    var visibleCategories = visibleSingleCategories(app);
    var popularHtml = expanded && popular.length
      ? '<section class="category-card category-card--tinted recommend-strip-section"><div class="category-card__head"><h3>大家都會加 👍</h3></div><div class="recommend-strip">' + popular.map(function (entry) { return renderSingleTile(entry.item, entry.theme, selectedFlavor.name); }).join("") + '</div></section>'
      : "";
    app.el.singleRoot.innerHTML = popularHtml + visibleCategories.map(function (category) {
      var theme = resolveCategoryTheme(category.colorTheme || category.bgColor || category.themeColor);
      return '<section class="category-card category-card--tinted" data-category-theme="' + escapeHtml(theme.value) + '" style="background:' + theme.bgColor + ";color:" + theme.textColor + '"><div class="category-card__head"><h3>' + escapeHtml(category.title) + '</h3><span class="option-pill">' + category.items.length + ' 項</span></div><div class="menu-tile-grid">' + category.items.map(function (item) {
        return renderSingleTile(item, theme, selectedFlavor.name);
      }).join("") + "</div></section>";
    }).join("");

    applyCategoryButtonThemes(app.el.singleRoot);
    Array.prototype.slice.call(app.el.singleRoot.querySelectorAll("[data-add-single]")).forEach(function (button) {
      var itemId = button.getAttribute("data-add-single");
      button.addEventListener("click", function () {
        var isQuick = false;
        app.state.singleCategories.forEach(function (cat) {
          cat.items.forEach(function (it) {
            if (it.id === itemId && it.quickAdd === true) isQuick = true;
          });
        });
        if (isQuick) {
          app.modules.cart.quickAddSingle(itemId);
        } else {
          app.modules.cart.requestAddSingle(itemId);
        }
      });
    });
    renderComboUpsell(app);
    updateSingleSectionUI(app);
  }

  function showToast(message, actions, timeoutMs) {
    var el = document.getElementById("lls-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lls-toast";
      el.className = "toast-msg";
      document.body.appendChild(el);
    }
    el.classList.toggle("toast-msg--actions", Array.isArray(actions) && actions.length > 0);
    el.innerHTML = '<div class="toast-msg__text">' + escapeHtml(message || "") + '</div>' + ((actions || []).length ? '<div class="toast-msg__actions">' + actions.map(function (action) {
      return '<button type="button" class="toast-msg__action" data-toast-add="' + escapeHtml(action.itemId || "") + '">' + escapeHtml(action.label || "") + '</button>';
    }).join("") + '</div>' : '');
    Array.prototype.slice.call(el.querySelectorAll("[data-toast-add]")).forEach(function (button) {
      button.addEventListener("click", function () {
        if (activeApp && activeApp.modules && activeApp.modules.cart) activeApp.modules.cart.quickAddSingle(button.getAttribute("data-toast-add"));
      });
    });
    el.classList.add("toast-msg--visible");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove("toast-msg--visible"); }, Number(timeoutMs || 1200));
  }

  function renderPickupDateOptions(app) {
    if (!app.el.pickupDate) return;
    app.state.pickupDateOptions = app.modules.checkout.getAvailablePickupDates();
    if (!app.state.pickupDateOptions.length) {
      app.el.pickupDate.innerHTML = '<option value="">目前沒有可選日期</option>';
      app.state.pickupDateLabel = "";
      app.state.pickupDateValue = "";
      return;
    }
    if (!app.state.pickupDateValue || !app.state.pickupDateOptions.some(function (item) { return item.value === app.state.pickupDateValue; })) {
      app.state.pickupDateValue = app.state.pickupDateOptions[0].value;
      app.state.pickupDateLabel = app.state.pickupDateOptions[0].label;
    }
    app.el.pickupDate.innerHTML = app.state.pickupDateOptions.map(function (item) {
      return '<option value="' + item.value + '"' + (item.value === app.state.pickupDateValue ? " selected" : "") + ">" + item.label + "</option>";
    }).join("");
  }

  function renderPickupTimeOptions(app) {
    if (!app.el.pickupTime) return;
    app.state.pickupTimeOptions = app.modules.checkout.generatePickupSlots(app.state.pickupDateValue);
    if (!app.state.pickupTimeOptions.length) {
      app.el.pickupTime.innerHTML = '<option value="">目前沒有可選時間</option>';
      app.state.pickupTime = "";
      return;
    }
    if (!app.state.pickupTime || app.state.pickupTimeOptions.indexOf(app.state.pickupTime) < 0) {
      app.state.pickupTime = app.state.pickupTimeOptions[0];
    }
    app.el.pickupTime.innerHTML = app.state.pickupTimeOptions.map(function (time) {
      return '<option value="' + time + '"' + (time === app.state.pickupTime ? " selected" : "") + ">" + time + "</option>";
    }).join("");
  }

  function renderAll(app) {
    renderProfile(app);
    renderFlavorOptions(app);
    renderComboItems(app);
    renderSingleItems(app);
    renderComboUpsell(app);
    updateSingleSectionUI(app);
    renderPickupDateOptions(app);
    renderPickupTimeOptions(app);
    app.modules.cart.renderCart();
  }

  function buildSingleCategories(categories, menuItems) {
    return categories.map(function (category) {
      return {
        id: category.id,
        title: category.name,
        colorTheme: resolveCategoryTheme(category.colorTheme || category.bgColor || category.themeColor).value,
        items: menuItems.filter(function (item) { return item.categoryId === category.id && item.enabled !== false; })
      };
    }).filter(function (category) { return category.items.length; });
  }

  function resolveCategoryColor(value) {
    return resolveCategoryTheme(value).bgColor;
  }

  async function loadStoreData(app) {
    var db = app.state.db;
    var storeId = app.state.storeId;
    console.log("[FrontData] Loading menu source from Firestore.", {
      storeId: storeId,
      paths: [
        "flavors where storeId==" + storeId,
        "categories where storeId==" + storeId,
        "menu_items where storeId==" + storeId,
        "menuItems where storeId==" + storeId,
        "comboTemplates where storeId==" + storeId,
        "promotions where storeId==" + storeId,
        "settings/" + storeId
      ]
    });

    var snaps = await Promise.all([
      db.collection("flavors").where("storeId", "==", storeId).get(),
      db.collection("categories").where("storeId", "==", storeId).get(),
      db.collection("menu_items").where("storeId", "==", storeId).get(),
      db.collection("menuItems").where("storeId", "==", storeId).get(),
      db.collection("comboTemplates").where("storeId", "==", storeId).get(),
      db.collection("promotions").where("storeId", "==", storeId).get(),
      db.collection("settings").doc(storeId).get()
    ]);

    var flavors = docs(snaps[0]).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    var categories = docs(snaps[1]).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    var menuItemsNew = docs(snaps[2]).map(normalizeMenuItemDoc).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    var menuItemsLegacy = docs(snaps[3]).map(normalizeMenuItemDoc).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    var menuItems = mergeMenuItems(menuItemsNew, menuItemsLegacy).sort(bySort);
    var combos = docs(snaps[4]).map(normalizeComboItemDoc).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    app.state.promotions = docs(snaps[5]).filter(function (item) { return item.enabled !== false; });
    app.state.settings = snaps[6].exists ? snaps[6].data() : null;

    var usingFirestoreFlavors = flavors.length > 0;
    var usingFirestoreCombos = combos.length > 0;
    var usingFirestoreCategories = categories.length > 0 && menuItems.length > 0;

    if (usingFirestoreFlavors) app.state.flavors = flavors;
    if (usingFirestoreCombos) app.state.comboItems = combos;
    var settingsGlobalOptions = app.state.settings && app.state.settings.globalOptions ? app.state.settings.globalOptions : null;
    app.state.globalOptions = {
      flavors: Array.isArray(settingsGlobalOptions && settingsGlobalOptions.flavors) ? settingsGlobalOptions.flavors.slice() : app.state.flavors.map(function (item) { return item.name; }),
      staples: Array.isArray(settingsGlobalOptions && settingsGlobalOptions.staples) ? settingsGlobalOptions.staples.slice() : app.state.stapleOptions.map(function (item) { return item.name; })
    };
    if (Array.isArray(settingsGlobalOptions && settingsGlobalOptions.staples) && settingsGlobalOptions.staples.length) {
      app.state.stapleOptions = settingsGlobalOptions.staples.map(function (name) {
        return { id: name, name: name, price: 0 };
      });
    }
    if (app.state.flavors.length) {
      var preferredFlavor = app.state.flavors.find(function (item) {
        return item.id === app.state.selectedFlavor;
      });
      app.state.selectedFlavor = (preferredFlavor || app.state.flavors[0]).id;
    } else {
      app.state.selectedFlavor = null;
    }
    app.state.singleCategories = buildSingleCategories(
      usingFirestoreCategories ? categories : app.defaults.categories || [],
      usingFirestoreCategories ? menuItems : app.defaults.menuItems || []
    );
    app.state.singleSectionExpanded = false;

    app.state.dataSourceSummary = {
      storeId: storeId,
      flavors: usingFirestoreFlavors ? "firestore" : "defaults.js fallback",
      combos: usingFirestoreCombos ? "firestore" : "defaults.js fallback",
      menu: usingFirestoreCategories ? "firestore" : "defaults.js fallback"
    };

    console.log("[FrontData] Firestore documents loaded.", {
      storeId: storeId,
      counts: {
        flavors: flavors.length,
        categories: categories.length,
        menuItems: menuItems.length,
        menuItemsNew: menuItemsNew.length,
        menuItemsLegacy: menuItemsLegacy.length,
        comboTemplates: combos.length,
        promotions: app.state.promotions.length,
        settings: app.state.settings ? 1 : 0
      }
    });
    console.log("[FrontData] Active data source summary.", app.state.dataSourceSummary);

    if (!usingFirestoreFlavors || !usingFirestoreCombos || !usingFirestoreCategories) {
      console.warn("[FrontData] Firestore data incomplete, using fallback defaults where needed.", {
        storeId: storeId,
        missing: {
          flavors: !usingFirestoreFlavors,
          combos: !usingFirestoreCombos,
          menu: !usingFirestoreCategories
        }
      });
    }

    updatePromoBanner(app);
    setupSettingsListener(app);
  }

  function setupSettingsListener(app) {
    var db = app.state.db;
    var storeId = app.state.storeId;
    if (!db || !storeId) return;
    if (app._settingsUnsub) { try { app._settingsUnsub(); } catch (e) {} }
    app._settingsUnsub = db.collection("settings").doc(storeId).onSnapshot(function (snap) {
      var prev = JSON.stringify(app.state.settings && app.state.settings.giftPromotion);
      app.state.settings = snap.exists ? snap.data() : null;
      var next = JSON.stringify(app.state.settings && app.state.settings.giftPromotion);
      updatePromoBanner(app);
      if (prev !== next && app.modules.cart && typeof app.modules.cart.renderCart === "function") {
        app.modules.cart.renderCart();
      }
    }, function (error) {
      console.warn("[FrontData] Settings real-time listener error.", error);
    });
  }

  function getBooleanValue() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (typeof arguments[i] === "boolean") return arguments[i];
    }
    return null;
  }

  function getArrayValue() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (Array.isArray(arguments[i]) && arguments[i].length) return arguments[i];
    }
    return [];
  }

  function getTodayDateValue(now) {
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function parseHourMinute(point) {
    if (!point) return { hour: null, minute: null };
    if (typeof point.hour === "number") return { hour: point.hour, minute: Number(point.minute || 0) };
    if (typeof point.time === "string") {
      var clean = point.time.replace(/[^0-9]/g, "");
      if (clean.length === 4) return { hour: Number(clean.slice(0, 2)), minute: Number(clean.slice(2, 4)) };
    }
    return { hour: null, minute: null };
  }

  function normalizePeriodPoint(point) {
    if (!point) return null;
    var hm = parseHourMinute(point);
    return {
      day: typeof point.day === "number" ? point.day : null,
      date: point.date || null,
      hour: hm.hour,
      minute: hm.minute
    };
  }

  function parseDateOnlyValue(value) {
    if (!value) return null;
    var parts = String(value).split("-");
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function buildDateFromPoint(point, fallbackDate) {
    if (!point || typeof point.hour !== "number") return null;
    var target = point.date ? parseDateOnlyValue(point.date) : new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
    if (!target || isNaN(target.getTime())) return null;
    target.setHours(point.hour, Number(point.minute || 0), 0, 0);
    return target;
  }

  function pointTouchesToday(point, todayValue, todayDay) {
    if (!point) return false;
    if (point.date) return point.date === todayValue;
    if (typeof point.day === "number") return point.day === todayDay;
    return false;
  }

  function formatTimeLabel(date) {
    if (!date || isNaN(date.getTime())) return "";
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function minutesUntil(fromDate, toDate) {
    if (!fromDate || !toDate) return null;
    return Math.round((toDate.getTime() - fromDate.getTime()) / 60000);
  }

  function summarizeTodayPeriods(periods, now) {
    var todayValue = getTodayDateValue(now);
    var todayDay = now.getDay();
    return (periods || []).map(function (period) {
      var open = normalizePeriodPoint(period && period.open);
      var close = normalizePeriodPoint(period && period.close);
      var touchesToday = pointTouchesToday(open, todayValue, todayDay) || pointTouchesToday(close, todayValue, todayDay);
      if (!touchesToday) return null;
      var openAt = buildDateFromPoint(open, now);
      var closeAt = buildDateFromPoint(close, now);
      return {
        openAt: openAt,
        closeAt: closeAt,
        openLabel: formatTimeLabel(openAt),
        closeLabel: formatTimeLabel(closeAt)
      };
    }).filter(Boolean).sort(function (left, right) {
      return (left.openAt ? left.openAt.getTime() : 0) - (right.openAt ? right.openAt.getTime() : 0);
    });
  }

  function deriveStoreStatusFromPlaces(data) {
    var now = new Date();
    var current = data && (data.currentOpeningHours || data.current_opening_hours) || null;
    var regular = data && (data.regularOpeningHours || data.regular_opening_hours || data.openingHours || data.opening_hours) || null;
    var specialDays = getArrayValue(
      current && (current.specialDays || current.special_days),
      regular && (regular.specialDays || regular.special_days),
      data && (data.specialDays || data.special_days)
    );
    var currentPeriods = getArrayValue(current && current.periods);
    var regularPeriods = getArrayValue(regular && regular.periods);
    var chosenPeriods = currentPeriods.length ? currentPeriods : regularPeriods;
    var openNow = getBooleanValue(
      current && current.openNow,
      current && current.open_now,
      regular && regular.openNow,
      regular && regular.open_now
    );
    var todayPeriods = summarizeTodayPeriods(chosenPeriods, now);
    var activePeriod = todayPeriods.find(function (period) {
      return period.openAt && period.closeAt && now >= period.openAt && now < period.closeAt;
    }) || null;
    var nextPeriod = todayPeriods.find(function (period) {
      return period.openAt && period.openAt > now;
    }) || null;
    var result = {
      status: "unknown",
      displayState: "unknown",
      subtitle: "目前沒有足夠資料，請稍後再試。",
      source: currentPeriods.length ? "currentOpeningHours.periods" : (regularPeriods.length ? "regularOpeningHours.periods" : (openNow !== null ? "openNow_only" : "none")),
      todayPeriods: todayPeriods.map(function (period) {
        return { open: period.openLabel || "", close: period.closeLabel || "" };
      })
    };

    if (openNow === true || activePeriod) {
      var closingMinutes = minutesUntil(now, activePeriod && activePeriod.closeAt);
      result.status = "open";
      result.displayState = closingMinutes !== null && closingMinutes >= 0 && closingMinutes <= 60 ? "closing_soon" : "open";
      result.subtitle = activePeriod && activePeriod.closeLabel ? "營業至 " + activePeriod.closeLabel : "可以正常點餐。";
      return result;
    }

    if (openNow === false) {
      if (!todayPeriods.length) {
        result.status = "closed";
        result.displayState = "closed";
        result.subtitle = specialDays.length ? "今天依 Google 特殊營業日設定為休息。" : "今天沒有營業時段。";
        return result;
      }
      if (nextPeriod && nextPeriod.openLabel) {
        var openingMinutes = minutesUntil(now, nextPeriod.openAt);
        result.status = "closed";
        result.displayState = openingMinutes !== null && openingMinutes >= 0 && openingMinutes <= 60 ? "opening_soon" : "before_open";
        result.subtitle = "將於 " + nextPeriod.openLabel + " 開始營業";
        return result;
      }
      result.status = "closed";
      result.displayState = "closed";
      result.subtitle = "今天沒有後續營業時段。";
      return result;
    }

    if (todayPeriods.length) {
      if (nextPeriod && nextPeriod.openLabel) {
        var nextOpeningMinutes = minutesUntil(now, nextPeriod.openAt);
        result.status = "closed";
        result.displayState = nextOpeningMinutes !== null && nextOpeningMinutes >= 0 && nextOpeningMinutes <= 60 ? "opening_soon" : "before_open";
        result.subtitle = "將於 " + nextPeriod.openLabel + " 開始營業";
        return result;
      }
      result.status = "closed";
      result.displayState = "closed";
      result.subtitle = "今天沒有後續營業時段。";
      return result;
    }

    return result;
  }

  function checkStoreOpenStatus(app) {
    app.state.storeStatusMeta = { displayState: "loading", subtitle: "正在確認營業狀態。" };
    updateStoreStatusUI(app, app.STATUS.LOADING);
    app.state.storeOpenStatus = app.STATUS.LOADING;
    var googleConfig = window.APP_CONFIG.googlePlaces;
    if (!googleConfig || !googleConfig.placeId || !googleConfig.apiKey) {
      app.state.storeStatusMeta = { displayState: "unknown", subtitle: "目前沒有足夠資料，請稍後再試。" };
      updateStoreStatusUI(app, app.STATUS.UNKNOWN);
      app.state.storeOpenStatus = app.STATUS.UNKNOWN;
      console.log("[StoreStatus] Google Places config missing, fallback to unknown.");
      syncControls(app);
      return Promise.resolve();
    }

    var placePath = googleConfig.placeId.indexOf("places/") === 0 ? googleConfig.placeId : "places/" + googleConfig.placeId;
    var fieldList = [
      "currentOpeningHours.openNow",
      "currentOpeningHours.periods",
      "currentOpeningHours.weekdayDescriptions",
      "currentOpeningHours.specialDays",
      "regularOpeningHours.openNow",
      "regularOpeningHours.periods",
      "regularOpeningHours.weekdayDescriptions",
      "regularOpeningHours.specialDays"
    ].join(",");
    var url = "https://places.googleapis.com/v1/" + placePath + "?fields=" + encodeURIComponent(fieldList) + "&key=" + encodeURIComponent(googleConfig.apiKey);
    console.log("[StoreStatus] Request URL.", url);
    return fetch(url, {
      method: "GET"
    }).then(function (response) {
      console.log("[StoreStatus] HTTP status.", response.status);
      if (!response.ok) {
        return response.text().then(function (body) {
          console.error("[StoreStatus] Google Places error response body.", body);
          throw new Error("Google Places request failed with status " + response.status + " / body=" + body);
        });
      }
      return response.json();
    }).then(function (data) {
      console.log("[StoreStatus] Raw response JSON.", data);
      var rawHours = {
        currentOpeningHours: data && (data.currentOpeningHours || data.current_opening_hours) || null,
        regularOpeningHours: data && (data.regularOpeningHours || data.regular_opening_hours || data.openingHours || data.opening_hours) || null,
        secondaryHours: data && (data.secondaryHours || data.secondary_hours) || null,
        specialDays: data && (data.specialDays || data.special_days) || null
      };
      console.log("[StoreStatus] Raw Google hours payload.", rawHours);
      console.log("[StoreStatus] Parsed currentOpeningHours.", rawHours.currentOpeningHours);
      console.log("[StoreStatus] Parsed regularOpeningHours.", rawHours.regularOpeningHours);
      var derived = deriveStoreStatusFromPlaces(data || {});
      console.log("[StoreStatus] Derived today periods.", derived.todayPeriods);
      app.state.storeOpenStatus = derived.status === "open" ? app.STATUS.OPEN : (derived.status === "closed" ? app.STATUS.CLOSED : app.STATUS.UNKNOWN);
      app.state.storeStatusMeta = derived;
      console.log("[StoreStatus] Derived decision source.", {
        source: derived.source,
        todayPeriods: derived.todayPeriods,
        finalStatus: app.state.storeOpenStatus,
        displayState: derived.displayState,
        subtitle: derived.subtitle
      });
      console.log("[StoreStatus] Final status.", {
        status: app.state.storeOpenStatus,
        displayState: derived.displayState,
        subtitle: derived.subtitle
      });
      updateStoreStatusUI(app, app.state.storeOpenStatus);
      if (app.state.storeOpenStatus === app.STATUS.CLOSED && derived.displayState === "closed") openStoreStatusModalOnce(app);
    }).catch(function (error) {
      console.error("[StoreStatus] Google Places check failed.", error);
      app.state.storeOpenStatus = app.STATUS.UNKNOWN;
      app.state.storeStatusMeta = { displayState: "unknown", subtitle: "目前沒有足夠資料，請稍後再試。" };
      updateStoreStatusUI(app, app.STATUS.UNKNOWN);
    }).finally(function () {
      syncControls(app);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function docs(snapshot) {
    return snapshot.docs.map(function (doc) {
      var data = doc.data();
      data.id = doc.id;
      return data;
    });
  }

  function normalizeMenuItemDoc(item) {
    return {
      id: item.id,
      name: item.name || "",
      price: Number(item.price || 0),
      unit: item.unit || "",            // unit 獨立欄位，與 requiresFlavor 完全無關
      categoryId: item.category || item.categoryId || "未分類",
      sort: Number(item.sortOrder != null ? item.sortOrder : (item.sort != null ? item.sort : 999)),
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      enabled: item.isActive === true || (item.isActive == null && item.enabled === true),
      isStaple: (function () {
        // Primary: explicit field on the item itself
        if (item.isStaple || item.staple || item.type === "staple") return true;
        // Fallback: category ID contains "staple" (e.g. the default "staples" category)
        var catId = (item.category || item.categoryId || "").toLowerCase();
        return catId === "staples" || catId === "staple" || catId.indexOf("staple") !== -1;
      })(),
      requiresFlavor: item.requiresFlavor === true,
      requiresStaple: item.requiresStaple === true,
      flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
      stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
      posHidden: item.posHidden === true || item.posVisible === false,
      posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
      posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : [],
      quickAdd: item.quickAdd === true
    };
  }

  function normalizeComboItemDoc(item) {
    return {
      id: item.id,
      name: item.name || "",
      price: Number(item.price || 0),
      sort: Number(item.sort != null ? item.sort : 999),
      description: item.description || "",
      enabled: item.enabled !== false,
      optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
      requiresFlavor: item.requiresFlavor === true,
      requiresStaple: item.requiresStaple === true,
      flavorOptions: Array.isArray(item.flavorOptions) ? item.flavorOptions : [],
      stapleOptions: Array.isArray(item.stapleOptions) ? item.stapleOptions : [],
      posHidden: item.posHidden === true || item.posVisible === false,
      posDisabledFlavorOptions: Array.isArray(item.posDisabledFlavorOptions) ? item.posDisabledFlavorOptions : [],
      posDisabledStapleOptions: Array.isArray(item.posDisabledStapleOptions) ? item.posDisabledStapleOptions : []
    };
  }

  function bindSingleSectionToggle(app) {
    if (!app.el.singleSectionToggle) return;
    app.el.singleSectionToggle.addEventListener("click", function () {
      if (app.state.singleSectionExpanded) return;
      app.state.singleSectionExpanded = true;
      renderSingleItems(app);
    });
  }

  function mergeMenuItems(primaryItems, fallbackItems) {
    var merged = {};
    fallbackItems.forEach(function (item) {
      merged[item.id] = item;
    });
    primaryItems.forEach(function (item) {
      merged[item.id] = item;
    });
    return Object.keys(merged).map(function (key) { return merged[key]; });
  }

  function bySort(left, right) {
    return Number(left.sort || 0) - Number(right.sort || 0);
  }

  window.LeLeShanUI = {
    init: init,
    bindModalDismiss: bindModalDismiss,
    handleDocumentKeydown: handleDocumentKeydown,
    setMessage: setMessage,
    updateStoreStatusUI: updateStoreStatusUI,
    setCustomerNamePlaceholder: setCustomerNamePlaceholder,
    renderProfile: renderProfile,
    openStoreStatusModalOnce: openStoreStatusModalOnce,
    closeStoreStatusModal: closeStoreStatusModal,
    openLoginRequiredModal: openLoginRequiredModal,
    closeLoginRequiredModal: closeLoginRequiredModal,
    openQuantityModal: openQuantityModal,
    openFlavorConfirmModal: openFlavorConfirmModal,
    showQuantityAddedSuccess: showQuantityAddedSuccess,
    showOrderSuccess: showOrderSuccess,
    closeQuantityModal: closeQuantityModal,
    closeFlavorConfirmModal: closeFlavorConfirmModal,
    scrollToCartList: scrollToCartList,
    syncControls: syncControls,
    updatePromoBanner: updatePromoBanner,
    renderFlavorOptions: renderFlavorOptions,
    renderComboItems: renderComboItems,
    renderComboUpsell: renderComboUpsell,
    renderSingleItems: renderSingleItems,
    renderPickupDateOptions: renderPickupDateOptions,
    renderPickupTimeOptions: renderPickupTimeOptions,
    renderAll: renderAll,
    loadStoreData: loadStoreData,
    checkStoreOpenStatus: checkStoreOpenStatus,
    categoryColorOptions: CATEGORY_COLOR_OPTIONS,
    resolveCategoryColor: resolveCategoryColor,
    resolveCategoryTheme: resolveCategoryTheme,
    showToast: showToast
  };
})();
