> ⚠️ **2026-04-21 方向變更通知 — 本資料夾內容已過期，請勿照舊版施作**
>
> 原計劃（P1 pending_confirmation 閘門 + P2-A 三欄 KDS）已在實作前被改方向。實際採用：
>
> - **P1 改為「無閘門」**：LINE/POS 下單皆直接寫 `status: "accepted"`（見 [checkout.js:373](../../checkout.js)、[pos.js:1860](../../pos.js)、[functions/index.js:482](../../functions/index.js) 註解），`pending_confirmation` 流程已移除，不再需要人工「確定接單」。
> - **P2 改為「2 台 KDS + 站別過濾」**：非「待確認 / 製作中 / 可取餐」三欄，而是「製作中 / 可取餐」2 欄，搭配 `body.kds-mode-boil` / `body.kds-mode-pack` 站別過濾（見 [kds.html:12-80](../../kds.html)），供煮麵站與包裝站分機顯示。
>
> 本資料夾的 `P1_狀態機統一_任務拆分.md`、`P2_KDS_現場最佳化_檔案級任務包.md`、`KDS 現場最佳化版 v3.html`、`KDS 可展開三欄 v4.html`、`ADDENDUM_v4.md`、`任務拆分.txt` 僅作歷史參考，**不要再據此派工**。若要新動作，請以當前程式碼為準重新開規格。

---

# Handoff: KDS P2-A 三欄版型視覺重構（已過期）

## Overview

將 `liff-ordering` 專案中的 **KDS（Kitchen Display System）** 頁面，從目前的「filter tabs + 單一網格」版型，重構為 **三欄固定版型**（待確認 / 製作中 / 可取餐，全部並列在螢幕上），並套用一套針對廚房現場設計的高對比、高辨識度的新卡片視覺。

核心目標：**尖峰時段不再需要切 tab 才能看到不同狀態的訂單，一眼掌握全場。**

---

## About the Design Files

本資料夾內 `KDS 現場最佳化版 v3.html` 是一份 **設計參考（design reference）** — 純 HTML/CSS 的高保真原型，用來展示最終的外觀、互動與動畫效果，**不是直接可 ship 的生產程式碼**。

你的任務是 **把這份 HTML 原型重新實作到 `liff-ordering` 專案的既有環境**（vanilla JS + 原生 CSS + Firebase，無前端框架），沿用它既有的架構規範（`ops.css` / `kds.js` / `order-helpers.js`）。不是要你把 HTML 整包貼進去，而是拆解其中的樣式、DOM 結構、模板函式，對應到專案既有的三個檔案。

---

## Fidelity

**High-fidelity（hifi）**。原型已包含：

- 最終配色、字級、間距
- 完整的狀態分欄邏輯（pending / accepted+preparing / ready）
- 所有卡片狀態與動畫（進場、飛出、慶祝、警示脈動、紅色臨界）
- 三種欄位的不同卡片密度與視覺權重
- 超時（>180s / >300s）的階段性強化視覺
- 取餐號閃爍呼叫、批次完成快捷動作

請「像素級」照原型還原，不要自創顏色或動畫節奏。

---

## Screens / Views

本次只動一個頁面：**KDS 主畫面**（`liff-ordering/kds.html`）。

### 版型結構

從上到下：

```
┌─────────────────────────────────────────────────────────┐
│  ops-topbar（既有 header，保留不動）                      │
├─────────────────────────────────────────────────────────┤
│  .kds-alert-strip（可選，紅底跑馬燈，僅在有 >300s pending）│
├─────────────────────────────────────────────────────────┤
│  .kds-board（主要三欄區）                                 │
│  ┌──────────────┬─────────────┬────────────────┐         │
│  │ 待確認        │ 製作中       │ 可取餐          │         │
│  │ （寬）        │ （窄）       │ （窄）          │         │
│  │ col--pending │ col--work   │ col--ready     │         │
│  │              │             │                │         │
│  │ [卡片]×N     │ [卡片]×N    │ [卡片]×N       │         │
│  └──────────────┴─────────────┴────────────────┘         │
├─────────────────────────────────────────────────────────┤
│  .kds-stats-bar（底部統計列，即時數量 + LIVE 指示燈）      │
└─────────────────────────────────────────────────────────┘
```

