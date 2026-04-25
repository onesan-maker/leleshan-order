import { useMenuStore } from "@/stores/menu.store";
import type { PosSession } from "@/lib/session";

const COMBO_CAT_ID = "__combos__";

function catEmoji(name: string): string {
  if (/套餐|combo/i.test(name)) return "🍲";
  if (/肉|meat/i.test(name)) return "🥩";
  if (/蔬|菜|veg/i.test(name)) return "🥬";
  if (/火鍋料|pot/i.test(name)) return "🍢";
  if (/特色|special/i.test(name)) return "⭐";
  if (/主食|main|staple/i.test(name)) return "🍜";
  if (/飲|drink/i.test(name)) return "🥤";
  if (/甜|dessert/i.test(name)) return "🍨";
  return "🍽";
}

interface Props {
  session: PosSession;
  activeCatId: string | null;
  onCatClick(id: string): void;
  onLogout(): void;
  onSwitchEmployee(): void;
}

export function Sidebar({
  session,
  activeCatId,
  onCatClick,
  onLogout,
  onSwitchEmployee,
}: Props) {
  const categories = useMenuStore((s) => s.categories);
  const items      = useMenuStore((s) => s.items);
  const combos     = useMenuStore((s) => s.combos);
  const loaded     = useMenuStore((s) => s.loaded);

  const allCategories = [
    ...(combos.length > 0 ? [{ id: COMBO_CAT_ID, name: "套餐" }] : []),
    ...categories,
  ];

  const countMap = new Map<string, number>();
  if (combos.length > 0) countMap.set(COMBO_CAT_ID, combos.length);
  for (const cat of categories) {
    countMap.set(cat.id, items.filter((i) => i.categoryId === cat.id).length);
  }

  return (
    <aside
      className="flex flex-col bg-panel border-r border-line-soft overflow-y-auto shrink-0"
      style={{ padding: "22px 14px" }}
    >
      {/* ── Brand ───────────────────────────────────────── */}
      <div
        className="flex items-baseline gap-2.5 border-b border-line-soft"
        style={{ padding: "6px 10px 20px", marginBottom: 18 }}
      >
        <span
          className="font-serif text-accent"
          style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}
        >
          樂樂山
        </span>
        <span
          className="font-mono text-muted uppercase"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          POS · v1
        </span>
      </div>

      {/* ── Nav label ───────────────────────────────────── */}
      <div
        className="font-bold text-muted uppercase"
        style={{ fontSize: 10, letterSpacing: "2.5px", padding: "0 12px 10px" }}
      >
        分類導覽
      </div>

      {/* ── Category list ───────────────────────────────── */}
      <nav className="flex flex-col gap-0.5">
        {!loaded
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded-[10px] bg-panel-2 animate-pulse" />
            ))
          : allCategories.map((cat) => {
              const cnt    = countMap.get(cat.id) ?? 0;
              const active = cat.id === activeCatId;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCatClick(cat.id)}
                  className={[
                    "flex items-center gap-3 rounded-[10px] border text-sm font-medium",
                    "transition-all duration-150 text-left w-full",
                    active
                      ? "border-[rgba(255,138,61,.25)] text-accent-2"
                      : "border-transparent text-text-dim hover:bg-panel-2 hover:text-text",
                  ].join(" ")}
                  style={{
                    padding: "10px 12px",
                    background: active
                      ? "linear-gradient(180deg,rgba(255,138,61,.18),rgba(255,138,61,.06))"
                      : undefined,
                  }}
                >
                  <span
                    className={[
                      "shrink-0 grid place-items-center rounded-[7px] text-base",
                      active ? "bg-[rgba(255,138,61,.18)]" : "bg-panel-2",
                    ].join(" ")}
                    style={{ width: 26, height: 26 }}
                  >
                    {catEmoji(cat.name)}
                  </span>
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className="font-mono text-muted shrink-0" style={{ fontSize: 11 }}>
                    {cnt}
                  </span>
                </button>
              );
            })}
      </nav>

      {/* ── Footer: shift card + actions ────────────────── */}
      <div
        className="mt-auto border-t border-line-soft flex flex-col gap-2"
        style={{ padding: "14px 10px" }}
      >
        <div
          className="bg-panel-2 border border-line rounded-[10px]"
          style={{ padding: "10px 12px" }}
        >
          <div
            className="text-muted uppercase mb-1"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            Current Shift
          </div>
          <div
            className="font-bold text-text flex items-center gap-1.5"
            style={{ fontSize: 14 }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-ready shrink-0"
              style={{ boxShadow: "0 0 8px #7dd67b" }}
            />
            {session.employeeName}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={onSwitchEmployee}
            className="flex-1 py-2 rounded-lg border border-line text-muted hover:bg-panel-2 hover:text-text transition-colors font-medium"
            style={{ fontSize: 12, fontFamily: "inherit" }}
          >
            切換員工
          </button>
          <button
            onClick={onLogout}
            className="flex-1 py-2 rounded-lg border border-line text-muted hover:bg-panel-2 hover:text-text transition-colors font-medium"
            style={{ fontSize: 12, fontFamily: "inherit" }}
          >
            登出
          </button>
        </div>
      </div>
    </aside>
  );
}
