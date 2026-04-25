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

  const subtotal   = getSubtotal();
  const count      = getItemCount();
  const isAppend   = appendTarget !== null;
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
    <div
      className="flex flex-col border-l border-line-soft overflow-hidden"
      style={{ background: "#111319" }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="border-b border-line-soft shrink-0"
        style={{ padding: "24px 22px 16px" }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="font-serif font-black text-text flex items-center gap-2.5"
            style={{ fontSize: 18 }}
          >
            <span
              className="inline-block rounded-sm bg-accent shrink-0"
              style={{ width: 4, height: 18 }}
            />
            {isAppend ? "追加品項" : "購物車"}
            {count > 0 && (
              <span className="font-mono text-muted font-normal ml-1" style={{ fontSize: 11 }}>
                ({count} 項)
              </span>
            )}
          </h2>
          {!isAppend && (
            <button
              onClick={() => useCartStore.getState().clear()}
              className="text-muted hover:text-pending hover:bg-panel-2 rounded-md transition-colors"
              style={{ fontSize: 12, padding: "6px 10px", fontFamily: "inherit", background: "none", border: "none", cursor: "pointer" }}
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* ── Line items ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: "10px 22px" }}>
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted py-12">
            <div
              className="rounded-full bg-panel-2 grid place-items-center opacity-50"
              style={{ width: 60, height: 60, fontSize: 26 }}
            >
              🍲
            </div>
            <div style={{ fontSize: 13 }}>尚未選取品項</div>
            <div style={{ fontSize: 11, color: "#6b6e79" }}>點選左側品項加入購物車</div>
          </div>
        ) : (
          <div>
            {lines.map((l) => (
              <div
                key={l.lineId}
                className="last:border-b-0"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "8px 14px",
                  padding: "14px 0",
                  borderBottom: "1px dashed #1d212b",
                  alignItems: "center",
                }}
              >
                {/* Name + group pill */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex-1 min-w-0 font-medium text-text leading-tight truncate"
                    style={{ fontSize: 14 }}
                  >
                    {l.name}
                  </div>
                  <span
                    className="inline-flex items-center rounded-full border border-accent/20 shrink-0 font-mono font-bold"
                    style={{
                      padding: "1px 7px",
                      fontSize: 10,
                      background: "rgba(255,138,61,.1)",
                      color: "#ffb347",
                    }}
                  >
                    {l.groupLabel}
                  </span>
                </div>

                {/* Price */}
                <div
                  className="font-mono font-black text-accent-2 text-right shrink-0"
                  style={{ fontSize: 14 }}
                >
                  NT${l.unitPrice * l.qty}
                </div>

                {/* Flavor / staple + qty controls + delete */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0 text-muted leading-tight truncate" style={{ fontSize: 11 }}>
                    {[l.flavor, l.staple].filter(Boolean).join(" / ") || (
                      <span style={{ opacity: .3 }}>—</span>
                    )}
                  </div>
                  {/* Qty control */}
                  <div
                    className="inline-flex items-center gap-0.5 rounded-lg border border-line shrink-0"
                    style={{ padding: 3, background: "#181b24" }}
                  >
                    <button
                      onClick={() => changeQty(l.lineId, -1)}
                      className="rounded-md flex items-center justify-center text-text-dim hover:bg-panel-3 hover:text-text transition-colors"
                      style={{ width: 22, height: 22, fontSize: 14, lineHeight: 1 }}
                    >
                      −
                    </button>
                    <span
                      className="text-center font-mono tabular-nums"
                      style={{ width: 20, fontSize: 12 }}
                    >
                      {l.qty}
                    </span>
                    <button
                      onClick={() => changeQty(l.lineId, 1)}
                      className="rounded-md flex items-center justify-center text-text-dim hover:bg-panel-3 hover:text-text transition-colors"
                      style={{ width: 22, height: 22, fontSize: 14, lineHeight: 1 }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeLine(l.lineId)}
                    className="text-muted hover:text-pending transition-colors shrink-0"
                    style={{ fontSize: 11, width: 18, textAlign: "center" }}
                  >
                    ✕
                  </button>
                </div>

                {/* (empty grid cell to align delete button) */}
                <div />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div
        className="shrink-0 border-t border-line-soft"
        style={{ background: "linear-gradient(180deg, transparent, rgba(255,138,61,.04))" }}
      >
        {/* Stats */}
        <div style={{ padding: "18px 22px 14px" }}>
          <div className="flex flex-col gap-1.5" style={{ fontSize: 13, marginBottom: 14 }}>
            <div className="flex justify-between text-text-dim">
              <span>小計</span>
              <span className="font-mono">NT${subtotal}</span>
            </div>
            <div className="flex justify-between text-text-dim">
              <span>品項數</span>
              <span className="font-mono">{count}</span>
            </div>
            <div
              className="flex justify-between text-text font-bold"
              style={{
                marginTop: 8,
                paddingTop: 10,
                fontSize: 15,
                borderTop: "1px solid #1d212b",
              }}
            >
              <span>合計</span>
              <span className="font-mono text-accent-2" style={{ fontSize: 22 }}>
                <span className="text-muted font-normal" style={{ fontSize: 11, marginRight: 3 }}>NT$</span>
                {subtotal}
              </span>
            </div>
          </div>

          {/* Source + payment chips (hidden in append mode) */}
          {!isAppend && (
            <div className="space-y-2" style={{ marginBottom: 8 }}>
              <div className="flex gap-1.5">
                {(["walk_in", "phone"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={[
                      "flex-1 rounded-lg border text-xs font-semibold transition-colors",
                      source === s
                        ? "bg-accent text-[#1a0d00] border-accent"
                        : "border-line text-text-dim hover:bg-panel-2",
                    ].join(" ")}
                    style={{ padding: "6px 0", fontFamily: "inherit" }}
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
                      "flex-1 rounded-lg border text-xs font-semibold transition-colors",
                      paymentMethod === m
                        ? "bg-accent text-[#1a0d00] border-accent"
                        : "border-line text-text-dim hover:bg-panel-2",
                    ].join(" ")}
                    style={{ padding: "6px 0", fontFamily: "inherit" }}
                  >
                    {m === "cash" ? "現金" : "LINE Pay"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* More options (hidden in append mode) */}
          {!isAppend && (
            <div className="border-t border-line-soft" style={{ marginBottom: 12 }}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="w-full flex items-center justify-between text-muted hover:text-text transition-colors"
                style={{ padding: "10px 0", fontSize: 12, fontFamily: "inherit", background: "none", border: "none", cursor: "pointer" }}
              >
                <span>顧客稱呼 / 備註 / 時段</span>
                <span
                  className="transition-transform"
                  style={{ transform: moreOpen ? "rotate(180deg)" : undefined }}
                >
                  ▾
                </span>
              </button>
              {moreOpen && (
                <div className="flex flex-col gap-2" style={{ paddingBottom: 10 }}>
                  {[
                    { placeholder: "顧客稱呼（選填）", value: customerName, onChange: setCustomerName },
                    { placeholder: "LINE ID（選填）",   value: lineUserId,   onChange: setLineUserId },
                  ].map(({ placeholder, value, onChange }) => (
                    <input
                      key={placeholder}
                      type="text"
                      placeholder={placeholder}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full rounded-lg border border-line text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                      style={{ background: "#181b24", padding: "6px 12px", fontSize: 12 }}
                    />
                  ))}
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full rounded-lg border border-line text-text-dim focus:outline-none focus:border-accent transition-colors"
                    style={{ background: "#181b24", padding: "6px 12px", fontSize: 12 }}
                  />
                  <textarea
                    placeholder="備註（選填）"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-line text-text placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors"
                    style={{ background: "#181b24", padding: "6px 12px", fontSize: 12 }}
                  />
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={!canCheckout}
            className="w-full rounded-xl font-serif font-black disabled:opacity-40 disabled:pointer-events-none
                       transition-all hover:-translate-y-px active:translate-y-0"
            style={{
              padding: 16,
              fontSize: 16,
              letterSpacing: 4,
              color: "#1a0d00",
              background: "linear-gradient(180deg, #ffb347, #ff8a3d)",
              boxShadow: canCheckout
                ? "0 20px 50px -20px rgba(255,138,61,.4)"
                : undefined,
              border: "none",
              cursor: canCheckout ? "pointer" : "not-allowed",
            }}
          >
            {isAppend
              ? `追加到訂單　NT$${subtotal}`
              : `確認收款　NT$${subtotal}`}
          </button>
        </div>
      </div>
    </div>
  );
}
