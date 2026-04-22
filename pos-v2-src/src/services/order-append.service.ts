import {
  doc, collection, runTransaction, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PosSession } from "@/lib/session";
import type { CartLine } from "@/stores/cart.store";
import type { AppendTarget } from "@/stores/cart.store";

export interface AppendResult {
  wasReady: boolean;
}

export async function appendToOrder(
  session: PosSession,
  order: AppendTarget,
  lines: CartLine[],
): Promise<AppendResult> {
  if (!lines.length) throw new Error("請先選取要追加的品項");

  const appendItems = lines.map((l) => ({
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

  const appendTotal = appendItems.reduce((s, i) => s + i.subtotal, 0);
  const orderRef = doc(db, "orders", order.id);
  const ts = serverTimestamp();
  let wasReady = false;
  let prevStatus = "";

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error("訂單不存在");
    const data = snap.data();
    prevStatus = (data.status as string) || "new";
    wasReady = prevStatus === "ready";

    const currentItems = Array.isArray(data.items) ? data.items : [];
    const updateData: Record<string, unknown> = {
      items: [...currentItems, ...appendItems],
      subtotal: ((data.subtotal as number) || 0) + appendTotal,
      total: ((data.total as number) || (data.totalAmount as number) || (data.subtotal as number) || 0) + appendTotal,
      itemCount: ((data.itemCount as number) || 0) + appendItems.length,
      updatedAt: ts,
    };
    if (wasReady) updateData.status = "preparing";
    tx.update(orderRef, updateData);

    const eventRef = doc(collection(db, "order_events"));
    tx.set(eventRef, {
      orderId: order.id,
      storeId: session.storeId,
      type: "order_appended",
      actorType: "staff",
      actorId: session.employeeId,
      actorName: session.employeeName || "",
      fromStatus: prevStatus,
      toStatus: wasReady ? "preparing" : prevStatus,
      appendedItems: appendItems.map((i) => ({ name: i.name, qty: i.qty, subtotal: i.subtotal })),
      amountDelta: appendTotal,
      appendedAt: ts,
      createdAt: ts,
    });

    if (wasReady) {
      const scRef = doc(collection(db, "order_events"));
      tx.set(scRef, {
        orderId: order.id,
        storeId: session.storeId,
        type: "status_changed",
        actorType: "staff",
        actorId: session.employeeId,
        actorName: session.employeeName || "",
        fromStatus: "ready",
        toStatus: "preparing",
        message: "追加品項，自動回退製作中",
        createdAt: ts,
      });
    }
  });

  // order_items batch — best effort
  try {
    const itemsPayload = window.LeLeShanOrders?.buildOrderItemsPayload?.({
      orderId: order.id,
      storeId: session.storeId,
      source: "pos",
      items: appendItems,
    });
    if (Array.isArray(itemsPayload) && itemsPayload.length) {
      const batch = writeBatch(db);
      itemsPayload.forEach((d: Record<string, unknown>) =>
        batch.set(doc(collection(db, "order_items")), d),
      );
      await batch.commit();
    }
  } catch (e) {
    console.warn("[POS v2] append order_items failed:", e);
  }

  return { wasReady };
}
