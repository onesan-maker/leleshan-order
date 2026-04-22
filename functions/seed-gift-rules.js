// One-time seed script for gift promotion rules
// Run: node seed-gift-rules.js
// Requires: GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "leleshan-system",
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
const STORE_ID = "store_1";

const defaultRules = [
  {
    id: "rule-150-299",
    name: "150-299 主食 1 份",
    enabled: true,
    minAmount: 150,
    maxAmount: 299,
    maxStaple: 1,
    maxVegetable: 0,
    sort: 1,
    items: [
      { id: "white-rice",      name: "白飯", type: "staple",     enabled: true, sort: 1, priceAdjustment: 0 },
      { id: "instant-noodle", name: "泡麵", type: "staple",     enabled: true, sort: 2, priceAdjustment: 0 },
      { id: "wide-noodle",    name: "寬粉", type: "staple",     enabled: true, sort: 3, priceAdjustment: 0 }
    ]
  },
  {
    id: "rule-300-449",
    name: "300-449 主食 2 份",
    enabled: true,
    minAmount: 300,
    maxAmount: 449,
    maxStaple: 2,
    maxVegetable: 0,
    sort: 2,
    items: [
      { id: "white-rice",      name: "白飯", type: "staple",     enabled: true, sort: 1, priceAdjustment: 0 },
      { id: "instant-noodle", name: "泡麵", type: "staple",     enabled: true, sort: 2, priceAdjustment: 0 },
      { id: "wide-noodle",    name: "寬粉", type: "staple",     enabled: true, sort: 3, priceAdjustment: 0 }
    ]
  },
  {
    id: "rule-450-plus",
    name: "450+ 主食 2 份＋蔬菜 1 份",
    enabled: true,
    minAmount: 450,
    maxAmount: null,
    maxStaple: 2,
    maxVegetable: 1,
    sort: 3,
    items: [
      { id: "white-rice",        name: "白飯",   type: "staple",     enabled: true, sort: 1, priceAdjustment: 0 },
      { id: "instant-noodle",   name: "泡麵",   type: "staple",     enabled: true, sort: 2, priceAdjustment: 0 },
      { id: "wide-noodle",      name: "寬粉",   type: "staple",     enabled: true, sort: 3, priceAdjustment: 0 },
      { id: "cabbage",          name: "高麗菜", type: "vegetable", enabled: true, sort: 4, priceAdjustment: 0 },
      { id: "mainland-lettuce", name: "大陸妹", type: "vegetable", enabled: true, sort: 5, priceAdjustment: 0 },
      { id: "baby-cabbage",     name: "娃娃菜", type: "vegetable", enabled: true, sort: 6, priceAdjustment: 0 }
    ]
  }
];

async function seed() {
  console.log("[Seed] Writing gift rules to settings/" + STORE_ID);
  await db.collection("settings").doc(STORE_ID).set({
    giftPromotion: {
      enabled: true,
      rules: defaultRules
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log("[Seed] Done! Gift rules seeded successfully.");
  process.exit(0);
}

seed().catch(function (err) {
  console.error("[Seed] Error:", err.message || err);
  process.exit(1);
});
