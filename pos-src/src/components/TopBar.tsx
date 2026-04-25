import { useState, useEffect } from "react";
import type { PosSession } from "@/lib/session";
import { useHubStatusStore } from "@/stores/hub-status.store";

interface Props {
  session: PosSession;
  storeName: string;
  searchQuery: string;
  onSearchChange(q: string): void;
}

function useClock() {
  const fmt = () =>
    new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const id = window.setInterval(() => setTime(fmt()), 10000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function HubBadge() {
  const { isHealthy, lastCheckAt } = useHubStatusStore();
  const tip = lastCheckAt
    ? `最後連線 ${lastCheckAt.toLocaleTimeString("zh-TW")}`
    : "尚未檢查";
  if (isHealthy) return null;
  return (
    <span title={tip} className="inline-flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-full bg-pending" />
      <span className="text-[10px] font-semibold text-pending">本機離線</span>
    </span>
  );
}

export function TopBar({ session, storeName, searchQuery, onSearchChange }: Props) {
  const time   = useClock();
  const online = useOnline();

  return (
    <div
      className="flex items-center gap-5 border-b border-line-soft shrink-0"
      style={{ padding: "20px 28px 14px" }}
    >
      {/* Left: title + meta */}
      <div className="shrink-0">
        <h1
          className="font-serif font-black flex items-center gap-2.5 text-text"
          style={{ fontSize: 22, letterSpacing: -0.5 }}
        >
          <span
            className="inline-block rounded-sm bg-accent shrink-0"
            style={{ width: 4, height: 22 }}
          />
          現場點餐
        </h1>
        <div
          className="font-mono text-muted flex items-center gap-1.5 flex-wrap"
          style={{ fontSize: 12, marginTop: 4, marginLeft: 14, letterSpacing: ".5px" }}
        >
          <span>{session.storeId}</span>
          <span>·</span>
          <span className="text-text-dim">{storeName}</span>
          <span>·</span>
          <span className="text-text-dim">{time}</span>
          <HubBadge />
          {!online && (
            <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold">
              離線中
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-1" style={{ maxWidth: 380 }}>
        <span
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted select-none pointer-events-none"
          style={{ fontSize: 15 }}
        >
          ⌕
        </span>
        <input
          type="text"
          placeholder="搜尋品項… (如：毛肚、麵)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-panel-2 border border-line rounded-[10px] text-text font-sans
                     placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          style={{ padding: "11px 16px 11px 40px", fontSize: 14 }}
        />
      </div>
    </div>
  );
}
