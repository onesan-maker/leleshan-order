(function () {
  var ALLOWED_ADMIN_ROLES = ["owner", "admin"];

  function normalizeRole(role) {
    return typeof role === "string" ? role.trim().toLowerCase() : "";
  }

  function isAllowedRole(role) {
    return ALLOWED_ADMIN_ROLES.indexOf(normalizeRole(role)) !== -1;
  }

  async function fetchAdminAccess(db, uid) {
    var adminRef = db.collection("admins").doc(uid);
    var adminSnap = await adminRef.get();
    var adminData = adminSnap.exists ? adminSnap.data() : null;
    var role = adminData && adminData.role ? normalizeRole(adminData.role) : "";

    return {
      exists: adminSnap.exists,
      role: role,
      data: adminData,
      allowed: adminSnap.exists && isAllowedRole(role)
    };
  }

  // Firestore 需手動建立第一位管理者文件：
  // 路徑：admins/{uid}
  // 範例：
  // {
  //   "role": "owner",
  //   "name": "Jack"
  // }
  window.AdminAuthHelper = {
    ALLOWED_ADMIN_ROLES: ALLOWED_ADMIN_ROLES,
    normalizeRole: normalizeRole,
    isAllowedRole: isAllowedRole,
    fetchAdminAccess: fetchAdminAccess
  };
})();