- **三欄寬度比**：`1.4 : 1 : 1`（用 CSS grid `grid-template-columns: 1.4fr 1fr 1fr`）
- **每欄獨立垂直捲動**（`overflow-y: auto`），欄間 `gap: 8px`
- **平板解析度 1366×768 不可橫向捲動**

### 卡片三種變體

| 欄位     | class              | 特點                                                                 |
| -------- | ------------------ | -------------------------------------------------------------------- |
| 待確認   | `.card--pending`   | 紅框、粗邊、取餐號 64px 最大、主 CTA 72px「接單」按鈕、有紅色脈動    |
| 製作中   | `.card--work`      | 藍框、compact 版型、取餐號較小、主 CTA「完成」、顯示製作剩餘秒數     |
| 可取餐   | `.card--ready`     | 綠框、取餐號閃爍呼叫、主 CTA「已取餐」、有超時提醒                   |

---

## Design Tokens

從 `KDS 現場最佳化版 v3.html` 的 `:root` 完整複製：

```css
--bg:        #0a0d14;   /* 頁面背景，極深藍黑 */
--panel:     #121620;   /* 欄位背景 */
--panel-2:   #1a2030;   /* 卡片背景 */
--line:      #242c40;   /* 分隔線 */
--text:      #ffffff;
--text-dim:  #c8cedc;
--muted:     #6b7489;

--pending:   #ef4444;   /* 待確認主色（紅） */
--pending-2: #dc2626;   /* 脈動次色 */
--accepted:  #f97316;   /* 已接單橘（製作中欄內的子狀態） */
--preparing: #3b82f6;   /* 製作中藍 */
--ready:     #10b981;   /* 可取餐綠 */
--ready-2:   #059669;   /* 按鈕陰影用 */

--line-brand:#06c755;   /* LINE 綠，客戶來源標記用 */
```

### 字級重點

| 用途       | 大小 | 字重 |
| ---------- | ---- | ---- |
| 取餐號（pending） | 64px | 900  |
| 取餐號（work/ready） | 44px | 900 |
| 主 CTA（pending） | 28px | 900 |
| 主 CTA 高度 | 72px（pending）/ 56px（work/ready） | - |
| 群組標題   | 20px | 900  |
| 品項列     | 18px | 700  |
| 備註       | 18px | 700（黃底 `#fef3c7`、深字 `#78350f`）|

字體：`Noto Sans TC`（`wght 400;500;700;900`），從 Google Fonts 載入。

### 動畫名稱（keyframes）

所有 keyframes **必須加 `kds-` 前綴**後放到 `ops.css`，避免與既有全域動畫衝突：

- `kdsStripPulse` — 頂部 alert strip 紅色脈動
- `kdsMarquee` — 跑馬燈
- `kdsLivePulse` — LIVE 指示燈
- `kdsColAlert` — 欄位內層紅光警示（>300s 時）
- `kdsBlink` — 取餐號閃爍
- `kdsReadyBoom` — 取餐號呼叫彈跳
- `kdsCtaReady` — 可取餐 CTA 綠色脈動
- `kdsCardPulseRed` — 待確認卡片紅色脈動
- `kdsCardCritical` — >300s 臨界背景脈動
- `kdsCardEnter` — 新卡片進場
- `kdsFlyOut` — 完成飛出
- `kdsCelebrate` — 完成慶祝
- `kdsNewOrderAlert` — 新單橫幅警示
- `kdsBatchDown` — 批次快捷條下滑

---

## 具體任務（對應 3 個檔案）

### 1. `liff-ordering/kds.html`

- 移除 `<section class="ops-panel">` 裡的 `.ops-tabs` 區塊
- 移除原 `<main id="kds-list" class="ops-grid"></main>`
- 新增：
  - `<div class="kds-alert-strip" id="kds-alert-strip" hidden></div>`
  - `<main class="kds-board">` 含三個 `<section class="kds-col col--pending/--work/--ready">`，每個 col 有 `.col__head`（標題 + count badge）、`<div class="col__body" id="kds-body-pending/work/ready">`
  - `<footer class="kds-stats-bar">` 顯示 LIVE + 各狀態計數
