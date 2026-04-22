import { useEffect, useState } from "react";
import { readSession, clearSession, redirectToLogin, type PosSession } from "./lib/session";
import { appConfig } from "./lib/firebase";

export default function App() {
  const [session, setSession] = useState<PosSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const s = readSession();
    setSession(s);
    setChecked(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);

  if (!checked) {
    return <div className="p-8 text-muted">正在驗證登入狀態…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center px-6 relative z-10">
        <div className="max-w-md w-full bg-panel border border-line rounded-2xl p-8 text-center space-y-4 shadow-lg">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="font-serif text-2xl font-black">尚未登入 POS</h1>
          <p className="text-muted text-sm leading-relaxed">
            POS v2 與現有 /pos 共用員工登入狀態。請先從登入頁驗證員工身分。
          </p>
          <a
            href="/pos-login"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black shadow-lg"
          >
            前往登入頁 →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top bar */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-line bg-panel/60 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-xl font-black flex items-center gap-3">
            <span className="w-1 h-5 bg-accent rounded-sm inline-block" />
            POS v2
          </h1>
          <span className="text-xs font-mono text-muted tracking-widest uppercase">
            {appConfig.store.name} · {session.storeId}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-text-dim tabular-nums">{clock}</span>
          <span className="px-3 py-1.5 text-xs rounded-full bg-panel-2 border border-line text-text-dim font-semibold">
            當班：{session.employeeName} ({session.employeeId})
          </span>
          <button
            onClick={() => {
              clearSession();
              redirectToLogin();
            }}
            className="px-4 py-1.5 text-xs rounded-lg border border-line bg-panel hover:bg-panel-2 text-text-dim hover:text-text transition-colors"
          >
            登出
          </button>
        </div>
      </header>

      {/* Placeholder content */}
      <main className="flex-1 grid place-items-center p-8">
        <div className="max-w-xl w-full bg-panel border border-line rounded-2xl p-10 text-center space-y-5">
          <div className="inline-block px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent-2 text-xs font-bold tracking-widest uppercase">
            W2 · Scaffold Ready
          </div>
          <h2 className="font-serif text-3xl font-black">POS v2 骨架已就緒</h2>
          <p className="text-muted leading-relaxed">
            完整點餐功能（菜單、多口味分組、購物車、結帳、今日訂單）將於 W3 上線。
            當前登入態已從 <code className="font-mono text-text-dim">LeLeShanPosSession</code> 繼承，Firebase 已連線至 <code className="font-mono text-text-dim">{appConfig.firebaseConfig.projectId}</code>。
          </p>
          <div className="pt-4 border-t border-line grid grid-cols-3 gap-4 text-left">
            <div>
              <div className="text-[10px] tracking-widest uppercase text-muted">Stack</div>
              <div className="font-mono text-sm mt-1">Vite+React+TS</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest uppercase text-muted">Route</div>
              <div className="font-mono text-sm mt-1">/pos-v2</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest uppercase text-muted">Legacy</div>
              <div className="font-mono text-sm mt-1">/pos still live</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
