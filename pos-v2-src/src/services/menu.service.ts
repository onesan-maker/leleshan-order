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

export function subscribeMenuItems(storeId: string, cb: (items: MenuItem[]) => void): Unsubscribe {
  const q = query(collection(db, "menu_items"), where("storeId", "==", storeId));
  return onSnapshot(
    q,
    (snap) => {
      const rows: MenuItem[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) } as MenuItem));
      cb(
        rows
          .filter((r) => r.enabled !== false && r.posVisible !== false && r.isSoldOut !== true)
          .sort(bySort),
      );
    },
    (err) => console.error("[POS v2] subscribeMenuItems failed:", err),
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
