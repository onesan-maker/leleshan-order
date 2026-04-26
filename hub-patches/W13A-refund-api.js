/**
 * ═══════════════════════════════════════════════════════════════════
 * W13-A Hub Server Patch — 訂單退款 API
 * ═══════════════════════════════════════════════════════════════════
 *
 * 準系統 Claude Code 適用（C:\Users\YK\hub\）
 * 這份檔案是「說明 + 可直接 copy 的程式碼片段」，非獨立執行檔。
 *
 * 應用步驟：
 *   1. 把 SCHEMA MIGRATION 片段貼入 Hub 啟動時的 initDb() 函式
 *   2. 把 ENDPOINTS 片段貼入 router / app.js 的路由區
 *   3. 把 GET /orders filter 更新應用到現有 GET /orders handler
 *   4. pm2 restart hub
 *
 * 測試：
 *   curl -X POST http://localhost:8080/orders/<id>/refund \
 *     -H "Content-Type: application/json" \
 *     -d '{"amount":200,"method":"cash","actorName":"測試"}'
 * ═══════════════════════════════════════════════════════════════════
 */

/* ── PART 1: Schema Migration (貼入 initDb / ensureSchema) ─────────
   在 Hub 啟動時的資料庫初始化區域，把以下兩條 SQLite 語句加進去。
   IF NOT EXISTS / IF NOT COLUMN EXISTS 確保冪等性，可重複執行。
   ──────────────────────────────────────────────────────────────── */
const SCHEMA_MIGRATION = `
  -- 退款記錄表
  CREATE TABLE IF NOT EXISTS refunds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    TEXT    NOT NULL REFERENCES orders(id),
    amount      INTEGER NOT NULL CHECK(amount > 0),
    method      TEXT    NOT NULL DEFAULT 'cash',
    reason      TEXT,
    actor_id    TEXT,
    actor_name  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- orders 表追加 refunded_amount 欄位（幂等：若已存在則跳過）
  -- SQLite 無 IF NOT EXISTS for ALTER TABLE，故用 try/catch 包住
`;

