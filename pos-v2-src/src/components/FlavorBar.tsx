import { useMenuStore } from "@/stores/menu.store";
import { useCartStore } from "@/stores/cart.store";

export function FlavorBar() {
  const flavors = useMenuStore((s) => s.flavors);
  const { parts, activePartId, addPart, setActivePart, setPartFlavor, removePart } = useCartStore();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-panel-2 overflow-x-auto shrink-0">
      {parts.map((p) => (
        <div
          key={p.id}
          className={[
            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm shrink-0 transition-colors",
            p.id === activePartId
              ? "border-accent bg-accent/10 text-text"
              : "border-line bg-panel text-text-dim",
          ].join(" ")}
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
            className="text-xs bg-transparent border-none outline-none cursor-pointer text-muted max-w-[80px]"
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
              className="text-muted hover:text-red-400 text-xs leading-none ml-0.5 transition-colors"
              title="移除此組"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        onClick={addPart}
        className="shrink-0 px-3 py-1.5 rounded-xl border border-dashed border-line text-muted hover:border-accent hover:text-accent text-sm transition-colors"
      >
        ＋新增口味組
      </button>
    </div>
  );
}
