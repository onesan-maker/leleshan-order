# 樂樂山 UI＋功能完整開發路線圖
**版本：2026-04-18｜文件狀態：完整版（含 Phase 1 + Phase 2 + 補遺）**

---

## 0. 文件摘要

| 項目 | 內容 |
|------|------|
| 本文件用途 | 四個頁面所有 UI / 功能 / 流程 / 風險問題的完整排程總表，可直接用作 Codex / Claude Code 任務派發依據 |
| 涵蓋頁面 | 前台點餐 `/`、POS `/pos`、後台 `/pos-admin`、KDS `/kds` |
| 排序原則 | 見 §1 |
| 任務包總數 | 47 個（Phase 1：22 個｜Phase 2：25 個） |
| 最後更新 | 2026-04-18，基於原始碼完整閱讀（index.html、pos.html、pos-admin.html、kds.html、kds.js）及多輪 UI 檢視報告 |

### 風險標記說明

| 標記 | 意義 |
|------|------|
| 🟢 安全 | 幾乎不動邏輯，只改 CSS / HTML 結構 / 靜態文字，丟給 Codex 可直接執行 |
| 🟡 中風險 | 涉及 JS 邏輯或現有函式，需驗收後再 deploy |
| 🔴 高風險 | 觸及核心流程、Firestore query / listener、跨頁資料、LIFF / WebView 行為，建議 Claude Code 或人工確認 |

---

## 1. 排序原則

優先順序由高至低：

1. **不漏單、不出錯** — 廚房漏單、誤取消、靜默斷線
2. **店員操作速度** — 每筆訂單的操作步驟數、改錯成本
3. **後台管理基本能力** — 對帳、查單、改設定
4. **顧客端體驗** — 狀態追蹤、下單流程順暢
5. **純視覺優化** — 色彩、間距、字級等美化

> 同優先級內，先排「風險低、改動小」的項目，讓早期 deploy 安全。

---

## 2. 全部問題總覽表

> 「來源」欄：V1 = 第一版報告提過、V2 = 第二版報告（修正版）提過、補 = 本次補遺新增

| 編號 | 頁面 | 類型 | 問題名稱 | 來源 | Phase | 風險 |
|------|------|------|---------|------|-------|------|
| KDS-01 | KDS | UI | 取餐號碼位置偏左且字體過小，遠距無法辨識 | V1 | 1 | 🟢 |
| KDS-02 | KDS | UI | 等待時間無顏色警示，無法一眼識別超時單 | V1 | 1 | 🟢 |
| KDS-03 | KDS | 功能 | 取消按鈕用 `window.confirm()`，平板易誤觸且部分 WebView 不支援 | V1 | 1 | 🟡 |
| KDS-04 | KDS | 功能 | 新訂單進入無音效，廚房不盯螢幕必漏單 | V1 | 1 | 🔴 |
| KDS-05 | KDS | 功能 | Firestore 連線中斷時畫面無任何提示 | V2 | 1 | 🟡 |
| KDS-06 | KDS | UI | 「完成取餐」與「取消」按鈕間距太近，易誤觸 | V2 | 1 | 🟢 |
| KDS-07 | KDS | UI | 群組標題（第N組｜口味｜主食）與品項列視覺差距不明顯 | V2 | 1 | 🟢 |
| KDS-08 | KDS | 功能 | `ready` 狀態訂單累積後無超時催取提示 | V1 | 2 | 🟡 |
| KDS-09 | KDS | 功能 | 無叫號連動（status→ready 時應通知顧客或更新叫號板） | V1 | 2 | 🔴 |
| KDS-10 | KDS | 功能 | 無站別過濾（例：煮麵站只看麵類品項） | V1 | 2 | 🔴 |
| KDS-11 | KDS | 功能 | 無品項完成進度追蹤（無法廚師勾選單項完成） | V1 | 2 | 🔴 |
| POS-01 | POS | UI | Spec Modal 無頂部 × 關閉按鈕，只有底部「取消」 | V2（修正 V1 低估） | 1 | 🟢 |
| POS-02 | POS | UI | `pos-detail-close`（訂單詳情關閉）36×36px，低於 44px 觸控目標 | V2 | 1 | 🟢 |
| POS-03 | POS | 功能 | 購物車品項無法修改口味/主食，選錯只能刪掉重選 | V1 | 1 | 🟡 |
| POS-04 | POS | UI | 結帳成功後無「開始下一筆」CTA，店員不知道怎麼繼續 | V1 | 1 | 🟢 |
| POS-05 | POS | 功能 | 取消追加模式後，無說明目前購物車狀態如何處理 | V2 | 1 | 🟢 |
| POS-06 | POS | UI | 「套用↗」按鈕文字語意不清，opacity:.75 視覺偏淡 | V1 | 2 | 🟢 |
| POS-07 | POS | UI | 購物車欄位（顧客/LINE/時間/備註）空購物車時全部展開，冗長 | V2 | 2 | 🟡 |
| POS-08 | POS | UI | 菜單格線 `minmax(160px,1fr)` 大螢幕可能 6 欄，品名截斷 | V1 | 2 | 🟢 |
| POS-09 | POS | 功能 | 付款方式僅「現金」「Line Pay」硬編碼，無法後台設定 | V2 | 2 | 🟡 |
| POS-10 | POS | 功能 | 無折扣輸入欄 | V1 | 2 | 🟡 |
| POS-11 | POS | 功能 | 今日訂單列表無快捷狀態更新（需去 KDS 才能推進） | V2 | 2 | 🟡 |
| POS-12 | POS | 功能 | 無暫存訂單（hold）功能 | V1 | 2 | 🔴 |
| POS-13 | POS | 功能 | 無分單（split bill）功能 | V1 | 2 | 🔴 |
| POS-14 | POS | 功能 | 無快捷備註 chip（常用備註如「不辣」「少鹽」） | V1 | 2 | 🟡 |
| POS-15 | POS | UI | `⚠ 缺口味` badge 與品項名稱擠同一行，小螢幕截斷 | 補 | 2 | 🟢 |
| ADMIN-01 | pos-admin | UI | Sidebar stub 項目（員工管理、營業設定）分散注意力 | V1 | 1 | 🟢 |
| ADMIN-02 | pos-admin | 流程 | 測試工具區塊無明顯警示，管理者易誤建測試單 | V1 | 1 | 🟢 |
| ADMIN-03 | pos-admin | UI | POS 規則儲存成功訊息未說明「何時生效」 | V1 | 1 | 🟢 |
| ADMIN-04 | pos-admin | UI | 訂單表格「摘要」欄無截斷，長訂單排版崩潰 | V2 | 1 | 🟢 |
| ADMIN-05 | pos-admin | 功能 | 無歷史日期查詢，只能看今日訂單 | V1 | 1 | 🟡 |
| ADMIN-06 | pos-admin | 功能 | 無匯出 CSV，無法對帳 | V1 | 1 | 🔴 |
| ADMIN-07 | pos-admin | 流程 | 清除測試訂單無二次確認 | V2 | 1 | 🟢 |
| ADMIN-08 | pos-admin | UI | 儀表板數字卡片無前後期對比（昨日 / 上週） | V1 | 2 | 🟡 |
| ADMIN-09 | pos-admin | UI | 商品管理（POS規則 + 全局口味 + 商品列表）全在同一長頁，資訊密度過高 | V2 | 2 | 🟡 |
| ADMIN-10 | pos-admin | 功能 | 訂單管理無法直接修改訂單內容（備註、品項、狀態） | V1 | 2 | 🔴 |
| ADMIN-11 | pos-admin | 功能 | 無商品新增/刪除功能，只能用 Firestore Console | V1 | 2 | 🔴 |
| ADMIN-12 | pos-admin | 功能 | 無營業時間開關（控制前台是否可下單） | V1 | 2 | 🔴 |
| ADMIN-13 | pos-admin | 功能 | 商品列表缺批量操作（如全部停售） | V1 | 2 | 🟡 |
| ADMIN-14 | pos-admin | 功能 | 訂單管理無日期範圍篩選（目前 ADMIN-05 是單日，但範圍查詢也需要） | 補 | 2 | 🟡 |
| INDEX-01 | 前台 | UI | `floating-cart` 底部可能缺 `env(safe-area-inset-bottom)`，iPhone 結帳被遮 | V2 | 1 | 🟢 |
| INDEX-02 | 前台 | 功能 | 前台售完商品顯示方式未確認（`ui.js` 未驗證） | V2 | 1 | 🟡 |
| INDEX-03 | 前台 | 功能 | 「我的訂單」有歷史清單，但無即時狀態顯示（new/preparing/ready） | V2（修正 V1） | 1 | 🔴 |
| INDEX-04 | 前台 | UI | 訂單成功頁（`order-success-screen`）缺「查看訂單狀態」連結 | V2 | 1 | 🟢 |
| INDEX-05 | 前台 | UI | `sticky-flavor-bar` 只有口味切換，缺套餐/單點區段快捷跳轉 | V2（修正 V1） | 2 | 🟡 |
| INDEX-06 | 前台 | UI | `quantity-modal` 口味/主食用 `<select>`，不如 POS spec 的卡片選法直覺 | V2 | 2 | 🟡 |
| INDEX-07 | 前台 | UI | `flavor-confirm-modal` 當前口味選中視覺不明確 | V2 | 2 | 🟢 |
| INDEX-08 | 前台 | 功能 | 顧客無法從前台申請取消訂單（new 狀態 5 分鐘內） | V1 | 2 | 🔴 |
| INDEX-09 | 前台 | 功能 | 下單成功後無估計等待時間 | V1 | 2 | 🔴 |

