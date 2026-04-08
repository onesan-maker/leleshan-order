import { auth, db } from "./firebase-client.js";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

var button = document.getElementById("admin-google-login-btn");
var retryButton = document.getElementById("admin-relogin-btn");
var loginCard = document.getElementById("admin-login-card");
var deniedCard = document.getElementById("admin-denied-card");
var deniedMessage = document.getElementById("admin-denied-message");
var message = document.getElementById("admin-login-message");

onAuthStateChanged(auth, async function (user) {
  if (!user) {
    showLoginCard();
    return;
  }

  console.log("[AdminLogin] Google 登入成功", {
    email: user.email || "",
    displayName: user.displayName || ""
  });
  console.log("[AdminLogin] 目前 uid", user.uid);
  message.textContent = "登入成功，正在驗證後台權限...";

  try {
    var access = await fetchAdminAccess(user.uid);
    console.log("[AdminLogin] admins/{uid} 是否存在", access.exists);
    console.log("[AdminLogin] role 值", access.role || "(empty)");
    console.log("[AdminLogin] 權限驗證結果", access.allowed ? "allowed" : "denied");

    if (access.allowed) {
      message.textContent = "權限驗證通過，正在進入後台...";
      window.location.href = "/admin/dashboard";
      return;
    }

    if (access.exists) {
      console.warn("[AdminLogin] 管理文件已存在，但角色設定不合法", {
        uid: user.uid,
        role: access.role || "(empty)"
      });
      await safeSignOut();
      showDeniedCard("帳號角色設定不正確", "此帳號已有管理文件，但 role 不合法，請在 Firestore 將 role 改為 owner 或 admin");
      return;
    }

    await safeSignOut();
    showDeniedCard("此帳號沒有後台權限", "此 Google 帳號尚未被加入管理名單");
  } catch (error) {
    console.error("[AdminLogin] 權限驗證失敗", error);
    console.log("[AdminLogin] 權限驗證結果", "denied");
    await safeSignOut();
    showDeniedCard("權限驗證失敗，請稍後再試", "如果問題持續發生，請稍後重新登入");
  }
});

button.addEventListener("click", startGoogleLogin);
retryButton.addEventListener("click", async function () {
  showLoginCard();
  await startGoogleLogin();
});

async function startGoogleLogin() {
  message.textContent = "正在開啟 Google 登入...";

  try {
    var provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("[AdminLogin] Google login failed.", error);
    message.textContent = "Google 登入失敗，請稍後再試";
  }
}

async function safeSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("[AdminLogin] signOut failed.", error);
  }
}

async function fetchAdminAccess(uid) {
  var adminSnap = await getDoc(doc(db, "admins", uid));
  var adminData = adminSnap.exists() ? adminSnap.data() : null;
  var role = adminData && typeof adminData.role === "string"
    ? adminData.role.trim().toLowerCase()
    : "";

  return {
    exists: adminSnap.exists(),
    role: role,
    data: adminData,
    allowed: adminSnap.exists() && (role === "owner" || role === "admin")
  };
}

function showLoginCard() {
  loginCard.classList.remove("hidden");
  deniedCard.classList.add("hidden");
  message.textContent = "";
}

function showDeniedCard(title, description) {
  loginCard.classList.add("hidden");
  deniedCard.classList.remove("hidden");
  deniedMessage.innerHTML =
    '<strong class="admin-access-card__title">' + escapeHtml(title) + '</strong>' +
    '<p class="admin-access-card__text">' + escapeHtml(description) + "</p>";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// owner 初始化入口已停用；如之後需要恢復，可重新掛回 admin-owner-init.js
window.initOwner = undefined;
