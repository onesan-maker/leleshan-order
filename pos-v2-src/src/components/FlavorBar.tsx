import type { FlavorPart } from "@/stores/cart.store";

interface Props {
  parts: FlavorPart[];
  activeId: string;
  onSelect(id: string): void;
  onAdd(): void;
}

export function FlavorBar({ parts, activeId, onSelect, onAdd }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-panel-2 overflow-x-auto">
      {parts.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={[
            "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
            p.id === activeId
              ? "bg-accent text-[#1a0d00] border-accent shadow"
              : "bg-panel border-line text-text-dim hover:bg-panel-3",
          ].join(" ")}
        >
          <span>{p.groupLabel}</span>
          {p.flavor && (
            <span className="ml-1.5 text-xs opacity-70">· {p.flavor}</span>
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="flex-shrink-0 w-8 h-8 rounded-full border border-dashed border-line text-muted hover:border-accent hover:text-accent text-lg leading-none transition-colors"
        title="新增口味組"
      >
        +
      </button>
    </div>
  );
}