// 應用方式（在 initDb 或 ensureSchema 函式裡加）：
function applySchemaExample(db) {
  // CREATE refunds table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refunds (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    TEXT    NOT NULL REFERENCES orders(id),
      amount      INTEGER NOT NULL CHECK(amount > 0),
      method      TEXT    NOT NULL DEFAULT 'cash',
      reason      TEXT,
      actor_id    TEXT,
      actor_name  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // ADD refunded_amount to orders (catch if already exists)
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0`);
    console.log('[Hub] orders.refunded_amount column added');
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
    // column already exists — OK
  }
}


/* ── PART 2: POST /orders/:id/refund ──────────────────────────────
   貼入 router/app.js 的路由區（在 PATCH /orders/:id/status 附近）
   ──────────────────────────────────────────────────────────────── */
function registerRefundEndpoints(app, db) {

  /**
   * POST /orders/:id/refund
   * Body: { amount: number, method: string, reason?: string, actorId?: string, actorName?: string }
   * 回傳: { id, status, refunded_amount, refund: { id, amount, method, reason, created_at } }
   */
  app.post('/orders/:id/refund', (req, res) => {
    const orderId = req.params.id;
    const { amount, method = 'cash', reason, actorId, actorName } = req.body || {};

    // 驗證
    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'amount 必須為正整數（單位：元）' });
    }
    const ALLOWED_METHODS = ['cash', 'card', 'line_pay', 'transfer', 'other'];
    if (!ALLOWED_METHODS.includes(method)) {
      return res.status(400).json({ error: `method 無效；允許值：${ALLOWED_METHODS.join(', ')}` });
    }

    // 查訂單
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: '找不到訂單' });
    }

    // 只有 ready / completed / refunded 可以退款
    // ready（備餐完成）= 顧客已付款，可退款（W13-A Hotfix 補充）
    const refundableStatuses = ['ready', 'completed', 'refunded'];
    if (!refundableStatuses.includes(order.status)) {
      return res.status(409).json({ error: `訂單狀態 ${order.status} 不可退款` });
    }

    const orderTotal = order.total_amount || order.total || 0;
    const alreadyRefunded = order.refunded_amount || 0;
    const remaining = orderTotal - alreadyRefunded;

    if (amount > remaining) {
      return res.status(400).json({
        error: `退款金額 ${amount} 超過可退金額 ${remaining}（總額 ${orderTotal}，已退 ${alreadyRefunded}）`,
      });
    }

    // 計算新狀態
    const newRefundedAmount = alreadyRefunded + amount;
    const newStatus = newRefundedAmount >= orderTotal ? 'fully_refunded' : 'refunded';

    // 交易寫入
    const insertRefund = db.prepare(`
      INSERT INTO refunds (order_id, amount, method, reason, actor_id, actor_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateOrder = db.prepare(`
      UPDATE orders SET status = ?, refunded_amount = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);

    const txn = db.transaction(() => {
      const info = insertRefund.run(orderId, amount, method, reason || null, actorId || null, actorName || null);
      updateOrder.run(newStatus, newRefundedAmount, orderId);
      return info.lastInsertRowid;
    });

    let refundId;
    try {
      refundId = txn();
    } catch (e) {
      console.error('[Hub] refund transaction failed:', e);
      return res.status(500).json({ error: '退款寫入失敗' });
    }

    // 取得剛寫入的退款記錄
    const refundRow = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);

    res.json({
      id: orderId,
      status: newStatus,
      refunded_amount: newRefundedAmount,
      refund: {
        id: refundRow.id,
        amount: refundRow.amount,
        method: refundRow.method,
        reason: refundRow.reason,
        actor_id: refundRow.actor_id,
        actor_name: refundRow.actor_name,
        created_at: refundRow.created_at,
      },
    });
  });


  /**
   * GET /orders/:id/refunds
   * 回傳該訂單的退款記錄列表
   */
  app.get('/orders/:id/refunds', (req, res) => {
    const orderId = req.params.id;
    const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: '找不到訂單' });
    }
    const refunds = db.prepare(
      'SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at ASC'
    ).all(orderId);
    res.json({ orderId, refunds });
  });

}


/* ── PART 3: 更新 GET /orders 預設篩選 ────────────────────────────
   在現有 GET /orders handler 中：
   - 原本可能沒有過濾 cancelled：加入過濾
   - 新增過濾 fully_refunded
   - 新增 ?includeAll=1 參數繞過篩選（POS 今日訂單頁用）
   ──────────────────────────────────────────────────────────────── */

// 找到現有 GET /orders handler，把 SQL 查詢邏輯改成類似以下：
function getOrdersHandlerExample(req, res, db) {
  const { date, storeId, includeAll } = req.query;

  // ── 基礎篩選 ──
  const conditions = [];
  const params = [];

  if (date) {
    conditions.push("business_date = ?");
    params.push(date);
  }
  if (storeId) {
    conditions.push("store_id = ?");
    params.push(storeId);
  }

  // ── 預設隱藏 cancelled + fully_refunded（KDS / Pickup Board 用）
  //    ?includeAll=1 時全部顯示（POS 今日訂單頁用）
  if (!includeAll || includeAll !== '1') {
    conditions.push("status NOT IN ('cancelled', 'fully_refunded')");
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM orders ${where} ORDER BY created_at ASC`;
  const orders = db.prepare(sql).all(...params);

  res.json({ orders });
}


/* ── PART 4: 確認 Sync Daemon 同步 refunds 表 ─────────────────────
   如果 Hub Sync Daemon 有把 orders 同步到 Firestore，需要確認：
   1. refunds 表不需要同步（可選，若業主不需要 Firestore 報表）
   2. orders 的 status / refunded_amount 需要跟著同步

   目前建議：refunds 僅存 SQLite，Firestore orders 文件同步新的
   status (refunded / fully_refunded) 即可。
   ──────────────────────────────────────────────────────────────── */

module.exports = { applySchemaExample, registerRefundEndpoints, getOrdersHandlerExample };
