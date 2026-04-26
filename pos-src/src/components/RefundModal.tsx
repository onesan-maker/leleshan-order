import { useState } from "react";
import type { PosSession } from "@/lib/session";
import { hubClient } from "@/lib/hub-client";
import type { TodayOrder } from "@/services/order-list.service";

interface Props {
  order: TodayOrder;
  session: PosSession;
  onSuccess(newStatus: string, newRefundedAmount: number): void;
  onClose(): void;
}

const METHOD_LABELS: Record<string, string> = {
  cash:      "現金",
  card:      "刷卡",
  line_pay:  "LINE Pay",
  transfer:  "轉帳",
  other:     "其他",
};

export function RefundModal({ order, session, onSuccess, onClose }: Props) {
  const orderTotal   = Number(order.total || order.totalAmount || order.subtotal || 0);
  const alreadyRefunded = Number(order.refunded_amount || 0);
  const remaining    = orderTotal - alreadyRefunded;

  const [amount,  setAmount ] = useState<string>(String(remaining > 0 ? remaining : ""));
  const [method,  setMethod ] = useState("cash");
  const [reason,  setReason ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState("");

  const orderLabel = order.pickupNumber ? `#${order.pickupNumber}` : order.id.slice(-6);

  const handleConfirm = async () => {
    setError("");
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      setError("請輸入有效的退款金額");
      return;
    }
    if (parsed > remaining) {
      setError(`退款金額不可超過可退金額 NT$${remaining}`);
      return;
    }

    setLoading(true);
    try {
      const result = await hubClient.refundOrder(
        order.id,
        parsed,
        method,
        { actorId: session.employeeId, actorName: session.employeeName },
        reason.trim() || undefined,
      );
      onSuccess(result.status, result.refunded_amount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "退款失敗，請再試一次");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel border border-line rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="font-serif font-black text-base">退款 — 訂單 {orderLabel}</div>
          <button onClick={onClose} className="text-muted hover:text-text text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3.5">

          {/* Order summary */}
          <div className="text-xs text-muted space-y-0.5">
            <div>
              顧客：<span className="text-text">{order.customer_name || order.display_name || "—"}</span>
            </div>
            <div>
              訂單金額：<span className="font-mono font-bold text-text">NT${orderTotal}</span>
              {alreadyRefunded > 0 && (
                <span className="ml-2 text-amber-400">（已退 NT${alreadyRefunded}，可退 NT${remaining}）</span>
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-muted mb-1.5 font-semibold">退款金額（元）</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted focus:outline-none focus:border-accent"
              placeholder={`最多 NT$${remaining}`}
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs text-muted mb-1.5 font-semibold">退款方式</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(METHOD_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMethod(val)}
                  className={[
                    "py-2 rounded-lg text-xs font-semibold border transition-colors",
                    method === val
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-panel-2 border-line text-text-dim hover:border-accent/50",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-muted mb-1.5 font-semibold">退款原因（選填）</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-xs placeholder:text-muted focus:outline-none focus:border-accent resize-none"
              placeholder="ex: 顧客不滿意、品項缺貨…"
            />
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-xs font-semibold text-text-dim hover:bg-panel-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || remaining <= 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] text-xs font-black disabled:opacity-50 transition-all hover:brightness-105"
          >
            {loading ? "處理中…" : "確認退款"}
          </button>
        </div>
      </div>
    </div>
  );
}
