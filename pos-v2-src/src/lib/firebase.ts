import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

function getConfig() {
  if (!window.APP_CONFIG) {
    throw new Error("APP_CONFIG 尚未載入，請確認 /config.public.js 已載入");
  }
  return window.APP_CONFIG;
}

const config = getConfig();
const app = getApps().length ? getApps()[0] : initializeApp(config.firebaseConfig);

export const db = getFirestore(app);
export const functions = getFunctions(app, config.functionsRegion);
export const auth = getAuth(app);
export const appConfig = config;

// Fix-2: patch the compat shim so vanilla order-helpers.js can call
// firebase.firestore.FieldValue.serverTimestamp() via window.__posv2_sts
import { serverTimestamp } from "firebase/firestore";
(window as unknown as { __posv2_sts: typeof serverTimestamp }).__posv2_sts = serverTimestamp;
