import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PosSession } from "@/lib/session";

// Doc path aligns with vanilla ops-session-sync.js: DOC_PREFIX = "current_session_"
function sessionDocRef(storeId: string) {
  return doc(db, "store_runtime", `current_session_${storeId}`);
}

export async function publishOpsSession(
  session: PosSession,
  action: "login" | "switch" | "refresh" = "login"
) {
  const payload: Record<string, unknown> = {
    storeId: session.storeId,
    employeeId: session.employeeId,
    employeeName: session.employeeName,
    role: "staff",
    sessionActive: true,
    updatedAt: serverTimestamp(),
    source: "pos",
    lastAction: action,
  };
  if (action === "login" || action === "switch") {
    payload.startedAt = serverTimestamp();
  }
  await setDoc(sessionDocRef(session.storeId), payload, { merge: true });
}

export async function clearOpsSession(storeId: string) {
  await setDoc(sessionDocRef(storeId), {
    storeId,
    sessionActive: false,
    employeeId: "",
    employeeName: "",
    role: "",
    updatedAt: serverTimestamp(),
    source: "pos",
    lastAction: "logout",
  }, { merge: true });
}
