> ## ✅ 遷移已於 2026-04-22 完成並驗收
> 以下內容為歷史紀錄，現行唯一部署目標為 `leleshan-system`（asia-east1）。

# Firebase US → Asia 遷移

從 `leleshan-order` (us-central1) 搬到新的 `leleshan-system` (asia-east1)。

## 為什麼

- 目前 Firestore / Functions / Storage 全部在 us-central1，對台灣顧客與 LINE 用戶延遲偏高（單趟 130-180ms）。
- Firestore / Storage 的 location 一經選定無法原地改，必須開新專案搬資料。

## 目標架構

| 項目 | 目前 | 目標 |
|---|---|---|
| Project ID | `leleshan-order` | `leleshan-system`（以實際新 ID 為準）|
| Firestore | us-central1 (nam5) | **asia-east1**（彰化）|
| Functions | us-central1 | **asia-east1** |
| Storage default bucket | us-central1 | **asia-east1** |
| Hosting | `leleshan-order.web.app` | `leleshan-system.web.app` |
| Secrets | `functions/.env` 明文 | **Secret Manager** (`firebase functions:secrets:set`) |
| LIFF ID | `2008047700-HIAn2llR` | **不變**（換 Endpoint URL）|
| LINE Messaging channel | 原 channel | **不變**（換 Webhook URL）|
| Bootstrap owner | `onesan@gmail.com` | **不變**（firestore.rules L28）|

## 為什麼選 asia-east1

- 對台灣使用者 RTT < 15ms（vs Tokyo ~25ms、us-central1 ~150ms）。
- Firestore 支援原生 asia-east1 region（非 multi-region）。
- Functions Gen 1 + Gen 2 都支援 asia-east1。
- LINE Taiwan CDN 與 IDC 同區。

## 文件索引

| 檔案 | 內容 |
|---|---|
| [runbook.md](runbook.md) | 完整執行步驟，從 Blaze 升級到正式切流 |
| [rollback.md](rollback.md) | 任何階段出錯如何回到 us-central1 |
| [acceptance.md](acceptance.md) | 切換前 / 切換後必跑的驗收清單 |

## 遷移前已完成的程式整理（commit `b774a56`）

此 commit 是**行為保佝**的，deploy 到現有 us-central1 後外部行為不變：

1. **集中 REGION 常數**：`functions/index.js:L25` 單一 `const REGION`。client 端透過 `window.APP_CONFIG.functionsRegion` 讀。切換時只改這幾個值。
2. **移除兩組重複 exports**：`upsertEmployee`、`posEmployeeLogin` 各有一組舊版被新版覆蓋。刪除舊版避免遷移後仍帶著影子 code。
3. **推播 idempotent 升級**：新的 `claimPushOnOrder()` 以 Firestore transaction 原子檢查+設定 `notificationStatus.{flagField}`，取代原本非原子的讀-寫檢查。保護：
   - Cloud Functions 重試（at-least-once delivery）
   - 遷移期間雙 region 訂閱
   - 連續快速狀態變更導致的 race

## 關鍵風險

- **Firestore 資料是 source of truth**：遷移期間任何新訂單都必須能到達新舊兩邊，或訂定明確的切換時刻。本方案採「切流瞬間」模式，不做雙寫。
- **LINE webhook URL 切換**：這是唯一一個「瞬間」的動作。切換前新 webhook 必須驗證過；切換後舊 webhook 還能收但不會處理（保險）。
- **Secrets**：舊專案 `functions/.env` 的 LINE token 是明文；新專案必須用 Secret Manager。
- **Functions 冷啟動**：第一次 deploy asia-east1 後 15-30 秒冷啟動延遲，避開尖峰時段。
