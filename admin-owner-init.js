import { auth, db } from "./firebase-client.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

var OWNER_INIT_EMAIL = "onesan@gmail.com";
var OWNER_INIT_NAME = "Jack";

function canInitializeOwner(user) {
  return !!(user && user.email && user.email.toLowerCase() === OWNER_INIT_EMAIL);
}

function showStatus(text) {
  if (typeof window.showOwnerInitStatus === "function") {
    window.showOwnerInitStatus(text);
  }
}

window.initOwner = async function () {
  console.log("[OwnerInit] initOwner triggered");

  try {
    const user = auth.currentUser;

    if (!user) {
      console.error("[OwnerInit] 尚未登入，無法初始化 owner");
      showStatus("建立 owner 失敗：尚未登入");
      return false;
    }

    console.log("[OwnerInit] 目前登入 email", user.email || "");
    console.log("[OwnerInit] 目前 uid", user.uid);

    var allowed = canInitializeOwner(user);
    console.log("[OwnerInit] 是否符合 onesan@gmail.com 白名單", allowed);
    if (!allowed) {
      showStatus("建立 owner 失敗：目前登入帳號不符合初始化條件");
      return false;
    }

    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);
    console.log("[OwnerInit] admins/{uid} 是否已存在", adminSnap.exists());

    if (adminSnap.exists()) {
      console.log("[OwnerInit] owner 已存在");
      showStatus("建立 owner 失敗：admins 文件已存在");
      return false;
    }

    console.log("[OwnerInit] Firestore write 開始");
    // 此為初始化用途，完成第一位 owner 建立後可移除。
    await setDoc(doc(db, "admins", user.uid), {
      role: "owner",
      name: OWNER_INIT_NAME,
      createdAt: serverTimestamp()
    });
    console.log("[OwnerInit] Firestore write 成功");
    showStatus("owner 建立成功，請重新登入或重新整理頁面");
    return true;
  } catch (error) {
    console.error("[OwnerInit] Firestore write 失敗", {
      code: error && error.code ? error.code : "",
      message: error && error.message ? error.message : error
    });

    if (error && error.code === "permission-denied") {
      showStatus("建立 owner 失敗：沒有寫入權限");
    } else {
      showStatus("建立 owner 失敗：" + ((error && error.message) || "請稍後再試"));
    }
    return false;
  }
};

window.AdminOwnerInit = {
  canInitializeOwner: canInitializeOwner
};
