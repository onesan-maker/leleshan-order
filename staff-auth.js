(function () {
  function init(options) {
    if (!firebase.apps.length) firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    var auth = firebase.auth();
    var db = firebase.firestore();
    var redirectTo = options && options.redirectTo || "/admin/login";
    var loadingEl = options && options.loadingEl;
    var errorEl = options && options.errorEl;

    auth.onAuthStateChanged(async function (user) {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }

      try {
        var adminSnap = await db.collection("admins").doc(user.uid).get();
        if (!adminSnap.exists) {
          await auth.signOut();
          window.location.href = redirectTo;
          return;
        }

        var admin = adminSnap.data() || {};
        if (["super_admin", "store_admin", "staff"].indexOf(admin.role) < 0) {
          throw new Error("目前帳號沒有操作權限");
        }

        if (loadingEl) loadingEl.classList.add("hidden");
        if (errorEl) errorEl.textContent = "";
        console.log("[StaffAuth] Staff verified.", {
          uid: user.uid,
          role: admin.role,
          storeId: admin.storeId || ""
        });
        if (options && typeof options.onReady === "function") {
          options.onReady({
            auth: auth,
            db: db,
            user: user,
            admin: admin,
            storeId: resolveStoreId(admin)
          });
        }
      } catch (error) {
        console.error("[StaffAuth] Access denied.", error);
        if (errorEl) errorEl.textContent = error.message || "登入驗證失敗";
      }
    });
  }

  function resolveStoreId(admin) {
    var queryStoreId = new URLSearchParams(window.location.search).get("storeId");
    if (admin && admin.role === "super_admin" && queryStoreId) return queryStoreId;
    return admin && admin.storeId || (window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1";
  }

  window.LeLeShanStaffAuth = {
    init: init
  };
})();
