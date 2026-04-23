import { useState } from "react";
import type { PosSession } from "@/lib/session";
import { switchEmployee } from "@/services/shift.service";
import { saveSession } from "@/lib/session";

interface Props {
  session: PosSession;
  onSwitch(newSession: PosSession): void;
  onClose(): void;
}

export function ShiftSwitchModal({ session, onSwitch, onClose }: Props) {
  const [empId, setEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!/^\d{3}$/.test(empId)) { setError("員工編號需為3位數字"); return; }
    if (!/^\d{4}$/.test(pin))   { setError("PIN 需為4位數字"); return; }
    if (!navigator.onLine)       { setError("目前離線，無法切換員工"); return; }
    if (session.employeeId === empId) { setError("已經是目前值班員工"); return; }

    setLoading(true);
    try {
      const newSession = await switchEmployee(session, empId, pin);
      saveSession(newSession);
      onSwitch(newSession);
      onClose();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code || "";
      if (code.includes("failed-precondition")) {
        setError("員工帳號未啟用或無法登入");
      } else if (code.includes("not-found") || code.includes("invalid-argument")) {
        setError("員工編號或 PIN 不正確");
      } else {
        setError(e instanceof Error ? e.message : "切換失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel border border-line rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="font-serif font-black text-base">切換員工</div>
          <button onClick={onClose} className="text-muted hover:text-text text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-muted">目前：{session.employeeName} ({session.employeeId})</div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="員工編號（3位數字）"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN（4位數字）"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full bg-panel-2 border border-line rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
          />
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-xs font-semibold text-text-dim hover:bg-panel-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] text-xs font-black disabled:opacity-50 transition-all hover:brightness-105"
          >
            {loading ? "驗證中…" : "確認切換"}
          </button>
        </div>
      </div>
    </div>
  );
}
