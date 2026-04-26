# Firestore Rules 審計事實調查（W13-B 補充）

調查日期：2026-04-27

---

## Q1：LIFF 是否使用 Firebase Auth？

**答：否。LIFF 寫入 Firestore 時 `request.auth` 永遠為 `null`。**

證據：

- 進入點：`index.html`（LIFF 顧客點餐頁）
- `index.html` 載入的 SDK：
  - `firebase-app-compat.js` ✅
  - `firebase-firestore-compat.js` ✅
  - **`firebase-auth-compat.js` ❌ 未載入**
- 流程：`liff.init()` → `liff.getProfile()` → 取得 LINE displayName/userId，**沒有呼叫任何 Firebase Auth API**（`signInWithCustomToken` / `signInAnonymously` 等）
- `auth.js`（LIFF 端）：純 LIFF SDK 操作，無 Firebase Auth import（`auth.js:14–43`）
- Firestore 寫入：`checkout.js:268`：`app.state.db.collection("orders").doc()` — 直接寫入，無 auth context

> ⚠️ 結論：Firestore Rules 中 `orders` collection 任何讀寫規則若要求 `request.auth != null`，
> 會直接擋掉所有 LIFF 顧客訂單。

---

## Q2：POS 是否使用 call/current？

**答：否。POS、KDS、Pickup Board 均未使用 `call` collection。**

使用該 collection 的檔案（非 POS 系統）：

| 檔案 | 操作 | 有無 Auth |
|------|------|-----------|
| `control.html:191,239` | 寫入（`setDoc`）| 無 — 無 `firebase-auth` import |
| `display.html:194` | 讀取（`onSnapshot`）| 無 |
| `public/control.html:191,239` | 寫入（`setDoc`）| 無 |
| `public/display.html:194` | 讀取（`onSnapshot`）| 無 |
| `public/index.html:75` | 讀取 | 無 |

> `control.html` 是「叫號控制台」（店員操作），`display.html` 是顧客螢幕顯示頁。
> 兩者均以 **unauthenticated** 狀態操作 Firestore。
>
> ⚠️ 結論：`call/current` rules 必須允許 unauthenticated 讀寫，否則叫號功能全壞。

---

## Q3：store_runtime 的 docId 格式

**docId 格式：`current_session_{storeId}`**

例如：`current_session_store_1`

寫入端：
- `ops-session-sync.js:11`：`db.collection("store_runtime").doc("current_session_" + storeId)` — **vanilla POS**（`source` 欄位值永遠為 `"pos"`）
- `pos-src/src/services/ops-session.service.ts:7`：`doc(db, "store_runtime", \`current_session_${storeId}\`)` — **React POS**

讀取端：
- `kds.js:687,713`：KDS subscribe store_runtime（只讀，取 POS session 狀態）

> ⚠️ 結論：rules 中 `store_runtime` match 路徑應寫成：
> `match /store_runtime/current_session_{storeId}`
> 或更寬鬆的 `match /store_runtime/{docId}`

---

## Q4：是否有 source: 'system' 寫 store_runtime？

**答：否。store_runtime 只有 source: 'pos' 寫入。**

全 repo 中 `source: "system"` 唯一出現處：

- `order-helpers.js:1209`：寫入 `point_transactions` + `point_logs`（積分系統）
  - 這是訂單完成後自動累點的 system source，**與 store_runtime 完全無關**

`ops-session-sync.js` 中的 source 邏輯：
- `ops-session-sync.js:23`：`source: opts.source || "pos"` — 預設 `"pos"`
- `ops-session-sync.js:42`：`source: "pos"` — logout 時硬碼 `"pos"`
- 呼叫端從不傳入 `source: "system"`

> ⚠️ 結論：store_runtime rules 無需針對 system source 做特殊處理。
> 唯一寫入來源是 POS（Firebase Auth custom token）。

---

## 綜合摘要（給準系統 rules 套用用）

| 問題 | 答案 | Rules 影響 |
|------|------|-----------|
| LIFF 有 Firebase Auth？ | **否，`request.auth == null`** | `orders` write 必須允許 unauthenticated |
| POS 用 call/current？ | **否，是叫號頁（control.html）** | `call` collection 必須允許 unauthenticated 讀寫 |
| store_runtime docId 格式 | **`current_session_{storeId}`** | match 路徑確認格式正確 |
| source: 'system' 寫 store_runtime？ | **否**（只有積分系統用，寫 point_transactions） | 無需特殊處理 |
