import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  subscribeCategories,
  subscribeMenuItems,
  subscribeCombos,
  subscribeFlavors,
} from "@/services/menu.service";
import { useMenuStore } from "@/stores/menu.store";

export function useMenuSubscription(storeId: string | null | undefined) {
  const setCategories = useMenuStore((s) => s.setCategories);
  const setItems = useMenuStore((s) => s.setItems);
  const setCombos = useMenuStore((s) => s.setCombos);
  const setFlavors = useMenuStore((s) => s.setFlavors);
  const setStaples = useMenuStore((s) => s.setStaples);

  useEffect(() => {
    if (!storeId) return;

    // One-time settings read for global staple options
    getDoc(doc(db, "settings", storeId))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const go = data.globalOptions as Record<string, unknown> | undefined;
        if (Array.isArray(go?.staples) && go.staples.length) {
          setStaples(go.staples as string[]);
        }
      })
      .catch((e) => console.warn("[POS] settings read failed:", e));

    const unsubCats = subscribeCategories(storeId, setCategories);
    const unsubItems = subscribeMenuItems(storeId, setItems);
    const unsubCombos = subscribeCombos(storeId, setCombos);
    const unsubFlavors = subscribeFlavors(storeId, setFlavors);
    return () => {
      unsubCats();
      unsubItems();
      unsubCombos();
      unsubFlavors();
    };
  }, [storeId, setCategories, setItems, setCombos, setFlavors, setStaples]);
}
