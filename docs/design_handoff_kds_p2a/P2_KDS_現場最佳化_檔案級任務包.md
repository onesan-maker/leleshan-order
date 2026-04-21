# P2 KDS 現場最佳化版 — 檔案級任務包

> **版本：** 2026-04-19 v1.0
> **原型參考：** `KDS 現場最佳化版 v3.html`
> **狀態機依賴：** 需 **P1 完成**（`pending_confirmation` 狀態已寫入）
> **派發對象：** Claude Code（每個 P2-X 一個 task）
> **測試環境：** 建議平板 1366×768 / 1280×800

---

## 📋 總覽

| 任務 | 範圍 | 預估 | 風險 | 依賴 | 可獨立上線 |
|------|------|------|------|------|------------|
| **P2-A** | 三欄版型 + 新卡片視覺（純 CSS/HTML） | 4–6 小時 | 🟢 低 | 無 | ✅ |
| **P2-B** | 狀態轉移 + 按鈕互動 + 長按取消 | 4–5 小時 | 🟡 中 | P1、P2-A | ✅（預先含 dry-run toggle） |
| **P2-C** | 警報系統（視覺 + 音效 + 呼吸燈） | 3–4 小時 | 🟢 低 | P2-A | ✅ |
| **P2-D** | 批量接單 + Undo + 工作負載感知 | 3–4 小時 | 🟡 中 | P2-B | ✅ |
| **P2-E** | POS 新訂單待確認區塊（同步邏輯） | 3–4 小時 | 🟡 中 | P2-B | ✅ |

**建議順序：** A → C → B → D → E
（前端視覺先上，不影響既有系統；中段上狀態機；最後才動 POS）

---

## P2-A：三欄版型 + 新卡片視覺

### 目標
把 KDS 從「filter tabs + 單一網格」改成「三欄固定（待確認 / 製作中 / 可取餐）+ 新卡片模板」，**純視覺重構**，不動狀態邏輯。

### 影響檔案
| 檔案 | 變更類型 | 行數估計 |
|------|----------|----------|
| `liff-ordering/kds.html` | 🟡 結構重寫 main 區 | 約 50 行 |
| `liff-ordering/ops.css` | 🔴 新增 KDS v3 樣式區塊 | 新增約 500 行（保留既有 `.ops-*` 原 class） |
| `liff-ordering/kds.js` | 🟡 改 render 函式（只改模板，不動資料流） | 改約 80 行 |

### `kds.html` 改動
**移除：**
```html
<section class="ops-panel">
  <div class="ops-tabs">
    <button class="ops-tab is-active" ... data-kds-filter="all">全部</button>
    ... （整個 tabs 區塊）
  </div>
</section>

<main id="kds-list" class="ops-grid"></main>
```

**替換為：**
```html
<!-- 全寬警報條 -->
<div class="kds-alert-strip" id="kds-alert-strip" hidden>
  <div class="kds-alert-strip__content">
    <span>⚠ 待確認</span>
    <span class="kds-alert-strip__count" id="kds-alert-count">0 筆</span>
    <div class="kds-alert-strip__marquee">
      <span id="kds-alert-marquee"></span>
    </div>
    <span class="kds-alert-strip__oldest" id="kds-alert-oldest">最老 0 分</span>
  </div>
</div>

<!-- 三欄主體 -->
<div class="kds-board" id="kds-board">
  <section class="kds-col kds-col--pending" id="kds-col-pending">
    <div class="kds-col__head">
      <span class="kds-col__title">⚠ 待確認</span>
      <span class="kds-col__count" id="kds-ct-pending">0</span>
    </div>
    <div class="kds-col__body" id="kds-body-pending"></div>
  </section>
  <section class="kds-col kds-col--work" id="kds-col-work">
    <div class="kds-col__head">
      <span class="kds-col__title">製作中</span>
      <span class="kds-col__count" id="kds-ct-work">0</span>
    </div>
    <div class="kds-col__body" id="kds-body-work"></div>
  </section>
  <section class="kds-col kds-col--ready" id="kds-col-ready">
    <div class="kds-col__head">
      <span class="kds-col__title">可取餐</span>
      <span class="kds-col__count" id="kds-ct-ready">0</span>
    </div>
    <div class="kds-col__body" id="kds-body-ready"></div>
  </section>
</div>

<!-- 底部統計條（取代原本頂部 stats） -->
<div class="kds-stats-bar">
  <div class="kds-stats-bar__item">
    <span class="kds-stats-bar__label">今日進度</span>
    <div class="kds-stats-bar__gauge" id="kds-gauge">
      <span class="sg-p" style="width:0%"></span>
      <span class="sg-w" style="width:0%"></span>
      <span class="sg-r" style="width:0%"></span>
    </div>
  </div>
  <div class="kds-stats-bar__item">
    <span class="kds-stats-bar__label">待確認</span>
    <span class="kds-stats-bar__val" id="kds-sb-p">0</span>
  </div>
  <div class="kds-stats-bar__item">
    <span class="kds-stats-bar__label">製作中</span>
    <span class="kds-stats-bar__val" id="kds-sb-w">0</span>
  </div>
  <div class="kds-stats-bar__item">
    <span class="kds-stats-bar__label">可取餐</span>
    <span class="kds-stats-bar__val" id="kds-sb-r">0</span>
  </div>
  <div class="kds-stats-bar__item" style="margin-left:auto">
    <span class="kds-stats-bar__label">最老待確認</span>
    <span class="kds-stats-bar__val" id="kds-sb-oldest">—</span>
  </div>
</div>
```

