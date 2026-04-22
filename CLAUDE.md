## 部署規範
- 此 repo 唯一部署目標為 `leleshan-system`。
- 任何 `firebase deploy` 指令之前，必須先跑 `firebase use` 確認當前 project，並跑 `node scripts/guard-deploy.mjs`。
- 舊專案 `leleshan-order` 僅作為資料備份保留，不再接受任何寫入或部署。
- 若執行任何 seed / migration script 前，務必 `grep projectId` 確認腳本目標不是舊專案。