---

## 3. Phase 1 開發順序

```
Step 1：KDS 防漏單強化（不漏單是最高優先）
Step 2：POS 核心操作修復（每筆訂單都用到）
Step 3：後台基本管理能力（影響日常對帳與設定）
Step 4：前台基本體驗修復（顧客端，影響較間接）
```

---

### Step 1｜KDS 防漏單強化

---

#### 🟢 任務包 P1-01｜KDS 取餐號碼放大置中

- **頁面**：KDS
- **對應問題**：KDS-01
- **來源**：V1（已列，已拆任務包）
- **目標**：廚房員工叫號時站在 1.5m 外可清楚看到號碼
- **修改內容**：
  - `.kds-pickup-num` 字級改為 `2.4rem`、`text-align:center`、`width:100%`
  - `kds.js` → `renderCard()` 確認 `pickupNumHtml` 輸出在 `order-card__head` **之前**（即卡片最頂端）
- **涉及檔案**：`ops.css`、`kds.js`
- **依賴任務**：無
- **驗收方式**：KDS 開啟後，取餐號碼出現在每張卡片最頂端、水平置中，站在 1.5m 外可清楚閱讀
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-02｜KDS 等待時間顏色警示

- **頁面**：KDS
- **對應問題**：KDS-02
- **來源**：V1（已列，已拆任務包）
- **目標**：超時訂單視覺上立即可辨
- **修改內容**：
  - `kds.js` → `renderCard()` 計算 `elapsed`，在 article class 加 `order-card--warn`（10-19分）或 `order-card--urgent`（≥20分）
  - `ops.css` 加：
    ```css
    .order-card--warn   { border-color: rgba(234,179,8,.7) !important; }
    .order-card--urgent { border-color: rgba(239,68,68,.85) !important; box-shadow: 0 0 0 2px rgba(239,68,68,.3); }
    ```
- **涉及檔案**：`kds.js`、`ops.css`
- **依賴任務**：無
- **驗收方式**：建立測試訂單，手動調整 `created_at` 為 10 分鐘前→邊框變黃；20 分鐘前→邊框變紅
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P1-03｜KDS 取消按鈕長按保護

- **頁面**：KDS
- **對應問題**：KDS-03
- **來源**：V1（已列，已拆任務包）
- **目標**：防止廚房誤觸取消整筆訂單；移除 `window.confirm()`（WebView 不穩定）
- **修改內容**：
  - 移除 `el.list` 的 cancel click handler
  - 改為 `pointerdown` 計時 1500ms、`pointerup` / `pointercancel` 清除計時器
  - 按住時對按鈕加 `outline` 視覺反饋，放開則清除
  - 長按到底才呼叫 `changeStatus(orderId, "cancelled")`
- **涉及檔案**：`kds.js`
- **依賴任務**：無
- **驗收方式**：短按「取消」不觸發；長按 1.5 秒訂單消失；中途鬆手不觸發；在 iPad Safari 測試
- **適合丟 Codex？** ✅ 可，但需附驗收步驟
- **風險等級**：🟡（pointer event 在 iPad Safari 需測試）

---

#### 🔴 任務包 P1-04｜KDS 新訂單音效提醒

- **頁面**：KDS
- **對應問題**：KDS-04
- **來源**：V1（已列，已拆任務包）
- **目標**：新訂單進入廚房時觸發短促音效
- **修改內容**：
  - `kds.js` 頂部加 Web Audio API 音效函式 `playNewOrderBeep()`（sine 波 880Hz，0.35 秒，try/catch 保護）
  - `kds.html` 頂部加「🔔 點此啟用提示音」按鈕，點擊後 `new AudioContext()` 解鎖
  - `onData` callback 比對 `new` 狀態訂單數，若增加則播音
  - `_audioCtx` 懶初始化，避免未互動時建立報錯
- **涉及檔案**：`kds.js`、`kds.html`
- **依賴任務**：建議 P1-01~P1-03 完成後再做
- **驗收方式**：點擊啟用按鈕→POS 建立新訂單→KDS 播放提示音；測試 Chrome / iPad Safari / 全螢幕 Kiosk 模式
- **適合丟 Codex？** ⚠️ 建議 Claude Code（需理解 AudioContext 瀏覽器限制）
- **風險等級**：🔴

---

#### 🟡 任務包 P1-05｜KDS Firestore 連線中斷告警

- **頁面**：KDS
- **對應問題**：KDS-05
- **來源**：V2（補充，未拆任務包）
- **目標**：即時偵測 Firestore listener 斷線，廚房知道資料可能過時
- **修改內容**：
  - `kds.js` → `subscribeStoreOrders` 的 `onError` callback 除現有 `handleError` 外，再加頂部橫幅警告（新增 `#kds-conn-banner` 元素）
  - 顯示「⚠ 連線中斷，資料可能未更新，請重新整理」黃色橫幅
  - 連線恢復時（`onData` 再次觸發）移除橫幅
- **涉及檔案**：`kds.html`（加 banner 元素）、`kds.js`、`ops.css`（banner 樣式）
- **依賴任務**：無
- **驗收方式**：斷網再連網，確認橫幅出現後消失；不斷網時橫幅不出現
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡

---

#### 🟢 任務包 P1-06｜KDS 按鈕間距調整（防誤觸）

- **頁面**：KDS
- **對應問題**：KDS-06
- **來源**：V2（已列，未拆任務包）
- **目標**：「完成取餐」和「取消」按鈕間距加大，防止誤觸
- **修改內容**：
  - `ops.css` → `.order-card__actions` 加 `justify-content: space-between`
  - 或在「取消」按鈕加 `margin-left: auto`
- **涉及檔案**：`ops.css`
- **依賴任務**：無
- **驗收方式**：KDS 開啟，ready 卡片的「完成取餐」和「取消」按鈕明顯分開在兩端
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-07｜KDS 群組標題視覺強化

