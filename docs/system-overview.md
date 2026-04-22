# 樂樂山點餐系統 — 系統說明文件

> 本文件為本專案唯一系統說明文件，描述現況架構，不含未來規劃。
> 最後更新：2026-04-22

---

## 一、系統概述

**用途：** 樂樂山湯滷川味的 LINE LIFF 網頁點餐系統。顧客透過 LINE 開啟 LIFF 網頁選餐、送出訂單；店家透過後台管理菜單、處理訂單、追蹤會員。

**部署位置：** Firebase Hosting — `https://leleshan-system.web.app`

**技術棧：**
- Frontend: 純 Vanilla JavaScript（無框架）+ HTML5 + CSS3
- Database: Firebase Firestore（NoSQL，即時 listener）
- Auth: LINE LIFF SDK（顧客端）+ Firebase Auth Google 登入（管理員端）
- Hosting: Firebase Hosting（靜態部署，無 build step）
- Store status: Google Places API（查詢門市是否營業中）

---

## 二、主要資料流

```
顧客 LINE LIFF
  → 選口味 → 選品項 → 加購物車
  → 填寫取餐稱呼 / 日期 / 時間
  → 觸發 LINE 登入（LIFF SDK）
      ↓ 登入前：cart + 表單存入 sessionStorage（pending checkout）
      ↓ 登入後：自動還原 pending checkout
  → 驗證通過 → 寫入 Firestore orders（status: "new"）
                        ↓
後台 admin.html（Google 登入）
  → 讀取 orders → 更新狀態（new → cooking → packing → ready → picked_up）
                        ↓
KDS / 包裝站 / 取餐看板
  → Firestore 即時 snapshot → 畫面自動更新（無需手動 refresh）
```

**訂單狀態流程：**
```
new → cooking → packing → ready → picked_up
                                 → cancelled（任一階段均可）
```

---

## 三、主要檔案分工

### 前台（顧客端）

| 檔案 | 職責 |
|------|------|
| `index.html` | 前台主頁面結構 |
| `app.js` | 初始化、模組整合、事件綁定、Firebase init |
| `ui.js` | DOM 快取、modal 開關、菜單 render、狀態文案、scroll 行為 |
| `cart.js` | 購物車新增 / 移除、upsert 合併同品項、總額計算、render |
| `checkout.js` | 取餐日期 / 時間生成、送單前驗證、Firestore 寫入、pending checkout 保存 / 還原 |
| `auth.js` | LIFF 初始化、LINE 登入 / 登出、profile 同步 |
| `storage.js` | 所有 sessionStorage / localStorage 讀寫集中於此（pending checkout 有 2h 過期機制）|
| `member.js` | 我的訂單 overlay、會員中心 overlay、點數查詢、訂單成功面板 |
| `styles.css` | 前台所有樣式（米白 / 深紅 / 咖啡色系） |

### 共用 / 工具層

| 檔案 | 職責 |
|------|------|
| `order-helpers.js` | buildCreatePayload、訂單狀態正規化、時間計算、來源 label 對應 |
| `firebase-client.js` | ES6 module Firebase import，供 KDS / packing / pickup-board 使用 |
| `defaults.js` | 口味、分類、品項、套餐模板預設值（Firestore 無資料時 fallback） |
| `config.js` | LIFF ID、Firebase credentials、Google Places API key、defaultStoreId |
| `config.sample.js` | 設定檔範本（不含真實金鑰） |

### 後台（管理員端）

| 檔案 | 職責 |
|------|------|
| `admin.html` | 後台主頁面結構 |
| `admin.js` | 後台全功能：菜單 CRUD、訂單管理、庫存、會員、促銷、設定、平台訂單匯入 |
| `admin.css` | 後台樣式 |
| `admin-login.html` | Google 登入頁 |
| `admin-login.js` | Google 登入流程 |
| `admin-auth-helper.js` | Google Auth 狀態確認、角色驗證工具 |
| `admin-owner-init.js` | 首次建立 owner admins document 的初始化工具 |
| `staff-auth.js` | 員工角色驗證 |

### 店內操作頁面

| 檔案 | 職責 |
|------|------|
| `kds.html` + `kds.js` | 廚房顯示（KDS），即時顯示 new / cooking 訂單 |
| `packing.html` + `packing.js` | 包裝站，顯示 packing 狀態訂單 |
| `pickup-board.html` + `pickup-board.js` | 顧客取餐看板（公開，不需登入），顯示 cooking / packing / ready |
| `admin-orders.html` + `admin-orders.js` | 員工訂單管理獨立頁面 |
| `ops.css` | KDS / 包裝站 / 取餐看板共用樣式 |

### 外送平台整合（骨架）

