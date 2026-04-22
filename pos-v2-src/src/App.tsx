import { useEffect, useState, useCallback } from "react";
import { readSession, type PosSession } from "./lib/session";
import { appConfig } from "./lib/firebase";
import { useMenuStore } from "./stores/menu.store";
import { useCartStore, type FlavorPart } from "./stores/cart.store";
import { useMenuSubscription } from "./hooks/useMenuSubscription";
import { checkout } from "./services/order.service";
import { TopBar } from "./components/TopBar";
import { FlavorBar } from "./components/FlavorBar";
import { MenuSection } from "./components/MenuSection";
import { CartPanel } from "./components/CartPanel";
import { PartFlavorPicker } from "./components/PartFlavorPicker";
import type { MenuItem } from "./services/menu.service";

// Fix-6: ensure legacy helpers loaded before any order write
function checkHelpers(): string | null {
  if (typeof window.LeLeShanOrders !== "object" || !window.LeLeShanOrders) {
    return "LeLeShanOrders 尚未載入，請重新整理頁面。若問題持續發生請聯絡技術支援。";
  }
  return null;
}

function makeGroupId(index: number) {
  return `part_${index}`;
}

export default function App() {
  const [session, setSession] = useState<PosSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [clock, setClock] = useState("");
  const [helpersError] = useState<string | null>(() => checkHelpers());

  const [parts, setParts] = useState<FlavorPart[]>([]);
  const [activePartId, setActivePartId] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const { categories, items, flavors, loaded } = useMenuStore();
  const { lines, setParts: setCartParts, addItem, clear } = useCartStore();

  const storeId = appConfig.store.defaultStoreId;
  useMenuSubscription(storeId);

  // Clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);

  // Session check
  useEffect(() => {
    const s = readSession();
    setSession(s);
    setChecked(true);
  }, []);

  // Init first part once flavors loaded
  useEffect(() => {
    if (parts.length === 0 && flavors.length > 0) {
      const firstFlavor = flavors[0].name;
      const p: FlavorPart = {
        id: makeGroupId(1),
        groupId: makeGroupId(1),
        groupLabel: "第 1 組",
        flavor: firstFlavor,
        staple: "",
      };
      setParts([p]);
      setActivePartId(p.id);
      setCartParts([p]);
    }
  }, [flavors, parts.length, setCartParts]);

  // Keep cart store in sync with parts
  useEffect(() => {
    setCartParts(parts);
  }, [parts, setCartParts]);

  const handleAddPart = useCallback(() => {
    setShowPicker(true);
  }, []);

  const handlePickerConfirm = useCallback((flavor: string, staple: string) => {
    const idx = parts.length + 1;
    const p: FlavorPart = {
      id: makeGroupId(idx),
      groupId: makeGroupId(idx),
      groupLabel: `第 ${idx} 組`,
      flavor,
      staple,
    };
    const next = [...parts, p];
    setParts(next);
    setActivePartId(p.id);
    setShowPicker(false);
  }, [parts]);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (!activePartId) return;
    addItem(
      {
        itemId: item.id,
        name: item.name,
        unitPrice: item.price,
        type: item.posType ?? "food",
        categoryName: categories.find((c) => c.id === item.categoryId)?.name ?? "",
        posType: item.posType,
      },
      activePartId,
    );
  }, [activePartId, addItem, categories]);

  const handleCheckout = useCallback(async () => {
    const helperErr = checkHelpers();
    if (helperErr) { setOrderError(helperErr); return; }
    if (lines.length === 0) return;

    setSubmitting(true);
    setOrderError(null);
    try {
      const { note, paymentMethod, customerName } = useCartStore.getState();
      const orderId = await checkout({
        storeId,
        source: "pos-v2",
        label: "內場",
        display_name: "內場點餐",
        customerName: customerName || "現場顧客",
        note,
        paymentMethod,
        isPaid: paymentMethod !== "cash",
        paymentStatus: paymentMethod !== "cash" ? "paid" : "unpaid",
        scheduledPickupDate: "",
        scheduledPickupTime: "",
        scheduledPickupAt: "",
        isTest: false,
        lineUserId: null,
        lineDisplayName: null,
        lines,
        parts,
      });
      setLastOrderId(orderId);
      clear();
      // reset parts to one fresh group
      const firstFlavor = flavors[0]?.name ?? "";
      const p: FlavorPart = {
        id: makeGroupId(1),
        groupId: makeGroupId(1),
        groupLabel: "第 1 組",
        flavor: firstFlavor,
        staple: "",
      };
      setParts([p]);
      setActivePartId(p.id);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [lines, parts, storeId, clear, flavors]);

  // --- Render gates ---

  if (!checked) {
    return <div className="p-8 text-muted">正在驗證登入狀態…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="max-w-md w-full bg-panel border border-line rounded-2xl p-8 text-center space-y-4 shadow-lg">
          <h1 className="font-serif text-2xl font-black">尚未登入 POS</h1>
          <p className="text-muted text-sm">請先從員工登入頁驗證身分。</p>
          <a
            href="/pos-login"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-b from-accent-2 to-accent text-[#1a0d00] font-black shadow"
          >
            前往登入頁 →
          </a>
        </div>
      </div>
    );
  }

  if (helpersError) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="max-w-md w-full bg-panel border border-red-500/40 rounded-2xl p-8 text-center space-y-4">
          <h1 className="font-serif text-xl font-black text-red-400">載入錯誤</h1>
          <p className="text-sm text-muted">{helpersError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-xl bg-panel-2 border border-line text-sm"
          >
            重新整理
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative z-10">
      <TopBar session={session} clock={clock} />

      {/* Success banner */}
      {lastOrderId && (
        <div className="px-6 py-2 bg-ready/20 border-b border-ready/30 text-sm text-ready font-semibold flex items-center justify-between">
          <span>訂單已送出：{lastOrderId}</span>
          <button onClick={() => setLastOrderId(null)} className="text-ready/60 hover:text-ready text-xs">✕</button>
        </div>
      )}
      {orderError && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/30 text-sm text-red-400 flex items-center justify-between">
          <span>錯誤：{orderError}</span>
          <button onClick={() => setOrderError(null)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left: flavor bar + menu */}
        <div className="flex flex-col flex-1 min-w-0">
          {loaded ? (
            <>
              <FlavorBar
                parts={parts}
                activeId={activePartId}
                onSelect={setActivePartId}
                onAdd={handleAddPart}
              />
              <MenuSection
                categories={categories}
                items={items}
                onItemClick={handleItemClick}
              />
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-muted text-sm">載入菜單中…</div>
          )}
        </div>

        {/* Right: cart */}
        <div className="w-80 xl:w-96 flex flex-col flex-shrink-0">
          <CartPanel onCheckout={handleCheckout} submitting={submitting} />
        </div>
      </div>

      {showPicker && (
        <PartFlavorPicker
          flavors={flavors}
          partIndex={parts.length + 1}
          onConfirm={handlePickerConfirm}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
