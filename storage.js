(function () {
  var KEYS = {
    pendingCheckoutCart: "pendingCheckoutCart",
    pendingCheckoutForm: "pendingCheckoutForm",
    pendingCheckoutReturnTo: "pendingCheckoutReturnTo",
    pendingCheckoutTimestamp: "pendingCheckoutTimestamp",
    checkoutCartDraft: "checkoutCartDraft",
    checkoutFormDraft: "checkoutFormDraft"
  };
  var PENDING_MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function readJSON(key) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("[Storage] Failed to parse JSON from sessionStorage.", { key: key, error: error });
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("[Storage] Failed to write JSON to sessionStorage.", { key: key, error: error });
    }
  }

  function writeString(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.error("[Storage] Failed to write string to sessionStorage.", { key: key, error: error });
    }
  }

  function remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error("[Storage] Failed to remove sessionStorage key.", { key: key, error: error });
    }
  }

  function cloneJSON(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      console.error("[Storage] Failed to clone JSON-safe value.", error);
      return Array.isArray(value) ? [] : {};
    }
  }

  function savePendingCheckoutState(payload) {
    writeJSON(KEYS.pendingCheckoutCart, cloneJSON(payload.cart || []));
    writeJSON(KEYS.pendingCheckoutForm, cloneJSON(payload.form || {}));
    writeJSON(KEYS.pendingCheckoutReturnTo, cloneJSON(payload.returnTo || {}));
    writeString(KEYS.pendingCheckoutTimestamp, String(payload.timestamp || Date.now()));
  }

  function loadPendingCheckoutState() {
    return {
      cart: readJSON(KEYS.pendingCheckoutCart),
      form: readJSON(KEYS.pendingCheckoutForm),
      returnTo: readJSON(KEYS.pendingCheckoutReturnTo),
      timestamp: Number(sessionStorage.getItem(KEYS.pendingCheckoutTimestamp) || 0)
    };
  }

  function clearPendingCheckoutState() {
    remove(KEYS.pendingCheckoutCart);
    remove(KEYS.pendingCheckoutForm);
    remove(KEYS.pendingCheckoutReturnTo);
    remove(KEYS.pendingCheckoutTimestamp);
  }

  function isPendingCheckoutExpired(timestamp) {
    if (!timestamp) return false;
    return Date.now() - Number(timestamp) > PENDING_MAX_AGE_MS;
  }

  function saveCheckoutDraft(payload) {
    writeJSON(KEYS.checkoutCartDraft, cloneJSON(payload.cart || []));
    writeJSON(KEYS.checkoutFormDraft, cloneJSON(payload.form || {}));
  }

  function loadCheckoutDraft() {
    return {
      cart: readJSON(KEYS.checkoutCartDraft),
      form: readJSON(KEYS.checkoutFormDraft)
    };
  }

  function clearCheckoutDraft() {
    remove(KEYS.checkoutCartDraft);
    remove(KEYS.checkoutFormDraft);
  }

  window.LeLeShanStorage = {
    keys: KEYS,
    pendingMaxAgeMs: PENDING_MAX_AGE_MS,
    readJSON: readJSON,
    writeJSON: writeJSON,
    writeString: writeString,
    remove: remove,
    cloneJSON: cloneJSON,
    savePendingCheckoutState: savePendingCheckoutState,
    loadPendingCheckoutState: loadPendingCheckoutState,
    clearPendingCheckoutState: clearPendingCheckoutState,
    isPendingCheckoutExpired: isPendingCheckoutExpired,
    saveCheckoutDraft: saveCheckoutDraft,
    loadCheckoutDraft: loadCheckoutDraft,
    clearCheckoutDraft: clearCheckoutDraft
  };
})();
