(function () {
  // 允許的 admins 角色清單（owner / admin 視同 staff 可進 KDS / POS）
  var ALLOWED_ADMIN_ROLES = ["owner", "admin", "super_admin", "store_admin", "staff"];

  function init(options) {
    if (!firebase.apps.length) firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    var auth = firebase.auth();
    var db   = firebase.firestore();
    var redirectTo = (options && options.redirectTo) || "/admin/login";
    var loadingEl  = options && options.loadingEl;
    var errorEl    = options && options.errorEl;

    auth.onAuthStateChanged(async function (user) {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }

      try {
        // ── 1. 先查 admins collection ──────────────────────────
        var adminSnap = await db.collection("admins").doc(user.uid).get();
        if (adminSnap.exists) {
          var adminData = adminSnap.data() || {};
          if (ALLOWED_ADMIN_ROLES.indexOf(adminData.role) < 0) {
            throw new Error("admins 帳號角色（" + adminData.role + "）沒有操作權限");
          }
          console.log("[StaffAuth] Verified via admins.", {
            uid: user.uid, role: adminData.role, storeId: adminData.storeId || ""
          });
          return onVerified({ auth, db, user, admin: adminData });
        }

        // ── 2. 查 staffs collection ────────────────────────────
        var staffSnap = await db.collection("staffs").doc(user.uid).get();
        if (staffSnap.exists) {
          var staffData = staffSnap.data() || {};
          if (staffData.isActive === false) {
            throw new Error("此員工帳號已停用，請聯絡管理員");
          }
          // 把 staffs 資料包裝成與 admins 格式一致的物件
          var staffAsAdmin = {
            role:    staffData.role || "staff",
            storeId: staffData.storeId || "",
            name:    staffData.name || staffData.displayName || "",
            email:   staffData.email || user.email || ""
          };
          console.log("[StaffAuth] Verified via staffs.", {
            uid: user.uid, role: staffAsAdmin.role, storeId: staffAsAdmin.storeId
          });
          return onVerified({ auth, db, user, admin: staffAsAdmin });
        }

        // ── 3. 兩個 collection 都找不到 ───────────────────────
        console.warn("[StaffAuth] UID not found in admins or staffs.", { uid: user.uid });
        await auth.signOut();
        window.location.href = redirectTo;

      } catch (error) {
        console.error("[StaffAuth] Access denied.", error);
        if (errorEl) {
          errorEl.textContent = error.message || "登入驗證失敗";
          errorEl.classList.remove("hidden");
        }
        if (loadingEl) loadingEl.classList.add("hidden");
      }

      function onVerified(context) {
        if (loadingEl) loadingEl.classList.add("hidden");
        if (errorEl)   errorEl.textContent = "";
        if (options && typeof options.onReady === "function") {
          options.onReady({
            auth:    context.auth,
            db:      context.db,
            user:    context.user,
            admin:   context.admin,
            storeId: resolveStoreId(context.admin)
          });
        }
      }
    });
  }

  function resolveStoreId(admin) {
    var queryStoreId = new URLSearchParams(window.location.search).get("storeId");
    if (admin && admin.role === "super_admin" && queryStoreId) return queryStoreId;
    return (admin && admin.storeId) ||
           (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) ||
           "store_1";
  }

  window.LeLeShanStaffAuth = { init: init };
})();
