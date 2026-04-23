import { useUIStore } from "@/stores/ui.store";

const CONFIGS = {
  ok:   { bar: "bg-ready",    icon: "✓", text: "text-ready" },
  err:  { bar: "bg-pending",  icon: "✕", text: "text-red-400" },
  info: { bar: "bg-preparing", icon: "ℹ", text: "text-preparing" },
};

export function Toast() {
  const { toast, hideToast } = useUIStore();

  if (!toast.visible) return null;

  const cfg = CONFIGS[toast.type];

  return (
    <div className="fixed bottom-6 right-6 z-50 toast-slide-in" style={{ width: 300 }}>
      <div className="flex items-stretch rounded-xl border border-line bg-panel shadow-2xl overflow-hidden">
        <div className={`w-1 shrink-0 ${cfg.bar}`} />
        <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
          <span className={`text-base font-bold shrink-0 ${cfg.text}`}>{cfg.icon}</span>
          <span className="text-sm font-semibold text-text flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={hideToast}
            className="text-muted hover:text-text text-xs shrink-0 transition-colors"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
