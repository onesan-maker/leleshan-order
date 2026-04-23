import { useState } from "react";
import type { Flavor } from "@/services/menu.service";

const STAPLE_OPTIONS = ["", "白飯", "稀飯", "麵"];

interface Props {
  flavors: Flavor[];
  partIndex: number;
  onConfirm(flavor: string, staple: string): void;
  onClose(): void;
}

export function PartFlavorPicker({ flavors, partIndex, onConfirm, onClose }: Props) {
  const [flavor, setFlavor] = useState(flavors[0]?.name ?? "");
  const [staple, setStaple] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel border border-line rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <h2 className="font-serif text-xl font-black">
          第 {partIndex} 組 — 選擇口味
        </h2>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-2">口味</p>
          <div className="grid grid-cols-2 gap-2">
            {flavors.map((f) => (
              <button
                key={f.id}
                onClick={() => setFlavor(f.name)}
                className={[
                  "px-3 py-2 rounded-xl border text-sm font-semibold text-left transition-colors",
                  flavor === f.name
                    ? "bg-accent text-[#1a0d00] border-accent"
                    : "bg-panel-2 border-line text-text hover:bg-panel-3",
                ].join(" ")}
              >
                <div>{f.name}</div>
                {f.spicyLabel && (
                  <div className="text-xs opacity-60 mt-0.5">{f.spicyLabel}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-2">主食（可選）</p>
          <div className="flex gap-2 flex-wrap">
            {STAPLE_OPTIONS.map((s) => (
              <button
                key={s || "none"}
                onClick={() => setStaple(s)}
                className={[
                  "px-3 py-1.5 rounded-full border text-sm transition-colors",
                  staple === s
                    ? "bg-accent text-[#1a0d00] border-accent font-semibold"
                    : "border-line text-text-dim hover:bg-panel-2",
                ].join(" ")}
              >
                {s || "（不選）"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-text-dim hover:bg-panel-2 text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(flavor, staple)}
            disabled={!flavor}
            className="flex-1 py-2.5 rounded-xl bg-accent text-[#1a0d00] font-black text-sm hover:brightness-105 disabled:opacity-40 transition-all"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
