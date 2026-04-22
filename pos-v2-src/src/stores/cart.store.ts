import { create } from "zustand";

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  type: string;
  categoryName?: string;
  groupId: string;
  groupLabel: string;
  flavor?: string;
  staple?: string;
  posType?: string;
}

export interface FlavorPart {
  id: string;       // "part_1", "part_2", ...
  groupId: string;  // P4 canonical — same value, used in CartLine
  groupLabel: string;
  flavor: string;
  staple: string;
}

interface CartState {
  parts: FlavorPart[];
  lines: CartLine[];
  note: string;
  paymentMethod: string;
  customerName: string;

  setParts(parts: FlavorPart[]): void;
  addItem(item: {
    itemId: string;
    name: string;
    unitPrice: number;
    type: string;
    categoryName?: string;
    posType?: string;
  }, partId: string): void;
  removeItem(lineId: string): void;
  updateQty(lineId: string, delta: number): void;
  setNote(note: string): void;
  setPaymentMethod(m: string): void;
  setCustomerName(n: string): void;
  clear(): void;
}

function makeLineId(itemId: string, groupId: string): string {
  return `${itemId}__${groupId}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  parts: [],
  lines: [],
  note: "",
  paymentMethod: "cash",
  customerName: "",

  setParts: (parts) => set({ parts }),

  addItem: (item, partId) => {
    const { parts, lines } = get();
    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    const lineId = makeLineId(item.itemId, part.groupId);
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
        itemId: item.itemId,
        name: item.name,
        unitPrice: item.unitPrice,
        qty: 1,
        type: item.type,
        categoryName: item.categoryName,
        groupId: part.groupId,
        groupLabel: part.groupLabel,
        flavor: part.flavor || undefined,
        staple: part.staple || undefined,
        posType: item.posType,
      };
      set({ lines: [...lines, newLine] });
    }
  },

  removeItem: (lineId) =>
    set({ lines: get().lines.filter((l) => l.lineId !== lineId) }),

  updateQty: (lineId, delta) => {
    const updated = get().lines
      .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l))
      .filter((l) => l.qty > 0);
    set({ lines: updated });
  },

  setNote: (note) => set({ note }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCustomerName: (customerName) => set({ customerName }),

  clear: () =>
    set({ lines: [], note: "", paymentMethod: "cash", customerName: "" }),
}));