**保留：**
- `<header class="ops-topbar">` 整段不動（避免破壞既有樣式）
- 原 `<section class="ops-panel">` with `ops-stats`（可保留但 display:none，先不動）
- 所有既有 script tag

**快取版本號：** `ops.css?v=20260419-p2a`、`kds.js?v=20260419-p2a`

### `ops.css` 新增區塊
在檔尾新增一大塊：
```css
/* ═════════════════════════════════════════════
   KDS v3 現場最佳化版樣式 (2026-04-19)
   全部以 .kds- 前綴，不影響既有 .ops- 樣式
   ═════════════════════════════════════════════ */

/* ─── 全寬警報條 ─── */
.kds-alert-strip { /* ... 取自原型 .alert-strip */ }
/* ... 其他樣式全部複製自 KDS 現場最佳化版 v3.html 的 <style> 區塊，
   但所有 class 名稱加上 kds- 前綴（除了已有 kds- 的） */
```

**完整樣式：** 直接從 `KDS 現場最佳化版 v3.html` 的 `<style>` 複製到 `ops.css` 尾端，並把以下 class 加 `kds-` 前綴：
- `.bar`、`.board`、`.col`、`.card`、`.btn`、`.alert-strip`、`.batch-bar`、`.batch-undo`、`.stats-bar`、`.tweaks`、`.tweak-*`、`.modal*`、`.toast`、`.group`、`.items`、`.note`、`.empty`、`.src`、`.pickup-time`
- `body.pending-mode` 不改（只影響 body）

### `kds.js` render 改動
找到目前 render 函式（約 L440 左右），改成：
```js
function render() {
  const cols = { pending: [], work: [], ready: [] };
  state.orders.forEach(o => {
    if (o.status === "completed" || o.status === "cancelled") return;
    if (o.status === "pending_confirmation") cols.pending.push(o);
    else if (o.status === "ready") cols.ready.push(o);
    else cols.work.push(o);  // accepted + preparing 合併
  });
  cols.pending.sort((a,b) => getCreatedMs(a) - getCreatedMs(b));
  cols.work.sort((a,b) => (getStartedMs(a) || getCreatedMs(a)) - (getStartedMs(b) || getCreatedMs(b)));
  cols.ready.sort((a,b) => (getReadyMs(a) || 0) - (getReadyMs(b) || 0));

  ["pending","work","ready"].forEach(k => {
    const body = document.getElementById("kds-body-"+k);
    if (cols[k].length === 0) {
      body.innerHTML = '<div class="kds-empty">' +
        (k === "pending" ? "無待確認" : k === "work" ? "無製作中" : "無可取餐") +
        '</div>';
    } else {
      body.innerHTML = cols[k].map(renderCard).join("");
    }
    document.getElementById("kds-ct-"+k).textContent = cols[k].length;
    document.getElementById("kds-sb-"+k[0]).textContent = cols[k].length;
  });

  document.body.classList.toggle("kds-pending-mode", cols.pending.length > 0);
  updateAlertStrip(cols.pending);
  attachCardHandlers();
}

function renderCard(o) {
  // 完整模板複製自 KDS 現場最佳化版 v3.html 的 cardTpl()，
  // 但改用 state.orders 結構的 helper（見下）
}
```

