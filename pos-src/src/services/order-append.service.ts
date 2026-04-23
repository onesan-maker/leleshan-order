/**
 * 追加品項到現有訂單。
 *
 * 根因說明：Firestore rules 的 `orders` allow update 要求 Firebase Auth
 * (canReadOrders → sameStore → request.auth != null)，但 POS 不使用 Firebase Auth。
 * 直接呼叫 db.runTransaction 會被 rules 拒絕 (PERMISSION_DENIED)。
 *
 * 修正做法：改透過 posAppendToOrder Cloud Function 執行，
 * 由 admin SDK 繞過 rules，並以 sessionToken 驗證員工身分。
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PosSession } from "@/lib/session";
import type { CartLine } from "@/stores/cart.store";
import type { AppendTarget } from "@/stores/cart.store";

export interface AppendResult {
  wasReady: boolean;
}

interface AppendPayload {
  employeeId: string;
  sessionToken: string;
  orderId: string;
  items: {
    itemId: string;
    name: string;
    qty: number;
    unit_price: number;
    price: number;
    subtotal: number;
    type: string;
    groupId: string;
    groupLabel: string;
    flavor: string;
    staple: string;
  }[];
}

interface AppendResponse {
  ok: boolean;
  wasReady: boolean;
  prevStatus: string;
  appendTotal: number;
  itemCount: number;
}

export async function appendToOrder(
  session: PosSession,
  order: AppendTarget,
  lines: CartLine[],
): Promise<AppendResult> {
  if (!lines.length) throw new Error("請先選取要追加的品項");

  const items = lines.map((l) => ({
    itemId: l.itemId,
    name: l.name,
    qty: l.qty,
    unit_price: l.unitPrice,
    price: l.unitPrice,
    subtotal: l.unitPrice * l.qty,
    type: l.posType || l.type || "addon",
    groupId: l.groupId,
    groupLabel: l.groupLabel,
    flavor: l.flavor || "",
    staple: l.staple || "",
  }));

  const fn = httpsCallable<AppendPayload, AppendResponse>(functions, "posAppendToOrder");
  const result = await fn({
    employeeId: session.employeeId,
    sessionToken: session.sessionToken,
    orderId: order.id,
    items,
  });

  return { wasReady: result.data.wasReady };
}
