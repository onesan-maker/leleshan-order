# 樂樂山專案待辦 BACKLOG

最後更新：2026-04-27

> 這份檔案的存在是為了讓 Claude（任何對話、任何時刻）都能看到「目前還沒做完的事」，
> 避免依賴對話 context、避免遺忘。
>
> 凡是接手這個專案的 Claude Code，**第一件事是讀這份 BACKLOG.md + AGENTS.md**。

---

## ⚡ 下次工作 session 入口（明天起床先讀這個）

業主習慣：凌晨 3:30 收工，下午 2 點起床。

**明天第一件事**：
1. 買好的實體網路線接準系統（WiFi → Ethernet）
2. 在準系統 `ipconfig /all` 查 Ethernet 介面的新 IP
3. 回報新 IP 給對話 Claude，更新 W11-B 的 LAN fallback URL
4. 進 router（TP-Link AX1500，192.168.0.1）的「網路 → DHCP 伺服器 → 位址保留」設定 Ethernet MAC 綁定新 IP（或繼續用 WiFi MAC 綁 192.168.0.180）

**設備網路狀態（截至 2026-04-26 03:30）**：
- 準系統 Hub：店裡 WiFi，IP `192.168.0.180`（DHCP 動態，未保留）
- Tailscale IP：`100.72.80.2`（永遠不變）
- POS / KDS / Pickup Board：已接 W11-B 雙 IP fallback（主 Tailscale、備 192.168.0.180）

**待辦的網路強化（高優先）**：
- [ ] 接實體網路線到準系統
- [ ] router 設保留 IP（Ethernet 或 WiFi MAC 綁 192.168.0.180）
- [ ] 確認新 IP 後更新 W11-B 的 hub-client.ts 與 kds-hub-client.js
- [ ] 韌性實測：拔網路線測 POS / KDS 撐 5 分鐘（W11 韌性測試）

---

## 業主與系統脈絡

業主：Edmond Lee（樂樂山火鍋店老闆）
- 不懂程式（PHP 程度）
- 餐廳已營運 9 個月
- 目前生產系統：Sunmi T2 + Loyverse + 你訂（過渡方案）
- 本專案目的：取代上述方案，**視覺品質必須 ≥ 現有方案**
- 沒有開店 deadline 壓力
- 凌晨工作習慣，下午 2 點起床

技術環境：
- Firebase 專案：`leleshan-system`（asia-east1）
- 部署：`https://leleshan-system.web.app`
- 本機 Hub：準系統 Windows 10，Tailscale IP `100.72.80.2:8080`
- Hub 跑在 `C:\Users\YK\hub\`，PM2 守護，開機自動啟動
- 雙 Claude Code：家用電腦（改 git repo）+ 準系統（改 Hub code）

---

## 高優先（影響核心使用體驗）

- [ ] **W11 韌性實測**：明天接實體網路線後，實測拔網路線 5 分鐘看 POS/KDS 是否撐住、Hub Sync Daemon 在網路恢復後是否補推訂單
- [ ] **W12 Firestore Rules 安全審計**：W4 發現過漏洞（追加被擋），系統性掃描

## 中優先（功能完整度）

- [ ] **admin 後台 UI 對標 + 重寫**：含 Hub 監控頁。admin.js 1831 行 vanilla 重寫成 React
- [ ] **pos-admin 重寫**：菜單管理 / POS 規則設定（vanilla 1831 行）
- [ ] **訂單退款流程**：目前只有 cancel，缺退款金額處理
- [ ] **發票整合**：營運中需要的（電子發票 / 紙本）
- [ ] **庫存管理**：售完狀態目前手動，缺自動扣庫存

## 低優先（優化與擴展）

- [ ] **LIFF 顧客端優化**：INDEX-01~09 任務
  - 我的訂單頁
  - 取消訂單功能
  - 等待時間顯示
  - 推播通知
  - 會員系統整合
  - 其他

---

## 已完成里程碑

- ✅ W1 共享設計系統（tokens、components）
- ✅ W2-W7 POS v2 完整重寫並上線（取代 vanilla pos）
- ✅ W7a Firebase Auth 統一（POS 員工拿 custom token）
- ✅ W7b vanilla pos 完全移除，pos-v2 改名為 pos
- ✅ W8-1 Hub 骨架（Express + Hello World）
- ✅ W8-2 Hub SQLite + 訂單 API + PM2
- ✅ W8-3 POS 改接 Hub（Hub-first 下單）
- ✅ W8-4 KDS 改接 Hub
- ✅ W8-5 取餐看板（Hub 接入 + 設計）
- ✅ W8-6 Hub Sync Daemon（離線優先 → Firestore 最終一致）
- ✅ W8-7 PM2 開機自動啟動 + Windows 自動登入
- ✅ W9-A Hub 營運 API（cancel / admin endpoints）
- ✅ W9-B Admin 監控面板（功能版，視覺待後續對標）
- ✅ W10-B POS UI 全面對標 design/pos_redesign.html
- ✅ W10-B Hotfix（emoji icon + 購物車自動捲動）（commit 4267e3d）
- ✅ W10-C KDS UI 對標 + V2→V1 字樣更換（commit 04dd511）
- ✅ W11-A Hub 每日備份 + 同步歷史時間軸 + CSV 匯出
- ✅ W11-B POS / KDS / Pickup Board 雙 IP Hub fallback（Tailscale 主、店內區網備）
- ✅ W12 Pickup Board UI 對標（暖琥珀 + 玻璃感，kds-hub-pill 狀態指示）
- ✅ W12 Admin 報表頁（KPI / 每日折線 / 來源分布 / 熱銷 Top10 / 訂單明細 / CSV 匯出）
- ✅ W12-Hub `/admin/reports` endpoint（已實作完成）

---

## 工作流程規範摘要（細節見 AGENTS.md）

- 套件管理：**npm 不用 pnpm**
- POS 修改：`npm --prefix pos-src run build` 後 commit `pos/` build output
- 部署目標：唯一 `leleshan-system`，`scripts/guard-deploy.mjs` 強制驗證
- 禁動的 vanilla 檔案：`pos-session.js`, `order-helpers.js`, `order-status-labels.js`, `ops-session-sync.js`
- UI 任務：先讀 `design/` 對應檔案再實作，不得自行降級設計
- 所有檔案 UTF-8 無 BOM
- 業主用瀏覽器手動驗收，不會看 console / DevTools