- 既有 `.ops-stats` **保留但加 `style="display:none"`**（不刪，避免 kds.js 裡 getElementById 拋錯）
- 更新 script tag 快取版本號：`ops.css?v=20260419-p2a`、`kds.js?v=20260419-p2a`
- **不可移除** 既有的 `<header class="ops-topbar">`、`auth-loading`、`auth-error` 區塊
- UTF-8 編碼保持（檔頭有註解禁止用未指定編碼工具覆蓋）

### 2. `liff-ordering/ops.css`

在檔尾新增一大塊 `/* ═══ KDS v3 現場最佳化版樣式 ═══ */`：

- 從 `KDS 現場最佳化版 v3.html` 的 `<style>` 區塊完整搬移
- 所有 selector **加 `.kds-` 前綴**（`.card` → `.kds-card`、`.col` → `.kds-col`、`.btn--main` → `.kds-btn--main` …）
- 注意 BEM modifier：`.card--pending`、`.card--work`、`.card--ready`、`.col--pending`、`.col--work`、`.col--ready`、`.btn--primary`、`.btn--sub`、`.group__label`、`.group__badge`、`.items__row`、`.note__strong` 全部前綴化
- `body.pending-mode` → `body.kds-pending-mode`
- 所有 `@keyframes xxx` → `@keyframes kdsXxx`（詳見上表），`animation: xxx` 的引用一併改
- **不影響既有 `.ops-*` class** — 新 class 用 `.kds-` 前綴，完全不重疊

### 3. `liff-ordering/kds.js`

**只改 render 相關程式碼**（大約在 L400–L600），按 `P2_KDS_現場最佳化_檔案級任務包.md` 裡 **P2-A** 段落的 `render()` 範本：

- 依 `order.status` 分成 `cols.pending / cols.work / cols.ready` 三組
  - `status === 'pending'` → pending 欄
  - `status === 'accepted' || status === 'preparing'` → work 欄（兩者合併）
  - `status === 'ready'` → ready 欄
- 分別 `innerHTML` 到 `#kds-body-pending / #kds-body-work / #kds-body-ready`
- 空欄位顯示 `<div class="kds-empty">無待確認</div>` 等
- `document.body.classList.toggle("kds-pending-mode", cols.pending.length > 0)` 用來切 alert strip 顯示

**新增 `renderCard(o)` 函式**：

- 完整複製 `KDS 現場最佳化版 v3.html` 裡的 `cardTpl()` 函式
- 資料欄位改呼叫 `order-helpers.js` 的 helper：`getPickupNumber(o)`、`getCustomerName(o)`、`getOrderGroups(o)`、`getOrderNote(o)` 等
- 若某 helper 不存在，**加到 `order-helpers.js` 尾端**（純讀取函式，零風險）
- 實際欄位名稱以 Firestore 為準 — 先 `console.log(o)` 確認 `pickup_number / customer_name / groups / items / note / source / created_at / status` 實際叫什麼

**保留所有既有函式**：`confirmOrder()`、`setStatusPreparing()`、`setStatusReady()` 等按鈕處理函式完全不動；只是 DOM 裡按鈕 class 從 `.ops-btn` 換成 `.kds-btn--primary`。

---

## Interactions & Behavior

| 互動                  | 行為                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| 新單進來              | 卡片從上方 `kdsCardEnter` 彈入（0.5s cubic-bezier 彈性）                               |
| 按「接單」            | 卡片 `kdsFlyOut` 往右飛出（0.6s），接著在製作中欄 `kdsCardEnter` 進場                  |
| 按「完成」（製作中）  | 卡片飛到可取餐欄                                                                       |
| 按「已取餐」          | 卡片 `kdsCelebrate` 慶祝動畫後消失                                                     |
| Pending >180s         | 卡片 `kdsCardPulseRed` 紅色脈動                                                        |
| Pending >300s         | 整欄 `kdsColAlert` 內層紅光 + 頂部 `kdsStripPulse` 跑馬燈出現                          |
| Ready >120s           | 取餐號 `kdsBlink` 閃爍 + `kdsReadyBoom` 彈跳                                           |
| 多筆 pending 積壓     | 出現批次快捷條（「一次接單 N 筆」按鈕）                                                |

所有互動由 **既有的 onClick handler** 驅動 — 你不需要重寫邏輯，只是把 CSS class 換掉，動畫會透過新的 class + keyframes 自動生效。

---

## State Management

**完全不動** — `state.orders` 的 `onSnapshot` 載入、狀態寫入、欄位名稱全部保留。本任務是純視覺重構。

