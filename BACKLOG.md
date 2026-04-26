# 樂樂山專案待辦 BACKLOG

最後更新：2026-04-28（W14-A）

> 這份檔案的存在是為了讓 Claude（任何對話、任何時刻）都能看到「目前還沒做完的事」，
> 避免依賴對話 context、避免遺忘。
>
> 凡是接手這個專案的 Claude Code，**第一件事是讀這份 BACKLOG.md + AGENTS.md**。

---

## ⚡ 下次工作 session 入口（明天起床先讀這個）

業主習慣：凌晨 3:30 收工，下午 2 點起床。

**最後一次 session 結束時間**：2026-04-27 凌晨

**目前系統能力**（截至此 commit）：
- ✅ 完整離線優先架構（Hub-first，Tailscale + LAN 雙 IP fallback）
- ✅ POS / KDS / Pickup Board / Admin 全套 UI 對標 design/pos_redesign.html
- ✅ 訂單退款（部分/全額）端到端：POS UI + Hub API
- ✅ 報表頁（KPI / 每日趨勢 / 來源分布 / Top10 / CSV 匯出）
- ✅ Admin Hub 監控面板
- ✅ Hub 自動每日備份 + 同步歷史時間軸
- ✅ Firestore Rules 安全審計（H1~H5、M1/M4、L1 修補 deploy 完成）
- ✅ 發票模組空殼（POS 結帳填寫 + Admin 管理頁 + Hub 標記 endpoint，未串第三方）
- ✅ 庫存基礎（Hub schema + endpoints 完備，待 admin UI / POS 自動扣量）

**網路架構**（已穩定）：
- 中華電信 AP（192.168.1.x 網段）
- 準系統 Hub：有線 192.168.1.50（中華電信 AP DHCP 保留）
- TP-Link AX1500：基地台模式（WiFi 訊號延伸，不做 NAT）
- 全店 POS / KDS / 看板 都在 192.168.1.x 同網段
- Tailscale 100.72.80.2（跨地點遠端管理）
- W11-B 雙 IP fallback：主 100.72.80.2、備 192.168.1.50

**生產環境狀態**：
- 業主餐廳已營運 9 個月，使用 Loyverse + 你訂作為過渡
- 本系統與生產環境並行，目前所有訂單均為測試
- 切換到本系統的時機由業主決定（無 deadline 壓力）

**待辦清單依優先序**：

### 高優先（核心功能完整度）
- [ ] **W14-C 庫存 admin UI**：菜單管理頁加庫存設定 + 補貨 / 異動歷史 / 警告
- [ ] **W14-D 訂單下單自動扣庫存**：POS 送單時 hook，扣對應 menu_item 的 inventory
- [ ] **W11 韌性實測**：拔網路線 5 分鐘看 POS / KDS 撐住、Hub 恢復後同步補推
- [ ] **W13-B 移除過時 line / walk_in source 白名單**（如果確認 Cloud Function 沒在用）

### 中優先（業務流程完整）
- [ ] **admin 後台 UI 對標 + 重寫**：admin.js 1831 行 vanilla 重寫成 React
- [ ] **pos-admin 重寫**：菜單管理 / POS 規則設定（vanilla 1831 行）
- [ ] **發票第三方串接**（業主簽完加值中心後再做）：ECPay / NewebPay / 統一
- [ ] **退款報表**：日 / 月 / 退款率 / 退款原因分布

### 低優先（擴展功能）
- [ ] **顧客忠誠度 / 點數系統**：point_transactions 已有 schema，缺 UI
- [ ] **員工管理 / 班表 / 薪資**：shift_logs 已記錄，缺彙整介面
- [ ] **LIFF 顧客端優化**：INDEX-01~09（我的訂單、取消訂單、等待時間、推播）

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

- [ ] **W14-C 庫存 admin UI**：菜單管理頁加庫存設定 + 補貨 / 異動歷史 / 警告
- [ ] **W14-D 訂單下單自動扣庫存**：POS 送單時 hook，扣對應 menu_item 的 inventory
- [ ] **W11 韌性實測**：拔網路線 5 分鐘看 POS / KDS 撐住、Hub 恢復後同步補推

## 中優先（功能完整度）

- [ ] **admin 後台 UI 對標 + 重寫**：admin.js 越來越長，重寫成 React
- [ ] **pos-admin 重寫**：菜單管理 / POS 規則設定（vanilla）
- [ ] **發票第三方串接**（業主簽完加值中心後再做）：ECPay / NewebPay / 統一
- [ ] **退款報表**：日 / 月 / 退款率 / 退款原因分布

## 低優先（優化與擴展）

- [ ] **LIFF 顧客端優化**：INDEX-01~09 任務
  - 我的訂單頁
  - 取消訂單功能
  - 等待時間顯示
  - 推播通知
  - 會員系統整合
- [ ] **顧客忠誠度 / 點數系統**：point_transactions 已有 schema，缺 UI
- [ ] **員工管理 / 班表 / 薪資**：shift_logs 已記錄，缺彙整介面

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
- ✅ Pickup Board 動畫遮擋 Hotfix（第 3 次，CSS 加永久警告註解）
- ✅ W13-A 訂單退款流程（POS UI + Hub API + 端到端驗證）
- ✅ W13-B Firestore Rules 安全審計 + Deploy（5H + 2M + 1L 修補，含 LIFF unauthenticated 妥協 fallback）
- ✅ hub-patches/ 清理（W13A patch 已套用後刪除）
- ✅ W14-A 發票模組空殼（POS / Admin / Hub）
- ✅ W14-B Hub 庫存基礎（schema + 6 個 endpoints + 路由順序修補）

---

## 工作流程規範摘要（細節見 AGENTS.md）

- 套件管理：**npm 不用 pnpm**
- POS 修改：`npm --prefix pos-src run build` 後 commit `pos/` build output
- 部署目標：唯一 `leleshan-system`，`scripts/guard-deploy.mjs` 強制驗證
- 禁動的 vanilla 檔案：`pos-session.js`, `order-helpers.js`, `order-status-labels.js`, `ops-session-sync.js`
- UI 任務：先讀 `design/` 對應檔案再實作，不得自行降級設計
- 所有檔案 UTF-8 無 BOM
- 業主用瀏覽器手動驗收，不會看 console / DevTools
