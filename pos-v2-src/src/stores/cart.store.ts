import { create } from "zustand";
import type { MenuItem } from "@/services/menu.service";
import { needsSpecModal } from "@/lib/posRules";

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  type: string;
  categoryName?: string;
  groupId: string;       // P4 canonical — equals part.id (part_N)
  groupLabel: string;    // P4 canonical — "第N組"
  flavor?: string;
  staple?: string;
  posType?: string;
}

export interface FlavorPart {
  id: string;            // "part_1", "part_2" ... → written as group.id
  label: string;         // "第1組", "第2組" ...
  flavorId: string | null;
  flavorName: string;
}

export interface AppendTarget {
  id: string;
  pickupNumber?: number;
  customer_name?: string;
  display_name?: string;
  status?: string;
}

interface CartState {
  parts: FlavorPart[];
  activePartId: string;
  lines: CartLine[];
  customerName: string;
  note: string;
  paymentMethod: "" | "cash" | "linepay";
  source: "walk_in" | "phone";
  pickupTime: string;
  lineUserId: string;

  pendingSpec: MenuItem | null;
  appendTarget: AppendTarget | null;

  addPart(): string;
  setActivePart(id: string): void;
  setPartFlavor(partId: string, flavorId: string | null, flavorName: string): void;
  removePart(id: string): void;

  addItem(item: MenuItem): void;
  addItemDirect(item: MenuItem, flavor: string, staple: string): void;
  confirmSpec(flavor: string, staple: string): void;
  cancelSpec(): void;

  changeQty(lineId: string, delta: number): void;
  removeLine(lineId: string): void;
  clear(): void;

  setCustomerName(v: string): void;
  setNote(v: string): void;
  setPaymentMethod(v: CartState["paymentMethod"]): void;
  setSource(v: CartState["source"]): void;
  setPickupTime(v: string): void;
  setLineUserId(v: string): void;

  setAppendTarget(t: AppendTarget | null): void;
  exitAppendMode(): void;

  getSubtotal(): number;
  getItemCount(): number;
}

function newPartId(existing: FlavorPart[]): string {
  const nums = existing
    .map((p) => Number(p.id.replace("part_", "")))
    .filter(Number.isFinite);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `part_${next}`;
}

function partLabel(id: string): string {
  const n = Number(id.replace("part_", ""));
  return `第${Number.isFinite(n) ? n : 1}組`;
}

function makeLineId(itemId: string, groupId: string, flavor = "", staple = ""): string {
  return `${itemId}__${groupId}__${flavor}__${staple}`;
}

const INIT_PARTS: FlavorPart[] = [
  { id: "part_1", label: "第1組", flavorId: null, flavorName: "" },
];

function addLineToState(
  lines: CartLine[],
  item: MenuItem,
  groupId: string,
  groupLabel: string,
  flavor: string,
  staple: string,
): CartLine[] {
  const lineId = makeLineId(item.id, groupId, flavor, staple);
  const existing = lines.find((l) => l.lineId === lineId);
  if (existing) {
    return lines.map((l) =>
      l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l,
    );
  }
  const newLine: CartLine = {
    lineId,
    itemId: item.id,
    name: item.name,
    unitPrice: item.price,
    qty: 1,
    type: (item.posType as string) || "addon",
    groupId,
    groupLabel,
    flavor: flavor || undefined,
    staple: staple || undefined,
    posType: (item.posType as string) || "addon",
  };
  return [...lines, newLine];
}

export const useCartStore = create<CartState>((set, get) => ({
  parts: INIT_PARTS,
  activePartId: "part_1",
  lines: [],
  customerName: "",
  note: "",
  paymentMethod: "",
  source: "walk_in",
  pickupTime: "",
  lineUserId: "",
  pendingSpec: null,
  appendTarget: null,

  addPart: () => {
    const id = newPartId(get().parts);
    set((s) => ({
      parts: [...s.parts, { id, label: partLabel(id), flavorId: null, flavorName: "" }],
      activePartId: id,
    }));
    return id;
  },

  setActivePart: (id) => set({ activePartId: id }),

  setPartFlavor: (partId, flavorId, flavorName) =>
    set((s) => ({
      parts: s.parts.map((p) =>
        p.id === partId ? { ...p, flavorId, flavorName } : p,
      ),
    })),

  removePart: (id) =>
    set((s) => {
      if (s.parts.length <= 1) return s;
      const parts = s.parts.filter((p) => p.id !== id);
      const lines = s.lines.filter((l) => l.groupId !== id);
      const activePartId = s.activePartId === id ? parts[0].id : s.activePartId;
      return { parts, lines, activePartId };
    }),

  addItem: (item) => {
    if (needsSpecModal(item.posType as string)) {
      set({ pendingSpec: item });
      return;
    }
    const { activePartId, parts, lines } = get();
    const part = parts.find((p) => p.id === activePartId);
    if (!part) return;
    set({ lines: addLineToState(lines, item, activePartId, part.label, part.flavorName, "") });
  },

  addItemDirect: (item, flavor, staple) => {
    const { activePartId, parts, lines } = get();
    const part = parts.find((p) => p.id === activePartId);
    if (!part) return;
    set({ lines: addLineToState(lines, item, activePartId, part.label, flavor, staple) });
  },

  confirmSpec: (flavor, staple) => {
    const { pendingSpec } = get();
    if (!pendingSpec) return;
    const { activePartId, parts, lines } = get();
    const part = parts.find((p) => p.id === activePartId);
    if (!part) { set({ pendingSpec: null }); return; }
    set({
      lines: addLineToState(lines, pendingSpec, activePartId, part.label, flavor, staple),
      pendingSpec: null,
    });
  },

  cancelSpec: () => set({ pendingSpec: null }),

  changeQty: (lineId, delta) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    })),

  removeLine: (lineId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) })),

  clear: () =>
    set({
      parts: [{ id: "part_1", label: "第1組", flavorId: null, flavorName: "" }],
      activePartId: "part_1",
      lines: [],
      customerName: "",
      note: "",
      paymentMethod: "",
      source: "walk_in",
      pickupTime: "",
      lineUserId: "",
      pendingSpec: null,
      appendTarget: null,
    }),

  setCustomerName: (v) => set({ customerName: v }),
  setNote: (v) => set({ note: v }),
  setPaymentMethod: (v) => set({ paymentMethod: v }),
  setSource: (v) => set({ source: v }),
  setPickupTime: (v) => set({ pickupTime: v }),
  setLineUserId: (v) => set({ lineUserId: v }),

  setAppendTarget: (t) =>
    set({
      appendTarget: t,
      lines: [],
      parts: [{ id: "part_1", label: "第1組", flavorId: null, flavorName: "" }],
      activePartId: "part_1",
    }),

  exitAppendMode: () =>
    set({
      appendTarget: null,
      lines: [],
      parts: [{ id: "part_1", label: "第1組", flavorId: null, flavorName: "" }],
      activePartId: "part_1",
    }),

  getSubtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
  getItemCount: () => get().lines.reduce((s, l) => s + l.qty, 0),
}));