**關鍵 helper（沿用 order-helpers.js）：**
- `getPickupNumber(o)` → 取餐號
- `getCustomerName(o)` → 姓名
- `getSource(o)` → `line`/`pos`/`phone`
- `getGroups(o)` → `[{ label, flavor, items: [{ name, qty, staple }] }]`
- `getNote(o)`、`getCreatedMs(o)`、`getPickupMs(o)`、`isReserved(o)`

若 helper 尚未存在，新增到 `order-helpers.js`（純讀取，零風險）。

### 驗收
- [ ] 平板 1366×768 無橫向捲動
- [ ] 三欄寬度比約 420:1.1:1，每欄獨立垂直捲動
- [ ] 空欄顯示 "無待確認 / 無製作中 / 無可取餐"
- [ ] 卡片內：取餐號 64px、主 CTA 72px、群組有色塊 A/B
- [ ] 頁面刷新後 CSS 版本號生效（hard reload Cmd+Shift+R）
- [ ] 既有 pending / preparing / ready 訂單正確分欄
- [ ] 按原本的按鈕（接單、開始、完成）仍能運作（邏輯不動，只是顯示層變了）

### 回滾
直接回復 3 個檔（git revert 2 commits：`ops.css` 和 `kds.html/js`）。

---

## P2-B：狀態轉移 + 按鈕互動 + 長按取消

### 目標
把 P2-A 的視覺接上**真實的狀態轉移邏輯**：
- 接單 → accepted
- 開始製作 → preparing
- 完成出餐 → ready
- 完成取餐 → completed
- 品項勾選（local state，不寫 DB）
- 長按取消 → cancellation modal

### 影響檔案
| 檔案 | 變更 |
|------|------|
| `kds.js` | 新增 `advance(orderId, toStatus)`、`attachLongPress()`、取消 modal |
| `order-helpers.js` | 新增 `advanceOrderStatus(db, orderId, toStatus, byUser)` Firestore helper |
| `firestore.rules` | 確認允許 staff 寫 `status`、`accepted_at`、`started_at`、`ready_at`、`completed_at`、`cancelled_at`、`cancellation_reason` |

### `advance()` 核心邏輯
```js
async function advance(orderId, toStatus) {
  const o = state.orders.find(x => x.id === orderId);
  if (!o) return;

  // 狀態機檢查：不允許反向或跳躍
  const allowed = {
    "pending_confirmation": ["accepted", "cancelled"],
    "accepted": ["preparing", "cancelled"],
    "preparing": ["ready", "cancelled"],
    "ready": ["completed"]
  };
  if (!allowed[o.status]?.includes(toStatus)) {
    showToast("狀態轉移不合法", "error");
    return;
  }

  // UI 立即回饋（optimistic）
  playCtaFeedback(toStatus);
  animateCardFlyOut(orderId);

  try {
    await advanceOrderStatus(firebase.firestore(), orderId, toStatus, currentStaff());
    showToast(ctaMessages[toStatus](o), toStatus === "ready" ? "success" : "info");
    // render() 會由 onSnapshot 自動觸發
  } catch (err) {
    showToast("操作失敗：" + err.message, "error");
    render();  // 還原
  }
}

const ctaMessages = {
  accepted: o => `✓ ${getPickupNumber(o)} 已接單，LINE 已通知`,
  preparing: o => `▶ ${getPickupNumber(o)} 開始製作`,
  ready: o => `🔔 ${getPickupNumber(o)} 完成！已叫號 + 通知顧客`,
  completed: o => `✓ ${getPickupNumber(o)} 完成取餐`
};
```

### `advanceOrderStatus()` — Firestore Transaction
寫到 `order-helpers.js`：
```js
async function advanceOrderStatus(db, orderId, toStatus, byUser) {
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("訂單不存在");
    const data = snap.data();
    const current = data.status;
    const allowed = {
      "pending_confirmation": ["accepted", "cancelled"],
      "accepted": ["preparing", "cancelled"],
      "preparing": ["ready", "cancelled"],
      "ready": ["completed"]
    };
    if (!allowed[current]?.includes(toStatus)) {
      throw new Error(`狀態衝突：目前為 ${current}，無法轉移到 ${toStatus}（可能已被其他裝置處理）`);
    }
    const update = {
      status: toStatus,
      [`${toStatus}_at`]: firebase.firestore.FieldValue.serverTimestamp(),
      [`${toStatus}_by`]: byUser?.uid || null,
      last_updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    tx.update(ref, update);
  });
}
```