| 檔案 | 職責 |
|------|------|
| `platform-order-module.js` | Foodpanda / UberEats CSV 解析與匯入邏輯 |
| `platform-api-placeholders.js` | Webhook stub（尚未正式對接） |

### Firebase 設定

| 檔案 | 職責 |
|------|------|
| `firestore.rules` | Firestore 安全規則（完整實作） |
| `firebase.json` | Firebase Hosting 設定、URL rewrites |
| `.firebaserc` | Firebase 專案 ID：`leleshan-system` |
| `firestore.indexes.json` | Firestore composite index（orders、transactions、logs） |

### 文件

| 檔案 | 職責 |
|------|------|
| `docs/system-overview.md` | 本文件，系統架構說明 |
| `docs/AI_RULES.md` | AI 協作與修改規則，本專案修改的最高約束文件 |
| `README.md` | 早期部署說明（內容已部分過時） |

---

## 四、Firestore Collection 結構

### `orders`
訂單主資料。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `status` | `new` / `cooking` / `packing` / `ready` / `picked_up` / `cancelled` |
| `source` | `liff` / `onsite` / `manual` / `uber` / `foodpanda` |
| `lineUserId` | LINE 用戶 ID |
| `items[]` | 訂單品項（sku, name, qty, flavor, staple, subtotal…） |
| `total` | 訂單總金額 |
| `scheduled_pickup_date` | 取餐日期（YYYY-MM-DD） |
| `scheduled_pickup_time` | 取餐時間（HH:mm） |
| `scheduled_pickup_at` | ISO 8601 取餐時間（含時區） |
| `earnedPoints` | 本單獲得點數（floor(total / 100)） |
| `appliedPromotion` | 套用的促銷活動摘要 |
| `note` | 顧客備註 |
| `createdAt` | serverTimestamp |

### `users`
會員資料，每次送單 upsert。

| 欄位 | 說明 |
|------|------|
| `userId` / `lineUserId` | LINE 用戶 ID（document id = lineUserId） |
| `storeId` | 門市 ID |
| `name` / `displayName` | 姓名 / LINE 顯示名稱 |
| `points` / `currentPoints` | 點數 |
| `totalSpent` | 累積消費金額 |
| `totalOrders` | 累積訂單數 |
| `tier` | 會員等級（預設 `standard`） |
| `tags` | 標籤陣列 |
| `couponWallet` | 折價券（架構預留，尚未實作兌換流程） |
| `status` | `active` |

### `menu_items`
菜單品項（前台讀取此 collection）。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `name` / `price` | 名稱 / 價格 |
| `categoryId` | 對應 categories |
| `enabled` / `sort` | 是否啟用 / 排序 |
| `tags` / `optionGroups` | 標籤 / 加購選項 |
| `unit` | 份量說明（如「3 顆」） |

> **注意：** Firestore rules 同時保護了 `menu_items`（snake_case）和 `menuItems`（camelCase）兩個 path，目前前台實際使用 `menu_items`。

### `categories`
菜單分類。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `name` / `enabled` / `sort` | 名稱 / 啟用 / 排序 |
| `color` | 顏色主題（cream / warm-beige / sage-light… 等 10 種） |

### `flavors`
口味選項。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `name` / `description` / `spicyLabel` | 口味名稱 / 說明 / 辣度標籤 |
| `sort` / `enabled` | 排序 / 啟用 |

### `comboTemplates`
套餐模板。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `name` / `price` | 套餐名稱 / 基礎價格 |
| `optionGroups[]` | 選項群組（含主食選項，各主食有 price adjustment） |

### `promotions`
促銷活動。

| 欄位 | 說明 |
|------|------|
| `storeId` | 門市 ID |
| `enabled` | 是否啟用 |
| `startAt` / `endAt` | 活動時間區間 |
| `condition.minAmount` | 最低消費金額條件 |
| `type` / `reward` | 促銷類型 / 回饋內容 |

### `settings`
門市設定（document id = storeId）。

| 欄位 | 說明 |
|------|------|
| `openFrom` | 開始取餐時間（HH:mm，預設 17:40） |
| `openTo` | 最後取餐時間（HH:mm，預設 22:50） |

### `stores`
門市清單（owner 才能寫）。

### `admins`
管理員帳號（document id = Firebase Auth uid）。

| 欄位 | 說明 |
|------|------|
| `role` | `owner` / `admin` / `staff` |
| `storeId` | 管轄門市（owner 可跨店） |
| `name` | 顯示名稱 |

### `inventory` / `inventory_movements`
庫存與異動紀錄，使用 `storeId` / `store_id`。

### `point_transactions` / `point_logs` / `point_rules`
點數交易、流水帳、規則，使用 `storeId` + `lineUserId`。

### `platform_orders` / `platform_menu_mapping` / `import_logs`
外送平台相關，使用 `store_id`（snake_case，與主資料不同）。

