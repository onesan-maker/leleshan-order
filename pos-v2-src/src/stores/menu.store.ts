import { create } from "zustand";
import type { MenuCategory, MenuItem, Flavor } from "@/services/menu.service";

interface MenuState {
  categories: MenuCategory[];
  items: MenuItem[];
  flavors: Flavor[];
  staples: string[];
  loaded: boolean;
  setCategories(c: MenuCategory[]): void;
  setItems(i: MenuItem[]): void;
  setFlavors(f: Flavor[]): void;
  setStaples(s: string[]): void;
}

export const useMenuStore = create<MenuState>((set) => ({
  categories: [],
  items: [],
  flavors: [],
  staples: [],
  loaded: false,
  setCategories: (c) => set({ categories: c, loaded: true }),
  setItems: (i) => set({ items: i }),
  setFlavors: (f) => set({ flavors: f }),
  setStaples: (s) => set({ staples: s }),
}));
