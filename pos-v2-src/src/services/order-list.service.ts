import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

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
