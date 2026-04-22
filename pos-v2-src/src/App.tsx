import { useEffect, useState } from "react";
import { readSession, clearSession, redirectToLogin, type PosSession } from "./lib/session";
import { appConfig } from "./lib/firebase";
import { useMenuSubscription } from "./hooks/useMenuSubscription";
import { useCartStore } from "./stores/cart.store";
import { useUIStore } from "./stores/ui.store";
import { submitOrder } from "./services/order.service";
import { TopBar } from "./components/TopBar";
import { FlavorBar } from "./components/FlavorBar";
import { MenuSection } from "./components/MenuSection";
import { CartPanel } from "./components/CartPanel";
import { Toast } from "./components/Toast";
import type { CheckoutPayload } from "./components/CartPanel";

export default function App() {
  const [session, setSession] = useState<PosSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setChecked(true);
  }, []);

  useMenuSubscription(session?.storeId);

  // Helpers guard — must come after session check so we don't block the login gate
  if (checked && session && typeof window.LeLeShanOrders?.buildCreatePayload !== "function") {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <div className="text-2xl font-serif font-black mb-3">載入訂單模組…</div>
          <div className="text-muted text-sm">如持續看到此訊息，請重新整理頁面</div>
        </div>
      </div>
    );
  }

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
            POS v2 與 /pos 共用員工登入狀態。請先從登入頁驗證員工身分。
          </p>
          <a
            href="/pos-login.html"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black shadow-lg"
          >
            前往登入頁 →
          </a>
        </div>
      </div>
    );
  }

  const handleCheckout = async (payload: CheckoutPayload) => {
    try {
      const result = await submitOrder({ session, ...payload });
      useCartStore.getState().clear();
      useUIStore.getState().showToast(`✅ 已收款，取餐號碼 ${result.pickupNumber}`, "ok");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      useUIStore.getState().showToast(`❌ 送單失敗：${msg}`, "err");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative z-10">
      <TopBar
        session={session}
        storeName={appConfig.store.name}
        onLogout={() => { clearSession(); redirectToLogin(); }}
      />
      <div className="flex-1 grid grid-cols-[1fr_380px] min-h-0 overflow-hidden">
        <main className="flex flex-col min-h-0 overflow-hidden">
          <FlavorBar />
          <MenuSection />
        </main>
        <aside className="flex flex-col min-h-0 overflow-hidden">
          <CartPanel onCheckout={handleCheckout} />
        </aside>
      </div>
      <Toast />
    </div>
  );
}
