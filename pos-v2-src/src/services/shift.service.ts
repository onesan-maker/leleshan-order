import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PosSession } from "@/lib/session";

interface LoginPayload {
  sessionToken: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  loginAt?: string;
  expiresAt?: string;
}

export async function switchEmployee(
  currentSession: PosSession,
  empId: string,
  pin: string,
): Promise<PosSession> {
  const loginFn = httpsCallable<unknown, LoginPayload>(functions, "posEmployeeLogin");
  const result = await loginFn({ employeeId: empId, pin, sessionHours: 16 });
  const payload = result.data;
  if (!payload?.sessionToken) throw new Error("SWITCH_FAILED");

  // best-effort invalidate old session
  try {
    const logoutFn = httpsCallable(functions, "logoutPosSession");
    await logoutFn({ sessionToken: currentSession.sessionToken });
  } catch (e) {
    console.warn("[POS v2] old session logout on switch failed:", e);
  }

  return {
    employeeId: String(payload.employeeId || empId),
    employeeName: payload.employeeName || "",
    storeId: payload.storeId || currentSession.storeId,
    sessionToken: payload.sessionToken,
    loginAt: payload.loginAt || new Date().toISOString(),
    expiresAt: payload.expiresAt,
  };
}
