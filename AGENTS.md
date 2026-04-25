# Claude Code / Codex 共通防呆規範

## 編碼規範
- 所有 `html/js/css/json/md` 檔案一律使用 UTF-8。
- 所有 HTML 檔案必須包含 `<meta charset="UTF-8">`。

## 編輯安全規範
- 禁止使用未指定編碼的 PowerShell `Set-Content` / `Out-File`。
- 修改前先讀取相關檔案內容，只在指定範圍內修改。
- 若發現亂碼（例如三連問號 `\u003f\u003f\u003f` 或 replacement char `\uFFFD`），優先先 `git restore` 回復檔案，再套用修改。
- 修改完成後，必須檢查是否出現 `\u003f\u003f\u003f` / `\uFFFD`。

## Git 操作規範
- 新頁面或新檔案不得長期保持 untracked，建立後應立即納入 Git 追蹤。

## POS 開發規範

- 原始碼位於 `pos-src/`，build 產出在 `pos/`（**已進 git**）
- 任何 `pos-src/` 的修改後，必須執行 `npm --prefix pos-src run build` 並把 `pos/` 的變更一起 commit
- 本專案唯一部署目標為 `leleshan-system`
- 禁止修改 `pos-session.js`、`order-helpers.js`、`order-status-labels.js`、`ops-session-sync.js`
- `pos-admin.*` 暫保留（Week 3+ 後規劃重寫）
- 禁止修改 `kds.*`、`ops.css`、`shared/*.css`

## 視覺與設計（強制）

### 設計參考稿優先

當 `design/` 資料夾存在 HTML 設計稿（如 `design/pos_redesign.html`），**任何 UI 任務必須先讀對應設計稿，再開始實作**。

設計稿是業主對視覺的最終決策，不是建議。如果設計稿與功能需求衝突，先停下來詢問業主，而非自行妥協。

### UI 任務的工作流程

開始任何 UI 任務（新增元件、改版型、套版）時，必須執行：

1. `ls design/` 確認設計稿是否存在
2. 若有相關設計稿（例如 POS 任務 → `pos_redesign.html`），讀完設計稿
3. 提取設計稿的：
   - 色彩 token（背景、accent、text）
   - 字體層級（serif / sans / mono 配置）
   - 間距與圓角規則
   - 動畫與互動細節（hover、active、transition）
   - 卡片 elevation 規則（shadow、backdrop-filter）
4. 對照 `shared/tokens.css` 確認 token 已對齊；若設計稿有新 token，補進 tokens.css
5. 實作時逐元件對標，確保**質感不打折**

### 不得自行降級設計

「資訊密度更高」、「先求功能可用」、「後續再優化視覺」這些理由都**不能成為設計打折的藉口**。

如果設計稿要求 backdrop-filter、漸層背景、字體混搭、精緻動畫，實作必須做到。

如果工程上有困難（例如某個 CSS 屬性瀏覽器支援差），停下來與業主溝通，給出明確替代方案，而非自行省略。

### 業主已營運中

樂樂山火鍋店已開業 9 個月，目前使用 Loyverse + 你訂作為過渡。本系統的目的是**取代**現有方案，因此「比現有方案更精緻」是核心需求，不是 nice-to-have。

如果做出來只是「能用」而非「比現有的好」，本系統就沒有存在價值。

## Hub 架構與離線優先

POS / KDS / 取餐看板都透過本機 Hub（準系統，Tailscale IP `100.72.80.2:8080`）作為主要訂單來源。Firestore 是**最終一致**的雲端備份。

斷網時：
- POS / KDS 必須正常運作（透過 Tailscale 內網連 Hub）
- Hub Sync Daemon 在網路恢復後自動推 Firestore
- 不允許在 POS / KDS 路徑直接寫 Firestore（追加訂單除外，那是 Cloud Function）
