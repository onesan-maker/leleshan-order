# 樂樂山點餐系統 AI 協作規則

本文件為樂樂山點餐系統後續修改的最高優先約束。AI、工程師與協作者在修改本專案時，均應優先遵守以下規則。

## 1. 核心原則

1. 先求穩定可營運，再追求重構與美化。
2. 不可破壞既有 LIFF、菜單、購物車、Firestore `orders` 寫入流程。
3. 所有修改優先採最小可用變更，避免一次重寫整個前台或後台。
4. 若涉及多門市資料，所有資料結構應保留 `storeId` / `store_id` 可擴充空間。
5. 若需求可用既有原生 JavaScript 架構完成，不要硬改成新框架。

## 2. 前台修改規則

1. 前台功能應優先沿用既有 DOM 結構與 Firestore 寫入路徑。
2. 顧客體驗相關流程不得使用瀏覽器原生 `alert()` / `confirm()`；應改用頁內 modal。
3. 登入流程若會導向外部頁面，必須先保存購物車與表單狀態，再導向登入。
4. 登入返回後應優先還原 pending checkout 狀態，避免 cart 被初始化覆蓋。
5. 若無 pending checkout，才可使用一般草稿或預設空購物車初始化。
6. 前台顯示文案必須以繁體中文為主，避免混用暫時性英文技術字串。

## 3. 模組責任分工

1. `app.js` 只保留：
   - 初始化
   - 模組整合
   - 事件綁定
2. `storage.js`：
   - 集中所有 `sessionStorage` / `localStorage` 讀寫
   - 提供 JSON serialize / parse 與錯誤處理
3. `ui.js`：
   - DOM 快取
   - modal 開關
   - 狀態文案
   - 畫面 render 與 scroll 行為
4. `cart.js`：
   - 購物車新增、刪除、總額計算、render
5. `auth.js`：
   - LIFF 初始化
   - LINE 登入 / 登出
   - profile 顯示與同步
6. `checkout.js`：
   - 取餐日期 / 時間邏輯
   - pending checkout 保存與還原
   - 送單前驗證與送單流程

## 4. Storage 與還原規則

1. 所有 pending checkout 暫存必須集中在 `storage.js`。
2. 建議至少使用以下 keys：
   - `pendingCheckoutCart`
   - `pendingCheckoutForm`
   - `pendingCheckoutReturnTo`
   - `pendingCheckoutTimestamp`
3. 一般草稿與登入前 pending 狀態必須分開。
4. pending checkout 若超過 2 小時可視為失效並清除。
5. restore 成功後必須清除 pending 暫存，避免重複還原。

## 5. Firestore 與訂單規則

1. 不可任意更改既有 `orders` collection 寫入方式。
2. 若新增欄位，應以獨立正式欄位加入，不要塞回備註欄位。
3. 所有寫入失敗應有明確 `console.error` 訊息。
4. 寫入前驗證不可省略，特別是：
   - 購物車不可為空
   - 取餐日期必填
   - 取餐時間必填
   - 必要稱呼欄位必填

## 6. UI / UX 規則

1. 視覺風格延續米白、深紅、咖啡色系。
2. 次要操作按鈕不可比主要 CTA 更搶眼。
3. 需要顧客注意但不可阻塞體驗時，優先使用頁內訊息與 modal。
4. 捲動定位應優先捲至目標區塊，避免使用粗暴的整頁捲到底。

## 7. 程式碼品質規則

1. 避免重複函式與重複流程。
2. 需要持久狀態時，必須說清楚來源與優先順序。
3. 所有容易失敗的外部依賴操作應使用 `try/catch`。
4. `console.log` / `console.error` 應能描述：
   - 當前流程
   - 讀寫資料內容摘要
   - 失敗原因
5. 修改完成後需明確回報：
   - 修改檔案
   - 新增檔案
   - 關鍵流程如何運作
   - 是否影響既有訂單流程

## 8. 若需求不完整時

1. 不可自行捏造商業規則、金額規則或平台欄位內容。
2. 可先用安全預設值處理技術流程，但需在回報中明確列出假設。
3. 若使用者要求「依先前提供內容逐字寫入」但當前上下文無全文，需在回報中註明目前為依現有需求整理版，避免假稱逐字一致。