- **頁面**：KDS
- **對應問題**：KDS-07
- **來源**：V2（已列，未拆任務包）
- **目標**：群組標題（`第N組｜口味｜主食`）與品項列有明顯層次
- **修改內容**：
  - `ops.css` → `.order-card__group-label`：`font-weight:700; font-size: calc(1em + 1px); color: #fed7aa;`
  - `.order-card__items`：`padding-left: 10px`
- **涉及檔案**：`ops.css`
- **依賴任務**：無
- **驗收方式**：KDS 卡片中有多組的訂單，群組標題比品項文字明顯粗一階
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

### Step 2｜POS 核心操作修復

---

#### 🟢 任務包 P1-08｜POS Spec Modal 頂部關閉按鈕

- **頁面**：POS
- **對應問題**：POS-01
- **來源**：V2（修正 V1，已拆任務包）
- **目標**：店員誤開 Spec Modal 可快速關閉
- **修改內容**：
  - `pos.html` → `pos-spec-card` 最頂行改為 flex 容器，將 `<h3>` 和新的 `×` 按鈕（`id="pos-spec-close-top"`，`min-width/height:44px`）並排
  - `pos.js` → `cache()` 加 `el.specCloseTop`，在 bind / start 加 click listener 呼叫 `closeSpecModal()`
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：無
- **驗收方式**：點任何商品打開 Spec Modal，右上角有 `×` 按鈕，點擊後 Modal 關閉且不加入購物車
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-09｜POS 訂單詳情關閉按鈕 Touch Target 修正

- **頁面**：POS
- **對應問題**：POS-02
- **來源**：V2（已列，未拆獨立任務包）
- **目標**：`pos-detail-close` 觸控目標符合 44×44px 標準
- **修改內容**：
  - `pos.html` inline style 或 CSS → `.pos-detail-close`：`min-width:44px; min-height:44px`（原為 `width:36px; height:36px`）
- **涉及檔案**：`pos.html`（inline style 區塊）
- **依賴任務**：無
- **驗收方式**：開啟訂單詳情 overlay，關閉按鈕在手機上可單指精準點擊
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P1-10｜POS 購物車品項修改功能

- **頁面**：POS
- **對應問題**：POS-03
- **來源**：V1（已列，已拆任務包）
- **目標**：購物車品項加「✏」按鈕，可修改口味/主食，不需刪掉重選
- **修改內容**：
  - `pos.js` → `renderCart()` 每筆 item 行加 `<button class="pos-cart-edit-btn" data-edit-key="...">✏</button>`
  - `pos.html` inline CSS 加 `.pos-cart-edit-btn` 樣式
  - `pos.js` → 購物車 click handler 加 `data-edit-key` 攔截，呼叫 `openSpecModal(item.productId, { editKey, prefill: item })`
  - `openSpecModal()` 加 `prefill` 參數支援：預先設定 `selectedFlavor`、`selectedStaple`
  - 確認時用 `editKey` 更新原有品項而非新增
- **涉及檔案**：`pos.js`、`pos.html`
- **依賴任務**：P1-08（Spec Modal 有關閉按鈕才算完整）
- **驗收方式**：
  1. 加入一個有口味的套餐
  2. 點「✏」，Spec Modal 打開，原口味已選中（橘色卡片）
  3. 改選新口味確認，購物車更新，總價正確
  4. 正常新增品項流程不受影響
- **適合丟 Codex？** ⚠️ 建議 Claude Code
- **風險等級**：🟡（prefill 邏輯易干擾新增流程）

---

#### 🟢 任務包 P1-11｜POS 結帳成功後「開始下一筆」按鈕

- **頁面**：POS
- **對應問題**：POS-04
- **來源**：V1（已列，已拆任務包）
- **目標**：結帳後店員有明確 CTA，不需手動清空
- **修改內容**：
  - `pos.html` → `pos-status` 下方加 `<button id="pos-new-order-btn" style="display:none">✓ 開始下一筆訂單</button>`（綠色樣式）
  - `pos.js` → submit 成功後 `el.newOrderBtn.style.display="block"`；`el.submitBtn.style.display="none"`
  - `el.newOrderBtn` click → 呼叫 `resetCart()`，按鈕隱藏，`submitBtn` 恢復
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：無
- **驗收方式**：完成一筆結帳 → 出現綠色「開始下一筆」按鈕 → 點擊後購物車清空、按鈕消失
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-12｜POS 取消追加模式狀態說明

- **頁面**：POS
- **對應問題**：POS-05
- **來源**：V2（已列，未拆任務包）
- **目標**：取消追加模式後，店員清楚知道購物車現在是什麼狀態
- **修改內容**：
  - `pos.js` → `pos-append-cancel-btn` click handler 執行取消後，用 `showStatus("已取消追加模式，購物車內容保留", "ok")` 顯示 2 秒提示
- **涉及檔案**：`pos.js`
- **依賴任務**：無
- **驗收方式**：進入追加模式後點「取消追加模式」，畫面顯示「已取消追加模式，購物車內容保留」提示訊息
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

### Step 3｜後台基本管理能力

---

#### 🟢 任務包 P1-13｜後台 Sidebar Stub 禁用

- **頁面**：pos-admin
- **對應問題**：ADMIN-01
- **來源**：V1（已列，已拆，合併在 P1 中）
- **目標**：移除 stub 項目對管理者的視覺干擾
- **修改內容**：
  - `pos-admin.html` → `pa-nav__item--stub` 加 `style="opacity:.4; cursor:not-allowed; pointer-events:none;"`
  - 移除 `<small>即將開放</small>`，改為 `title="尚未開放"` tooltip
- **涉及檔案**：`pos-admin.html`
- **依賴任務**：無
- **驗收方式**：後台側邊欄「員工管理」「營業設定」呈灰色、點擊無反應
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-14｜後台測試工具二次確認

- **頁面**：pos-admin
- **對應問題**：ADMIN-02、ADMIN-07
- **來源**：V1 + V2（合併兩個相關問題）
- **目標**：防止管理者誤觸「清除測試訂單」
- **修改內容**：
  - `pos-admin.js` → 「清除測試訂單」click handler 最前面加 `if (!window.confirm("確定清除所有測試訂單？此操作不可還原。")) return;`
  - `pos-admin.html` → 測試工具區塊 `<h2>` 改為加醒目說明：`style="color:#f87171"` 並補文字「⚠ 僅限開發環境使用」
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`
- **依賴任務**：無
- **驗收方式**：點「清除測試訂單」出現確認彈窗；測試工具 header 有紅色警示文字
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-15｜後台 POS 規則儲存訊息修正

- **頁面**：pos-admin
- **對應問題**：ADMIN-03
- **來源**：V1（已列，未拆獨立任務包）
- **目標**：讓管理者知道改完規則何時生效
- **修改內容**：
  - `pos-admin.js` → `savePosRules()` 成功訊息改為 `"已儲存。POS 下次開啟或重新整理後生效。"`
  - 全局口味/主食儲存訊息同樣補充說明
- **涉及檔案**：`pos-admin.js`
- **依賴任務**：無
- **驗收方式**：後台儲存 POS 規則，成功訊息包含「重新整理後生效」
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟢 任務包 P1-16｜後台訂單摘要欄截斷＋Tooltip

- **頁面**：pos-admin
- **對應問題**：ADMIN-04
- **來源**：V2（已列，已拆任務包）
- **目標**：長訂單摘要不破版，hover 可看完整內容
- **修改內容**：
  - `pos-admin.css` 加 `.pa-table-summary { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }`
  - `pos-admin.js` → 建立訂單列 `<td>` 時，摘要改為 `<span class="pa-table-summary" title="${summaryText}">${summaryText}</span>`
- **涉及檔案**：`pos-admin.css`、`pos-admin.js`
- **依賴任務**：無
- **驗收方式**：訂單管理表格中長摘要顯示 `...`，滑鼠懸停顯示完整文字
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P1-17｜後台歷史日期查詢

- **頁面**：pos-admin
- **對應問題**：ADMIN-05
- **來源**：V1（已列，已拆任務包）
- **目標**：管理者可查任意一天的訂單與統計
- **修改內容**：
  - `pos-admin.html` → dashboard panel head 和 orders panel head 各加 `<input type="date" id="pa-date-picker" class="pa-mini-input">`，預設值為今日
  - `pos-admin.js` → `loadDashboard()` 和 `loadOrders()` 改用 picker 值計算 dayStart / dayEnd（UTC+8）並傳入 Firestore query（`.where("created_at", ">=", dayStart).where("created_at", "<=", dayEnd)`）
  - date picker `change` 事件觸發重新載入
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`、`pos-admin.css`（mini-input 樣式）
- **依賴任務**：無
- **驗收方式**：選昨天 → 訂單表格和統計數字更新為昨天資料；選今天 → 恢復今日資料
- **適合丟 Codex？** ✅ 可，但需標注 Firestore index 確認
- **風險等級**：🟡（需確認 `created_at` range query 有 Firestore index，否則會報錯）

