(function () {
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
    var el = app.el;
    el.profileName = document.getElementById("profile-name");
    el.profileMeta = document.getElementById("profile-meta");
    el.logoutBtn = document.getElementById("logout-btn");
    el.flavorOptions = document.getElementById("flavor-options");
    el.orderTypeOptions = document.getElementById("order-type-options");
    el.comboSection = document.getElementById("combo-section");
    el.singleSection = document.getElementById("single-section");
    el.comboRoot = document.getElementById("combo-root");
    el.singleRoot = document.getElementById("single-root");
    el.cartItems = document.getElementById("cart-items");
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
    el.quantityModalPrice = document.getElementById("quantity-modal-price");
    el.quantityModalDetail = document.getElementById("quantity-modal-detail");
    el.quantityModalType = document.getElementById("quantity-modal-type");
    el.quantityModalFlavorField = document.getElementById("quantity-modal-flavor-field");
    el.quantityModalFlavor = document.getElementById("quantity-modal-flavor");
    el.quantityModalStapleField = document.getElementById("quantity-modal-staple-field");
    el.quantityModalStaple = document.getElementById("quantity-modal-staple");
    el.quantityModalOptions = document.getElementById("quantity-modal-options");
    el.quantityModalSuccess = document.getElementById("quantity-modal-success");
    el.quantityModalSuccessText = document.getElementById("quantity-modal-success-text");
    el.quantityModalConfirm = document.getElementById("quantity-modal-confirm");
    el.viewCartBtnSticky = document.getElementById("view-cart-btn-sticky");
    el.cartListStart = document.getElementById("cart-list-start");
    el.pickupReservationNotice = document.getElementById("pickup-reservation-notice");
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
        app.el.storeStatusSubText.innerText = meta.subtitle || "今天沒有營業時段。";
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
      setCustomerNamePlaceholder(app, true);
    } else {
      app.el.profileName.textContent = "尚未登入";
      app.el.profileMeta.textContent = "送出訂單前會提示你登入 LINE。";
      app.el.logoutBtn.classList.add("hidden");
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
    if (app.el.storeStatusModalText) app.el.storeStatusModalText.textContent = "仍可先點餐，並預約營業時間取餐。";
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
    var flavorOptions = app.state.flavors.map(function (flavor) {
      return { id: flavor.id, name: flavor.name };
    });

    app.el.quantityModalDetail.classList.remove("hidden");

    if (app.el.quantityModalType) {
      app.el.quantityModalType.textContent = isCombo ? "套餐" : "";
      if (app.el.quantityModalType.parentElement) {
        app.el.quantityModalType.parentElement.classList.toggle("hidden", !isCombo);
      }
    }

    if (app.el.quantityModalFlavorField && app.el.quantityModalFlavor) {
      if (flavorOptions.length) {
        app.el.quantityModalFlavorField.classList.remove("hidden");
        fillSelectOptions(app.el.quantityModalFlavor, flavorOptions, payload.flavorId);
      } else {
        app.el.quantityModalFlavorField.classList.add("hidden");
        app.el.quantityModalFlavor.innerHTML = "";
      }
    }

    if (app.el.quantityModalStapleField && app.el.quantityModalStaple) {
      if (isCombo && payload.stapleOptions && payload.stapleOptions.length) {
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
      var flavor = app.state.flavors.find(function (item) {
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

  function openQuantityModal(app, payload) {
    if (!app.el.quantityModal || !payload) return;
    app.state.activeModal = "quantity-select";
    app.el.quantityModal.classList.remove("hidden");
    app.el.quantityModal.setAttribute("aria-hidden", "false");
    app.el.quantityModalItemName.textContent = payload.name || "請選擇品項";
    if (app.el.quantityModalPrice) {
      var basePrice = Number(payload.basePrice || 0);
      if (basePrice > 0) {
        app.el.quantityModalPrice.textContent = "NT$ " + basePrice + (payload.type === "combo" ? "（主食另計）" : "");
        app.el.quantityModalPrice.classList.remove("hidden");
      } else {
        app.el.quantityModalPrice.classList.add("hidden");
      }
    }
    app.el.quantityModalSuccess.classList.add("hidden");
    app.el.quantityModalOptions.classList.remove("hidden");
    renderQuantityModalDetail(app, payload);
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
    app.el.quantityModalOptions.innerHTML = [1, 2, 3, 4, 5].map(function (quantity) {
      return '<button type="button" class="quantity-modal__choice" data-quantity-choice="' + quantity + '">' + quantity + '</button>';
    }).join("");
    Array.prototype.slice.call(app.el.quantityModalOptions.querySelectorAll("[data-quantity-choice]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.modules.cart.applyPendingQuantity(Number(button.getAttribute("data-quantity-choice")));
      });
    });
  }

  function showQuantityAddedSuccess(app, selection, quantity) {
    if (!app.el.quantityModalSuccess || !app.el.quantityModalSuccessText || !app.el.quantityModalOptions) return;
    app.el.quantityModalOptions.classList.add("hidden");
    Array.prototype.slice.call(app.el.quantityModalOptions.querySelectorAll("[data-quantity-choice]")).forEach(function (button) {
      button.disabled = true;
    });
    app.el.quantityModalSuccess.classList.remove("hidden");
    if (app.el.quantityModalDetail) app.el.quantityModalDetail.classList.add("hidden");
    var label = selection && selection.type === "combo"
      ? '已加入「' + (selection.name || "") + '（套餐）」x' + quantity
      : '已加入「' + ((selection && selection.name) || "") + '」x' + quantity;
    app.el.quantityModalSuccessText.textContent = label;
    setTimeout(function () {
      if (app.state.activeModal === "quantity-select") closeQuantityModal(app);
    }, 1400);
  }

  function showOrderSuccess(app, pickupNumber, cartSnapshot, pickupLabel) {
    if (!app.el.submitMessage) return;
    var numDisplay = pickupNumber
      ? "取餐號碼 " + escapeHtml(String(pickupNumber))
      : "訂單已送出";
    var itemLines = (cartSnapshot || []).map(function (item) {
      var label = escapeHtml(item.name);
      if (item.flavorName) label += "（" + escapeHtml(item.flavorName) + "）";
      return label + " ×" + item.quantity;
    }).join("、");
    app.el.submitMessage.innerHTML =
      "<strong>✓ " + numDisplay + "</strong>" +
      (pickupLabel ? "<br>取餐時間：" + escapeHtml(pickupLabel) : "") +
      (itemLines ? "<br><small class='order-success-items'>" + itemLines + "</small>" : "");
    app.el.submitMessage.className = "submit-message success";
  }

  function closeQuantityModal(app) {
    if (!app.el.quantityModal) return;
    app.el.quantityModal.classList.add("hidden");
    app.el.quantityModal.setAttribute("aria-hidden", "true");
    if (app.state.activeModal === "quantity-select") app.state.activeModal = null;
    app.state.pendingCartSelection = null;
    app.el.quantityModalOptions.innerHTML = "";
    if (app.el.quantityModalDetail) app.el.quantityModalDetail.classList.add("hidden");
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
    if (app.state.appliedPromotion) text = "已符合優惠：" + app.state.appliedPromotion.name;
    else if (app.state.settings && app.state.settings.promoEnabled && app.state.settings.promoText) text = app.state.settings.promoText;
    if (!text) {
      app.el.promoBanner.classList.add("hidden");
      return;
    }
    app.el.promoBanner.classList.remove("hidden");
    app.el.promoBannerText.textContent = text;
  }

  function renderFlavorOptions(app) {
    if (!app.el.flavorOptions) return;
    app.el.flavorOptions.innerHTML = app.state.flavors.map(function (flavor) {
      var selectedClass = app.state.selectedFlavor === flavor.id ? " choice-card--selected" : "";
      return '<button class="choice-card' + selectedClass + '" type="button" data-flavor-id="' + flavor.id + '"><strong>' + escapeHtml(flavor.name) + '</strong><span>' + escapeHtml(flavor.description || "") + '</span><small>' + escapeHtml(flavor.spicyLabel || "") + "</small></button>";
    }).join("");

    Array.prototype.slice.call(app.el.flavorOptions.querySelectorAll("[data-flavor-id]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.state.selectedFlavor = button.getAttribute("data-flavor-id");
        renderFlavorOptions(app);
        renderOrderTypes(app);
        setMessage(app, "");
        if (app.el.orderTypeOptions) {
          requestAnimationFrame(function () {
            var target = app.el.orderTypeOptions.closest ? (app.el.orderTypeOptions.closest(".step-card") || app.el.orderTypeOptions) : app.el.orderTypeOptions;
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(function () { window.scrollBy({ top: -72, left: 0, behavior: "smooth" }); }, 200);
            }
          });
        }
      });
    });
  }

  function renderOrderTypes(app) {
    if (!app.el.orderTypeOptions) return;
    var types = [
      { id: "combo", name: "套餐", desc: "可選主食，適合一次搭配完成。" },
      { id: "single", name: "單點", desc: "自由加點喜歡的單品。" }
    ];
    app.el.orderTypeOptions.innerHTML = types.map(function (type) {
      var disabled = !app.state.selectedFlavor;
      var disabledClass = disabled ? " choice-card--disabled" : "";
      var selectedClass = app.state.selectedOrderType === type.id ? " choice-card--selected" : "";
      return '<button class="choice-card' + disabledClass + selectedClass + '" type="button" data-order-type="' + type.id + '" ' + (disabled ? "disabled" : "") + '><strong>' + type.name + '</strong><span>' + type.desc + '</span></button>';
    }).join("");

    Array.prototype.slice.call(app.el.orderTypeOptions.querySelectorAll("[data-order-type]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.state.selectedOrderType = button.getAttribute("data-order-type");
        if (app.el.comboSection) app.el.comboSection.classList.toggle("hidden", app.state.selectedOrderType !== "combo");
        if (app.el.singleSection) app.el.singleSection.classList.toggle("hidden", app.state.selectedOrderType !== "single");
        renderOrderTypes(app);
        syncControls(app);
      });
    });
  }

  function renderComboItems(app) {
    if (!app.el.comboRoot) return;
    app.el.comboRoot.innerHTML = app.state.comboItems.map(function (item) {
      var options = app.modules.cart.getComboOptions(item).map(function (option) {
        return '<option value="' + option.id + '">' + escapeHtml(option.name) + (option.price ? " +NT$" + option.price : "") + "</option>";
      }).join("");
      return '<article class="item-card item-card--combo"><div class="item-card__body"><h3>' + escapeHtml(item.name) + '</h3><p class="item-card__meta">' + escapeHtml(item.description || "") + '</p></div><div class="item-card__footer"><strong class="item-card__price">NT$ ' + Number(item.price || 0) + '</strong><label class="option-group"><span>主食</span><select id="staple-' + item.id + '">' + options + '</select></label><button class="secondary-btn secondary-btn--full" type="button" data-add-combo="' + item.id + '">加入套餐</button></div></article>';
    }).join("");

    Array.prototype.slice.call(app.el.comboRoot.querySelectorAll("[data-add-combo]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.modules.cart.requestAddCombo(button.getAttribute("data-add-combo"));
      });
    });
  }

  function renderSingleItems(app) {
    if (!app.el.singleRoot) return;
    app.el.singleRoot.innerHTML = app.state.singleCategories.map(function (category) {
      var theme = resolveCategoryTheme(category.colorTheme || category.bgColor || category.themeColor);
      return '<section class="category-card category-card--tinted" data-category-theme="' + escapeHtml(theme.value) + '" style="background:' + theme.bgColor + ";color:" + theme.textColor + '"><div class="category-card__head"><h3>' + escapeHtml(category.title) + '</h3><span class="option-pill">' + category.items.length + ' 項</span></div><div class="menu-tile-grid">' + category.items.map(function (item) {
        return '<article class="menu-tile"><div class="menu-tile__body"><strong>' + escapeHtml(item.name) + '</strong>' + (item.unit ? '<span>' + escapeHtml(item.unit) + '</span>' : '') + '</div><div class="menu-tile__footer"><strong>NT$ ' + Number(item.price || 0) + '</strong><button class="mini-btn menu-tile__add-btn" type="button" data-add-single="' + item.id + '" data-category-theme="' + escapeHtml(theme.value) + '" data-button-color="' + escapeHtml(theme.buttonColor) + '" data-button-text-color="' + escapeHtml(theme.buttonTextColor) + '">加入</button></div></article>';
      }).join("") + "</div></section>";
    }).join("");

    applyCategoryButtonThemes(app.el.singleRoot);
    Array.prototype.slice.call(app.el.singleRoot.querySelectorAll("[data-add-single]")).forEach(function (button) {
      button.addEventListener("click", function () {
        app.modules.cart.requestAddSingle(button.getAttribute("data-add-single"));
      });
    });
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
    renderOrderTypes(app);
    renderComboItems(app);
    renderSingleItems(app);
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
    var menuItemsLegacy = docs(snaps[3]).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    var menuItems = mergeMenuItems(menuItemsNew, menuItemsLegacy).sort(bySort);
    var combos = docs(snaps[4]).filter(function (item) { return item.enabled !== false; }).sort(bySort);
    app.state.promotions = docs(snaps[5]).filter(function (item) { return item.enabled !== false; });
    app.state.settings = snaps[6].exists ? snaps[6].data() : null;

    var usingFirestoreFlavors = flavors.length > 0;
    var usingFirestoreCombos = combos.length > 0;
    var usingFirestoreCategories = categories.length > 0 && menuItems.length > 0;

    if (usingFirestoreFlavors) app.state.flavors = flavors;
    if (usingFirestoreCombos) app.state.comboItems = combos;
    app.state.singleCategories = buildSingleCategories(
      usingFirestoreCategories ? categories : app.defaults.categories || [],
      usingFirestoreCategories ? menuItems : app.defaults.menuItems || []
    );

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
      categoryId: item.category || item.categoryId || "未分類",
      sort: Number(item.sortOrder != null ? item.sortOrder : (item.sort != null ? item.sort : 999)),
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      enabled: item.isActive === true || (item.isActive == null && item.enabled === true)
    };
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
    showQuantityAddedSuccess: showQuantityAddedSuccess,
    showOrderSuccess: showOrderSuccess,
    closeQuantityModal: closeQuantityModal,
    scrollToCartList: scrollToCartList,
    syncControls: syncControls,
    updatePromoBanner: updatePromoBanner,
    renderFlavorOptions: renderFlavorOptions,
    renderOrderTypes: renderOrderTypes,
    renderComboItems: renderComboItems,
    renderSingleItems: renderSingleItems,
    renderPickupDateOptions: renderPickupDateOptions,
    renderPickupTimeOptions: renderPickupTimeOptions,
    renderAll: renderAll,
    loadStoreData: loadStoreData,
    checkStoreOpenStatus: checkStoreOpenStatus,
    categoryColorOptions: CATEGORY_COLOR_OPTIONS,
    resolveCategoryColor: resolveCategoryColor,
    resolveCategoryTheme: resolveCategoryTheme
  };
})();






