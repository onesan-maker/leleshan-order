import { create } from "zustand";
import type { MenuCategory, MenuItem, Flavor, Combo } from "@/services/menu.service";

interface MenuState {
  categories: MenuCategory[];
  items: MenuItem[];
  combos: Combo[];
  flavors: Flavor[];
  staples: string[];
  loaded: boolean;
  setCategories(c: MenuCategory[]): void;
  setItems(i: MenuItem[]): void;
  setCombos(c: Combo[]): void;
  setFlavors(f: Flavor[]): void;
  setStaples(s: string[]): void;
}

export const useMenuStore = create<MenuState>((set) => ({
  categories: [],
  items: [],
  combos: [],
  flavors: [],
  staples: [],
  loaded: false,
  setCategories: (c) => set({ categories: c, loaded: true }),
  setItems: (i) => set({ items: i }),
  setCombos: (c) => set({ combos: c }),
  setFlavors: (f) => set({ flavors: f }),
  setStaples: (s) => set({ staples: s }),
}));