**關鍵：** 這個 transaction **消滅 POS 和 KDS 同時接單的競態** — 誰先寫誰贏，後寫的會拋出 "狀態衝突" 錯誤並顯示 toast。

### 長按取消（沿用原型 attachLongPress()）
從 `KDS 現場最佳化版 v3.html` 複製 `attachLongPress()` 到 `kds.js`，並在 `attachCardHandlers()` 中綁定：
```js
document.querySelectorAll(".kds-btn--sub[data-longpress='cancel']").forEach(b => {
  attachLongPress(b, () => openCancelModal(b.dataset.oid), 600);
});
```

### 取消 modal
完整結構複製原型的 `.modal-bg` + `.modal`，HTML 插入 `kds.html` body 底部。
確認後呼叫：
```js
await advanceOrderStatus(db, orderId, "cancelled", currentStaff());
await db.collection("orders").doc(orderId).update({
  cancellation: {
    reason: selReason,  // sold_out / kitchen_busy / customer_request / wrong_order
    cancelled_by: currentStaff().uid,
    cancelled_at: firebase.firestore.FieldValue.serverTimestamp()
  }
});
```

### `firestore.rules` 檢查
在 staff role 的 orders update 允許名單中加入（若未有）：
```
&& request.resource.data.diff(resource.data).affectedKeys().hasOnly([
  'status', 'accepted_at', 'accepted_by',
  'preparing_at', 'preparing_by',
  'ready_at', 'ready_by',
  'completed_at', 'completed_by',
  'cancelled_at', 'cancelled_by',
  'cancellation', 'last_updated_at'
])
```

### Dry-run Flag
加入 `kds.js` 頂部：
```js
const KDS_DRY_RUN = false;  // true = 只動 UI 不寫 DB（上線前逐步開放）
```

### 驗收
- [ ] 按「接單」→ 卡片飛到中欄 + Firestore status 變 accepted + accepted_at 有值
- [ ] 按「開始製作」→ 轉 preparing
- [ ] 勾選品項：卡片 UI 更新（暫存在 `state.checked[orderId][itemId]`），不寫 DB
- [ ] 品項全勾完 → CTA 變綠閃爍
- [ ] 按「完成出餐」→ 卡到右欄 + celebrate 動畫 + 勝利音 + status=ready
- [ ] 按「完成取餐」→ 卡消失 + status=completed
- [ ] 長按 ✕ 600ms → modal 開啟
- [ ] 選原因後按確認 → cancellation 欄位寫入、卡消失
- [ ] 開兩台裝置同時按「接單」→ 其中一台跳「狀態衝突」toast、畫面自動刷新

### 回滾
- `KDS_DRY_RUN = true` 即立即停止所有 DB 寫入
- 完整回滾：git revert

---

## P2-C：警報系統（視覺 + 音效 + 呼吸燈）

### 目標
接上**持續性警報**：
- 頂部全寬紅色警報條（跑馬燈 + 脈動）
- pending-mode 中右欄 dim
- 呼吸燈節奏音效（隨等待時間遞增）
- 超時升級（3 分黃 / 5 分紅 / 8 分 critical）

### 影響檔案
| 檔案 | 變更 |
|------|------|
| `kds.js` | 新增 `startBreathing()` / `stopBreathing()` / `playTone()` / `updateAlertStrip()` / `markCritical()` |
| `ops.css` | （已在 P2-A 引入，此任務只用） |

### 核心函式（複製自原型）
```js
let breathingTimer = null;
let soundOn = true;  // 從 localStorage 讀

function startBreathing() {
  if (breathingTimer) return;
  const tick = () => {
    const p = state.orders.filter(o => o.status === "pending_confirmation");
    if (p.length === 0) { stopBreathing(); return; }
    const oldest = p.reduce((a,b) => getCreatedMs(a) < getCreatedMs(b) ? a : b);
    const mins = (Date.now() - getCreatedMs(oldest)) / 60000;
    let interval, vol;
    if (mins < 1) { interval = 5000; vol = 0.06; }
    else if (mins < 3) { interval = 3000; vol = 0.10; }
    else if (mins < 5) { interval = 2000; vol = 0.14; }
    else { interval = 1000; vol = 0.18; }
    if (soundOn) playTone(mins >= 5 ? [880, 1046] : [880], 0.08, vol);
    breathingTimer = setTimeout(tick, interval);
  };
  tick();
}

function stopBreathing() {
  if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
}

function playTone(freqs, dur, vol) {
  try {
    const ctx = window.__kdsAudioCtx || (window.__kdsAudioCtx = new (window.AudioContext||window.webkitAudioContext)());
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, now + i*dur);
      gain.gain.linearRampToValueAtTime(vol, now + i*dur + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i*dur + dur*0.9);
      osc.start(now + i*dur);
      osc.stop(now + i*dur + dur);
    });
  } catch(e) { console.warn("playTone failed", e); }
}
```

