import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Unsubscribe } from "firebase/firestore";

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

export function subscribeCategories(storeId: string, cb: (cats: MenuCategory[]) => void): Unsubscribe {
  const q = query(
    collection(db, "categories"),
    where("storeId", "==", storeId),
    orderBy("sort", "asc"),
  );
  return onSnapshot(q, (snap) => {
    const rows: MenuCategory[] = [];
    snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<MenuCategory, "id">) }));
    cb(rows.filter((r) => r.enabled !== false));
  });
}

export function subscribeMenuItems(storeId: string, cb: (items: MenuItem[]) => void): Unsubscribe {
  const q = query(
    collection(db, "menu_items"),
    where("storeId", "==", storeId),
    orderBy("sort", "asc"),
  );
  return onSnapshot(q, (snap) => {
    const rows: MenuItem[] = [];
    snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) } as MenuItem));
    cb(rows.filter((r) => r.enabled !== false && r.posVisible !== false && r.isSoldOut !== true));
  });
}

export function subscribeFlavors(storeId: string, cb: (flavors: Flavor[]) => void): Unsubscribe {
  const q = query(
    collection(db, "flavors"),
    where("storeId", "==", storeId),
    orderBy("sort", "asc"),
  );
  return onSnapshot(q, (snap) => {
    const rows: Flavor[] = [];
    snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Flavor, "id">) }));
    cb(rows.filter((r) => r.enabled !== false));
  });
}