---

#### 🔴 任務包 P1-18｜後台訂單匯出 CSV

- **頁面**：pos-admin
- **對應問題**：ADMIN-06
- **來源**：V1（已列，已拆任務包）
- **目標**：管理者可下載當日（或選定日期）訂單的 CSV 供 Excel 對帳
- **修改內容**：
  - `pos-admin.html` → 訂單 panel head 加 `<button id="pa-export-csv-btn" class="pa-mini-btn">匯出 CSV</button>`
  - `pos-admin.js` 加 `exportOrdersCsv(orders)` 函式：
    - 欄位：時間、訂單編號、顧客名稱、來源、金額、狀態、品項摘要
    - `\uFEFF` BOM 確保 Excel 中文不亂碼
    - 用 `Blob` + `URL.createObjectURL` + 動態 `<a>` 下載
    - 檔名包含日期（使用 date picker 值）
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`
- **依賴任務**：P1-17（有 date picker 才能控制匯出範圍）
- **驗收方式**：點「匯出 CSV」，下載 `orders-YYYY-MM-DD.csv`，用 Excel 開啟欄位正確、中文無亂碼
- **適合丟 Codex？** ⚠️ 建議 Claude Code
- **風險等級**：🔴（BOM、日期 timezone、大量訂單記憶體、特殊字元逸出）

---

### Step 4｜前台基本體驗修復

---

#### 🟢 任務包 P1-19｜前台 iOS 底部安全區域

- **頁面**：前台
- **對應問題**：INDEX-01
- **來源**：V2（已列，已拆任務包）
- **目標**：iPhone 底部「送出訂單」按鈕不被 Home Bar 遮住
- **修改內容**：
  - `styles.css` → `.floating-cart`（或其 inner padding 容器）加 `padding-bottom: calc(16px + env(safe-area-inset-bottom))`
  - 確認 `index.html` 已有 `viewport-fit=cover`（已確認存在）
- **涉及檔案**：`styles.css`
- **依賴任務**：無
- **驗收方式**：iPhone Safari 開啟前台，「送出訂單」按鈕不被底部工具列遮擋
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P1-20｜前台售完商品顯示確認與修正

- **頁面**：前台
- **對應問題**：INDEX-02
- **來源**：V2（已列，未拆獨立任務包）
- **目標**：確認前台 LIFF 是否正確處理 `available: false` 商品，確保有視覺鎖定
- **修改內容**：
  - 先讀取 `ui.js` 確認是否有 `available` 判斷
  - 若無：在商品 render 函式中，對 `available === false` 的商品加灰化 class + 「今日售完」badge + `pointer-events:none`
  - 若已有：確認視覺樣式與 POS 的 `.pos-menu-tile--soldout` 一致
- **涉及檔案**：`ui.js`（需先讀確認）、`styles.css`
- **依賴任務**：無
- **驗收方式**：將某商品 `available` 設為 `false`，前台顯示「今日售完」遮罩，點擊無反應
- **適合丟 Codex？** ⚠️ 需先讀 `ui.js`
- **風險等級**：🟡

---

#### 🟢 任務包 P1-21｜前台訂單成功頁加「查看訂單狀態」連結

- **頁面**：前台
- **對應問題**：INDEX-04
- **來源**：V2（已列，未拆獨立任務包）
- **目標**：顧客下單成功後能快速進入訂單狀態查詢
- **修改內容**：
  - `index.html` → `order-success-screen` 的 `oss-card` 內，`oss-back-btn` 前加一個 `<button id="oss-view-status-btn" class="ghost-btn">查看訂單進度</button>`
  - `app.js` / `checkout.js` 加 click handler → 打開 `#my-orders-overlay`（已存在）並自動定位到最新訂單
- **涉及檔案**：`index.html`、`app.js` 或 `checkout.js`
- **依賴任務**：P1-22（最好先有即時狀態，否則此按鈕價值有限，但本身可獨立做）
- **驗收方式**：下單成功頁出現「查看訂單進度」按鈕，點擊打開「我的訂單」overlay
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🔴 任務包 P1-22｜前台訂單即時狀態 Badge

- **頁面**：前台
- **對應問題**：INDEX-03
- **來源**：V2（修正 V1，已拆任務包）
- **目標**：「我的訂單」overlay 顯示即時狀態，`ready` 時閃爍提示
- **修改內容**：
  - `member.js` → 訂單列表 render 時每筆加狀態 badge（`new`/`preparing`/`ready`/`completed`）
  - 對進行中訂單（非 completed/cancelled）建立 Firestore `onSnapshot` 監聽，狀態變更時更新 DOM
  - 注意 listener 清理（overlay 關閉時 `unsubscribe`）
  - `ready` 狀態加 CSS pulse 動畫
  - 新增 CSS class 在 `styles.css`
- **涉及檔案**：`member.js`、`styles.css`
- **依賴任務**：無（但建議 KDS 流程穩定後再做）
- **驗收方式**：前台下單 → 「我的訂單」顯示「等待接單」→ KDS 推進到「可取餐」→ badge 自動更新為「✅ 可取餐！」並閃爍
- **適合丟 Codex？** ⚠️ 建議 Claude Code
- **風險等級**：🔴（Firestore listener 管理、LIFF 環境記憶體洩漏風險）

---

## 4. Phase 2 開發順序

---

### Step 5｜KDS 進階功能

---

#### 🟡 任務包 P2-01｜KDS Ready 訂單超時催取提示

- **頁面**：KDS
- **對應問題**：KDS-08
- **來源**：V1（已列，未拆任務包）
- **目標**：`ready` 狀態超過 5 分鐘未取餐時，卡片加黃色外框提示
- **修改內容**：
  - `kds.js` → `renderCard()` 中，若 `order.status === "ready"` 且自狀態變更起超過 5 分鐘，加 `order-card--ready-warn` class
  - 需在 order 資料中有 `status_updated_at` 欄位（若無，需 `order-helpers.js` 補充）
  - `ops.css` 加對應樣式
- **涉及檔案**：`kds.js`、`ops.css`
- **依賴任務**：P1-02（顏色系統一致）
- **驗收方式**：手動建立 `ready` 狀態訂單，修改 `status_updated_at` 為 6 分鐘前，確認黃框出現
- **適合丟 Codex？** ✅ 可，需確認資料欄位
- **風險等級**：🟡

---

#### 🔴 任務包 P2-02｜KDS 叫號連動（display.html）

