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
}

export function CartPanel({ onCheckout }: Props) {
  const {
    parts, lines, customerName, note, paymentMethod, source, pickupTime, lineUserId,
    changeQty, removeLine,
    setCustomerName, setNote, setPaymentMethod, setSource, setPickupTime, setLineUserId,
    getSubtotal, getItemCount,
  } = useCartStore();

  const subtotal = getSubtotal();
  const count = getItemCount();
  const canCheckout = lines.length > 0 && paymentMethod !== "";

  const handleCheckout = () => {
    if (!canCheckout) return;
    void onCheckout({
      parts,
      lines,
      customerName,
      note,
      paymentMethod: paymentMethod as "cash" | "linepay",
      source,
      pickupTime,
      lineUserId,
    });
  };

  return (
    <div className="flex flex-col h-full border-l border-line bg-panel/60">
      <div className="px-5 py-3 border-b border-line shrink-0">
        <h2 className="font-serif font-black text-base">
          購物車
          {count > 0 && (
            <span className="ml-2 text-xs font-mono text-muted">({count} 項)</span>
          )}
        </h2>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {lines.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">尚未選取品項</div>
        ) : (
          lines.map((l) => (
            <div
              key={l.lineId}
              className="flex items-center gap-2 bg-panel-2 border border-line rounded-xl px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{l.name}</div>
                <div className="text-xs text-muted">
                  {l.groupLabel}
                  {l.flavor ? ` · ${l.flavor}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => changeQty(l.lineId, -1)}
                  className="w-6 h-6 rounded-full border border-line text-text-dim hover:bg-panel-3 text-sm leading-none"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-mono tabular-nums">{l.qty}</span>
                <button
                  onClick={() => changeQty(l.lineId, 1)}
                  className="w-6 h-6 rounded-full border border-line text-text-dim hover:bg-panel-3 text-sm leading-none"
                >
                  +
                </button>
              </div>
              <div className="w-14 text-right font-mono text-sm font-black text-accent-2 shrink-0">
                ${l.unitPrice * l.qty}
              </div>
              <button
                onClick={() => removeLine(l.lineId)}
                className="text-muted hover:text-red-400 text-xs px-1 transition-colors"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-4 py-4 space-y-3 shrink-0">
        {/* 訂單來源 */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">來源</p>
          <div className="flex gap-2">
            {(["walk_in", "phone"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={[
                  "flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                  source === s
                    ? "bg-accent text-[#1a0d00] border-accent"
                    : "border-line text-text-dim hover:bg-panel-2",
                ].join(" ")}
              >
                {s === "walk_in" ? "現場" : "電話"}
              </button>
            ))}
          </div>
        </div>

        {/* 付款方式 */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">付款</p>
          <div className="flex gap-2">
            {(["cash", "linepay"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={[
                  "flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
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

        <input
          type="text"
          placeholder="顧客稱呼（選填）"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          placeholder="LINE ID（選填）"
          value={lineUserId}
          onChange={(e) => setLineUserId(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="time"
          placeholder="取餐時間（選填）"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm text-text-dim focus:outline-none focus:border-accent"
        />
        <textarea
          placeholder="備註（選填）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted resize-none focus:outline-none focus:border-accent"
        />

        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted">小計</span>
          <span className="font-mono font-black text-xl text-accent-2">NT${subtotal}</span>
        </div>

        <button
          onClick={handleCheckout}
          disabled={!canCheckout}
          className="w-full py-3 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black text-base hover:brightness-105 disabled:opacity-40 active:scale-[0.98] transition-all shadow"
        >
          確認收款 NT${subtotal}
        </button>
      </div>
    </div>
  );
}
