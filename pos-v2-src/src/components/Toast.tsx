import { useUIStore } from "@/stores/ui.store";

const TYPE_CLASSES = {
  ok: "bg-ready/20 border-ready/40 text-ready",
  err: "bg-red-500/10 border-red-500/30 text-red-400",
  info: "bg-panel-2 border-line text-text-dim",
};

export function Toast() {
  const { toast, hideToast } = useUIStore();

  if (!toast.visible) return null;

  return (
    <div
      className={[
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-xl text-sm font-semibold max-w-sm",
        TYPE_CLASSES[toast.type],
      ].join(" ")}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={hideToast}
        className="opacity-60 hover:opacity-100 text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}
