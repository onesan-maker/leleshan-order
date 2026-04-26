import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { hubClient } from "@/lib/hub-client";

export interface TodayOrder {
  id: string;
  pickupNumber?: number;
  customer_name?: string;
  display_name?: string;
  status?: string;
  source?: string;
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  createdAt?: unknown;
  items?: unknown[];
  note?: string;
  cancel_reason?: string;
  refunded_amount?: number;
}

interface ListInput {
  employeeId: string;
  sessionToken: string;
  limit?: number;
}

interface ListResult {
  orders?: TodayOrder[];
}

export async function listTodayOrders(input: ListInput): Promise<TodayOrder[]> {
  const fn = httpsCallable<ListInput, ListResult>(functions, "listPosTodayOrders");
  const res = await fn({ ...input, limit: input.limit ?? 200 });
  const data = res.data || {};
  return Array.isArray(data.orders) ? data.orders : [];
}

/**
 * 直接從 Hub 取今日訂單（含 cancelled + fully_refunded，POS 今日訂單頁使用）。
 * 不依賴 Firebase Functions — 離線時仍可讀取本機 Hub 資料。
 */
export async function listTodayOrdersFromHub(storeId: string): Promise<TodayOrder[]> {
  const orders = await hubClient.getTodayOrders(storeId, { includeAll: true });
  return orders as TodayOrder[];
}
