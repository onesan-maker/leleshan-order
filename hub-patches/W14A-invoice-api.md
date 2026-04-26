# W14-A Hub Patch — Invoice Update Endpoint

**套用對象**：準系統 Claude Code（`C:\Users\YK\hub\server.js`）

---

## 新增端點：POST /orders/:id/invoice

把下列程式碼加在 `server.js` 中 `/orders/:id/cancel`（或 `/orders/:id/refund`）附近。

```javascript
// ── W14-A: 標記發票狀態（手動或未來自動）──────────────────────────
app.post('/orders/:id/invoice', (req, res) => {
  const { id } = req.params;
  const { invoiceNumber, provider, status, issuedAt, note } = req.body || {};

  const order = db.prepare('SELECT id, payload_json FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let payload = {};
  try { payload = JSON.parse(order.payload_json || '{}'); } catch (_) {}

  const existing = payload.invoice || {};
  payload.invoice = {
    ...existing,
    ...(invoiceNumber !== undefined ? { invoiceNumber } : {}),
    ...(provider      !== undefined ? { provider }      : {}),
    ...(status        !== undefined ? { status }        : {}),
    ...(issuedAt      !== undefined ? { issuedAt }      : {}),
    ...(note          !== undefined ? { note }          : {}),
    // preserve carrierType, carrier, buyerName, etc. from original
  };

  const now = nowIso(); // 假設 nowIso() 已定義；否則改用 new Date().toISOString()
  db.prepare(`
    UPDATE orders
    SET payload_json = ?, updated_at = ?, synced_to_cloud = 0
    WHERE id = ?
  `).run(JSON.stringify(payload), now, id);

  // 記 order_events
  try {
    db.prepare(`
      INSERT INTO order_events (order_id, event_type, message, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, 'invoice_updated', JSON.stringify(payload.invoice), now);
  } catch (_) {}

  res.json({ orderId: id, invoice: payload.invoice });
});
```

---

## 啟動 log 加（可選）

在 `console.log('[Hub] Routes registered:')` 附近加：

```javascript
console.log('  POST /orders/:id/invoice');
```

---

## 驗證

```powershell
# 找一筆訂單 ID
$orders = Invoke-RestMethod -Uri http://localhost:8080/admin/orders/recent?limit=5
$id = $orders.orders[0].id

# 標記已開
$body = @{
  invoiceNumber = "AB12345678"
  status        = "issued"
  provider      = "manual"
  issuedAt      = (Get-Date).ToString("o")
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8080/orders/$id/invoice" `
  -Body $body `
  -ContentType 'application/json'

# 預期回傳：{ orderId: "...", invoice: { status: "issued", invoiceNumber: "AB12345678", ... } }
```

---

## 注意事項

- invoice 資料存在 `payload_json`，透過現有 sync daemon 同步到 Firestore（order doc 層）。
- Hub **不需要**新增欄位或 ALTER TABLE，`payload_json` 已完整儲存。
- 此端點為冪等：重複呼叫只更新指定欄位，其餘 invoice 欄位（carrierType 等）不受影響。
- `refundableStatuses` 不影響此端點（發票不限訂單狀態皆可更新）。
- `pm2 restart hub` 後立即生效。