### Critical 標記（每 3 秒檢查）
```js
setInterval(() => {
  document.querySelectorAll(".kds-card--pending").forEach(c => {
    const id = c.dataset.id;
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const mins = (Date.now() - getCreatedMs(o)) / 60000;
    c.classList.toggle("kds-critical", mins >= 8);
  });
}, 3000);
```

### 音效開關 + localStorage
```js
function loadSoundPref() {
  const v = localStorage.getItem("kds_sound_on");
  soundOn = v === null ? true : v === "true";
}
function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem("kds_sound_on", String(soundOn));
  document.getElementById("kds-sound-btn").classList.toggle("active", soundOn);
  document.getElementById("kds-sound-btn").textContent = soundOn ? "🔔 音效" : "🔕 靜音";
}
```

把音效開關按鈕放到 `ops-topbar` 右側（取代或加在 `kds-last-update` 附近）。

### render() 裡新增：
```js
if (cols.pending.length > 0) startBreathing();
else stopBreathing();
```

### 使用者啟用音效
Web Audio 需用戶互動才能播。在 `ops-topbar` 若尚未有 "啟用音效" 按鈕，加一個 `enableAudio` 按鈕（kds.js 原本就有這個 pattern，沿用）。

### 驗收
- [ ] 有 pending 時頂部 40px 紅條出現 + 跑馬燈顯示號碼列表
- [ ] 最老時間 3 分鐘內：單音、間隔 5s/3s
- [ ] 最老時間 5 分鐘以上：雙音、間隔 1s（急促）
- [ ] 無 pending 時警報條和音效自動停
- [ ] 中右欄在 pending-mode 時降到 55% 透明 + saturation 降低
- [ ] 8 分鐘以上 pending：卡片整張閃爍（critical）
- [ ] 音效開關存 localStorage，刷新後保持設定

### 回滾
- `soundOn = false` 即可消除所有音效
- 移除 `document.body.classList.toggle("kds-pending-mode", ...)` 一行即可恢復視覺

---

## P2-D：批量接單 + Undo + 工作負載感知

### 目標
- 尖峰時 pending ≥ 3 顯示「一鍵全部接單」banner
- 按下後底部出現 5 秒 undo 提示
- 中欄 4 單顯示「● 忙」、6 單「● 忽」
- 右欄 4+ 單顯示「● 壅塞」

### 影響檔案
- `kds.js` — 新增 `acceptAllPending()`、`undoBatch()`、工作負載感知
- `kds.html` — 加入 `.kds-batch-bar` 和 `.kds-batch-undo` 兩個 HTML element