- **頁面**：KDS + 叫號板
- **對應問題**：KDS-09
- **來源**：V1（已列，未拆任務包）
- **目標**：KDS 點「餐點完成」（status → ready）時，叫號板自動顯示取餐號碼
- **修改內容**：
  - `kds.js` → `changeStatus` 成功後，若 `nextStatus === "ready"` 且 order 有 `pickupNumber`，寫入 Firestore `display/{storeId}/calling`
  - `display.html` / `display.js`（已存在）監聽此欄位並更新畫面
- **涉及檔案**：`kds.js`、`display.html`、`display.js`（需讀取確認現有邏輯）
- **依賴任務**：無
- **驗收方式**：KDS 推進到 ready，叫號板同步顯示取餐號碼
- **適合丟 Codex？** ⚠️ 建議 Claude Code（需理解 display.html 現有邏輯）
- **風險等級**：🔴

---

#### 🔴 任務包 P2-03｜KDS 站別過濾

- **頁面**：KDS
- **對應問題**：KDS-10
- **來源**：V1（已列，未拆任務包）
- **目標**：不同廚房站（如煮麵站）只看相關品項的訂單或品項
- **修改內容**：
  - `kds.html` 加站別選擇 select（從 Firestore `settings.kdsSections` 讀取）
  - `kds.js` 篩選邏輯：filter order.items 中含有指定 `category` 的品項
  - 需後台能設定哪些商品屬於哪個站別
- **涉及檔案**：`kds.html`、`kds.js`、`pos-admin.html`、`pos-admin.js`（後台設定端）
- **依賴任務**：ADMIN-11（商品管理完善後）
- **驗收方式**：選「煮麵站」只顯示含麵類品項的訂單
- **適合丟 Codex？** ❌ 建議人工設計後再交出
- **風險等級**：🔴（涉及多檔案、資料結構設計）

---

#### 🔴 任務包 P2-04｜KDS 品項完成進度追蹤

- **頁面**：KDS
- **對應問題**：KDS-11
- **來源**：V1（已列，未拆任務包）
- **目標**：廚師可勾選個別品項已完成，卡片顯示部分完成進度
- **修改內容**：
  - `kds.js` → 每個品項加 checkbox，點擊後寫入 Firestore `orders/{id}/itemProgress`
  - 卡片頂部顯示進度（如 `3 / 5 項完成`）
- **涉及檔案**：`kds.js`、`kds.html`（CSS）
- **依賴任務**：無
- **驗收方式**：勾選品項後有刪除線，進度條更新
- **適合丟 Codex？** ⚠️ 建議 Claude Code
- **風險等級**：🔴

---

### Step 6｜POS 進階功能

---

#### 🟢 任務包 P2-05｜POS「套用↗」按鈕語意優化

- **頁面**：POS
- **對應問題**：POS-06
- **來源**：V1 + V2（已列，未拆獨立任務包）
- **目標**：讓「指定品項到特定份數」功能對店員更直覺
- **修改內容**：
  - `pos.html` → `pos-assign-toggle-btn` 文字改為「↪ 指定到...」
  - `title` tooltip 改為「點擊後選擇要加入哪個口味組，再點品項加入」
  - `.pos-part-btn--sm` opacity 從 `.75` 改為 `1`
- **涉及檔案**：`pos.html`
- **依賴任務**：無
- **驗收方式**：按鈕文字更新，hover tooltip 說明清楚
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P2-06｜POS 購物車欄位摺疊

- **頁面**：POS
- **對應問題**：POS-07
- **來源**：V2（已列，未拆任務包）
- **目標**：空購物車時不顯示顧客資料欄位，有品項才展開
- **修改內容**：
  - `pos.js` → `renderCart()` 時，若 `state.cart.length === 0` 則 `el.cartFields.style.display="none"`，有品項則顯示
  - 或改為 accordion（`<details><summary>填寫顧客資料（選填）</summary>...</details>`）
- **涉及檔案**：`pos.js`、`pos.html`
- **依賴任務**：無
- **驗收方式**：空購物車時顧客資料欄位隱藏；加入第一個品項後自動展開
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡（需確認展開/收合不影響現有 submit 邏輯）

---

#### 🟢 任務包 P2-07｜POS 菜單格線最大欄數限制

- **頁面**：POS
- **對應問題**：POS-08
- **來源**：V1（已列，未拆獨立任務包）
- **目標**：大螢幕下菜單不超過 4 欄，品名不截斷
- **修改內容**：
  - `pos.html` inline CSS → `.pos-menu-grid`：改為 `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); max-width: calc(4 * 160px + 3 * 10px)` 或加 `@media (min-width:900px) { .pos-menu-grid { grid-template-columns: repeat(4, 1fr); } }`
  - `.pos-menu-tile__name` 加 `word-break: keep-all`
- **涉及檔案**：`pos.html`
- **依賴任務**：無
- **驗收方式**：1440px 寬螢幕開 POS，菜單最多 4 欄，品名不截斷
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🟡 任務包 P2-08｜POS 付款方式動態化

- **頁面**：POS
- **對應問題**：POS-09
- **來源**：V2（已列，未拆任務包）
- **目標**：付款方式（現金/Line Pay/信用卡等）從 Firestore 設定讀取，不再硬編碼
- **修改內容**：
  - Firestore `settings/{storeId}/paymentMethods` 加欄位
  - `pos.js` → init 時讀取，動態 render 付款按鈕
  - `pos-admin.html` → 營業設定區塊加付款方式勾選設定
- **涉及檔案**：`pos.js`、`pos-admin.html`、`pos-admin.js`
- **依賴任務**：無
- **驗收方式**：後台加「信用卡」選項後，POS 結帳區出現信用卡按鈕
- **適合丟 Codex？** ⚠️ 建議 Claude Code（跨頁資料）
- **風險等級**：🟡

---

#### 🟡 任務包 P2-09｜POS 折扣欄位

- **頁面**：POS
- **對應問題**：POS-10
- **來源**：V1（已列，未拆任務包）
- **目標**：店員可輸入折扣（固定金額或百分比），結帳金額自動更新
- **修改內容**：
  - `pos.html` → `pos-checkout` 內加折扣 input（`<input type="number" id="pos-discount">`）
  - `pos.js` → `calcTotal()` 納入折扣計算；訂單 payload 加 `discount` 欄位
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：無
- **驗收方式**：輸入 50（NT$50），結帳金額減 50；提交訂單後 Firestore 有 `discount: 50` 欄位
- **適合丟 Codex？** ✅ 可
- **風險等級**：🟡

---

#### 🟡 任務包 P2-10｜POS 今日訂單快捷狀態推進

- **頁面**：POS
- **對應問題**：POS-11
- **來源**：V2（已列，未拆任務包）
- **目標**：今日訂單列表每筆可直接推進到下一個狀態，不需切到 KDS
- **修改內容**：
  - `pos.js` → 訂單列表每行加「下一步」按鈕（顯示當前狀態的下一動作，如「開始製作」）
  - 呼叫 `window.LeLeShanOrders.updateOrderStatus` 更新狀態
- **涉及檔案**：`pos.js`
- **依賴任務**：無
- **驗收方式**：今日訂單列表點「開始製作」，訂單狀態變 preparing，KDS 同步更新
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡

---

#### 🟡 任務包 P2-11｜POS 快捷備註 Chip

- **頁面**：POS
- **對應問題**：POS-14
- **來源**：V1（已列，未拆任務包）
- **目標**：常用備註一鍵插入，節省輸入時間
- **修改內容**：
  - `pos.html` → 備註 input 下方加 chip 列（「不辣」「少鹽」「不加蔥」）
  - 從 Firestore `settings.quickNotes` 讀取，或先硬編碼常見選項
  - 點擊 chip 將文字 append 到 `#pos-note` input
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：無
- **驗收方式**：點「不辣」chip，備註欄自動填入「不辣」
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡

---

#### 🟢 任務包 P2-12｜POS 缺口味 Badge 位置修正

