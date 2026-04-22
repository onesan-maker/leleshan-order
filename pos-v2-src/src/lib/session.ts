/**
 * POS v2 員工 session 讀取器
 *
 * Session 契約之權威來源為 vanilla `pos-session.js`
 *   - Key: leleshan_pos_employee_session_v1
 *   - Fields: employeeId / employeeName / storeId / sessionToken / loginAt (/ expiresAt?)
 *   - 過期判斷: expiresAt > now，若無 expiresAt 則 loginAt + 16h > now
 *
 * 本檔在 W2–W4 期間與 pos-session.js 行為必須 byte-for-byte 對齊
 * （vanilla 端已由 AGENTS.md 規則凍結，不會漂移）。
 *
 * 若未來 v2 取代 vanilla，本檔將升級為 writer（目前只讀）。
 */

export interface PosSession {
  employeeId: string;
  employeeName: string;
  storeId: string;
  sessionToken: string;
  loginAt: string | number;        // ISO string 或 timestamp，vanilla 用 new Date() 解析兩者皆可
  expiresAt?: string | number;     // optional；未提供時走 16h fallback
}

const SESSION_KEY = "leleshan_pos_employee_session_v1";
const DEFAULT_MAX_AGE_MS = 16 * 60 * 60 * 1000;  // 對齊 pos-session.js 的 DEFAULT_MAX_AGE_MS

function parseTime(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isValidShape(s: unknown): s is PosSession {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.employeeId   === "string" && o.employeeId.length   > 0 &&
    typeof o.employeeName === "string" && o.employeeName.length > 0 &&
    typeof o.storeId      === "string" && o.storeId.length      > 0 &&
    typeof o.sessionToken === "string" && o.sessionToken.length > 0 &&
    (typeof o.loginAt === "string" || typeof o.loginAt === "number")
  );
}

function isStillAlive(s: PosSession): boolean {
  const now = Date.now();
  const explicit = parseTime(s.expiresAt ?? null);
  if (explicit !== null) return explicit > now;
  const login = parseTime(s.loginAt);
  if (login === null) return false;
  return login + DEFAULT_MAX_AGE_MS > now;
}

export function readSession(): PosSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidShape(parsed)) return null;
    if (!isStillAlive(parsed))  return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function redirectToLogin(): void {
  window.location.assign("/pos-login.html");
}
