import { useEffect } from "react";
import { subscribeCategories, subscribeMenuItems, subscribeFlavors } from "@/services/menu.service";
import { useMenuStore } from "@/stores/menu.store";

export function useMenuSubscription(storeId: string) {
  const { setCategories, setItems, setFlavors } = useMenuStore();

  useEffect(() => {
    if (!storeId) return;
    const unsubCats = subscribeCategories(storeId, setCategories);
    const unsubItems = subscribeMenuItems(storeId, setItems);
    const unsubFlavors = subscribeFlavors(storeId, setFlavors);
    return () => {
      unsubCats();
      unsubItems();
      unsubFlavors();
    };
  }, [storeId, setCategories, setItems, setFlavors]);
}