- **頁面**：POS
- **對應問題**：POS-15
- **來源**：補（前面報告提過問題，未拆任務包）
- **目標**：`⚠ 缺口味` badge 不擠壓品項名稱
- **修改內容**：
  - `pos.html` inline CSS → `.pos-cart-item__warn`（or 相關 badge）改為 `display:block; margin-top:3px;` 讓 badge 換行顯示在品項名稱下方
- **涉及檔案**：`pos.html`
- **依賴任務**：無
- **驗收方式**：有缺口味品項時，`⚠ 缺口味` badge 顯示在品項名稱下一行
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🔴 任務包 P2-13｜POS 暫存訂單（Hold）功能

- **頁面**：POS
- **對應問題**：POS-12
- **來源**：V1（已列，未拆任務包）
- **目標**：允許暫存目前購物車，先服務下一位顧客
- **修改內容**：
  - `pos.js` → 加「暫存目前訂單」按鈕，將 `state.cart` 序列化存入 `localStorage.heldCarts[]`
  - 頁面頂部加「暫存列表」按鈕，可恢復任一暫存
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：P1-11（結帳後清空邏輯）
- **驗收方式**：暫存一筆 → 建新單結帳 → 恢復暫存單繼續操作
- **適合丟 Codex？** ❌ 建議 Claude Code
- **風險等級**：🔴（cart state 管理複雜）

---

#### 🔴 任務包 P2-14｜POS 分單（Split Bill）功能

- **頁面**：POS
- **對應問題**：POS-13
- **來源**：V1（已列，未拆任務包）
- **目標**：依份數（part）拆開為多筆訂單各自結帳
- **修改內容**：
  - `pos.js` → 加「分單」按鈕，依 `partId` 分組，為每組建立獨立的 order payload
  - 需處理共享品項（無 partId 的品項如何分配）
- **涉及檔案**：`pos.html`、`pos.js`
- **依賴任務**：P1-10（品項修改）、P2-09（折扣欄位）
- **驗收方式**：2 個 part 的訂單點「分單」→ Firestore 建立 2 筆獨立訂單
- **適合丟 Codex？** ❌ 建議人工設計後再交出
- **風險等級**：🔴

---

### Step 7｜後台進階管理

---

#### 🟡 任務包 P2-15｜後台儀表板前後期對比

- **頁面**：pos-admin
- **對應問題**：ADMIN-08
- **來源**：V1（已列，未拆任務包）
- **目標**：數字卡片下方顯示「較昨日 ↑/↓ X%」
- **修改內容**：
  - `pos-admin.js` → `loadDashboard()` 時同時 query 昨日同時段資料
  - 計算差異百分比，在卡片 `pa-card__value` 下方加比較文字
- **涉及檔案**：`pos-admin.js`、`pos-admin.html`（可能加 DOM 元素）
- **依賴任務**：P1-17（日期 query 邏輯可複用）
- **驗收方式**：今日訂單數下方顯示「較昨日 ↑20%」或「↓5%」
- **適合丟 Codex？** ✅ 可
- **風險等級**：🟡

---

#### 🟡 任務包 P2-16｜後台商品管理分頁化

- **頁面**：pos-admin
- **對應問題**：ADMIN-09
- **來源**：V2（已列，未拆任務包）
- **目標**：POS規則設定、全局口味/主食、商品列表分為子 Tab 或子頁面
- **修改內容**：
  - `pos-admin.html` → 商品管理 view 內加三個子 Tab 按鈕（「規則設定」「口味主食」「商品列表」）
  - `pos-admin.js` 加子 Tab 切換邏輯（顯示/隱藏對應 section）
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`、`pos-admin.css`
- **依賴任務**：無
- **驗收方式**：點「規則設定」只顯示 POS 規則卡片；點「商品列表」只顯示商品列表
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡

---

#### 🟡 任務包 P2-17｜後台訂單日期範圍篩選

- **頁面**：pos-admin
- **對應問題**：ADMIN-14
- **來源**：補（P1-17 是單日，範圍查詢是獨立需求）
- **目標**：管理者可選取日期範圍（如本週）查詢訂單
- **修改內容**：
  - `pos-admin.html` → 訂單管理加「開始日期」「結束日期」兩個 `<input type="date">`
  - `pos-admin.js` → query 改用 start/end range
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`
- **依賴任務**：P1-17
- **驗收方式**：選本週起訖日，訂單表格顯示該週全部訂單
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡

---

#### 🔴 任務包 P2-18｜後台訂單直接修改功能

- **頁面**：pos-admin
- **對應問題**：ADMIN-10
- **來源**：V1（已列，未拆任務包）
- **目標**：管理者可在後台直接修改訂單備註、狀態、品項數量
- **修改內容**：
  - `pos-admin.js` → 訂單列點擊展開 inline edit 面板
  - 備註：可直接編輯 input
  - 狀態：可從 select 改變
  - 品項數量：加減按鈕（需重算 total_price）
  - 儲存後寫入 Firestore
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`、`pos-admin.css`
- **依賴任務**：P1-17（訂單資料載入）
- **驗收方式**：點一筆訂單展開，修改備註儲存後 KDS 同步更新
- **適合丟 Codex？** ❌ 建議 Claude Code
- **風險等級**：🔴

---

#### 🔴 任務包 P2-19｜後台商品新增/刪除表單

- **頁面**：pos-admin
- **對應問題**：ADMIN-11
- **來源**：V1（已列，未拆任務包）
- **目標**：管理者不需進 Firestore Console 就能新增或下架商品
- **修改內容**：
  - `pos-admin.html` → 商品列表上方加「新增商品」按鈕，打開 modal 表單
  - 欄位：名稱、類型、價格、分類、POS 類型、是否上架
  - `pos-admin.js` 加 Firestore `set()` / `delete()` 操作
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`
- **依賴任務**：P2-16（商品管理分頁化後較好操作）
- **驗收方式**：新增一個「測試套餐」，POS 菜單格線即時出現
- **適合丟 Codex？** ❌ 建議 Claude Code（需理解完整資料結構）
- **風險等級**：🔴

---

#### 🔴 任務包 P2-20｜後台營業時間 / 接單開關

