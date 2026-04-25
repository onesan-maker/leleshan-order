import { useEffect, useState, useCallback } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { readSession, clearSession, redirectToLogin, type PosSession } from "./lib/session";
import { appConfig, auth } from "./lib/firebase";
import { useMenuSubscription } from "./hooks/useMenuSubscription";
import { useCartStore } from "./stores/cart.store";
import { useUIStore } from "./stores/ui.store";
import { submitOrder } from "./services/order.service";
import { appendToOrder } from "./services/order-append.service";
import { publishOpsSession, clearOpsSession } from "./services/ops-session.service";
import { useHubStatusStore } from "./stores/hub-status.store";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FlavorBar } from "./components/FlavorBar";
import { MenuSection } from "./components/MenuSection";
import { CartPanel } from "./components/CartPanel";
import { Toast } from "./components/Toast";
import { SpecModal } from "./components/SpecModal";
import { OrderListTab } from "./components/OrderListTab";
import { ShiftSwitchModal } from "./components/ShiftSwitchModal";
import type { CheckoutPayload } from "./components/CartPanel";
import type { TodayOrder } from "./services/order-list.service";

type MainTab = "order" | "orders";

async function ensureFirebaseAuth(session: PosSession) {
  if (auth.currentUser) return;
  if (!session.customToken) {
    console.warn("[POS] no customToken in session — KDS auth unavailable until next login");
    return;
  }
  try {
    await signInWithCustomToken(auth, session.customToken);
    console.log("[POS] Firebase Auth signed in as pos staff");
  } catch (err) {
    console.warn("[POS] signInWithCustomToken failed (token may be expired):", err);
  }
}

export default function App() {
  const [session,        setSession       ] = useState<PosSession | null>(null);
  const [checked,        setChecked       ] = useState(false);
  const [activeTab,      setActiveTab     ] = useState<MainTab>("order");
  const [showShiftModal, setShowShiftModal] = useState(false);

  /* Sidebar ↔ MenuSection state */
  const [activeCatId,  setActiveCatId ] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [searchQuery,  setSearchQuery ] = useState("");

  useEffect(() => {
    const s = readSession();
    setSession(s);
    setChecked(true);
    if (s) {
      void ensureFirebaseAuth(s);
      void publishOpsSession(s, "login").catch((e) =>
        console.warn("[POS] publishOpsSession failed:", e),
      );
      useHubStatusStore.getState().startMonitoring();
    }
    return () => { useHubStatusStore.getState().stopMonitoring(); };
  }, []);

  useMenuSubscription(session?.storeId);

  /* Sidebar category click → switch to order tab + scroll */
  const handleCatClick = useCallback((id: string) => {
    setActiveTab("order");
    setActiveCatId(id);
    setScrollTarget(id);
  }, []);

  const handleScrollTargetConsumed = useCallback(() => setScrollTarget(null), []);

  const handleSectionVisible = useCallback((id: string) => setActiveCatId(id), []);

  /* ── Loading / auth guards ──────────────────────────── */
  if (checked && session && typeof window.LeLeShanOrders?.buildCreatePayload !== "function") {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center relative z-10">
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
            className="inline-block px-6 py-3 rounded-xl text-[#1a0d00] font-black shadow-lg"
            style={{ background: "linear-gradient(180deg, #ffb347, #ff8a3d)" }}
          >
            前往登入頁 →
          </a>
        </div>
      </div>
    );
  }

  /* ── Checkout handlers ──────────────────────────────── */
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

  const handleEnterAppend = (order: TodayOrder) => {
    useCartStore.getState().setAppendTarget(order);
    setActiveTab("order");
  };

  const handleAppendCheckout = async () => {
    const { appendTarget, lines } = useCartStore.getState();
    if (!appendTarget || !lines.length) return;
    try {
      const result = await appendToOrder(session, appendTarget, lines);
      const label  = appendTarget.pickupNumber ? `#${appendTarget.pickupNumber}` : appendTarget.id.slice(-6);
      const extra  = result.wasReady ? "（訂單已回退製作中）" : "";
      useCartStore.getState().exitAppendMode();
      useUIStore.getState().showToast(`✅ 已追加到訂單 ${label}${extra}`, "ok");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      useUIStore.getState().showToast(`❌ 追加失敗：${msg}`, "err");
    }
  };

  const handleLogout = () => {
    clearOpsSession(session.storeId).catch(() => {});
    clearSession();
    auth.signOut().catch(() => {});
    redirectToLogin();
  };

  /* ── Main layout ────────────────────────────────────── */
  return (
    <div
      className="h-screen overflow-hidden relative z-10"
      style={{ display: "grid", gridTemplateColumns: "220px 1fr 360px" }}
    >
      {/* ── Left: Sidebar ─────────────────────────────── */}
      <Sidebar
        session={session}
        activeCatId={activeCatId}
        onCatClick={handleCatClick}
        onLogout={handleLogout}
        onSwitchEmployee={() => setShowShiftModal(true)}
      />

      {/* ── Center: Main column ───────────────────────── */}
      <main className="flex flex-col min-h-0 overflow-hidden bg-bg">
        <TopBar
          session={session}
          storeName={appConfig.store.name}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Tab row — underline style per design */}
        <div
          className="flex items-center gap-1 border-b border-line-soft shrink-0 bg-bg"
          style={{ padding: "0 28px" }}
        >
          {(["order", "orders"] as MainTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "py-3.5 px-4 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-accent text-accent-2"
                  : "border-transparent text-text-dim hover:text-text",
              ].join(" ")}
            >
              {tab === "order" ? "點餐" : "今日訂單"}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "order" ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <AppendBanner onExit={() => useCartStore.getState().exitAppendMode()} />
            <FlavorBar />
            <MenuSection
              scrollTarget={scrollTarget}
              onScrollTargetConsumed={handleScrollTargetConsumed}
              onSectionVisible={handleSectionVisible}
              searchQuery={searchQuery}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            <OrderListTab session={session} onEnterAppend={handleEnterAppend} />
          </div>
        )}
      </main>

      {/* ── Right: Cart ───────────────────────────────── */}
      <CartPanel
        onCheckout={handleCheckout}
        onAppendCheckout={handleAppendCheckout}
      />

      <Toast />
      <SpecModal />
      {showShiftModal && (
        <ShiftSwitchModal
          session={session}
          onSwitch={(newSession) => {
            setSession(newSession);
            void publishOpsSession(newSession, "switch").catch((e) =>
              console.warn("[POS] publishOpsSession switch failed:", e),
            );
          }}
          onClose={() => setShowShiftModal(false)}
        />
      )}
    </div>
  );
}

/* ── Append-mode banner ─────────────────────────────────── */
function AppendBanner({ onExit }: { onExit(): void }) {
  const appendTarget = useCartStore((s) => s.appendTarget);
  if (!appendTarget) return null;
  const label = appendTarget.pickupNumber
    ? `#${appendTarget.pickupNumber}`
    : appendTarget.id.slice(-6);
  const name = appendTarget.customer_name || appendTarget.display_name || "顧客";
  return (
    <div className="flex items-center justify-between px-7 py-2 bg-accent/15 border-b border-accent/30 shrink-0">
      <span className="text-xs font-semibold text-accent">
        追加模式：訂單 {label}（{name}）
      </span>
      <button
        onClick={onExit}
        className="text-xs px-3 py-1 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
      >
        取消追加
      </button>
    </div>
  );
}
