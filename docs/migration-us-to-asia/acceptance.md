> ## ✅ 遷移已於 2026-04-22 完成並驗收
> 以下內容為歷史紀錄，現行唯一部署目標為 `leleshan-system`（asia-east1）。

# 驗收清單

每個階段完成後，必須全部勾完才進下一階段。

---

## A. 遷移前程式整理（commit `b774a56`）驗收

deploy 到 OLD (us-central1) 後，確認**外部行為完全不變**：

- [ ] `firebase deploy --only functions --project default` 成功，無錯誤
- [ ] Functions Console 14 個 function 都是 `us-central1`（不是 13 也不是 15）
- [ ] 真實下單一筆（LIFF 或測試帳號），推播「已收到訂單」正常
- [ ] 改訂單狀態到 ready，推播「可取餐」正常
- [ ] 取消訂單，推播「訂單取消」正常
- [ ] 員工 LINE 取消 postback 能觸發 `lineWebhook`
- [ ] POS 登入 / 登出 / 今日訂單查詢 callable 正常
- [ ] admin panel 可以正常建立員工（`upsertEmployee`）、重設 PIN（`resetEmployeePin`）
- [ ] 連續下 3 筆單測試 idempotent：每筆只收到 1 次推播（check `notificationStatus.receivedPushSent` + `receivedPushSentClaimedRegion` 欄位都有值）

---

## B. NEW 專案建立驗收

- [ ] Project ID 確定：`__________________`
- [ ] Firestore 顯示 Location：`asia-east1`
- [ ] Storage default bucket 顯示 Location：`asia-east1`
- [ ] 6 個必要 API 都已啟用（Cloud Functions / Cloud Build / Artifact Registry / Eventarc / Secret Manager / Cloud Scheduler）
- [ ] `firebase use asia` 成功，`firebase projects:list` 列出新 project
- [ ] Authentication 已啟用 Google 登入，`onesan@gmail.com` 可登入
- [ ] `firebase functions:secrets:set` 寫入 `LINE_CHANNEL_ACCESS_TOKEN` 與 `LINE_CHANNEL_SECRET` 都回 OK

---

## C. NEW 第一次 deploy 驗收

- [ ] `firebase deploy --only firestore:rules --project asia` 成功
- [ ] `firebase deploy --only firestore:indexes --project asia` 成功；Console 看 12 個 composite indexes 全部 **Enabled**（非 Building）
- [ ] `firebase deploy --only functions --project asia` 成功；14 個 function 在 asia-east1
- [ ] `firebase deploy --only hosting --project asia` 成功；`https://<newproject>.web.app` 可開
- [ ] 前台 `https://<newproject>.web.app` 能看到菜單（讀 `menu_items`）— 意味 client config 已切到 NEW
- [ ] 瀏覽器 DevTools Network 分頁確認 `firestore.googleapis.com` 請求的 URL 包含 `asia-east1`（或至少不再是 `nam5`）
- [ ] Functions logs 沒有 `REGION mismatch` / `bucket location mismatch` 警告

---

## D. 資料遷移驗收

### D.1 匯出

- [ ] `gcloud firestore export` 完成，exit 0
- [ ] GCS bucket 可見 `metadata.json` + `all_namespaces/all_kinds/output-0` 等檔案
- [ ] export 大小合理（和 Firestore Console 顯示的 storage usage 接近）

### D.2 匯入

- [ ] `gcloud firestore import` 完成，exit 0
- [ ] NEW Firestore Console 看到所有原 collection

### D.3 抽樣比對（由 `scripts/migrate-firestore-compare.js` 產出）

各 collection **筆數一致**（NEW 可以略多於 OLD，因為 test orders；但不可少）：

| Collection | OLD 筆數 | NEW 筆數 | 允許差異 |
|---|---|---|---|
| orders | | | 0 |
| order_items | | | 0 |
| order_events | | | 0 |
| notifications | | | 0 |
| admins | | | 0 |
| employees | | | 0 |
| menu_items | | | 0 |
| categories | | | 0 |
| flavors | | | 0 |
| comboTemplates | | | 0 |
| promotions | | | 0 |
| settings | | | 0 |
| inventory | | | 0 |
| stores | | | 0 |
| users | | | 0 |
| customers | | | 0 |
| line_bindings | | | 0 |
| posSessions | | | 0 |
| platform_orders | | | 0 |
| platform_menu_mapping | | | 0 |
| inventory_movements | | | 0 |
| shift_logs | | | 0 |
| order_logs | | | 0 |
| point_rules | | | 0 |
| point_logs | | | 0 |
| point_transactions | | | 0 |
| staffCancelSessions | | | 0 |
| import_logs | | | 0 |
| employeeIdIndex | | | 0 |

### D.4 最新 30 筆 orders 欄位比對

抽 OLD 最新 30 筆訂單，對 NEW 的同 docId 做：
- [ ] `status` 一致
- [ ] `storeId` 一致
- [ ] `total`、`subtotal` 一致
- [ ] `createdAt` 一致（seconds 與 nanoseconds 都要）
- [ ] `pickupNumber` 一致
- [ ] `items` 陣列長度一致
- [ ] `lineUserId` 一致（若有）
- [ ] `notificationStatus.receivedPushSent` 一致

### D.5 serverTimestamp 驗證

- [ ] 隨機抽 5 筆有 `createdAt` 的 doc，NEW 的時間與 OLD 完全一致（非新生成的 server timestamp）

---

## E. 切流前最終驗收

- [ ] LIFF 登入 → 下單 → 推播收到（用 NEW 的 Hosting URL + NEW 的 function）
- [ ] 推播內文正確（取餐號碼、商品列表、合計金額）
- [ ] 員工 LINE 取消按鈕能觸發 `lineWebhook` 並正確取消訂單
- [ ] POS 員工登入、查看今日訂單、登出都正常
- [ ] KDS 能即時看到新訂單（onSnapshot 在新 region 延遲 < 1 秒）
- [ ] admin panel 能讀菜單 / 員工 / 訂單、能修改設定、能 bootstrap owner（若是新裝）
- [ ] Functions logs 沒有 error，只有 info 等級

---

## F. 切流後 T+0（前 15 分鐘）

- [ ] LINE webhook Verify 200 OK
- [ ] 自己下一筆 $1 真訂單，完整流程跑過
- [ ] Functions logs 有 `[Push/onCreate]` 正常訊息
- [ ] Firestore NEW 有該筆新訂單
- [ ] OLD Firestore 沒有該筆新訂單（確認流量真的切走）

---

## G. 切流後 T+1h / T+24h / T+72h 持續監控

時間點 | 指標 | 目標
---|---|---
T+1h | 推播成功率 | ≥ 99%
T+1h | Functions error 數 | 0
T+1h | 顧客回報 | 0
T+24h | 推播成功率 | ≥ 99%
T+24h | Functions p95 latency | ≤ 1.5s
T+24h | 營收量與 OLD 前一週同時段比對 | 差異 < 10%
T+72h | 無 P1 事件 | 確認後執行 Phase 7 的 OLD 刪除

---

## H. 最終清理驗收

- [ ] `migration/us-to-asia` merge 到 main 完成
- [ ] `functions/.env` 已不含正式 token
- [ ] `README.md` / `docs/system-overview.md` URL 已更新
- [ ] OLD Blaze 預算已調降
- [ ] 本 acceptance.md 所有勾選都完成，歸檔
