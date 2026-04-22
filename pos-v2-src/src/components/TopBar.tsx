import type { PosSession } from "@/lib/session";

interface Props {
  session: PosSession;
  storeName: string;
  onLogout(): void;
  onSwitchEmployee(): void;
}

export function TopBar({ session, storeName, onLogout, onSwitchEmployee }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-line bg-panel/70 backdrop-blur z-10 shrink-0">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-lg font-black flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-sm inline-block" />
          POS v2
        </h1>
        <span className="text-xs font-mono text-muted tracking-wide">{storeName}</span>
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
