/**
 * scripts/migrate-firestore-compare.js
 *
 * Firestore 遷移抽樣比對腳本。比對兩個 project 的同名 collection：
 *   - 全量 doc 計數
 *   - 最新 30 筆 orders 的關鍵欄位
 *   - 5 筆隨機 doc 的 serverTimestamp 原封不動
 *
 * Usage:
 *   node scripts/migrate-firestore-compare.js <OLD_PROJECT_ID> <NEW_PROJECT_ID>
 *
 * 需要：
 *   - GOOGLE_APPLICATION_CREDENTIALS 指向 OLD 的 service account JSON
 *   - 或先 gcloud auth application-default login（兩個 project 都有權限）
 *
 * 執行時間：依資料量，30s - 5min 不等。
 */

/* eslint-disable no-console */
"use strict";

const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTIONS = [
  "orders", "order_items", "order_events", "notifications", "order_counters",
  "order_logs", "admins", "employees", "stores", "users", "customers",
  "menu_items", "categories", "flavors", "comboTemplates", "promotions",
  "settings", "inventory", "inventory_movements", "line_bindings",
  "posSessions", "staffCancelSessions", "store_runtime", "shift_logs",
  "point_rules", "point_logs", "point_transactions", "platform_orders",
  "platform_menu_mapping", "import_logs", "employeeIdIndex", "call",
];

const CRITICAL_ORDER_FIELDS = [
  "status", "storeId", "total", "subtotal", "pickupNumber",
  "lineUserId", "source", "customer_name"
];

function connect(projectId, appName) {
  return initializeApp({ projectId }, appName);
}

async function count(db, name) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function compareCounts(oldDb, newDb) {
  console.log("\n=== Collection counts ===");
  const diffs = [];
  for (const name of COLLECTIONS) {
    let oldN = 0, newN = 0;
    try { oldN = await count(oldDb, name); } catch (e) { oldN = `ERR:${e.code || e.message}`; }
    try { newN = await count(newDb, name); } catch (e) { newN = `ERR:${e.code || e.message}`; }
    const flag = (oldN === newN) ? "✓" : "✗";
    console.log(`${flag} ${name.padEnd(25)} OLD=${String(oldN).padStart(6)}  NEW=${String(newN).padStart(6)}`);
    if (oldN !== newN) diffs.push({ name, oldN, newN });
  }
  return diffs;
}

async function compareOrdersSample(oldDb, newDb) {
  console.log("\n=== Latest 30 orders field-by-field ===");
  const oldSnap = await oldDb.collection("orders")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  const mismatches = [];
  for (const doc of oldSnap.docs) {
    const oldData = doc.data() || {};
    const newSnap = await newDb.collection("orders").doc(doc.id).get();
    if (!newSnap.exists) {
      console.log(`✗ ${doc.id}  MISSING in NEW`);
      mismatches.push({ id: doc.id, missing: true });
      continue;
    }
    const newData = newSnap.data() || {};
    const fieldDiffs = [];
    for (const f of CRITICAL_ORDER_FIELDS) {
      const a = JSON.stringify(oldData[f] || null);
      const b = JSON.stringify(newData[f] || null);
      if (a !== b) fieldDiffs.push(`${f}: OLD=${a} NEW=${b}`);
    }
    // createdAt: compare seconds (allow 0 diff)
    const oldSec = oldData.createdAt && oldData.createdAt.seconds;
    const newSec = newData.createdAt && newData.createdAt.seconds;
    if (oldSec !== newSec) fieldDiffs.push(`createdAt: OLD=${oldSec} NEW=${newSec}`);

    if (fieldDiffs.length) {
      console.log(`✗ ${doc.id}`);
      fieldDiffs.forEach(d => console.log(`    ${d}`));
      mismatches.push({ id: doc.id, fieldDiffs });
    } else {
      console.log(`✓ ${doc.id}`);
    }
  }
  return mismatches;
}

async function compareRandomTimestamps(oldDb, newDb) {
  console.log("\n=== 5 random timestamp-bearing docs ===");
  const snap = await oldDb.collection("order_events")
    .limit(5)
    .get();
  for (const doc of snap.docs) {
    const oldTs = (doc.data() || {}).createdAt;
    const newSnap = await newDb.collection("order_events").doc(doc.id).get();
    if (!newSnap.exists) {
      console.log(`✗ order_events/${doc.id}  MISSING`);
      continue;
    }
    const newTs = (newSnap.data() || {}).createdAt;
    const same = oldTs && newTs
      && oldTs.seconds === newTs.seconds
      && oldTs.nanoseconds === newTs.nanoseconds;
    console.log(`${same ? "✓" : "✗"} ${doc.id}  OLD=${oldTs && oldTs.toDate && oldTs.toDate().toISOString()}  NEW=${newTs && newTs.toDate && newTs.toDate().toISOString()}`);
  }
}

async function main() {
  const [oldProject, newProject] = process.argv.slice(2);
  if (!oldProject || !newProject) {
    console.error("Usage: node scripts/migrate-firestore-compare.js <OLD_PROJECT_ID> <NEW_PROJECT_ID>");
    process.exit(2);
  }

  const oldApp = connect(oldProject, "old");
  const newApp = connect(newProject, "new");
  const oldDb = getFirestore(oldApp);
  const newDb = getFirestore(newApp);

  console.log(`Comparing: OLD=${oldProject}  →  NEW=${newProject}`);

  const countDiffs = await compareCounts(oldDb, newDb);
  const fieldDiffs = await compareOrdersSample(oldDb, newDb);
  await compareRandomTimestamps(oldDb, newDb);

  console.log("\n=== Summary ===");
  console.log(`Collection count mismatches: ${countDiffs.length}`);
  console.log(`Orders field mismatches:     ${fieldDiffs.length}`);

  await deleteApp(oldApp);
  await deleteApp(newApp);

  if (countDiffs.length || fieldDiffs.length) {
    process.exit(1);
  }
  console.log("\n✓ All checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
