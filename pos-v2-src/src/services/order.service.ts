import { doc, runTransaction, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CartLine, FlavorPart } from "@/stores/cart.store";
import type {
  OrderItemInput,
  OrderGroupInput,
  BuildCreatePayloadArgs,
} from "@/types/legacy-helpers";

export interface CheckoutArgs {
  storeId: string;
  source: string;
  label: string;
  display_name: string;
  customerName: string;
  note: string;
  paymentMethod: string;
  isPaid: boolean;
  paymentStatus: string;
  scheduledPickupDate: string;
  scheduledPickupTime: string;
  scheduledPickupAt: string;
  isTest: boolean;
  lineUserId: string | null;
  lineDisplayName: string | null;
  lines: CartLine[];
  parts: FlavorPart[];
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
    categoryName: l.categoryName ?? "",
    groupId: l.groupId,
    groupLabel: l.groupLabel,
    groupIndex: undefined,
    flavor: l.flavor ?? "",
    staple: l.staple ?? "",
    posType: l.posType ?? "",
  }));
}

function buildGroups(parts: FlavorPart[], lines: CartLine[]): OrderGroupInput[] {
  return parts
    .filter((p) => lines.some((l) => l.groupId === p.groupId))
    .map((p, idx) => ({
      id: p.groupId,
      index: idx + 1,
      label: p.groupLabel,
      flavor: p.flavor,
      staple: p.staple,
      items: lines
        .filter((l) => l.groupId === p.groupId)
        .map((l) => ({
          itemId: l.itemId,
          name: l.name,
          unit_price: l.unitPrice,
          price: l.unitPrice,
          qty: l.qty,
          subtotal: l.unitPrice * l.qty,
          type: l.type,
          categoryName: l.categoryName ?? "",
          groupId: l.groupId,
          groupLabel: l.groupLabel,
          groupIndex: idx + 1,
          flavor: l.flavor ?? "",
          staple: l.staple ?? "",
          posType: l.posType ?? "",
        })),
    }));
}

export async function checkout(args: CheckoutArgs): Promise<string> {
  const { LeLeShanOrders } = window;
  if (!LeLeShanOrders) throw new Error("LeLeShanOrders helpers not loaded");

  const { storeId, lines, parts } = args;
  const items = linesToItems(lines);
  const groups = buildGroups(parts, lines);
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  const counterRef = doc(db, "order_counters", storeId);
  const ordersRef = collection(db, "orders");

  let orderId = "";

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const currentSeq: number = counterSnap.exists()
      ? (counterSnap.data().seq ?? 0)
      : 0;
    const seq = currentSeq + 1;

    orderId = `${storeId}_${todayStr}_${String(seq).padStart(4, "0")}`;

    const buildArgs: BuildCreatePayloadArgs = {
      id: orderId,
      storeId,
      customer_name: args.customerName,
      source: args.source,
      label: args.label,
      display_name: args.display_name,
      items,
      subtotal,
      total: subtotal,
      status: "pending",
      lineUserId: args.lineUserId,
      lineDisplayName: args.lineDisplayName,
      paymentMethod: args.paymentMethod,
      isPaid: args.isPaid,
      paymentStatus: args.paymentStatus,
      note: args.note,
      scheduled_pickup_date: args.scheduledPickupDate,
      scheduled_pickup_time: args.scheduledPickupTime,
      scheduled_pickup_at: args.scheduledPickupAt,
      isTest: args.isTest,
      groups: groups.length > 0 ? groups : null,
    };

    const orderPayload = LeLeShanOrders.buildCreatePayload(buildArgs);

    tx.set(doc(ordersRef, orderId), {
      ...orderPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(counterRef, { seq, updatedAt: serverTimestamp() }, { merge: true });

    const eventPayload = LeLeShanOrders.buildOrderEventPayload({
      orderId,
      storeId,
      type: "created",
      actorType: "staff",
      actorId: "pos-v2",
      actorName: "POS",
      fromStatus: null,
      toStatus: "pending",
      message: "訂單建立",
    });
    tx.set(doc(collection(db, "order_events")), {
      ...eventPayload,
      createdAt: serverTimestamp(),
    });

    const itemPayloads = LeLeShanOrders.buildOrderItemsPayload({
      orderId,
      storeId,
      source: args.source,
      items,
    });
    const orderItemsRef = collection(db, "order_items");
    for (const ip of itemPayloads) {
      tx.set(doc(orderItemsRef), { ...ip, createdAt: serverTimestamp() });
    }
  });

  return orderId;
}
