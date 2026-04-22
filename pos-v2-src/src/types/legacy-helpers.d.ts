/**
 * Vanilla helpers 型別映射 (order-helpers.js)
 * 權威來源：order-helpers.js window.LeLeShanOrders export（line 1265-1309）
 *
 * W3 只宣告用到的三個寫入 API。其餘 API（normalizeOrder、formatDate 等）用到再加。
 * order-status-labels.js 掛在 window.LeLeShanOrderStatus（非 LeLeShanOrders），W3 不用，不宣告。
 */

export interface OrderItemInput {
  itemId: string;
  name: string;
  unit_price: number;       // P4 canonical（snake_case）；normalizeItem 讀 unit_price || price
  price: number;            // fallback chain 雙保險
  qty: number;
  subtotal: number;
  type?: string;
  categoryName?: string;
  groupId?: string;         // P4 canonical（原 partId）
  groupLabel?: string;      // P4 canonical（原 partLabel）
  groupIndex?: number;      // P4 canonical（原 partIndex）
  flavor?: string;
  staple?: string;
  posType?: string;
  isGift?: boolean;
  [key: string]: unknown;
}

export interface OrderGroupInput {
  id: string;               // group 唯一 key，對齊 item.groupId
  index: number;            // 1-based
  label: string;
  flavor: string;
  staple: string;
  items: OrderItemInput[];
}

export interface BuildCreatePayloadArgs {
  id: string;
  storeId: string;
  customer_name: string;
  source: string;
  label: string;
  display_name: string;
  items: OrderItemInput[];
  subtotal: number;
  total: number;
  status: string;
  lineUserId: string | null;
  lineDisplayName: string | null;
  paymentMethod: string;
  isPaid: boolean;
  paymentStatus: string;
  note: string;
  scheduled_pickup_date: string;
  scheduled_pickup_time: string;
  scheduled_pickup_at: string;
  isTest: boolean;
  groups?: OrderGroupInput[] | null;
  [key: string]: unknown;
}

export interface BuildOrderEventPayloadArgs {
  orderId: string;
  storeId: string;
  type: string;
  actorType: string;
  actorId: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string;
  message: string;
  [key: string]: unknown;
}

export interface BuildOrderItemsPayloadArgs {
  orderId: string;
  storeId: string;
  source: string;
  items: OrderItemInput[];
}

declare global {
  interface Window {
    LeLeShanOrders: {
      buildCreatePayload(args: BuildCreatePayloadArgs): Record<string, unknown>;
      buildOrderEventPayload(args: BuildOrderEventPayloadArgs): Record<string, unknown>;
      buildOrderItemsPayload(args: BuildOrderItemsPayloadArgs): Record<string, unknown>[];
    };
  }
}

export {};
