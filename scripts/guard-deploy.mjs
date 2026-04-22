#!/usr/bin/env node
// 部署前防呆：確認當前 Firebase CLI 使用的 project 是 leleshan-system
import { execSync } from "node:child_process";

const EXPECTED = "leleshan-system";

try {
  const out = execSync("firebase use", { encoding: "utf8" }).trim();
  // `firebase use` 輸出格式: "Active Project: leleshan-system (leleshan-system)"
  if (!out.includes(EXPECTED)) {
    console.error(`\n❌ 部署中止：當前 Firebase project 不是 ${EXPECTED}`);
    console.error(`   firebase use 輸出：${out}`);
    console.error(`   請執行：firebase use ${EXPECTED}\n`);
    process.exit(1);
  }
  console.log(`✅ Deploy guard 通過：${EXPECTED}`);
} catch (err) {
  console.error("❌ 無法執行 firebase use，請確認已安裝 firebase-tools：", err.message);
  process.exit(1);
}
