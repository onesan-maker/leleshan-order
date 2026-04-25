const HUB_URL = (import.meta.env.VITE_HUB_URL as string | undefined) ?? 'http://100.72.80.2:8080';
const HUB_TIMEOUT = 5000;

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

function todayDateStr(): string {
  const now = new Date();
  const local = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

async function hubFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HUB_TIMEOUT);
  try {
    const res = await fetch(`${HUB_URL}${path}`, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new HubUnavailableError('Hub request timed out after 5s');
    }
    throw new HubUnavailableError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }
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
    const d = date ?? todayDateStr();
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
