import { useEffect } from "react";
import { subscribeCategories, subscribeMenuItems, subscribeFlavors } from "@/services/menu.service";
import { useMenuStore } from "@/stores/menu.store";

export function useMenuSubscription(storeId: string | null | undefined) {
  const setCategories = useMenuStore((s) => s.setCategories);
  const setItems = useMenuStore((s) => s.setItems);
  const setFlavors = useMenuStore((s) => s.setFlavors);

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