- **頁面**：pos-admin
- **對應問題**：ADMIN-12
- **來源**：V1（已列，未拆任務包）
- **目標**：管理者可一鍵暫停前台接單（如節日公休或備料時間）
- **修改內容**：
  - `pos-admin.html` → 儀表板或營業設定加「接單開關」toggle
  - 寫入 Firestore `settings/{storeId}/acceptingOrders: boolean`
  - `index.html` / `app.js` 讀取此值，若為 false 禁用「送出訂單」按鈕並顯示「目前暫停接單」
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`、`app.js`（前台讀取）
- **依賴任務**：無
- **驗收方式**：後台關閉接單→前台「送出訂單」按鈕灰化；後台開啟→按鈕恢復
- **適合丟 Codex？** ❌ 建議 Claude Code（跨頁資料、即時監聽）
- **風險等級**：🔴

---

#### 🟡 任務包 P2-21｜後台商品批量操作

- **頁面**：pos-admin
- **對應問題**：ADMIN-13
- **來源**：V1（已列，未拆任務包）
- **目標**：一次性停售或上架多個商品
- **修改內容**：
  - `pos-admin.js` → 商品列表每行加 checkbox
  - 頂部加「批量動作」bar（全選、停售、上架）
  - 批量 Firestore `batch.update()`
- **涉及檔案**：`pos-admin.html`、`pos-admin.js`
- **依賴任務**：P2-19（商品列表完善後）
- **驗收方式**：勾選 3 個商品 → 點「批量停售」→ 三個商品狀態更新
- **適合丟 Codex？** ✅ 可
- **風險等級**：🟡

---

### Step 8｜前台進階體驗

---

#### 🟡 任務包 P2-22｜前台套餐/單點區段快捷跳轉

- **頁面**：前台
- **對應問題**：INDEX-05
- **來源**：V2（修正 V1，未拆任務包）
- **目標**：顧客可快速跳到「套餐」或「單點」區段，不需一直滾動
- **修改內容**：
  - `index.html` → `sticky-flavor-bar` 的 `sticky-flavor-bar__panel` 加「套餐 / 單點」anchor 按鈕
  - 點擊後 `document.getElementById("combo-section").scrollIntoView({behavior:"smooth"})`
  - 同樣加在 `sticky-flavor-bar` 展示時
- **涉及檔案**：`index.html`、`ui.js` 或 `app.js`（若 sticky bar 由 JS 控制）
- **依賴任務**：無
- **驗收方式**：頁面滾動後 sticky bar 出現，點「套餐」按鈕跳到套餐區
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟡（sticky bar 的顯示邏輯由 JS 控制，需確認注入點）

---

#### 🟡 任務包 P2-23｜前台 Quantity Modal 口味主食改卡片選法

- **頁面**：前台
- **對應問題**：INDEX-06
- **來源**：V2（已列，未拆任務包）
- **目標**：口味/主食選擇改為與 POS spec modal 一致的卡片按鈕，減少誤選
- **修改內容**：
  - `index.html` → `quantity-modal-flavor-field` 的 `<select>` 改為 div 容器，JS 動態 render 卡片按鈕
  - `styles.css` 加卡片選項樣式（參考 `.pos-spec-option-card`）
  - `ui.js` / `cart.js` 修改對應 render 邏輯
- **涉及檔案**：`index.html`、`ui.js`（或 `cart.js`）、`styles.css`
- **依賴任務**：無
- **驗收方式**：前台點套餐，口味選項顯示為可點擊卡片，選中有橘色高亮
- **適合丟 Codex？** ⚠️ 建議 Claude Code（需理解 modal 現有邏輯）
- **風險等級**：🟡

---

#### 🟢 任務包 P2-24｜前台 Flavor Confirm Modal 視覺強化

- **頁面**：前台
- **對應問題**：INDEX-07
- **來源**：V2（已列，未拆任務包）
- **目標**：`flavor-confirm-modal` 當前選中口味視覺更清楚，防止誤確認
- **修改內容**：
  - `styles.css` → `.flavor-confirm__options` 的已選項加填色（橘色背景），未選項只有邊框
  - 確認「當前口味」文字比未選項更醒目
- **涉及檔案**：`styles.css`
- **依賴任務**：無
- **驗收方式**：口味確認 modal 中，已選口味有填色卡片，其餘為空心
- **適合丟 Codex？** ✅ 是
- **風險等級**：🟢

---

#### 🔴 任務包 P2-25｜前台顧客申請取消訂單

- **頁面**：前台
- **對應問題**：INDEX-08
- **來源**：V1（已列，未拆任務包）
- **目標**：顧客在下單後 5 分鐘內、狀態仍為 `new` 時可申請取消
- **修改內容**：
  - `member.js` → 「我的訂單」列表中，符合條件的訂單加「申請取消」按鈕
  - 點擊後確認 → 寫入 Firestore `status: "cancelled"`
  - 需確認後端（Cloud Function 或 Firestore rules）有保護，避免已接單的訂單也被取消
- **涉及檔案**：`member.js`、Firestore Security Rules（需確認）
- **依賴任務**：P1-22（即時狀態顯示，才知道當前是否 new）
- **驗收方式**：下單後 3 分鐘內，「我的訂單」有「申請取消」按鈕；狀態非 new 時按鈕不出現
- **適合丟 Codex？** ❌ 建議 Claude Code + 人工確認 Rules
- **風險等級**：🔴（Firestore Rules + 狀態條件判斷）

---

#### 🔴 任務包 P2-26｜前台下單後估計等待時間

- **頁面**：前台
- **對應問題**：INDEX-09
- **來源**：V1（已列，未拆任務包）
- **目標**：訂單成功頁顯示目前廚房狀況的等待估算
- **修改內容**：
  - `checkout.js` / `app.js` → 下單成功後，query Firestore 取得目前 `pending + preparing` 訂單數
  - 以固定估算（例如每筆 3 分鐘）計算並顯示在 `order-success-screen`
- **涉及檔案**：`checkout.js` 或 `app.js`、`index.html`（DOM 加估算文字欄位）
- **依賴任務**：P1-22
- **驗收方式**：下單成功，頁面顯示「目前廚房約有 3 筆待製作，預估等待 10 分鐘」
- **適合丟 Codex？** ✅ 可（邏輯簡單）
- **風險等級**：🔴（Firestore 讀取成本、估算準確性）

---

## 5. 前面提過但上次沒拆成任務包的補遺清單

以下問題在 V1 或 V2 報告中明確提出，但在上一輪任務包拆解中被遺漏或僅合併在其他包的描述中，未獨立拆出：

| 補遺編號 | 對應問題 | 原因遺漏 | 已補入 |
|---------|---------|---------|--------|
| 補-01 | KDS-05：Firestore 斷線無告警 | V2 提出但未拆 | ✅ P1-05 |
| 補-02 | KDS-06：按鈕間距防誤觸 | V2 提出但未拆 | ✅ P1-06 |
| 補-03 | KDS-07：群組標題視覺強化 | V2 提出但未拆 | ✅ P1-07 |
| 補-04 | POS-02：detail-close touch target | V2 提出但未獨立拆 | ✅ P1-09 |
| 補-05 | POS-05：取消追加模式說明 | V2 提出但未拆 | ✅ P1-12 |
| 補-06 | POS-15：缺口味 badge 位置 | 補遺，前報告提過問題，未拆包 | ✅ P2-12 |
| 補-07 | ADMIN-03：POS 規則儲存訊息 | V1 提出但合在其他包描述中 | ✅ P1-15（獨立） |
| 補-08 | ADMIN-07：清除測試訂單二次確認 | V2 提出但合在 3-1 描述中 | ✅ P1-14（獨立） |
| 補-09 | ADMIN-14：訂單日期範圍篩選 | 補遺，P1-17 是單日，範圍是獨立需求 | ✅ P2-17 |
| 補-10 | INDEX-04：訂單成功頁「查看狀態」連結 | V2 提出但未拆 | ✅ P1-21 |

---

## 6. 風險總表

### 🟢 安全任務（共 14 個）

幾乎不動 JS 邏輯，只改 CSS / HTML 靜態結構 / 文字，丟 Codex 可直接執行。

| 任務包 | 名稱 |
|--------|------|
| P1-01 | KDS 取餐號碼放大置中 |
| P1-02 | KDS 等待時間顏色警示 |
| P1-06 | KDS 按鈕間距調整 |
| P1-07 | KDS 群組標題視覺強化 |
| P1-08 | POS Spec Modal 頂部關閉按鈕 |
| P1-09 | POS 訂單詳情關閉 Touch Target |
| P1-11 | POS 結帳成功「開始下一筆」按鈕 |
| P1-12 | POS 取消追加模式狀態說明 |
| P1-13 | 後台 Sidebar Stub 禁用 |
| P1-14 | 後台測試工具二次確認 |
| P1-15 | 後台 POS 規則儲存訊息修正 |
| P1-16 | 後台訂單摘要截斷 |
| P1-19 | 前台 iOS 底部安全區域 |
| P2-05 | POS「套用↗」語意優化 |
| P2-07 | POS 菜單格線最大欄數 |
| P2-12 | POS 缺口味 Badge 位置修正 |
| P2-24 | 前台 Flavor Modal 視覺強化 |

### 🟡 中風險任務（共 17 個）

涉及 JS 邏輯或 Firestore query，需驗收後 deploy。

| 任務包 | 名稱 | 主要風險點 |
|--------|------|-----------|
| P1-03 | KDS 取消長按保護 | pointer event 跨裝置 |
| P1-05 | KDS Firestore 斷線告警 | listener error callback |
| P1-10 | POS 購物車品項修改 | prefill 干擾新增流程 |
| P1-17 | 後台歷史日期查詢 | Firestore index 是否存在 |
| P1-20 | 前台售完商品確認 | ui.js 邏輯未完整讀取 |
| P2-01 | KDS Ready 超時催取 | status_updated_at 欄位是否存在 |
| P2-06 | POS 購物車欄位摺疊 | 展開/收合影響 submit |
| P2-08 | POS 付款方式動態化 | 跨頁 Firestore 讀取 |
| P2-09 | POS 折扣欄位 | 金額計算正確性 |
| P2-10 | POS 快捷狀態推進 | updateOrderStatus 呼叫時機 |
| P2-11 | POS 快捷備註 | 備註 append 邏輯 |
| P2-15 | 後台儀表板前後期對比 | 雙 query 效能 |
| P2-16 | 後台商品管理分頁化 | 子 Tab 切換邏輯 |
| P2-17 | 後台訂單範圍篩選 | Firestore range query |
| P2-21 | 後台商品批量操作 | batch.update() 原子性 |
| P2-22 | 前台區段快捷跳轉 | sticky bar JS 注入點 |
| P2-23 | 前台 Modal 口味卡片化 | modal render 邏輯複雜 |

### 🔴 高風險任務（共 10 個）

觸及核心流程、跨頁資料、Firestore listener 管理、AudioContext、LIFF 行為，建議 Claude Code 或人工確認。

| 任務包 | 名稱 | 主要風險點 |
|--------|------|-----------|
| P1-04 | KDS 新訂單音效 | AudioContext WebView 限制 |
| P1-18 | 後台匯出 CSV | 編碼、記憶體、日期 TZ |
| P1-22 | 前台即時狀態 Badge | Firestore listener 記憶體洩漏、LIFF 環境 |
| P2-02 | KDS 叫號連動 | 跨頁 Firestore 寫入、display.js 整合 |
| P2-03 | KDS 站別過濾 | 多檔案、資料結構設計 |
| P2-04 | KDS 品項進度追蹤 | 每項 Firestore write 頻率 |
| P2-13 | POS 暫存訂單 | cart state 複雜管理 |
| P2-14 | POS 分單 | 共享品項分配邏輯 |
| P2-18 | 後台訂單直接修改 | Firestore 寫入＋重算金額 |
| P2-19 | 後台商品新增/刪除 | 資料結構、即時同步 |
| P2-20 | 後台接單開關 | 跨頁即時監聽 |
| P2-25 | 前台申請取消訂單 | Firestore Rules + 狀態條件 |
| P2-26 | 前台等待時間估算 | 讀取頻率、估算準確性 |

---

## 7. Codex / Claude Code 分工建議

### ✅ 適合直接交給 Codex

條件：單檔案、CSS 修改、加元素、改文字、簡單 event listener。給 Codex 時需附上：
1. 目標元素的 CSS selector 或 id
2. 預期輸出（文字/樣式）
3. 驗收步驟

| 任務包 |
|--------|
| P1-01、P1-02、P1-06、P1-07 |
| P1-08、P1-09、P1-11、P1-12 |
| P1-13、P1-14、P1-15、P1-16 |
| P1-19、P1-21 |
| P2-05、P2-07、P2-12、P2-24 |
| P2-09（折扣邏輯簡單）、P2-10、P2-11 |
| P2-15、P2-16、P2-17、P2-21 |
| P2-26（估算邏輯固定） |

### ⚠️ 建議交給 Claude Code

條件：需理解現有多個函式的上下文，或涉及 JS 狀態管理。Claude Code 可讀取完整檔案後修改。

| 任務包 | 原因 |
|--------|------|
| P1-03 | pointer event 需理解現有 click handler |
| P1-04 | AudioContext 需理解 onData callback 完整流程 |
| P1-05 | 需理解 subscribeStoreOrders 的 error 結構 |
| P1-10 | 需理解 openSpecModal 完整邏輯後才能加 prefill |
| P1-17 | 需理解 loadDashboard / loadOrders 完整 query 流程 |
| P1-18 | 需理解訂單資料結構 |
| P1-20 | 需先讀 ui.js |
| P1-22 | 需理解 member.js 完整邏輯 |
| P2-01 | 需確認 order 資料欄位 |
| P2-02 | 需理解 display.js |
| P2-06 | 需理解 renderCart 完整流程 |
| P2-08 | 需理解 POS init 流程 |
| P2-13、P2-14 | state 管理複雜 |
| P2-18、P2-19 | Firestore 資料結構 |
| P2-20 | 跨頁 listener |
| P2-22、P2-23 | 需理解前台 JS 完整結構 |
| P2-25 | Firestore Rules |

### 👤 建議人工先確認再改

條件：涉及資料結構設計決策、跨系統整合、或安全性設定。

| 任務包 | 需人工確認的點 |
|--------|--------------|
| P2-03 | 站別設計：哪些商品屬哪個站，資料結構要先定義 |
| P2-04 | 品項進度追蹤的寫入頻率是否影響費用 |
| P2-14 | 分單時共享品項（無 partId）如何分配 |
| P2-25 | Firestore Security Rules 是否允許顧客自行 update |

---

## 8. 最後結論

### 最優先 5 個任務包（應最先 deploy）

| 排名 | 任務包 | 理由 |
|------|--------|------|
| 1 | **P1-03** KDS 取消長按保護 | 最直接的漏單/誤操作風險，一個手滑取消整筆訂單 |
| 2 | **P1-04** KDS 新訂單音效 | 廚房不盯螢幕=必漏單，每日都在發生 |
| 3 | **P1-01+P1-02** KDS 號碼放大＋超時警示 | 廚房辨識速度直接影響出餐，改動小效果立即 |
| 4 | **P1-10** POS 品項修改功能 | 選錯口味必須清空重選是高頻痛點，顧客等待體驗差 |
| 5 | **P1-18** 後台匯出 CSV | 管理者現在無法對帳，是財務 gap |

### 建議第一週完成的任務包

第一週目標：KDS 穩定 + POS 基本修復 + 後台基礎

```
Day 1：P1-01、P1-02、P1-06、P1-07（全是 KDS CSS，同一次 deploy）
Day 2：P1-03（KDS 長按，需平板測試後再 deploy）
Day 3：P1-04（KDS 音效，需多裝置驗收）
Day 4：P1-08、P1-09、P1-11、P1-12（POS 四個小修，同一次 deploy）
Day 5：P1-13、P1-14、P1-15、P1-16（後台四個小修，同一次 deploy）
Day 6：P1-10（POS 品項修改，較複雜，單獨一天）
Day 7：P1-17 → P1-18（歷史查詢→CSV，有依賴順序）
```

### 最不建議現在先動的任務包

| 任務包 | 原因 |
|--------|------|
| P2-14 分單功能 | 需完整設計決策，業務場景複雜，強行實作會留技術債 |
| P2-03 KDS 站別過濾 | 涉及商品分類設計，需先有 P2-19（商品管理）才有意義 |
| P2-25 顧客申請取消 | Firestore Rules 未確認前動這個有安全風險 |
| P2-04 品項完成追蹤 | 廚房工作流程尚未確認是否真的需要這個，做了可能不用 |

---

*文件建立日期：2026-04-18*
*依據：原始碼完整閱讀（index.html、pos.html、pos-admin.html、kds.html、kds.js）及 V1、V2 UI 功能檢視報告*
*下次更新建議：每完成 5 個任務包後更新狀態欄*
