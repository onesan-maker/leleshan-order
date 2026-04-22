import { create } from "zustand";
import type { MenuItem } from "@/services/menu.service";

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

  addPart(): string;
  setActivePart(id: string): void;
  setPartFlavor(partId: string, flavorId: string | null, flavorName: string): void;
  removePart(id: string): void;

  addItem(item: MenuItem): void;
  changeQty(lineId: string, delta: number): void;
  removeLine(lineId: string): void;
  clear(): void;

  setCustomerName(v: string): void;
  setNote(v: string): void;
  setPaymentMethod(v: CartState["paymentMethod"]): void;
  setSource(v: CartState["source"]): void;
  setPickupTime(v: string): void;
  setLineUserId(v: string): void;

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

function makeLineId(itemId: string, groupId: string, flavor = ""): string {
  return `${itemId}__${groupId}__${flavor}`;
}

const INIT_PARTS: FlavorPart[] = [
  { id: "part_1", label: "第1組", flavorId: null, flavorName: "" },
];

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
    const { activePartId, parts, lines } = get();
    const part = parts.find((p) => p.id === activePartId);
    if (!part) return;
    const lineId = makeLineId(item.id, activePartId, part.flavorName);
    const existing = lines.find((l) => l.lineId === lineId);
    if (existing) {
      set({
        lines: lines.map((l) =>
          l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l,
        ),
      });
    } else {
      const newLine: CartLine = {
        lineId,
        itemId: item.id,
        name: item.name,
        unitPrice: item.price,
        qty: 1,
        type: (item.posType as string) || "addon",
        categoryName: "",
        groupId: activePartId,
        groupLabel: part.label,
        flavor: part.flavorName || undefined,
        posType: (item.posType as string) || "addon",
      };
      set({ lines: [...lines, newLine] });
    }
  },

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
    }),

  setCustomerName: (v) => set({ customerName: v }),
  setNote: (v) => set({ note: v }),
  setPaymentMethod: (v) => set({ paymentMethod: v }),
  setSource: (v) => set({ source: v }),
  setPickupTime: (v) => set({ pickupTime: v }),
  setLineUserId: (v) => set({ lineUserId: v }),

  getSubtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
  getItemCount: () => get().lines.reduce((s, l) => s + l.qty, 0),
}));
