import type { CartLine, FlavorPart } from "@/stores/cart.store";
import type { PosSession } from "@/lib/session";
import type { OrderItemInput } from "@/types/legacy-helpers";
import { hubClient, HubUnavailableError } from "@/lib/hub-client";

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "現場顧客",
  phone: "電話訂",
};

function todayStr(): string {
  const now = new Date();
  const local = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
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

  // Step 1: get pickup number from Hub
  let pickupInfo: { pickupNumber: string; pickupSequence: number; businessDate: string };
  try {
    pickupInfo = await hubClient.getPickupNumber(storeId);
  } catch (e) {
    if (e instanceof HubUnavailableError) throw new Error("本機服務異常，請聯繫店家");
    throw e;
  }

  const { pickupNumber, pickupSequence, businessDate } = pickupInfo;
  const date = businessDate || todayStr();
  const clientRef = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Step 2: build payload via helpers, then replace FieldValue sentinels with ISO timestamps
  const payload = window.LeLeShanOrders.buildCreatePayload({
    id: orderId,
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
  }) as Record<string, unknown>;

  // Replace Firestore FieldValue sentinels (non-JSON-serializable) with ISO strings
  payload.created_at = now;
  payload.updated_at = now;
  payload.accepted_at = now;
  payload.acceptedAt = now;

  // Hub-specific fields
  payload.clientRef = clientRef;
  payload.pickupNumber = pickupNumber;
  payload.pickupSequence = pickupSequence;
  payload.businessDate = businessDate;
  payload.employeeId = session.employeeId;
  payload.employeeName = session.employeeName;

  // Step 3: write order to Hub (Hub handles Firestore sync)
  let result: { id: string };
  try {
    result = await hubClient.createOrder(payload);
  } catch (e) {
    if (e instanceof HubUnavailableError) throw new Error("本機服務異常，請聯繫店家");
    throw e;
  }

  return { orderId: result.id, pickupNumber };
}