---

## 五、權限模型

```
Bootstrap Owner（onesan@gmail.com，硬編碼於 firestore.rules）
  └─ Owner（可跨所有門市，可建立 / 刪除 admins）
       └─ Admin（可管理指定 storeId 的菜單 / 訂單 / 庫存）
            └─ Staff（可讀取指定 storeId 的訂單）

顧客（未登入）：
  - 可 read：orders（自己的）、菜單相關、取餐看板
  - 可 create：orders（status 必須為 new）
  - 不可 write：菜單、flavors、categories、users（非自己）
```

**特殊規則：**
- 取餐看板：orders 狀態為 `cooking / packing / ready` 時，任何人可公開讀取
- 顧客可取消自己的訂單（僅限 status = new，且只能設為 cancelled）
- Bootstrap owner 建立自己的 admins document 只能做一次（`!exists` 防止重複）

---

## 六、已完成功能

**顧客前台**
- 選口味 → 選品項（套餐 / 單點）→ 加購物車 → 送出訂單
- 套餐主食選項（含 price adjustment）
- 購物車同品項 upsert 合併、移除、總額計算
- 取餐日期 / 時間選擇（根據 settings.openFrom / openTo，每 10 分鐘一格）
- 送單前完整驗證（cart 不空、日期時間必填、稱呼必填）
- LINE LIFF 登入（送單前觸發）
- 登入前 pending checkout 保存，登入後自動還原（2h 過期）
- 草稿自動保存（不需登入的一般 draft）
- Google Places API 門市營業狀態查詢
- 促銷活動 banner 顯示（時間區間 + 最低消費條件）
- 訂單成功面板
- 會員資料每次送單 upsert（`users` collection）
- 會員中心 overlay（我的訂單、點數查詢頁籤、會員資訊）

**後台 / 店內**
- Google 登入 + 角色權限驗證（owner / admin / staff）
- Bootstrap owner 初始化機制
- 多門市切換（storeId scoping）
- 菜單管理 CRUD（分類、品項、套餐模板、口味）
- 後台 seed 預設資料（把 defaults.js 寫入 Firestore）
- 庫存管理
- 訂單列表與狀態更新
- 會員列表與搜尋
- 促銷活動管理
- 營業設定（openFrom / openTo）
- 點數規則設定頁面
- KDS 廚房顯示（即時 listener）
- 包裝站頁面
- 取餐看板（公開，無需登入）
- 員工訂單管理獨立頁面
- 外送平台訂單 CSV 匯入（骨架）

**Firestore**
- 安全規則完整實作（讀寫分離、角色管控、公開取餐看板）
- Composite index（orders、transactions、logs）

---

## 七、尚未完成 / 預留骨架

| 項目 | 現況 | 說明 |
|------|------|------|
| 外送平台 webhook 串接 | 骨架存在 | `platform-api-placeholders.js` 都是 stub，CSV 匯入架構在但商業邏輯待補 |
| 點數實際累積 | 架構存在 | 送單時計算 `earnedPoints`，但寫入 `users.currentPoints` 的 increment 目前為 0，未實際入帳 |
| 折價券兌換流程 | 欄位存在 | `users.couponWallet` 欄位已定義，前台無兌換 / 使用入口 |
| LINE 推播通知 | 無 | 送單成功後無 LINE 訊息確認（LINE Message API 未串接） |
| 顧客主動取消訂單 | rules 允許 | Firestore rules 已開放，但前台無明顯取消入口 |

---

## 八、重要注意事項

1. **任何修改都不能破壞** 選口味 → 選品項 → 加購物車 → 送單寫入 `orders` 這條主線流程。詳見 `docs/AI_RULES.md`。

2. **storeId 命名不一致：** 主資料（orders、menu_items、users 等）用 `storeId`；外送平台相關 collection（platform_orders、import_logs 等）用 `store_id`。修改時注意對應正確欄位名稱。

3. **pending checkout 機制：** LIFF 登入會導離頁面，購物車 + 表單須先存 sessionStorage，登入後必須優先還原，才能初始化空購物車。邏輯在 `checkout.js` + `storage.js`，不要在 `app.js` initFlow 中提前覆蓋 cart state。

4. **defaults.js 是 fallback：** 菜單資料應從 Firestore 讀取，`defaults.js` 只在 Firestore 無資料時使用。後台 seed 功能可把 defaults.js 寫入 Firestore。

5. **Bootstrap owner 帳號：** `onesan@gmail.com` 硬編碼於 `firestore.rules`，僅能建立一次自己的 owner admins document。

6. **無 build step：** 修改 JS / CSS / HTML 後直接 `firebase deploy` 即可上線。無 npm、無 bundler、無 TypeScript。
