> ## ✅ 遷移已於 2026-04-22 完成並驗收
> 以下內容為歷史紀錄，現行唯一部署目標為 `leleshan-system`（asia-east1）。

# Runbook：US → Asia 遷移執行

> 執行者：Jack (`onesan@gmail.com`)
> 協助：Claude（負責下指令、驗證）
> 預計總耗時：3-5 小時（含驗證等待），可分 2 天做

## 術語

- **OLD** = 現有 `leleshan-order` 專案（us-central1）
- **NEW** = 新 `leleshan-system` 專案（asia-east1）
- **切換點** = LINE Developer Console 改 Webhook URL 的那一刻

---

## Phase 0. 前置檢查（5 分鐘）

- [ ] 確認以 `onesan@gmail.com` 登入 Firebase Console
- [ ] OLD 專案目前狀態正常：[https://console.firebase.google.com/project/leleshan-order](https://console.firebase.google.com/project/leleshan-order)
- [ ] 本 repo 的 `migration/us-to-asia` 分支存在並已 push
- [ ] `firebase --version` ≥ 13（已驗：15.12.0 ✓）
- [ ] `gcloud --version` 已安裝（若沒有：`choco install gcloudsdk` 或從 [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) 下載）

---

## Phase 1. OLD 專案升 Blaze（Jack 手動，5 分鐘）

**目的**：只有 Blaze 才能 `gcloud firestore export`（這是唯一官方匯出方式）。

1. 打開 [https://console.firebase.google.com/project/leleshan-order/usage/details](https://console.firebase.google.com/project/leleshan-order/usage/details)
2. 點「升級 / Upgrade」→ 選 **Blaze**
3. 綁定計費帳戶
4. 設定預算：建議 NT$3000/月，遷移完成後調降
5. 回報給 Claude：「OLD Blaze 完成」

---

## Phase 2. 建立 NEW 專案（Jack 手動，10 分鐘）

1. 打開 [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. 新增專案：名稱 `leleshan-system`（實際 Project ID 可能帶後綴）
3. **關閉** Google Analytics（遷移完後可加）
4. 升級 **Blaze**（同上步驟）
5. 新增 **Web App**：名稱 `leleshan-web`，**不勾** Hosting（之後 CLI deploy）
6. 複製新的 Firebase config（apiKey / authDomain / projectId / storageBucket / messagingSenderId / appId）
7. 啟用服務：
   - **Firestore Database**：建立 → **Native 模式** → Location **asia-east1** → 安全規則：production
   - **Authentication**：啟用 **Google** 登入，授權網域加入 `<newproject>.web.app`
   - **Cloud Storage**：建立預設 bucket → Location **asia-east1**
8. 啟用 API（[https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)，選新 project）：
   - [ ] Cloud Functions API
   - [ ] Cloud Build API
   - [ ] Artifact Registry API
   - [ ] Eventarc API
   - [ ] Secret Manager API
   - [ ] Cloud Scheduler API（即使目前沒用到，先開）
9. 回報給 Claude：
   - 新 Project ID：`__________________`
   - Firebase config 6 個欄位
   - 「服務全部啟用」確認

---

## Phase 3. 本機切換 project + 設定 secrets（Claude 執行，10 分鐘）

> 以下指令都在 `E:\OneDrive\桌面\紅頤坊\樂樂山\liff-ordering\` 執行。

### 3.1 加入 NEW project alias

```bash
firebase use --add
# 選 <newproject-id>，alias 取 asia
# 然後：
firebase projects:list
firebase use asia
```

確認 `.firebaserc` 變成：
```json
{
  "projects": {
    "default": "leleshan-order",
    "asia": "<newproject-id>"
  }
}
```

### 3.2 設定 secrets（Gen 1 functions 用 firebase）

```bash
# 從 OLD 的 functions/.env 讀取 token，改用 NEW 的 Secret Manager
firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN --project asia
# 貼上原 token：8+PF0zdEm1wm... (從 OLD functions/.env 複製)

firebase functions:secrets:set LINE_CHANNEL_SECRET --project asia
# 貼上 LINE Channel Secret（從 LINE Developer Console > Messaging API > Channel secret）
```

### 3.3 修改 functions/index.js 讀 secrets 而非 env

目前 `getLineToken()` 讀 `process.env.LINE_CHANNEL_ACCESS_TOKEN`。改用 `defineSecret`（Firebase Functions v5+）或保留 env-only 方式但透過 secrets binding。

本遷移採**保留 env 讀取 + 透過 `.runWith({ secrets })` 綁 secret** 的最小改動：

```javascript
// functions/index.js 每個需要 token 的 function 加：
// .runWith({ secrets: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"] })
// secrets 在運行時會以 env var 注入，getLineToken() / verifyLineSignature 程式碼不變。
```

→ 這部分由 Claude 在進入 Phase 3.3 前做成另一個 commit。

---

## Phase 4. NEW 專案第一次 deploy（Claude 執行，15 分鐘）

### 4.1 暫停推播（避免測試期間打擾真實客戶）

此時 NEW 還沒接流量，但測試寫 Firestore 可能觸發 onCreate → 推播。
先在 functions/index.js 加 kill-switch 檢查（讀 `store_runtime/notifications_paused`），或 Phase 4.2 時先把 test order 的 `lineUserId` 設成空字串。

### 4.2 切 REGION 到 asia-east1（暫時本地改）

```bash
# functions/index.js
sed -i 's/const REGION   = "us-central1"/const REGION   = "asia-east1"/' functions/index.js

# config.public.js & public/config.public.js & config.sample.js
sed -i 's/functionsRegion: "us-central1"/functionsRegion: "asia-east1"/' config.public.js config.sample.js
sed -i 's/export const functionsRegion = "us-central1"/export const functionsRegion = "asia-east1"/' public/config.public.js
```

⚠ 此時 **先不 commit**，deploy 完成驗證後再決定何時 commit 切 main。

### 4.3 Deploy Firestore rules + indexes + functions

```bash
firebase use asia

# 先 rules + indexes（不涉及 functions，最低風險）
firebase deploy --only firestore:rules,firestore:indexes --project asia

# 等 indexes build 完成（可能 5-15 分鐘，在 Console 看狀態）
# 然後 deploy functions
firebase deploy --only functions --project asia

# Hosting 最後再 deploy
firebase deploy --only hosting --project asia
```

### 4.4 驗證 NEW 可獨立運作

- 打開 `https://<newproject>.web.app`（前台）
- 用一個**測試用 LINE 帳號**跑完整流程：
  - LIFF 登入 → 下單 → 推播到測試帳號 → 員工 KDS 看到訂單 → 改狀態 ready → 收到取餐推播
- 檢查 Firestore Console 新 project，orders / order_events / notifications 都正常寫入
- Functions Console 看每個 function 都是 `asia-east1` 前綴

**此時 OLD 仍在跑，所有真實流量仍走 OLD。**

---

## Phase 5. Firestore 資料遷移（Claude + Jack 配合，30-60 分鐘）

### 5.1 建立匯出用 GCS bucket（在 OLD project）

```bash
gcloud config set project leleshan-order
gcloud storage buckets create gs://leleshan-order-migration-export \
  --location=asia-east1 \
  --uniform-bucket-level-access
```

### 5.2 匯出 OLD Firestore

```bash
# 匯出全部 collections（含關鍵 20+ collections）
gcloud firestore export gs://leleshan-order-migration-export/$(date +%Y%m%d-%H%M%S) \
  --project=leleshan-order
# 等待完成（視資料量，10-30 分鐘）
```

記錄輸出路徑：例如 `gs://leleshan-order-migration-export/20260422-143055/`

### 5.3 匯入到 NEW

```bash
# 授權 NEW 的 service account 讀 OLD 的 bucket
export OLD_BUCKET=gs://leleshan-order-migration-export
export NEW_PROJECT=<newproject-id>
export NEW_SA="${NEW_PROJECT}@appspot.gserviceaccount.com"

# 確認路徑，然後 import
gcloud storage buckets add-iam-policy-binding $OLD_BUCKET \
  --member="serviceAccount:${NEW_SA}" \
  --role="roles/storage.objectViewer"

gcloud firestore import $OLD_BUCKET/<timestamp-from-5.2>/ \
  --project=$NEW_PROJECT
# 等待完成
```

### 5.4 抽樣比對（腳本會產生）

```bash
node scripts/migrate-firestore-compare.js leleshan-order <newproject>
# 輸出：每個 collection 的 doc 計數比對，最新 30 筆 orders 欄位比對
```

---

## Phase 6. 切流瞬間（Jack + Claude 配合，15 分鐘）

**前置條件**：Phase 4.4 + Phase 5.4 全部 PASS。挑**離峰時段**（週一上午 10:00 或週日下午 3:00）。

### 6.1 宣布維護窗（可選）

在 OLD 的 Hosting 貼 maintenance banner：「系統升級中，5 分鐘後恢復」。

### 6.2 停 OLD 的 onCreate / onUpdate trigger

```bash
# 停掉推播，避免資料遷移最後一波後又有新單打舊推播
firebase functions:delete sendOrderReceivedPush --region us-central1 --project default --force
firebase functions:delete sendOrderStatusPush --region us-central1 --project default --force
firebase functions:delete notifyAdminsNewLineOrder --region us-central1 --project default --force
# OLD 的 callable 先保留，等切完流再刪
```

### 6.3 最終增量匯出（若 5.2 之後有新單）

重跑 5.2-5.4，路徑加新 timestamp。

### 6.4 LINE Developer Console 切 Webhook URL

- 打開 [https://developers.line.biz/console/](https://developers.line.biz/console/)
- 找到 Messaging channel → Webhook settings
- **舊**：`https://us-central1-leleshan-order.cloudfunctions.net/lineWebhook`
- **新**：`https://asia-east1-<newproject>.cloudfunctions.net/lineWebhook`
- 點 Verify，確認 200 OK
- 儲存

### 6.5 LIFF Endpoint URL 切換

- LINE Developers → LIFF → 找到 LIFF ID `2008047700-HIAn2llR`
- Endpoint URL：舊 `https://leleshan-order.web.app/` → 新 `https://<newproject>.web.app/`
- 儲存（LIFF 內 apps 會在 ~1 分鐘內生效）

### 6.6 實際測試一筆真訂單

用自己的 LINE 下一筆 $1 測試單，全流程跑過去。

---

## Phase 7. 舊環境保留 + 觀察（72 小時）

- **不要立刻刪 OLD**！保留至少 72 小時作為回滾保險。
- 監控 NEW 的 Functions error rate、Firestore 讀寫量、推播成功率。
- 第 3 天確認穩定後，刪除 OLD 的 functions：`firebase functions:delete --all --region us-central1 --project default`
- 第 7 天可刪 OLD 的 Firestore（或保留更久）。

---

## Phase 8. 清理

- [ ] Commit `migration/us-to-asia` 到 main
- [ ] 合併後刪除 `migration/us-to-asia` 分支
- [ ] `functions/.env` 刪除正式 token（改用 secrets 後已不需要）
- [ ] 更新 README.md / docs/system-overview.md 的新 URL
- [ ] 調降 OLD 的 Blaze 預算到 NT$100/月
- [ ] 文件：回填實際 Project ID 與 URL 到本 runbook
