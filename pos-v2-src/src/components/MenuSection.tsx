import { useState } from "react";
import { useMenuStore } from "@/stores/menu.store";
import { useCartStore } from "@/stores/cart.store";
import type { MenuItem, Combo } from "@/services/menu.service";

const COMBO_CAT_ID = "__combos__";

function comboAsMenuItem(c: Combo): MenuItem {
  return {
    ...c,
    categoryId: COMBO_CAT_ID,
    // vanilla: when fallbackType==="combo", inferPosType returns "set"
    posType: (c.posType as string) || "set",
    enabled: c.enabled !== false,
    sort: c.sort ?? 0,
  } as MenuItem;
}

export function MenuSection() {
  const categories = useMenuStore((s) => s.categories);
  const items = useMenuStore((s) => s.items);
  const combos = useMenuStore((s) => s.combos);
  const addItem = useCartStore((s) => s.addItem);

  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  // Virtual "套餐" category prepended when combos exist (做法 C, aligns with vanilla renderMenu)
  const allCategories = combos.length > 0
    ? [{ id: COMBO_CAT_ID, name: "套餐", storeId: "", enabled: true, sort: -1 }, ...categories]
    : categories;

  const effectiveCatId = activeCatId ?? allCategories[0]?.id ?? null;

  const filtered: MenuItem[] = effectiveCatId === COMBO_CAT_ID
    ? combos.map(comboAsMenuItem)
    : items.filter((i) => i.categoryId === effectiveCatId);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Category tab bar */}
      <div className="flex gap-0.5 px-3 overflow-x-auto shrink-0 bg-panel/40" style={{ minHeight: 44 }}>
        {allCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCatId(c.id)}
            className={[
              "shrink-0 px-3 self-stretch text-[0.9rem] font-semibold transition-colors whitespace-nowrap",
              c.id === effectiveCatId
                ? "bg-accent text-[#1a0d00]"
                : "text-text-dim hover:text-text",
            ].join(" ")}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))" }}>
          {filtered.map((item) => {
            const soldOut = item.isSoldOut === true;
            return (
              <button
                key={item.id}
                onClick={() => !soldOut && addItem(item)}
                disabled={soldOut}
                className={[
                  "text-left rounded-xl border transition-all",
                  soldOut
                    ? "opacity-50 cursor-not-allowed border-line bg-panel"
                    : "border-line bg-panel hover:border-accent/60 hover:bg-panel-2 active:scale-95",
                ].join(" ")}
                style={{ padding: "10px 12px" }}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="font-semibold leading-tight text-[0.92rem] line-clamp-2 flex-1">
                    {item.name}
                  </div>
                  {soldOut && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1 shrink-0">售完</span>
                  )}
                </div>
                {item.unit && (
                  <div className="text-[11px] text-muted mb-1">{String(item.unit)}</div>
                )}
                <div className="font-mono font-bold text-accent-2 text-base mt-auto">
                  ${item.price}
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-muted py-12 text-sm">此分類暫無商品</div>
        )}
      </div>
    </div>
  );
}
