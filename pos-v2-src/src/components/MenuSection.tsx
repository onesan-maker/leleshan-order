import { useState } from "react";
import { useMenuStore } from "@/stores/menu.store";
import { useCartStore } from "@/stores/cart.store";
import type { MenuItem, Combo } from "@/services/menu.service";

const COMBO_CAT_ID = "__combos__";

function comboAsMenuItem(c: Combo): MenuItem {
  return {
    ...c,
    categoryId: COMBO_CAT_ID,
    posType: (c.posType as string) || "set",
    enabled: c.enabled !== false,
    sort: c.sort ?? 0,
  } as MenuItem;
}

function SkeletonTabs() {
  return (
    <>
      {[80, 56, 72, 64, 60].map((w, i) => (
        <div key={i} className="h-7 rounded bg-panel-2 animate-pulse shrink-0" style={{ width: w }} />
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-panel animate-pulse" style={{ height: 74 }} />
      ))}
    </div>
  );
}

export function MenuSection() {
  const categories = useMenuStore((s) => s.categories);
  const items = useMenuStore((s) => s.items);
  const combos = useMenuStore((s) => s.combos);
  const loaded = useMenuStore((s) => s.loaded);
  const addItem = useCartStore((s) => s.addItem);

  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const allCategories = combos.length > 0
    ? [{ id: COMBO_CAT_ID, name: "套餐", storeId: "", enabled: true, sort: -1 }, ...categories]
    : categories;

  const effectiveCatId = activeCatId ?? allCategories[0]?.id ?? null;

  const filtered: MenuItem[] = effectiveCatId === COMBO_CAT_ID
    ? combos.map(comboAsMenuItem)
    : items.filter((i) => i.categoryId === effectiveCatId);

  // Item counts per category for tab badges
  const countMap = new Map<string, number>();
  if (combos.length > 0) countMap.set(COMBO_CAT_ID, combos.length);
  for (const cat of categories) {
    countMap.set(cat.id, items.filter((i) => i.categoryId === cat.id).length);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Category tab bar — sticky */}
      <div className="flex gap-0.5 px-3 overflow-x-auto shrink-0 bg-panel border-b border-line sticky top-0 z-10" style={{ minHeight: 44 }}>
        {!loaded ? (
          <div className="flex items-center gap-2 py-2">
            <SkeletonTabs />
          </div>
        ) : allCategories.map((c) => {
          const cnt = countMap.get(c.id) ?? 0;
          const isActive = c.id === effectiveCatId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCatId(c.id)}
              className={[
                "shrink-0 px-3 self-stretch text-[0.85rem] transition-colors whitespace-nowrap",
                isActive
                  ? "bg-accent text-[#1a0d00] font-black rounded-md"
                  : "font-semibold text-text-dim hover:text-text",
              ].join(" ")}
            >
              {c.name}
              {cnt > 0 && (
                <span className={["ml-1 text-[10px] font-normal", isActive ? "opacity-70" : "text-muted"].join(" ")}>
                  ({cnt})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {!loaded ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
            <span className="text-3xl opacity-30">🧺</span>
            <span className="text-sm">此分類暫無商品</span>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))" }}>
            {filtered.map((item) => {
              const soldOut = item.isSoldOut === true;
              return (
                <button
                  key={item.id}
                  onClick={() => !soldOut && addItem(item)}
                  disabled={soldOut}
                  className={[
                    "text-left rounded-xl border transition-all duration-150",
                    soldOut
                      ? "opacity-50 cursor-not-allowed border-line bg-panel grayscale"
                      : "border-line bg-panel hover:border-accent/30 hover:shadow-lg hover:shadow-accent/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
                  ].join(" ")}
                  style={{ padding: "8px 10px" }}
                >
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <div className="font-semibold leading-tight text-[0.88rem] line-clamp-2 flex-1">
                      {item.name}
                    </div>
                    {soldOut && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1 shrink-0">售完</span>
                    )}
                  </div>
                  {item.unit && (
                    <div className="text-[11px] text-muted mb-0.5">{String(item.unit)}</div>
                  )}
                  <div className="font-mono font-bold text-accent-2 text-[0.95rem] mt-auto">
                    ${item.price}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
