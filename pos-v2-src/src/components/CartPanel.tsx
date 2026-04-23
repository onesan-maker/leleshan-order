import { useState } from "react";
import { useCartStore, type FlavorPart, type CartLine } from "@/stores/cart.store";

export interface CheckoutPayload {
  parts: FlavorPart[];
  lines: CartLine[];
  customerName: string;
  note: string;
  paymentMethod: "cash" | "linepay";
  source: "walk_in" | "phone";
  pickupTime: string;
  lineUserId: string;
}

interface Props {
  onCheckout: (payload: CheckoutPayload) => Promise<void>;
  onAppendCheckout: () => Promise<void>;
}

export function CartPanel({ onCheckout, onAppendCheckout }: Props) {
  const {
    parts, lines, customerName, note, paymentMethod, source, pickupTime, lineUserId,
    appendTarget,
    changeQty, removeLine,
    setCustomerName, setNote, setPaymentMethod, setSource, setPickupTime, setLineUserId,
    getSubtotal, getItemCount,
  } = useCartStore();

  const [moreOpen, setMoreOpen] = useState(false);

  const subtotal = getSubtotal();
  const count = getItemCount();
  const isAppend = appendTarget !== null;
  const canCheckout = lines.length > 0 && (isAppend || paymentMethod !== "");

  const handleCheckout = () => {
    if (!canCheckout) return;
    if (isAppend) {
      void onAppendCheckout();
    } else {
      void onCheckout({
        parts, lines, customerName, note,
        paymentMethod: paymentMethod as "cash" | "linepay",
        source, pickupTime, lineUserId,
      });
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-line bg-panel/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-line shrink-0">
        <h2 className="font-serif font-black text-sm">
          {isAppend ? "追加品項" : "購物車"}
          {count > 0 && (
            <span className="ml-2 text-xs font-mono text-muted font-normal">({count} 項)</span>
          )}
        </h2>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted py-12">
            <div className="text-4xl opacity-40">🛒</div>
            <div className="text-sm">尚未選取品項</div>
            <div className="text-xs opacity-60">點左側品項加入購物車</div>
          </div>
        ) : (
          <div>
            {lines.map((l) => (
              <div key={l.lineId} className="px-3 py-2.5 border-b border-line last:border-b-0">
                {/* Row 1: name + group pill + price */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 min-w-0 text-sm font-semibold leading-tight truncate">{l.name}</div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent-2 text-[10px] font-mono font-bold border border-accent/20 shrink-0">
                    {l.groupLabel}
                  </span>
                  <div className="font-mono text-sm font-black text-accent-2 shrink-0 w-12 text-right">
                    ${l.unitPrice * l.qty}
                  </div>
                </div>
                {/* Row 2: flavor/staple + qty controls + delete */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 text-[11px] text-muted leading-tight">
                    {[l.flavor, l.staple].filter(Boolean).join(" / ") || <span className="opacity-30">—</span>}
                  </div>
                  <div className="inline-flex items-center gap-0.5 bg-panel-2 rounded-lg p-0.5 border border-line shrink-0">
                    <button
                      onClick={() => changeQty(l.lineId, -1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-text-dim hover:bg-panel-3 hover:text-text text-sm leading-none transition-colors"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-mono tabular-nums">{l.qty}</span>
                    <button
                      onClick={() => changeQty(l.lineId, 1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-text-dim hover:bg-panel-3 hover:text-text text-sm leading-none transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeLine(l.lineId)}
                    className="text-muted hover:text-red-400 text-xs w-5 text-center shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 border-t border-line">
        {/* Subtotal */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-line">
          <span className="text-xs text-muted">小計</span>
          <span className="font-mono font-black text-lg text-accent-2">NT${subtotal}</span>
        </div>

        {/* Source + Payment chips — hidden in append mode */}
        {!isAppend && (
          <div className="px-3 py-2 space-y-2 border-b border-line">
            <div className="flex gap-1.5">
              {(["walk_in", "phone"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={[
                    "flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                    source === s
                      ? "bg-accent text-[#1a0d00] border-accent"
                      : "border-line text-text-dim hover:bg-panel-2",
                  ].join(" ")}
                >
                  {s === "walk_in" ? "現場" : "電話"}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(["cash", "linepay"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={[
                    "flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                    paymentMethod === m
                      ? "bg-accent text-[#1a0d00] border-accent"
                      : "border-line text-text-dim hover:bg-panel-2",
                  ].join(" ")}
                >
                  {m === "cash" ? "現金" : "LINE Pay"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible more options — hidden in append mode */}
        {!isAppend && (
          <div className="border-b border-line">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted hover:text-text transition-colors"
            >
              <span>更多選項（顧客稱呼 / 備註）</span>
              <span className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            {moreOpen && (
              <div className="px-3 pb-3 space-y-2">
                <input
                  type="text"
                  placeholder="顧客稱呼（選填）"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-panel-2 border border-line rounded-lg px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="LINE ID（選填）"
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  className="w-full bg-panel-2 border border-line rounded-lg px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full bg-panel-2 border border-line rounded-lg px-3 py-1.5 text-xs text-text-dim focus:outline-none focus:border-accent"
                />
                <textarea
                  placeholder="備註（選填）"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full bg-panel-2 border border-line rounded-lg px-3 py-1.5 text-xs placeholder:text-muted resize-none focus:outline-none focus:border-accent"
                />
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="px-3 py-3">
          <button
            onClick={handleCheckout}
            disabled={!canCheckout}
            className="w-full rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black text-base hover:brightness-105 disabled:opacity-40 active:scale-[0.98] transition-all shadow"
            style={{ height: 56 }}
          >
            {isAppend
              ? `追加到訂單 NT$${subtotal}`
              : `確認收款 NT$${subtotal}`}
          </button>
        </div>
      </div>
    </div>
  );
}
