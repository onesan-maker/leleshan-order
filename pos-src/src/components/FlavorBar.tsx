import { useMenuStore } from "@/stores/menu.store";
import { useCartStore } from "@/stores/cart.store";

export function FlavorBar() {
  const flavors = useMenuStore((s) => s.flavors);
  const { parts, activePartId, addPart, setActivePart, setPartFlavor, removePart } =
    useCartStore();

  return (
    <div
      className="flex items-center gap-2.5 border-b border-line-soft overflow-x-auto shrink-0"
      style={{ padding: "14px 28px" }}
    >
      {/* Label */}
      <span
        className="text-muted uppercase shrink-0 font-medium"
        style={{ fontSize: 11, letterSpacing: 2, marginRight: 4 }}
      >
        鍋底 / 口味
      </span>

      {parts.map((p) => {
        const active = p.id === activePartId;
        return (
          <div
            key={p.id}
            className={[
              "inline-flex items-center gap-2 rounded-full border shrink-0 transition-all duration-150",
              active
                ? "border-accent text-accent-2 font-bold"
                : "border-line text-muted hover:text-text hover:border-panel-4",
            ].join(" ")}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              background: active
                ? "linear-gradient(180deg,rgba(255,138,61,.20),rgba(255,138,61,.08))"
                : "#181b24",
            }}
          >
            <button
              onClick={() => setActivePart(p.id)}
              className="font-semibold leading-none"
            >
              {p.label}
            </button>

            <select
              value={p.flavorId ?? ""}
              onChange={(e) => {
                const f = flavors.find((fl) => fl.id === e.target.value);
                setPartFlavor(p.id, f?.id ?? null, f?.name ?? "");
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs bg-transparent border-none outline-none cursor-pointer text-muted"
              style={{ maxWidth: 80, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 12 }}
            >
              <option value="">未選口味</option>
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            {parts.length > 1 && (
              <button
                onClick={() => removePart(p.id)}
                className="text-muted hover:text-pending text-xs leading-none ml-0.5 transition-colors"
                title="移除此組"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* Add group button */}
      <button
        onClick={addPart}
        className="shrink-0 rounded-full border border-dashed border-accent text-accent
                   hover:bg-accent hover:text-[#1a0d00] transition-all duration-150"
        style={{ padding: "7px 14px", fontSize: 13, background: "transparent" }}
      >
        ＋ 新增組別
      </button>

      {/* Apply-all button */}
      <button
        className="ml-auto shrink-0 rounded-lg border border-line text-muted hover:text-text
                   transition-colors font-medium"
        style={{ padding: "7px 14px", fontSize: 12, fontFamily: "inherit", background: "#181b24" }}
      >
        套用至全品項 ↗
      </button>
    </div>
  );
}
