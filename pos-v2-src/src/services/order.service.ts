import { collection, doc, runTransaction, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CartLine, FlavorPart } from "@/stores/cart.store";
import type { PosSession } from "@/lib/session";
import type { OrderItemInput } from "@/types/legacy-helpers";

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "現場顧客",
  phone: "電話訂",
};

function todayStr(): string {
  const now = new Date();
  const tzOffset = 8 * 60;
  const local = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

function linesToItems(lines: CartLine[]): OrderItemInput[] {
  return lines.map((l) => ({
    itemId: l.itemId,
    name: l.name,
    unit_price: l.unitPrice,
    price: l.unitPrice,
    qty: l.qty,
    subtotal: l.unitPrice * l.qty,
    type: l.type,
    categoryName: l.categoryName || "",
    groupId: l.groupId,
    groupLabel: l.groupLabel,
    flavor: l.flavor || "",
    staple: l.staple || "",
    posType: l.posType || "addon",
  }));
}

export interface SubmitInput {
  session: PosSession;
  parts: FlavorPart[];
  lines: CartLine[];
  customerName: string;
  note: string;
  paymentMethod: "cash" | "linepay";
  source: "walk_in" | "phone";
  pickupTime: string;
  lineUserId: string;
}

export interface SubmitResult {
  orderId: string;
  pickupNumber: string;
}

export async function submitOrder(input: SubmitInput): Promise<SubmitResult> {
  const { session, parts, lines, customerName, note, paymentMethod, source, pickupTime, lineUserId } = input;

  if (!window.LeLeShanOrders) throw new Error("LeLeShanOrders helpers not loaded");

  const storeId = session.storeId;
  const date = todayStr();
  const items = linesToItems(lines);
  const total = items.reduce((s, i) => s + (i.subtotal ?? 0), 0);

  const groups = parts
    .map((p, idx) => {
      const groupItems = items.filter((i) => i.groupId === p.id);
      if (!groupItems.length) return null;
      return {
        id: p.id,
        index: idx + 1,
        label: p.label,
        flavor: p.flavorName || "",
        staple: "",
        items: groupItems,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const customer = customerName.trim() || "現場顧客";
  const displayLabel = SOURCE_LABELS[source] || "現場顧客";
  const displayName = `${displayLabel}${customer !== "現場顧客" ? " " + customer : ""}`;

  const orderRef = doc(collection(db, "orders"));
  const counterRef = doc(db, "order_counters", date);

  const payload = window.LeLeShanOrders.buildCreatePayload({
    id: orderRef.id,
    storeId,
    customer_name: customer,
    source: "pos",
    label: displayLabel,
    display_name: displayName,
    items,
    subtotal: total,
    total,
    status: "accepted",
    lineUserId: lineUserId || null,
    lineDisplayName: lineUserId ? customer : null,
    paymentMethod,
    isPaid: true,
    paymentStatus: "paid",
    note,
    scheduled_pickup_date: date,
    scheduled_pickup_time: pickupTime,
    scheduled_pickup_at: pickupTime ? `${date}T${pickupTime}:00+08:00` : "",
    isTest: false,
    groups: groups.length > 0 ? groups : null,
  });

  (payload as Record<string, unknown>).isPaid = true;
  (payload as Record<string, unknown>).accepted_at = serverTimestamp();
  (payload as Record<string, unknown>).acceptedAt = serverTimestamp();

  let pickupNumber = "";

  await runTransaction(db, async (tx) => {
    const counterDoc = await tx.get(counterRef);
    const seq = counterDoc.exists()
      ? ((counterDoc.data() as { seq?: number }).seq ?? 0) + 1
      : 1;
    pickupNumber = String(seq).padStart(3, "0");

    tx.set(counterRef, { seq, date, updatedAt: serverTimestamp() }, { merge: true });

    (payload as Record<string, unknown>).pickupNumber = pickupNumber;
    (payload as Record<string, unknown>).pickupSequence = seq;
    tx.set(orderRef, payload as Parameters<typeof tx.set>[1]);

    const eventRef = doc(collection(db, "order_events"));
    tx.set(
      eventRef,
      window.LeLeShanOrders!.buildOrderEventPayload({
        orderId: orderRef.id,
        storeId,
        type: "order_created",
        actorType: "staff",
        actorId: `emp:${session.employeeId}`,
        actorName: session.employeeName,
        fromStatus: null,
        toStatus: "accepted",
        message: `POS v2 現場建單，取餐號碼 ${pickupNumber}`,
      }) as Parameters<typeof tx.set>[1],
    );
  });

  try {
    const itemsPayload = window.LeLeShanOrders!.buildOrderItemsPayload({
      orderId: orderRef.id,
      storeId,
      source: "pos",
      items,
    });
    if (Array.isArray(itemsPayload) && itemsPayload.length) {
      const batch = writeBatch(db);
      itemsPayload.forEach((d) => {
        batch.set(doc(collection(db, "order_items")), d as Parameters<typeof batch.set>[1]);
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn("[POS v2] order_items write failed (non-fatal).", e);
  }

  return { orderId: orderRef.id, pickupNumber };
}
