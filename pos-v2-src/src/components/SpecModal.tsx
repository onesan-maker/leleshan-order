import { useState } from "react";
import { useCartStore } from "@/stores/cart.store";
import { useMenuStore } from "@/stores/menu.store";

export function SpecModal() {
  const pendingSpec = useCartStore((s) => s.pendingSpec);
  const pendingSpecMode = useCartStore((s) => s.pendingSpecMode);
  const confirmSpec = useCartStore((s) => s.confirmSpec);
  const cancelSpec = useCartStore((s) => s.cancelSpec);
  const activePartId = useCartStore((s) => s.activePartId);
  const setPartFlavor = useCartStore((s) => s.setPartFlavor);
  const flavors = useMenuStore((s) => s.flavors);
  const staples = useMenuStore((s) => s.staples);

  const [flavor, setFlavor] = useState("");
  const [staple, setStaple] = useState("");
  const [error, setError] = useState("");

  if (!pendingSpec) return null;

  const isFlavorOnly = pendingSpecMode === "flavorOnly";

  const itemFlavors: string[] = Array.isArray((pendingSpec as Record<string, unknown>).flavorOptions)
    ? (pendingSpec as Record<string, unknown>).flavorOptions as string[]
    : [];
  const flavorList = itemFlavors.length ? itemFlavors : flavors.map((f) => f.name);

  const itemStaples: string[] = Array.isArray((pendingSpec as Record<string, unknown>).stapleOptions)
    ? (pendingSpec as Record<string, unknown>).stapleOptions as string[]
    : [];
  const stapleList = isFlavorOnly ? [] : (itemStaples.length ? itemStaples : staples);

  const handleConfirm = () => {
    if (!flavor && flavorList.length > 0) { setError("請選擇口味"); return; }
    if (!staple && stapleList.length > 0) { setError("請選擇主食"); return; }

    if (isFlavorOnly) {
      // Write chosen flavor back to the active part so subsequent inherit items share it
      const matchedFlavor = flavors.find((f) => f.name === flavor);
      setPartFlavor(activePartId, matchedFlavor?.id ?? null, flavor);
    }

    confirmSpec(flavor, staple);
    setFlavor("");
    setStaple("");
    setError("");
  };

  const handleCancel = () => {
    cancelSpec();
    setFlavor("");
    setStaple("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel border border-line rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line">
          <div className="text-xs text-muted mb-0.5">{isFlavorOnly ? "選擇口味" : "選擇規格"}</div>
          <div className="font-serif font-black text-base">{pendingSpec.name}</div>
          <div className="font-mono text-accent-2 text-sm font-bold">${pendingSpec.price}</div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Flavor */}
          {flavorList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-text-dim mb-2">口味 <span className="text-red-400">*</span></div>
              <div className="grid grid-cols-3 gap-1.5">
                {flavorList.map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFlavor(f); setError(""); }}
                    className={[
                      "py-2 rounded-xl border text-xs font-semibold transition-all",
                      flavor === f
                        ? "bg-accent text-[#1a0d00] border-accent"
                        : "border-line text-text-dim hover:bg-panel-2",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Staple — hidden in flavorOnly mode */}
          {!isFlavorOnly && stapleList.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-text-dim mb-2">主食 <span className="text-red-400">*</span></div>
              <div className="grid grid-cols-3 gap-1.5">
                {stapleList.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStaple(s); setError(""); }}
                    className={[
                      "py-2 rounded-xl border text-xs font-semibold transition-all",
                      staple === s
                        ? "bg-accent text-[#1a0d00] border-accent"
                        : "border-line text-text-dim hover:bg-panel-2",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-xl border border-line text-xs font-semibold text-text-dim hover:bg-panel-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-2 flex-1 py-2.5 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] text-xs font-black transition-all hover:brightness-105 active:scale-95"
          >
            加入購物車
          </button>
        </div>
      </div>
    </div>
  );
}
