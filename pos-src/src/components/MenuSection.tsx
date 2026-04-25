import { useRef, useEffect, useCallback } from "react";
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

/* ── Skeletons ─────────────────────────────────────────── */
function SkeletonCards() {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))" }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-panel-2 animate-pulse"
          style={{ minHeight: 108 }}
        />
      ))}
    </div>
  );
}

/* ── Props ──────────────────────────────────────────────── */
interface Props {
  /** Category id to scroll to (set by Sidebar click, consumed once). */
  scrollTarget: string | null;
  onScrollTargetConsumed(): void;
  /** Called with the topmost visible section id as user scrolls. */
  onSectionVisible(id: string): void;
  searchQuery: string;
}

/* ── Component ──────────────────────────────────────────── */
export function MenuSection({
  scrollTarget,
  onScrollTargetConsumed,
  onSectionVisible,
  searchQuery,
}: Props) {
  const categories = useMenuStore((s) => s.categories);
  const items      = useMenuStore((s) => s.items);
  const combos     = useMenuStore((s) => s.combos);
  const loaded     = useMenuStore((s) => s.loaded);
  const addItem    = useCartStore((s) => s.addItem);

  const scrollRef = useRef<HTMLDivElement>(null);

  const allCategories = [
    ...(combos.length > 0 ? [{ id: COMBO_CAT_ID, name: "套餐", en: "SET MEALS", isCombo: true }] : []),
    ...categories.map((c) => ({ id: c.id, name: c.name, en: "", isCombo: false })),
  ];

  /* ── Programmatic scroll (from Sidebar click) ──────── */
  useEffect(() => {
    if (!scrollTarget || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-cat-id="${scrollTarget}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    onScrollTargetConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget]);

  /* ── IntersectionObserver — highlight active cat ────── */
  const onSectionVisibleRef = useRef(onSectionVisible);
  useEffect(() => { onSectionVisibleRef.current = onSectionVisible; }, [onSectionVisible]);

  useEffect(() => {
    if (!loaded || !scrollRef.current) return;
    const root = scrollRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("data-cat-id");
          if (id) onSectionVisibleRef.current(id);
        }
      },
      { root, threshold: 0, rootMargin: "-20px 0px -55% 0px" },
    );

    root.querySelectorAll("[data-cat-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded, allCategories.length]);

  /* ── Search filter ──────────────────────────────────── */
  const q = searchQuery.trim().toLowerCase();

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      style={{ padding: "22px 28px 60px" }}
    >
      {!loaded ? (
        <SkeletonCards />
      ) : (
        allCategories.map((cat) => {
          const rawItems: MenuItem[] = cat.isCombo
            ? combos.map(comboAsMenuItem)
            : items.filter((i) => i.categoryId === cat.id);

          const filtered = q
            ? rawItems.filter((i) => i.name.toLowerCase().includes(q))
            : rawItems;

          if (filtered.length === 0 && q) return null; // hide empty sections in search mode

          return (
            <section
              key={cat.id}
              data-cat-id={cat.id}
              id={`cat-${cat.id}`}
              style={{ marginBottom: 28, scrollMarginTop: 10 }}
            >
              {/* Section header */}
              <div
                className="flex items-baseline gap-3 border-b border-line-soft"
                style={{ marginBottom: 14, paddingBottom: 10 }}
              >
                <h2
                  className="font-serif font-black text-text"
                  style={{ fontSize: 18, letterSpacing: -0.3 }}
                >
                  {cat.name}
                </h2>
                {cat.en && (
                  <span
                    className="font-mono text-muted uppercase"
                    style={{ fontSize: 10, letterSpacing: 2 }}
                  >
                    {cat.en}
                  </span>
                )}
                <span
                  className="flex-1 self-center"
                  style={{
                    height: 1,
                    background: "linear-gradient(90deg, #262a36, transparent)",
                  }}
                />
                <span className="font-mono text-muted" style={{ fontSize: 11 }}>
                  {filtered.length} items
                </span>
              </div>

              {/* Item grid */}
              <div
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))" }}
              >
                {filtered.map((item, idx) => {
                  const soldOut  = item.isSoldOut === true;
                  const isCombo  = cat.isCombo;
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      soldOut={soldOut}
                      isCombo={isCombo}
                      delay={idx * 15}
                      onAdd={() => addItem(item)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/* ── ItemCard — extracted for clarity ──────────────────── */
interface CardProps {
  item: MenuItem;
  soldOut: boolean;
  isCombo: boolean;
  delay: number;
  onAdd(): void;
}

function ItemCard({ item, soldOut, isCombo, delay, onAdd }: CardProps) {
  const handleClick = useCallback(() => {
    if (!soldOut) onAdd();
  }, [soldOut, onAdd]);

  return (
    <button
      onClick={handleClick}
      disabled={soldOut}
      className={[
        "pos-item-card pos-item-rise relative text-left rounded-xl border",
        "flex flex-col transition-all duration-150",
        soldOut
          ? "opacity-50 cursor-not-allowed border-line bg-panel-2 grayscale"
          : isCombo
            ? "border-[rgba(255,138,61,.25)] cursor-pointer hover:border-[rgba(255,138,61,.5)] hover:-translate-y-px"
            : "border-line bg-panel-2 cursor-pointer hover:border-[rgba(255,138,61,.35)] hover:-translate-y-px hover:bg-panel-3 active:translate-y-0",
      ].join(" ")}
      style={{
        padding: "14px 14px 12px",
        minHeight: 108,
        animationDelay: `${delay}ms`,
        boxShadow: "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -12px rgba(0,0,0,.6)",
        background: isCombo && !soldOut
          ? "linear-gradient(145deg,rgba(255,138,61,.12),#181b24 70%)"
          : undefined,
      }}
    >
      {/* Hover shimmer overlay */}
      {!soldOut && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none opacity-0 transition-opacity duration-200 hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 80% -20%, rgba(255,138,61,.12), transparent 60%)",
          }}
        />
      )}

      {/* Item name */}
      <div
        className="font-medium text-text leading-snug mb-auto relative z-10"
        style={{ fontSize: 14, lineHeight: 1.3 }}
      >
        {item.name}
      </div>

      {item.unit && (
        <div className="text-muted relative z-10" style={{ fontSize: 11, marginBottom: 2 }}>
          {String(item.unit)}
        </div>
      )}

      {/* Price row */}
      <div
        className="flex items-baseline justify-between relative z-10"
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed #262a36",
        }}
      >
        <span className="font-mono font-bold text-accent-2" style={{ fontSize: 15 }}>
          <span className="text-muted font-normal" style={{ fontSize: 10, marginRight: 2 }}>
            NT$
          </span>
          {item.price}
        </span>

        {soldOut ? (
          <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1">售完</span>
        ) : (
          <span
            className="pos-item-add grid place-items-center rounded-[7px] text-text transition-all duration-150"
            style={{
              width: 24,
              height: 24,
              fontSize: 18,
              lineHeight: 1,
              background: "#2a2f3d",
            }}
          >
            +
          </span>
        )}
      </div>
    </button>
  );
}