### 批量接單實作
```js
let batchSnapshot = null, undoCountdownTimer = null;

async function acceptAllPending() {
  const p = state.orders.filter(o => o.status === "pending_confirmation");
  if (p.length === 0) return;

  // 先快照（for undo）
  batchSnapshot = p.map(o => ({ id: o.id, prevStatus: o.status }));

  // 用 batched write 一次送
  const db = firebase.firestore();
  const batch = db.batch();
  p.forEach(o => {
    batch.update(db.collection("orders").doc(o.id), {
      status: "accepted",
      accepted_at: firebase.firestore.FieldValue.serverTimestamp(),
      accepted_by: currentStaff().uid,
      batch_accepted: true,  // 標記以便 cloud function 延遲發通知避免 LINE API rate-limit
      last_updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  try {
    await batch.commit();
    showBatchUndo(p.length);
  } catch (err) {
    showToast("批量接單失敗：" + err.message, "error");
    batchSnapshot = null;
  }
}

function showBatchUndo(count) {
  const el = document.getElementById("kds-batch-undo");
  document.getElementById("kds-undo-msg").textContent = `✓ 已批量接單 ${count} 筆，LINE 順序通知`;
  el.classList.add("show");
  let left = 5;
  document.getElementById("kds-undo-countdown").textContent = left + "s";
  clearInterval(undoCountdownTimer);
  undoCountdownTimer = setInterval(() => {
    left--;
    document.getElementById("kds-undo-countdown").textContent = left + "s";
    if (left <= 0) {
      clearInterval(undoCountdownTimer);
      el.classList.remove("show");
      batchSnapshot = null;  // 過期無法再還原
    }
  }, 1000);
}

async function undoBatch() {
  if (!batchSnapshot) return;
  const db = firebase.firestore();
  const batch = db.batch();
  batchSnapshot.forEach(({ id, prevStatus }) => {
    batch.update(db.collection("orders").doc(id), {
      status: prevStatus,
      accepted_at: firebase.firestore.FieldValue.delete(),
      accepted_by: firebase.firestore.FieldValue.delete(),
      batch_accepted: firebase.firestore.FieldValue.delete(),
      last_updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  try {
    await batch.commit();
    showToast("↶ 已還原 " + batchSnapshot.length + " 筆", "info");
  } catch (err) {
    showToast("還原失敗：" + err.message, "error");
  }
  batchSnapshot = null;
  clearInterval(undoCountdownTimer);
  document.getElementById("kds-batch-undo").classList.remove("show");
}
```

**關鍵注意：** `batch_accepted` 旗標讓 cloud function 知道要延遲發 LINE 通知（每秒一則，避免 rate-limit）— 此為 P3 任務，但欄位先寫好。

### 工作負載感知（render 內）
```js
const workCol = document.getElementById("kds-col-work");
workCol.classList.remove("kds-overload", "kds-busy");
if (cols.work.length >= 6) workCol.classList.add("kds-overload");
else if (cols.work.length >= 4) workCol.classList.add("kds-busy");

const readyCol = document.getElementById("kds-col-ready");
readyCol.classList.toggle("kds-full", cols.ready.length >= 4);
```

### 驗收
- [ ] pending ≥ 3 時頂部出現紅色批量 banner
- [ ] 按下後 5 秒內可 undo
- [ ] Undo 後 pending 卡片回到左欄
- [ ] 超過 5 秒 undo 按鈕消失
- [ ] 製作中 4 張：「● 忙」黃標
- [ ] 製作中 6 張：「● 忽」紅閃
- [ ] 可取餐 4+ 張：「● 壅塞」黃閃
- [ ] 多台裝置同時批量接單：Firestore transaction 保證不重複

### 回滾
- 隱藏 `.kds-batch-bar` 和 `.kds-batch-undo` 兩個 element（display:none）
- 功能即下線；狀態欄位不影響既有訂單

---

## P2-E：POS 新訂單待確認區塊

### 目標
POS 頁面加入「新訂單待確認」區塊（與 KDS 同步），讓收銀員也能在 POS 端確認 LINE 訂單，而不用切到 KDS 平板。

### 影響檔案
| 檔案 | 變更 |
|------|------|
| `pos.html` | 新增「新訂單待確認」panel（在 order tab 頂部） |
| `pos.js` | 新增 `renderPendingConfirmationSection()`、用 `advanceOrderStatus()` 共用函式 |
| `pos-admin.css` | 新增 `.pos-pending-*` 區塊樣式（參考 `POS 新訂單待確認區塊原型.html`）|

### 設計重點（與 KDS v3 不同）
POS 空間有限，pending 用**橫向 list row** 而非 card：
```
┌──────────────────────────────────────────────────────┐
│ 🔔 新訂單待確認 (3 筆)                   🔇 音效開  │
├──────────────────────────────────────────────────────┤
│ A-125  王小姐 [LINE]  2組3項 麻辣/蒜香 $480         │
│                      已等 0 分  [✓ 接單][❌][明細]   │
├──────────────────────────────────────────────────────┤
│ A-124  陳先生 [LINE]  1組2項 原味 $260  ⚠ 已等 4 分 │
│                                [✓ 接單][❌][明細]    │
└──────────────────────────────────────────────────────┘
```

完整 HTML + CSS 複製自 `POS 新訂單待確認區塊原型.html`。

### 同步邏輯
- POS 訂閱 `collection("orders").where("status","==","pending_confirmation")`
- 按「✓ 接單」→ 呼叫共用的 `advanceOrderStatus(db, orderId, "accepted")` 
- 若訂單**已被 KDS 搶先接單**，transaction 會 throw "狀態衝突"
  - POS 顯示 toast：「此訂單已由廚房人員確認」
  - onSnapshot 自動移除該筆

