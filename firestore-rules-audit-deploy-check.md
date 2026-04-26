# Firestore Rules Deploy 前事實確認

調查日期：2026-04-27

---

## Q-A：customers collection 實際欄位

### 寫入來源

| 檔案 | 操作 | 條件 |
|------|------|------|
| `checkout.js:459` | `collection("customers").doc(lineUid).set({...}, {merge:true})` | 有 LINE 登入才執行 |

> ⚠️ **唯一寫入端是 LIFF checkout.js**。
> `order-helpers.js` 與 `admin.js` 寫入的是 **`users` collection**（積分系統），不是 `customers`。

### 實際欄位清單（checkout.js:459–468 逐行核對）

| 欄位名 | 型別 | 在 proposed allowlist? |
|--------|------|------------------------|
| `lineUserId` | string | ✅ |
| `storeId` | string | ✅ |
| `name` | string | ❌ **缺漏** |
| `displayName` | string | ✅ |
| `pictureUrl` | string | ❌ **缺漏**（proposed 有 `profilePicture`，實際是 `pictureUrl`）|
| `lastOrderId` | string | ❌ **缺漏** |
| `lastOrderAt` | Timestamp | ❌ **缺漏** |
| `updatedAt` | Timestamp | ✅ |
| `createdAt` | Timestamp | ✅ |

### Proposed allowlist 有但程式碼不寫的欄位

| 欄位名 | 實際存在? |
|--------|-----------|
| `profilePicture` | ❌（正確名稱是 `pictureUrl`）|
| `phoneNumber` | ❌（無任何程式碼寫此欄位）|
| `email` | ❌（無任何程式碼寫此欄位）|

### 建議調整 customers allowlist

```
// 正確版本（對應 checkout.js 實際寫入）
['lineUserId', 'storeId', 'name', 'displayName',
 'pictureUrl', 'lastOrderId', 'lastOrderAt',
 'updatedAt', 'createdAt']
```

> `profilePicture` → 改為 `pictureUrl`
> 新增：`name`, `lastOrderId`, `lastOrderAt`
> 移除：`phoneNumber`, `email`（無程式碼使用）

---

## Q-B：order_counters 欄位

### 實際欄位名（checkout.js:403–411）

```javascript
var seq = counterDoc.exists ? ((counterDoc.data().seq || 0) + 1) : 1;
tx.set(counterRef, {
  seq:       seq,           // ← 實際欄位名！不是 lastNumber
  date:      todayStr,
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}, { merge: true });
```

**實際欄位**：`seq`、`date`、`updatedAt`

> ⚠️ **proposed rules 假設 `lastNumber` 是錯的！正確欄位名是 `seq`。**
> deploy proposed rules 後取餐號碼系統會因 `lastNumber` allowlist 檢查失敗而壞掉。

### 寫入方式與上限

- **方式**：Firestore transaction（原子讀取 + 寫入）
- **seq 上限**：程式碼 `padStart(3, "0")` 顯示期望最大 3 位數 → `999`
  - 但 seq 本身沒有上限判斷，技術上會超過 999（顯示成 `1000`）
  - 目前業務量建議 rules 寫 `seq >= 0 && seq <= 9999` 較安全

### 建議調整 order_counters rules

```
// 修正版
allow write: if
  request.resource.data.keys().hasOnly(['seq', 'date', 'updatedAt'])
  && request.resource.data.seq is int
  && request.resource.data.seq >= 0
  && request.resource.data.seq <= 9999;
```

---

## Q-C：orders source 整合狀況

### 確認每個 source 是否實際被寫入 orders

| Source | 實際寫入? | 證據 | 說明 |
|--------|-----------|------|------|
| `liff` | ✅ **是** | `checkout.js:329` | LIFF 顧客下單 |
| `pos` | ✅ **是** | `order.service.ts:101`（POS React）、`functions/index.js:1943` | POS 下單，hardcoded `"pos"` |
| `walk_in` | ⚠️ **型別有，實際不寫** | `cart.store.ts:42`（TypeScript type）| POS 實際送出時 override 為 `"pos"` |
| `phone` | ⚠️ **型別有，實際不寫** | `cart.store.ts:42`、`CartPanel.tsx:10` | 同上，POS 送出時 override 為 `"pos"` |
| `line` | ❓ **沒有寫入，但被讀取** | `functions/index.js:487,612` | Cloud Function 檢查此值（可能是舊 LINE Bot 留下的歷史資料）|
| `onsite` | ❌ 無 | — | 全 repo 無此值 |
| `manual` | ❌ 無 | — | 全 repo 無此值 |
| `ubereats` | ❌ 無 | — | 全 repo 無此值 |
| `foodpanda` | ❌ 無 | — | 全 repo 無此值 |

### Source allowlist 建議

```
// 建議白名單
['liff', 'pos', 'walk_in', 'phone', 'line']
```

**保留邏輯**：
- `liff`、`pos`：確認寫入，必留
- `walk_in`、`phone`：TypeScript type 定義存在，POS UI 有 source picker，未來改動可能直接寫 — 保留避免未來升級後 rules 不需再改
- `line`：Cloud Function 有檢查此值（`functions/index.js:487,612`），歷史 Firestore 資料可能存在

**移除邏輯**：
- `onsite`、`manual`：全 repo 零出現，移除
- `ubereats`、`foodpanda`：全 repo 零出現，無整合，移除

---

## 綜合修正清單（給準系統套用用）

| 項目 | proposed 假設 | 實際 | 動作 |
|------|--------------|------|------|
| `customers` allowlist | 含 `profilePicture`、`phoneNumber`、`email` | 實際是 `pictureUrl`，另缺 `name`、`lastOrderId`、`lastOrderAt` | **修正 allowlist** |
| `order_counters` 欄位名 | `lastNumber` | 實際是 **`seq`** | **⚠️ 必須修正，否則取餐號碼壞** |
| `orders.source` 白名單 | 含 `onsite`、`manual`，提到移除 `line`、`walk_in` | `line`、`walk_in`、`phone` 應保留 | **修正白名單** |
