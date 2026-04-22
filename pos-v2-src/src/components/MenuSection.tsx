import { useState } from "react";
import type { MenuCategory, MenuItem } from "@/services/menu.service";

interface Props {
  categories: MenuCategory[];
  items: MenuItem[];
  onItemClick(item: MenuItem): void;
}

export function MenuSection({ categories, items, onItemClick }: Props) {
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const effectiveCatId = activeCatId ?? categories[0]?.id ?? null;
  const filtered = effectiveCatId
    ? items.filter((i) => i.categoryId === effectiveCatId)
    : items;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Category tabs */}
      <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-line bg-panel/40">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCatId(c.id)}
            className={[
              "flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors",
              c.id === effectiveCatId
                ? "bg-accent text-[#1a0d00]"
                : "text-text-dim hover:bg-panel-2",
            ].join(" ")}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className="group text-left bg-panel border border-line rounded-xl p-3 hover:border-accent/60 hover:bg-panel-2 transition-all active:scale-95"
            >
              <div className="font-semibold text-sm leading-snug line-clamp-2 mb-1">
                {item.name}
              </div>
              {item.unit && (
                <div className="text-[10px] text-muted mb-1">{item.unit}</div>
              )}
              <div className="font-mono font-black text-accent-2 text-base">
                ${item.price}
              </div>
              {item.isSoldOut && (
                <div className="text-xs text-red-400 mt-1">售完</div>
              )}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-muted py-12 text-sm">此分類暫無商品</div>
        )}
      </div>
    </div>
  );
}