### 驗收
- [ ] POS 頁面載入，order tab 頂部出現 pending 區塊
- [ ] LINE 新訂單進來：POS 和 KDS 同時出現
- [ ] POS 按接單 → KDS 同步消失
- [ ] KDS 先按接單 → POS 顯示「已由廚房確認」toast 並自動移除
- [ ] 取消 modal 與 KDS 一致（選 4 個原因按鈕）

### 回滾
- 隱藏 `.pos-pending-zone` 即可；pos.js 的訂閱也可條件判斷後停用

---

## 🧪 整體 E2E 驗收（P2 全包完成後）

### 劇本 1：正常流程
1. 顧客從 LIFF 下單 → KDS 左欄紅脈動 + 警報條 + 呼吸燈響
2. 員工 KDS 按「✓ 接單」→ 卡片飛到中欄 + LINE 通知顧客 "訂單已確認"
3. 員工勾品項（全勾）→ CTA 變綠閃爍
4. 員工按「🔔 完成出餐」→ 卡片飛到右欄 + 勝利音 + LINE 通知 "可取餐"
5. 顧客來取餐，員工按「✓ 完成取餐」→ 卡片消失

### 劇本 2：競態保護
1. LINE 新訂單進 → KDS 和 POS 同時顯示
2. 同時按兩邊的「接單」
3. **先送到 Firestore 的成功**；另一邊顯示 "狀態衝突，已由他人處理" toast 並自動刷新

### 劇本 3：午餐尖峰
1. 2 分鐘內 8 單湧入
2. 頂部批量 banner 出現 "8 筆待確認"
3. 按「一鍵全部接單」→ 8 筆全部移到中欄
4. 底部 undo 倒數 5 秒
5. 若發現有食材售完 → 按 Undo → 全部回到 pending
6. 否則 5 秒後 undo 消失，8 筆穩定在 accepted

### 劇本 4：誤按保護
1. 滑動手指快速劃過取消按鈕 → 無反應
2. 按下取消按鈕 300ms 後放開 → 無反應
3. 按住 600ms → modal 彈出
4. 不選原因按確認 → 按鈕 disabled
5. 選原因後確認 → 訂單取消 + cancellation 欄位寫入

### 劇本 5：超時警示
1. 讓一張 pending 停留 8 分鐘
2. 卡片從紅脈動 → 黃時間 → 紅閃爍 → 整張縮放閃
3. 呼吸燈從 5s → 3s → 2s → 1s 雙音警報

---

## 📦 派發給 Claude Code 的範本

```markdown
# Task: P2-A 三欄版型視覺重構

## 背景
專案 liff-ordering 是 Firebase 餐飲 LIFF 點餐 + KDS 系統。
需要把 KDS 頁面（kds.html + kds.js + ops.css）從既有「filter tabs + 單一網格」
改為「三欄固定版型（待確認/製作中/可取餐）+ 新卡片視覺」。

## 參考文件
- `P2_KDS_現場最佳化_檔案級任務包.md`（本任務的 P2-A 段）
- `KDS 現場最佳化版 v3.html`（原型，所有樣式和模板來源）

## 約束（來自 AI_RULES.md）
- 不可破壞既有資料結構
- 所有新 class 用 `.kds-` 前綴，不影響 `.ops-*` 既有樣式
- 不動 Firestore 讀寫邏輯，純視覺重構
- 保留既有 script tag 順序

## 具體任務
（照任務包 P2-A 的影響檔案 + 驗收清單執行）

## 完成標準
- 平板 1366×768 無橫向捲動
- 既有訂單正確分欄顯示
- 按鈕邏輯未動，仍能完成接單/出餐流程
```

---

## 🔑 依賴備註

- **P1 狀態機統一**必須先完成：`pending_confirmation` 狀態已寫入 Firestore、read 端也統一使用
- **P3 LINE 通知**為獨立任務：P2 只寫 Firestore 狀態欄位，cloud function 自動 trigger LINE push
- **firestore.rules** 若尚未允許上述新欄位，P2-B 第一步就要改

---

**文件產出：** 2026-04-19
**下一步：** 若 Claude Code 執行順利，可進入 **P3（LINE 通知 + 會員訊息）** 或 **P4（取餐看板 v2）**。
