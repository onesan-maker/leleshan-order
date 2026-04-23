import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MenuCategory {
  id: string;
  name: string;
  storeId: string;
  enabled: boolean;
  sort: number;
  color?: string;
}

export interface MenuItem {
  id: string;
  storeId: string;
  name: string;
  price: number;
  categoryId: string;
  enabled: boolean;
  sort: number;
  tags?: string[];
  unit?: string;
  posVisible?: boolean;
  posHidden?: boolean;
  isActive?: boolean;
  isSoldOut?: boolean;
  posType?: string;
  flavorMode?: string;
  stapleMode?: string;
  [key: string]: unknown;
}

export interface Flavor {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  spicyLabel?: string;
  sort: number;
  enabled: boolean;
}

function bySort<T extends { sort?: number }>(a: T, b: T): number {
  return (a.sort ?? 0) - (b.sort ?? 0);
}

export function subscribeCategories(storeId: string, cb: (cats: MenuCategory[]) => void): Unsubscribe {
  const q = query(collection(db, "categories"), where("storeId", "==", storeId));
  return onSnapshot(
    q,
    (snap) => {
      const rows: MenuCategory[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<MenuCategory, "id">) }));
      cb(rows.filter((r) => r.enabled !== false).sort(bySort));
    },
    (err) => console.error("[POS v2] subscribeCategories failed:", err),
  );
}

/**
 * 對齊 vanilla pos.js 行為：
 * 1. 讀 menu_items + menuItems（legacy）兩個 collection，new 優先去重
 * 2. filter 條件：enabled !== false && isActive !== false && posHidden !== true && posVisible !== false
 *    — 不過濾 isSoldOut（vanilla 保留售完品項，僅視覺標示）
 */
export function subscribeMenuItems(storeId: string, cb: (items: MenuItem[]) => void): Unsubscribe {
  let itemsNew: MenuItem[] = [];
  let itemsLegacy: MenuItem[] = [];

  function publish() {
    const seen = new Set<string>();
    const merged: MenuItem[] = [];
    for (const item of [...itemsNew, ...itemsLegacy]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    cb(
      merged
        .filter(
          (r) =>
            r.enabled !== false &&
            r.isActive !== false &&
            r.posHidden !== true &&
            r.posVisible !== false,
        )
        .sort(bySort),
    );
  }

  const toRow = (d: { id: string; data(): Record<string, unknown> }): MenuItem =>
    ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) } as MenuItem);

  const unsubNew = onSnapshot(
    query(collection(db, "menu_items"), where("storeId", "==", storeId)),
    (snap) => {
      itemsNew = snap.docs.map(toRow);
      publish();
    },
    (err) => console.error("[POS v2] subscribeMenuItems(menu_items) failed:", err),
  );

  const unsubLegacy = onSnapshot(
    query(collection(db, "menuItems"), where("storeId", "==", storeId)),
    (snap) => {
      itemsLegacy = snap.docs.map(toRow);
      publish();
    },
    (err) => console.error("[POS v2] subscribeMenuItems(menuItems) failed:", err),
  );

  return () => {
    unsubNew();
    unsubLegacy();
  };
}

export interface Combo {
  id: string;
  storeId: string;
  name: string;
  price: number;
  enabled: boolean;
  sort: number;
  posType?: string;
  posVisible?: boolean;
  posHidden?: boolean;
  isSoldOut?: boolean;
  flavorOptions?: string[];
  stapleOptions?: string[];
  optionGroups?: unknown;
  description?: string;
  requiresFlavor?: boolean;
  requiresStaple?: boolean;
  [key: string]: unknown;
}

// Align with vanilla: filter enabled !== false && posHidden !== true; keep isSoldOut items
export function subscribeCombos(storeId: string, cb: (combos: Combo[]) => void): Unsubscribe {
  const q = query(collection(db, "comboTemplates"), where("storeId", "==", storeId));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Combo[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Combo, "id">) } as Combo));
      cb(
        rows
          .filter((r) => r.enabled !== false && r.posHidden !== true && r.posVisible !== false)
          .sort(bySort),
      );
    },
    (err) => console.error("[POS v2] subscribeCombos failed:", err),
  );
}

export function subscribeFlavors(storeId: string, cb: (flavors: Flavor[]) => void): Unsubscribe {
  const q = query(collection(db, "flavors"), where("storeId", "==", storeId));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Flavor[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Flavor, "id">) }));
      cb(rows.filter((r) => r.enabled !== false).sort(bySort));
    },
    (err) => console.error("[POS v2] subscribeFlavors failed:", err),
  );
}
