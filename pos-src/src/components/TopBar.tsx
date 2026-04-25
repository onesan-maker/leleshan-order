import { useState, useEffect } from "react";
import type { PosSession } from "@/lib/session";
import { useHubStatusStore } from "@/stores/hub-status.store";

interface Props {
  session: PosSession;
  storeName: string;
  onLogout(): void;
  onSwitchEmployee(): void;
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
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
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function HubIndicator() {
  const { isHealthy, lastCheckAt } = useHubStatusStore();
  const tip = lastCheckAt
    ? `最後連線 ${lastCheckAt.toLocaleTimeString("zh-TW")}`
    : "尚未檢查";

  return (
    <span title={tip} className="flex items-center gap-1">
      <span
        className={`inline-block w-2 h-2 rounded-full ${isHealthy ? "bg-ready" : "bg-pending"}`}
      />
      {!isHealthy && (
        <span className="text-[10px] font-semibold text-pending">本機離線</span>
      )}
    </span>
  );
}

export function TopBar({ session, storeName, onLogout, onSwitchEmployee }: Props) {
  const time = useClock();
  const online = useOnline();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-line bg-panel/70 backdrop-blur z-10 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-lg font-black flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-sm inline-block" />
          POS
        </h1>
        <span className="text-xs font-mono text-muted tracking-wide">{storeName}</span>
        <span className="font-mono text-sm tabular-nums text-text-dim">{time}</span>
        <HubIndicator />
        {!online && (
          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold">
            離線中
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 text-xs rounded-full bg-panel-2 border border-line text-text-dim font-semibold">
          {session.employeeName}
        </span>
        <button
          onClick={onSwitchEmployee}
          className="px-3 py-1 text-xs rounded-lg border border-line bg-panel hover:bg-panel-2 text-text-dim transition-colors"
        >
          切換員工
        </button>
        <button
          onClick={onLogout}
          className="px-3 py-1 text-xs rounded-lg border border-line bg-panel hover:bg-panel-2 text-text-dim transition-colors"
        >
          登出
        </button>
      </div>
    </header>
  );
}
