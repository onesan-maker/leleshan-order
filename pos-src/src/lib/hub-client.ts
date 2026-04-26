/* ════════════════════════════════════════════════════════════════
   hub-client.ts — W11-B 雙 IP Hub 連線用戶端（TypeScript / POS）

   主 URL：VITE_HUB_URL env var，預設 http://100.72.80.2:8080  （Tailscale）
   備 URL：http://192.168.1.50:8080                              （店內區網）

   策略：先試 preferred URL（初始為主），5 s timeout 後 fallback 到備。
   切換後 sticky，30 s 後才再試主。兩個都失敗才拋 HubUnavailableError。
   ════════════════════════════════════════════════════════════════ */

const HUB_URLS: [string, ...string[]] = [
  (import.meta.env.VITE_HUB_URL as string | undefined) ?? 'http://100.72.80.2:8080',
  'http://192.168.1.50:8080',
];
const HUB_TIMEOUT        = 5000;   /* ms — per-URL timeout */
const PRIMARY_RECHECK_MS = 30_000; /* ms — re-attempt primary after 30 s */

let preferredIdx     = 0;
let lastPrimaryCheck = 0;

/* ── Error types ────────────────────────────────────────────── */
export class HubUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HubUnavailableError';
  }
}

export class HubValidationError extends Error {
  readonly details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'HubValidationError';
    this.details = details;
  }
}

export class HubServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HubServerError';
  }
}

/* ── Shared types ───────────────────────────────────────────── */
export interface PickupNumber {
  pickupNumber: string;
  pickupSequence: number;
  businessDate: string;
}

export interface OrderCreateResult {
  id: string;
  clientRef: string;
  status: string;
  createdAt: string;
  duplicate?: boolean;
  message?: string;
}

export interface Actor {
  actorId?: string;
  actorName?: string;
}

export interface StatusUpdate {
  id: string;
  status: string;
  fromStatus: string;
  updatedAt: string;
}

export interface HubOrder {
  id: string;
  [key: string]: unknown;
}

/* ── Internal helpers ───────────────────────────────────────── */
function todayDateStr(): string {
  const now   = new Date();
  const local = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
  const pad   = (n: number) => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** 嘗試單一 URL；timeout 或網路錯誤均 reject。 */
async function tryUrl(baseUrl: string, path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HUB_TIMEOUT);
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/** 主要 fetch wrapper：雙 URL fallback + sticky preferred。 */
async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  let startIdx = preferredIdx;

  /* 30 s 後嘗試回主 URL（若目前在備） */
  if (preferredIdx !== 0 && now - lastPrimaryCheck >= PRIMARY_RECHECK_MS) {
    startIdx        = 0;
    lastPrimaryCheck = now;
  }

  /* 嘗試順序：startIdx 優先，其餘依序附後 */
  const tryOrder: number[] = [startIdx];
  for (let i = 0; i < HUB_URLS.length; i++) {
    if (i !== startIdx) tryOrder.push(i);
  }

  let lastErr: unknown;
  for (const idx of tryOrder) {
    try {
      const res = await tryUrl(HUB_URLS[idx], path, init);
      if (preferredIdx !== idx) {
        console.log('[hubClient] switched to', HUB_URLS[idx]);
        preferredIdx = idx;
      }
      return res;
    } catch (e) {
      lastErr = e;
      console.warn('[hubClient]', HUB_URLS[idx] + path, 'failed:', e instanceof Error ? e.message : e);
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new HubUnavailableError(`All Hub URLs unavailable. Last: ${msg}`);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let body: { error?: string } | null = null;
  try {
    body = (await res.json()) as { error?: string };
  } catch {
    // non-JSON error body
  }
  if (res.status >= 400 && res.status < 500) {
    throw new HubValidationError(body?.error ?? `HTTP ${res.status}`, body);
  }
  throw new HubServerError(`Hub server error: HTTP ${res.status}`);
}

/* ── Public URL helpers ─────────────────────────────────────── */
export function getCurrentHubUrl(): string {
  return HUB_URLS[preferredIdx];
}
export function getAllHubUrls(): readonly string[] {
  return HUB_URLS;
}

/* ── hubClient object ───────────────────────────────────────── */
export const hubClient = {
  async isHealthy(): Promise<boolean> {
    try {
      const res = await hubFetch('/health');
      return res.ok;
    } catch {
      return false;
    }
  },

  async getPickupNumber(storeId: string): Promise<PickupNumber> {
    const res = await hubFetch('/pickup-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });
    return parseResponse<PickupNumber>(res);
  },

  async createOrder(payload: Record<string, unknown>): Promise<OrderCreateResult> {
    const res = await hubFetch('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse<OrderCreateResult>(res);
  },

  async getTodayOrders(storeId: string, date?: string): Promise<HubOrder[]> {
    const d   = date ?? todayDateStr();
    const res = await hubFetch(`/orders?date=${d}&storeId=${encodeURIComponent(storeId)}`);
    const data = await parseResponse<{ orders: HubOrder[] }>(res);
    return data.orders;
  },

  async updateStatus(orderId: string, status: string, actor?: Actor): Promise<StatusUpdate> {
    const res = await hubFetch(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...actor }),
    });
    return parseResponse<StatusUpdate>(res);
  },
};