---

## 硬性約束（務必遵守）

1. **所有新 class 用 `.kds-` 前綴**（如 `.kds-col`、`.kds-card`、`.kds-btn`），不影響既有 `.ops-*` class。
2. **不動 Firestore 讀寫** — 載入、onSnapshot、狀態寫入原樣保留。
3. **不動按鈕 onClick 行為** — 接單/開始/完成走原函式，只是 class 換名。
4. **保留 script tag 順序**：firebase → config.public → order-helpers → staff-auth → order-status-labels → kds.js
5. **快取版本號**：`ops.css?v=20260419-p2a`、`kds.js?v=20260419-p2a`
6. **不可移除** `<header class="ops-topbar">` 和 `auth-loading`、`auth-error` 區塊
7. **UTF-8 編碼保持** — kds.html 檔頭有註解禁止用未指定編碼工具覆蓋
8. **不改 firestore.rules** — 本任務不涉及寫入新欄位

---

## ⚠️ 常見陷阱

1. **不要刪 `.ops-stats`** — kds.js 裡有 `document.getElementById("stat-pending")` 等引用，刪了會拋錯。先加 `style="display:none"`。
2. **不要改 state.orders 的欄位名稱** — 純視覺改動。
3. **複製 style 時 keyframes 要加前綴** — `@keyframes pulseRed` 在專案其他地方可能已被使用。
4. **helper 查不到時先 `console.log(o)` 看欄位** — `order.groups`、`order.items`、`order.pickup_number`、`order.customer_name`、`order.source` 實際名稱以 Firestore 為準。
5. **accepted 和 preparing 都進中欄** — 不要分兩欄。

---

## 驗證清單

實作完成後逐項驗：

- [ ] 平板解析度 1366×768 無橫向捲動
- [ ] 三欄寬度比約 1.4:1:1，每欄獨立垂直捲動
- [ ] 空欄顯示 "無待確認 / 無製作中 / 無可取餐"
- [ ] pending 卡片：取餐號 64px、主 CTA 72px、群組有色塊 A/B、備註黃底
- [ ] 既有 `pending / accepted / preparing / ready` 訂單正確分欄（accepted 和 preparing 都進中欄）
- [ ] 按接單／開始／完成按鈕，原邏輯仍能運作（訂單狀態實際寫回 Firestore）
- [ ] 頁面 hard reload（Cmd+Shift+R）後 CSS 版本號生效
- [ ] 無 console error / warning
- [ ] 既有接單 → 開始 → 完成流程可走完一輪
- [ ] alert strip 在有 >300s pending 時自動浮現
- [ ] pending 卡片超時視覺（>180s 紅脈動、>300s 紅底臨界）按時間觸發

---

## 回滾策略

```bash
git revert <commit-hash>
```

3 個檔（`kds.html`、`ops.css`、`kds.js`）全部回滾即恢復既有 UI。

---

## ✅ 完成標準

- [ ] 所有驗證清單通過
- [ ] 沒有 console error / warning
- [ ] 既有接單 → 開始 → 完成流程仍可走完一輪
- [ ] git commit message：`feat(kds): P2-A 三欄版型視覺重構`
- [ ] 自測影片或截圖（平板解析度）貼回 PR

---

## Files in this bundle

| 檔名                                              | 用途                                                    |
| ------------------------------------------------- | ------------------------------------------------------- |
| `README.md`                                       | 本文件 — 任務總覽 + 驗證清單                            |
| `KDS 現場最佳化版 v3.html`                        | **高保真原型** — 樣式、DOM 結構、模板、動畫全部從這裡搬 |
| `P2_KDS_現場最佳化_檔案級任務包.md`               | 詳細的檔案級改動清單（含 `render()` 範本程式碼）        |
| `P1_狀態機統一_任務拆分.md`                       | 背景參考 — P1（狀態機統一）已完成，P2-A 接續            |

### 進入點

1. 先讀本 README 建立全貌
2. 打開 `KDS 現場最佳化版 v3.html` — 瀏覽器直接開、看實際效果與動畫節奏
3. 對照 `P2_KDS_現場最佳化_檔案級任務包.md` 的 P2-A 段落動手
4. 實作中遇到資料欄位對不上 → `console.log(o)` + 參考 `P1_狀態機統一_任務拆分.md` 了解狀態機約定
