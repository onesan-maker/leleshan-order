import { useCartStore } from "@/stores/cart.store";

interface Props {
  onCheckout(): void;
  submitting: boolean;
}

export function CartPanel({ onCheckout, submitting }: Props) {
  const { lines, note, paymentMethod, customerName, updateQty, removeItem, setNote, setPaymentMethod, setCustomerName } =
    useCartStore();

  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  return (
    <div className="flex flex-col h-full border-l border-line bg-panel/60">
      <div className="px-5 py-3 border-b border-line">
        <h2 className="font-serif font-black text-base">購物車</h2>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {lines.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">尚無品項</div>
        ) : (
          lines.map((l) => (
            <div key={l.lineId} className="flex items-center gap-2 bg-panel-2 border border-line rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{l.name}</div>
                <div className="text-xs text-muted">
                  {l.groupLabel}
                  {l.flavor ? ` · ${l.flavor}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(l.lineId, -1)}
                  className="w-6 h-6 rounded-full border border-line text-text-dim hover:bg-panel-3 text-sm leading-none"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-mono tabular-nums">{l.qty}</span>
                <button
                  onClick={() => updateQty(l.lineId, 1)}
                  className="w-6 h-6 rounded-full border border-line text-text-dim hover:bg-panel-3 text-sm leading-none"
                >
                  +
                </button>
              </div>
              <div className="w-16 text-right font-mono text-sm font-black text-accent-2">
                ${l.unitPrice * l.qty}
              </div>
              <button
                onClick={() => removeItem(l.lineId)}
                className="text-muted hover:text-red-400 text-xs px-1"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-4 py-4 space-y-3">
        <input
          type="text"
          placeholder="顧客名稱（選填）"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <textarea
          placeholder="備註（選填）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted resize-none focus:outline-none focus:border-accent"
        />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
        >
          <option value="cash">現金</option>
          <option value="card">刷卡</option>
          <option value="transfer">轉帳</option>
          <option value="line_pay">LINE Pay</option>
        </select>

        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted">合計</span>
          <span className="font-mono font-black text-xl text-accent-2">${total}</span>
        </div>

        <button
          onClick={onCheckout}
          disabled={lines.length === 0 || submitting}
          className="w-full py-3 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black text-base hover:brightness-105 disabled:opacity-40 active:scale-98 transition-all shadow"
        >
          {submitting ? "送出中…" : "確認送出"}
        </button>
      </div>
    </div>
  );
}
