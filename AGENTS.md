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

## POS v2（`/pos-v2`）開發規範

- 原始碼位於 `pos-v2-src/`，build 產出在 `pos-v2/`（**已進 git**）
- 任何 `pos-v2-src/` 的修改後，必須執行 `npm --prefix pos-v2-src run build` 並把 `pos-v2/` 的變更一起 commit
- 本專案唯一部署目標為 `leleshan-system`
- 禁止修改 vanilla POS（`pos.html`、`pos.js`、`pos-admin.*`、`pos-login.*`、`pos-session.js`）
- 禁止修改 `kds.*`、`ops.css`、`shared/*.css`
- W2 只做骨架與 auth bridge，菜單／購物車／結帳留待 W3
