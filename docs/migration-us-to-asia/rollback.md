> ## ✅ 遷移已於 2026-04-22 完成並驗收
> 以下內容為歷史紀錄，現行唯一部署目標為 `leleshan-system`（asia-east1）。

# Rollback：各階段失敗處置

**原則**：OLD 專案保留至少 72 小時，任何階段都可以回滾到「OLD 完整運作」。

## 觸發回滾的條件（任一成立就執行）

1. NEW 推播失敗率 > 5%（連續 10 分鐘）
2. NEW 訂單寫入失敗率 > 1%
3. Firestore indexes 建不起來（讀取超時 > 5 秒）
4. LINE webhook 在 NEW 回 non-200 > 3 次
5. 顧客回報訂單不見、推播沒收到、取餐號碼亂掉
6. KDS / POS / admin 其中任一 console 連不上 NEW

---

## Scenario A：Phase 4 NEW deploy 失敗

**症狀**：`firebase deploy --only functions --project asia` 報錯、function 無法啟動、冷啟動超時。

**處置**：
- 不需回滾，**OLD 完全沒動過**。
- 修 bug → 重跑 Phase 4。
- 若卡很久，Jack 的 LINE 測試帳號可用 `window.APP_CONFIG.functionsRegion = "us-central1"` 臨時改回測試。

---

## Scenario B：Phase 5 資料匯出/匯入失敗

**症狀**：`gcloud firestore export` 報 permission denied、import 目標 collection 衝突、抽樣比對筆數不符。

**處置**：
- 若 export 失敗：檢查 OLD 是否已升 Blaze、service account 是否有 `Cloud Datastore Import Export Admin` 角色。
- 若 import 失敗：**先清空 NEW Firestore**（Console → 刪除所有 collections 或 `gcloud firestore databases delete` 後重建）再 import。
- **OLD 完全沒動過**，可以任意重試。

---

## Scenario C：Phase 6 LINE Webhook 切換後異常

**症狀**：切完 webhook URL 後，員工收不到新訂單推播、顧客下單沒反應、LINE 回「訊息無法處理」。

**處置（5 分鐘內完成）**：

### C.1 立即把 LINE Webhook URL 切回 OLD

1. 打開 [https://developers.line.biz/console/](https://developers.line.biz/console/)
2. Messaging channel → Webhook → 改回：
   `https://us-central1-leleshan-order.cloudfunctions.net/lineWebhook`
3. 點 Verify
4. 儲存

### C.2 把 LIFF Endpoint 切回 OLD

1. LINE Developers → LIFF → `2008047700-HIAn2llR`
2. Endpoint URL → `https://leleshan-order.web.app/`
3. 儲存

### C.3 若已刪 OLD 的推播 functions，重新 deploy 回去

```bash
# 先把本地切回 us-central1
git checkout main
git checkout <commit-before-asia-switch> -- functions/index.js config.public.js public/config.public.js
# 或直接 sed 改 REGION 回 us-central1

firebase use default  # 回 OLD
firebase deploy --only functions --project default
```

### C.4 通知客戶

若有實際訂單落在 NEW，透過 OLD 的 admin panel 手動補登（或從 NEW Firestore export 該段時間的 orders，transform 回 OLD 格式 import 進去）。

---

## Scenario D：切流後 48 小時內發現資料損毀

**症狀**：NEW 的 Firestore 資料有 collection 遺漏、欄位型別不對、timestamp 位移。

**處置**：
1. 不要動 OLD（OLD 是 source of truth）
2. Stop NEW 的寫入流量：把 Webhook 切回 OLD（參考 Scenario C）
3. 將 NEW 的整個 database 刪掉
4. 重新 export OLD → import NEW
5. 重新驗證

---

## Scenario E：NEW 專案憑證外洩 / 誤設

**症狀**：懷疑 API key 或 LINE token 外流、誤 commit 到 public repo。

**處置**：
1. Firebase Console → Project Settings → 刪除外洩的 API key
2. 產生新 key，更新 `config.public.js` → 立即 deploy hosting
3. LINE Developer Console → 產新的 Channel access token / Channel secret
4. `firebase functions:secrets:set` 覆蓋 secrets → 重 deploy functions
5. OLD 不受影響，不用回滾。

---

## 永久回滾（放棄遷移）

若 72 小時內發現 asia-east1 有無法接受的問題（例如 SLA 不如預期、計費意外暴衝）：

1. 執行 Scenario C 把流量切回 OLD。
2. 把 `migration/us-to-asia` 分支標為 abandoned（不刪，留著以後再試）。
3. 在 NEW 專案 GCP IAM → 關閉計費帳戶。
4. 30 天後刪除 NEW 專案（Firebase Console → Project Settings → Delete Project）。

---

## 每個階段的回滾時間成本

| 階段 | 已發生的不可逆動作 | 回滾時間 |
|---|---|---|
| Phase 1-3 | 無 | 0 分鐘（直接放棄）|
| Phase 4 | NEW 有 function 在跑 | 5 分鐘（停 NEW functions）|
| Phase 5 | NEW 有歷史資料 | 10 分鐘（刪 NEW Firestore）|
| Phase 6 切流前 | 同 Phase 5 | 10 分鐘 |
| **Phase 6 切流後** | **LINE webhook 指向 NEW** | **2-5 分鐘（Scenario C）** |
| Phase 7 第 3 天刪 OLD 前 | 72 小時內都可無痛回滾 | 2-5 分鐘 |
| Phase 7 刪 OLD 後 | OLD 沒了 | **不可回滾**（只能修 NEW）|

## 如何判斷「確定不回滾」

必須同時滿足：
- 連續 72 小時無 P1 事件
- 推播成功率 ≥ 99%
- Functions error rate < 0.5%
- 顧客 / 員工沒回報異常
- Firestore 讀寫延遲 ≤ OLD 的 30%（這是遷移的主要目的）

全部滿足後，才執行 Phase 7 的 OLD functions 刪除。
