import { useState, useCallback } from "react";
import type { PosSession } from "@/lib/session";
import { listTodayOrders, type TodayOrder } from "@/services/order-list.service";

const STATUS_LABELS: Record<string, string> = {
  new:       "新訂單",
  accepted:  "已接受",
  preparing: "製作中",
  ready:     "備餐完成",
  completed: "已完成",
  cancelled: "已取消",
};

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "現場",
  phone:   "電話",
  pos:     "POS",
  line:    "LINE",
  liff:    "LIFF",
};

function tsToTime(val: unknown): string {
  if (!val) return "—";
  if (typeof val === "object" && val !== null && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  }
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  session: PosSession;
  onEnterAppend(order: TodayOrder): void;
}

export function OrderListTab({ session, onEnterAppend }: Props) {
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTodayOrders({
        employeeId: session.employeeId,
        sessionToken: session.sessionToken,
      });
      setOrders(rows);
      setLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const completedSet = new Set(["completed", "cancelled"]);
  const q = search.trim().toLowerCase();
  const filtered = orders.filter((o) => {
    if (!q) return true;
    const no = String(o.pickupNumber || "").toLowerCase();
    const name = String(o.customer_name || o.display_name || "").toLowerCase();
    const id = String(o.id || "").toLowerCase();
    return no.includes(q) || name.includes(q) || id.includes(q);
  });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line shrink-0">
        <input
          type="text"
          placeholder="搜尋取餐號 / 顧客名…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-panel-2 border border-line rounded-lg px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-text-dim hover:bg-panel-2 disabled:opacity-50 transition-colors shrink-0"
        >
          {loading ? "載入中…" : loaded ? "重新整理" : "載入"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!loaded && !loading && (
          <div className="text-center text-muted py-16 text-sm">點擊「載入」查看今日訂單</div>
        )}
        {loading && (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <div className="h-4 w-10 rounded bg-panel-2 animate-pulse" />
                <div className="h-4 w-20 rounded bg-panel-2 animate-pulse" />
                <div className="h-4 w-12 rounded bg-panel-2 animate-pulse" />
                <div className="h-4 w-16 rounded bg-panel-2 animate-pulse ml-auto" />
                <div className="h-4 w-14 rounded bg-panel-2 animate-pulse" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="text-center py-8 text-xs text-red-400 px-4">載入失敗：{error}</div>
        )}
        {loaded && !loading && filtered.length === 0 && (
          <div className="text-center text-muted py-16 text-sm">{q ? "無符合搜尋的訂單" : "今日尚無訂單"}</div>
        )}
        {loaded && !loading && filtered.length > 0 && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel border-b border-line">
              <tr>
                <th className="px-3 py-2 text-left text-muted font-semibold">號碼</th>
                <th className="px-3 py-2 text-left text-muted font-semibold">顧客</th>
                <th className="px-3 py-2 text-left text-muted font-semibold">來源</th>
                <th className="px-3 py-2 text-right text-muted font-semibold">金額</th>
                <th className="px-3 py-2 text-left text-muted font-semibold">狀態</th>
                <th className="px-3 py-2 text-left text-muted font-semibold">時間</th>
                <th className="px-3 py-2 text-center text-muted font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((o) => {
                const status = o.status || "new";
                const canAppend = !completedSet.has(status);
                const no = o.pickupNumber ? `#${o.pickupNumber}` : o.id.slice(-6);
                const total = Number(o.total || o.totalAmount || o.subtotal || 0);
                const name = o.customer_name || o.display_name || "—";
                const src = o.source || "pos";
                return (
                  <tr key={o.id} className="hover:bg-panel-2 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold">{no}</td>
                    <td className="px-3 py-2 max-w-[80px] truncate">{name}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-panel-2 border border-line text-muted">
                        {SOURCE_LABELS[src] || src}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-accent-2">NT${total}</td>
                    <td className="px-3 py-2">
                      <span className={[
                        "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                        status === "completed" ? "bg-green-500/20 text-green-400" :
                        status === "cancelled" ? "bg-red-500/20 text-red-400" :
                        status === "ready"     ? "bg-accent/20 text-accent" :
                        "bg-panel-2 border border-line text-muted",
                      ].join(" ")}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{tsToTime(o.createdAt)}</td>
                    <td className="px-3 py-2 text-center">
                      {canAppend && (
                        <button
                          onClick={() => onEnterAppend(o)}
                          className="px-2 py-1 rounded-lg border border-accent/40 text-accent text-[10px] font-semibold hover:bg-accent/10 transition-colors"
                        >
                          追加
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
