import { clearSession, redirectToLogin, type PosSession } from "@/lib/session";
import { appConfig } from "@/lib/firebase";

interface Props {
  session: PosSession;
  clock: string;
}

export function TopBar({ session, clock }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-line bg-panel/70 backdrop-blur z-10">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-lg font-black flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-sm inline-block" />
          POS v2
        </h1>
        <span className="text-xs font-mono text-muted tracking-wide">
          {appConfig.store.name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-text-dim tabular-nums">{clock}</span>
        <span className="px-3 py-1 text-xs rounded-full bg-panel-2 border border-line text-text-dim font-semibold">
          {session.employeeName}
        </span>
        <button
          onClick={() => { clearSession(); redirectToLogin(); }}
          className="px-3 py-1 text-xs rounded-lg border border-line bg-panel hover:bg-panel-2 text-text-dim transition-colors"
        >
          登出
        </button>
      </div>
    </header>
  );
}
