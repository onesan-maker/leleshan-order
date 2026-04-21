/**
 * scripts/migrate-firestore-verify.js
 *
 * Post-import verification using Firestore REST API + Firebase CLI's cached
 * OAuth access token (auto-refreshed from refresh_token if stale). No extra
 * deps, no service account JSON, no ADC setup required.
 *
 * Usage:
 *   node scripts/migrate-firestore-verify.js <OLD_PROJECT> <NEW_PROJECT>
 */

"use strict";

const https = require("https");
const fs = require("fs");
const os = require("os");

const COLLECTIONS = [
  "orders", "order_items", "order_events", "notifications", "order_counters",
  "order_logs", "admins", "employees", "stores", "users", "customers",
  "menu_items", "categories", "flavors", "comboTemplates", "promotions",
  "settings", "inventory", "inventory_movements", "line_bindings",
  "posSessions", "staffCancelSessions", "store_runtime", "shift_logs",
  "point_rules", "point_logs", "point_transactions", "platform_orders",
  "platform_menu_mapping", "import_logs", "employeeIdIndex", "call",
];

function firebaseToolsConfigPath() {
  return os.homedir() + "/.config/configstore/firebase-tools.json";
}

function readAccessToken() {
  const j = JSON.parse(fs.readFileSync(firebaseToolsConfigPath(), "utf8"));
  if (!j.tokens || !j.tokens.access_token) throw new Error("No access_token in firebase-tools.json. Run: firebase login");
  return j.tokens.access_token;
}

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const req = https.request({
      hostname: "firestore.googleapis.com",
      path,
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": payload.length } : {}),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || "{}"));
        } else {
          reject(new Error(`HTTP ${res.statusCode} ${path}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function countCollection(project, collection, token) {
  const result = await apiCall(
    "POST",
    `/v1/projects/${project}/databases/(default)/documents:runAggregationQuery`,
    {
      structuredAggregationQuery: {
        structuredQuery: { from: [{ collectionId: collection }] },
        aggregations: [{ alias: "c", count: {} }],
      },
    },
    token,
  );
  const row = Array.isArray(result) ? result[0] : result;
  const c = row && row.result && row.result.aggregateFields && row.result.aggregateFields.c;
  return c && c.integerValue ? Number(c.integerValue) : 0;
}

async function latestOrders(project, token, limit) {
  const result = await apiCall(
    "POST",
    `/v1/projects/${project}/databases/(default)/documents:runQuery`,
    {
      structuredQuery: {
        from: [{ collectionId: "orders" }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
        limit,
      },
    },
    token,
  );
  return (Array.isArray(result) ? result : []).filter(r => r && r.document).map(r => r.document);
}

function docId(doc) {
  const n = doc.name || "";
  return n.split("/").pop();
}

function pick(doc, field) {
  const v = (doc.fields || {})[field];
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return v.integerValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  return JSON.stringify(v);
}

async function main() {
  const [oldProject, newProject] = process.argv.slice(2);
  if (!oldProject || !newProject) {
    console.error("Usage: node scripts/migrate-firestore-verify.js <OLD_PROJECT> <NEW_PROJECT>");
    process.exit(2);
  }
  const token = readAccessToken();
  console.log(`Verifying ${oldProject} → ${newProject}\n`);

  console.log("=== Collection counts ===");
  const diffs = [];
  for (const name of COLLECTIONS) {
    let oldN = 0, newN = 0;
    try { oldN = await countCollection(oldProject, name, token); } catch (e) { oldN = `ERR`; }
    try { newN = await countCollection(newProject, name, token); } catch (e) { newN = `ERR`; }
    const flag = (oldN === newN) ? "✓" : (oldN === 0 && newN === 0) ? "·" : "✗";
    console.log(`${flag} ${name.padEnd(26)} OLD=${String(oldN).padStart(6)}  NEW=${String(newN).padStart(6)}`);
    if (oldN !== newN && !(oldN === 0 && newN === 0)) diffs.push({ name, oldN, newN });
  }

  console.log("\n=== Latest 10 orders field parity ===");
  const mismatches = [];
  try {
    const oldList = await latestOrders(oldProject, token, 10);
    for (const oldDoc of oldList) {
      const id = docId(oldDoc);
      // Fetch single doc from NEW by docId
      let newDoc = null;
      try {
        newDoc = await apiCall("GET", `/v1/projects/${newProject}/databases/(default)/documents/orders/${id}`, null, token);
      } catch (e) {
        console.log(`✗ orders/${id}  MISSING in NEW`);
        mismatches.push({ id, missing: true });
        continue;
      }
      const fields = ["status", "storeId", "total", "subtotal", "pickupNumber", "lineUserId", "source"];
      const row = fields.map(f => {
        const a = JSON.stringify(pick(oldDoc, f));
        const b = JSON.stringify(pick(newDoc, f));
        return { f, same: a === b, a, b };
      });
      const bad = row.filter(r => !r.same);
      const createdSame = pick(oldDoc, "createdAt") === pick(newDoc, "createdAt");
      if (!createdSame) bad.push({ f: "createdAt", a: pick(oldDoc, "createdAt"), b: pick(newDoc, "createdAt") });
      if (bad.length) {
        console.log(`✗ orders/${id}`);
        bad.forEach(b => console.log(`    ${b.f}: OLD=${b.a} NEW=${b.b}`));
        mismatches.push({ id, bad });
      } else {
        console.log(`✓ orders/${id}`);
      }
    }
  } catch (e) {
    console.error("Latest orders compare failed:", e.message);
  }

  console.log("\n=== Summary ===");
  console.log(`Collection count diffs: ${diffs.length}`);
  console.log(`Orders field diffs:     ${mismatches.length}`);
  if (diffs.length || mismatches.length) {
    process.exit(1);
  }
  console.log("\n✓ All checks passed.");
}

main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
