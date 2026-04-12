package com.leleshan.pos.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.leleshan.pos.AppConfig
import com.leleshan.pos.AppConfig.Collections
import com.leleshan.pos.AppConfig.EventType
import com.leleshan.pos.AppConfig.ItemField
import com.leleshan.pos.AppConfig.OrderField
import com.leleshan.pos.data.model.CartItem
import com.leleshan.pos.data.model.Order
import com.leleshan.pos.data.model.OrderGroup
import com.leleshan.pos.data.model.OrderItemDoc
import com.leleshan.pos.util.DateUtils
import kotlinx.coroutines.tasks.await

data class SubmitResult(
    val orderId: String,
    val pickupNumber: String
)

class OrderRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    // ─────────────────────────────────────────────────────
    // 建立新訂單
    // 完全對應 JS pos.js handleNewOrderSubmit + buildCreatePayload
    // ─────────────────────────────────────────────────────
    suspend fun createOrder(
        customerName: String,
        cartItems: List<CartItem>,
        note: String,
        staffUid: String,
        staffName: String
    ): Result<SubmitResult> = runCatching {

        val storeId   = AppConfig.STORE_ID
        val orderRef  = db.collection(Collections.ORDERS).document()
        val orderId   = orderRef.id
        val todayStr  = DateUtils.todayTaiwanString()
        val counterRef= db.collection(Collections.COUNTERS).document(todayStr)
        val ts        = FieldValue.serverTimestamp()

        val subtotal  = cartItems.sumOf { it.lineTotal }
        val itemsMap  = cartItems.map { it.toOrderItemMap() }
        var pickupNumber = ""

        // Transaction：更新計數器 + 寫入訂單 + 寫入事件（atomic）
        db.runTransaction { tx ->
            val counterDoc = tx.get(counterRef)
            val seq = if (counterDoc.exists()) {
                (counterDoc.getLong("seq") ?: 0L) + 1L
            } else 1L
            pickupNumber = seq.toString().padStart(3, '0')

            // 1. 更新每日計數器
            tx.set(counterRef, mapOf(
                "seq"       to seq,
                "date"      to todayStr,
                "updatedAt" to ts
            ), com.google.firebase.firestore.SetOptions.merge())

            // 2. 寫入訂單
            val orderPayload = buildOrderPayload(
                orderId       = orderId,
                storeId       = storeId,
                customerName  = customerName,
                itemsMap      = itemsMap,
                subtotal      = subtotal,
                note          = note,
                pickupNumber  = pickupNumber,
                pickupSeq     = seq.toInt()
            )
            tx.set(orderRef, orderPayload)

            // 3. 寫入 order_events: order_created
            val eventRef = db.collection(Collections.ORDER_EVENTS).document()
            tx.set(eventRef, buildEventPayload(
                orderId    = orderId,
                storeId    = storeId,
                type       = EventType.ORDER_CREATED,
                fromStatus = null,
                toStatus   = AppConfig.ORDER_STATUS_NEW,
                message    = "POS 現場建單，取餐號碼 $pickupNumber",
                staffUid   = staffUid,
                staffName  = staffName
            ))
        }.await()

        // 4. 批次寫入 order_items（transaction 外，與 JS 相同做法）
        writeOrderItems(orderId, storeId, cartItems)

        SubmitResult(orderId, pickupNumber)
    }

    // ─────────────────────────────────────────────────────
    // 追加品項到既有訂單
    // 完全對應 JS pos.js handleAppendSubmit
    // ─────────────────────────────────────────────────────
    suspend fun appendToOrder(
        orderId: String,
        cartItems: List<CartItem>,
        staffUid: String,
        staffName: String
    ): Result<Unit> = runCatching {

        val storeId   = AppConfig.STORE_ID
        val orderRef  = db.collection(Collections.ORDERS).document(orderId)
        val ts        = FieldValue.serverTimestamp()
        val appendTotal = cartItems.sumOf { it.lineTotal }
        val appendItemsMaps = cartItems.map { it.toOrderItemMap() }

        db.runTransaction { tx ->
            val orderDoc = tx.get(orderRef)
            check(orderDoc.exists()) { "訂單 $orderId 不存在" }

            val data       = orderDoc.data!!
            val prevStatus = data[OrderField.STATUS] as? String ?: "new"
            val wasReady   = prevStatus == "ready"
            val currentItems = (data[OrderField.ITEMS] as? List<*>) ?: emptyList<Any>()
            val newItems = currentItems + appendItemsMaps

            val update = mutableMapOf<String, Any>(
                OrderField.ITEMS      to newItems,
                OrderField.SUBTOTAL   to FieldValue.increment(appendTotal.toLong()),
                OrderField.TOTAL      to FieldValue.increment(appendTotal.toLong()),
                OrderField.TOTAL_AMOUNT to FieldValue.increment(appendTotal.toLong()),
                OrderField.TOTAL_PRICE  to FieldValue.increment(appendTotal.toLong()),
                OrderField.ITEM_COUNT to FieldValue.increment(cartItems.size.toLong()),
                OrderField.UPDATED_AT  to ts,
                OrderField.UPDATED_AT2 to ts
            )
            if (wasReady) update[OrderField.STATUS] = "preparing"
            tx.update(orderRef, update)

            // order_events: order_appended
            val eventRef = db.collection(Collections.ORDER_EVENTS).document()
            tx.set(eventRef, buildEventPayload(
                orderId    = orderId,
                storeId    = storeId,
                type       = EventType.APPENDED,
                fromStatus = prevStatus,
                toStatus   = if (wasReady) "preparing" else prevStatus,
                message    = "追加 ${cartItems.size} 項，+NT\$$appendTotal",
                staffUid   = staffUid,
                staffName  = staffName,
                extra      = mapOf(
                    "appendedItems" to appendItemsMaps,
                    "amountDelta"   to appendTotal
                )
            ))

            if (wasReady) {
                val statusEventRef = db.collection(Collections.ORDER_EVENTS).document()
                tx.set(statusEventRef, buildEventPayload(
                    orderId    = orderId,
                    storeId    = storeId,
                    type       = EventType.STATUS_CHANGED,
                    fromStatus = "ready",
                    toStatus   = "preparing",
                    message    = "追加品項，由 ready 回退為 preparing",
                    staffUid   = staffUid,
                    staffName  = staffName
                ))
            }
        }.await()

        // 寫入 order_items
        writeOrderItems(orderId, storeId, cartItems)
    }

    // ─────────────────────────────────────────────────────
    // 讀取今日可追加訂單（status 非 completed/cancelled）
    // ─────────────────────────────────────────────────────
    suspend fun loadTodayActiveOrders(): Result<List<Order>> = runCatching {
        val snap = db.collection(Collections.ORDERS)
            .whereEqualTo(OrderField.STORE_ID, AppConfig.STORE_ID)
            .orderBy(OrderField.CREATED_AT, Query.Direction.DESCENDING)
            .limit(50)
            .get()
            .await()

        snap.documents.mapNotNull { doc ->
            val d = doc.data ?: return@mapNotNull null
            val status = d[OrderField.STATUS] as? String ?: return@mapNotNull null
            if (status in listOf("completed", "picked_up", "cancelled")) return@mapNotNull null
            Order(
                id           = doc.id,
                storeId      = d[OrderField.STORE_ID] as? String ?: "",
                status       = status,
                customerName = d[OrderField.CUSTOMER_NAME] as? String ?: "",
                pickupNumber = d[OrderField.PICKUP_NUMBER] as? String ?: "",
                total        = (d[OrderField.TOTAL] as? Number)?.toInt() ?: 0,
                itemCount    = (d[OrderField.ITEM_COUNT] as? Number)?.toInt() ?: 0,
                note         = d[OrderField.NOTE] as? String ?: "",
                createdAt    = d[OrderField.CREATED_AT] as? Timestamp,
                source       = d[OrderField.SOURCE] as? String ?: "pos"
            )
        }
    }

    // ─────────────────────────────────────────────────────
    // 讀取訂單明細（order_items，依 groupId 分組）
    // ─────────────────────────────────────────────────────
    suspend fun loadOrderGroups(orderId: String): Result<List<OrderGroup>> = runCatching {
        val snap = db.collection(Collections.ORDER_ITEMS)
            .whereEqualTo(ItemField.ORDER_ID, orderId)
            .orderBy(ItemField.CREATED_AT, Query.Direction.ASCENDING)
            .get()
            .await()

        val docs = snap.documents.mapNotNull { doc ->
            val d = doc.data ?: return@mapNotNull null
            @Suppress("UNCHECKED_CAST")
            val opts = (d[ItemField.SELECTED_OPTIONS] as? List<*>)
                ?.mapNotNull { it as? Map<String, Any> } ?: emptyList()
            OrderItemDoc(
                docId      = doc.id,
                orderId    = d[ItemField.ORDER_ID]    as? String ?: "",
                storeId    = d[ItemField.STORE_ID]    as? String ?: "",
                menuItemId = d[ItemField.MENU_ITEM_ID]as? String ?: "",
                name       = d[ItemField.NAME]        as? String ?: "",
                qty        = (d[ItemField.QTY] as? Number)?.toInt() ?: 1,
                unitPrice  = (d[ItemField.UNIT_PRICE] as? Number)?.toInt() ?: 0,
                lineTotal  = (d[ItemField.LINE_TOTAL] as? Number)?.toInt() ?: 0,
                flavor     = d[ItemField.FLAVOR]      as? String ?: "",
                staple     = d[ItemField.STAPLE]      as? String ?: "",
                selectedOptions = opts,
                notes      = d[ItemField.NOTES]       as? String ?: "",
                source     = d[ItemField.SOURCE]      as? String ?: "",
                groupId    = d[ItemField.GROUP_ID]    as? String ?: "g1",
                groupLabel = d[ItemField.GROUP_LABEL] as? String ?: "第1份",
                itemRole   = d[ItemField.ITEM_ROLE]   as? String ?: "main",
                createdAt  = d[ItemField.CREATED_AT]  as? Timestamp
            )
        }

        // 按 groupId 分組，保持插入順序
        docs.groupBy { it.groupId }
            .entries
            .map { (gid, items) ->
                OrderGroup(
                    groupId    = gid,
                    groupLabel = items.first().groupLabel,
                    items      = items
                )
            }
    }

    // ─────────────────────────────────────────────────────
    // 私有輔助
    // ─────────────────────────────────────────────────────

    private fun buildOrderPayload(
        orderId: String,
        storeId: String,
        customerName: String,
        itemsMap: List<Map<String, Any>>,
        subtotal: Int,
        note: String,
        pickupNumber: String,
        pickupSeq: Int
    ): Map<String, Any?> {
        val ts = FieldValue.serverTimestamp()
        val displayName = "${AppConfig.ORDER_LABEL} $customerName"
        return mapOf(
            OrderField.STORE_ID        to storeId,
            OrderField.STATUS          to AppConfig.ORDER_STATUS_NEW,
            OrderField.SOURCE          to AppConfig.ORDER_SOURCE,
            OrderField.CUSTOMER_NAME   to customerName,
            OrderField.LABEL           to AppConfig.ORDER_LABEL,
            OrderField.DISPLAY_NAME    to displayName,
            OrderField.ITEMS           to itemsMap,
            OrderField.SUBTOTAL        to subtotal,
            OrderField.TOTAL           to subtotal,
            OrderField.TOTAL_AMOUNT    to subtotal,
            OrderField.TOTAL_PRICE     to subtotal,
            OrderField.ITEM_COUNT      to itemsMap.size,
            OrderField.PICKUP_NUMBER   to pickupNumber,
            OrderField.PICKUP_SEQUENCE to pickupSeq,
            OrderField.NOTE            to note,
            OrderField.PAYMENT_METHOD  to AppConfig.PAYMENT_CASH,
            OrderField.PAYMENT_STATUS  to AppConfig.PAYMENT_PENDING,
            OrderField.CREATED_AT      to ts,
            OrderField.CREATED_AT2     to ts,
            OrderField.UPDATED_AT      to ts,
            OrderField.UPDATED_AT2     to ts,
            OrderField.IS_TEST         to false,
            "notificationStatus" to mapOf(
                "receivedPushSent" to false,
                "readyPushSent"    to false,
                "cancelledPushSent"to false
            )
        )
    }

    private fun buildEventPayload(
        orderId: String,
        storeId: String,
        type: String,
        fromStatus: String?,
        toStatus: String?,
        message: String,
        staffUid: String,
        staffName: String,
        extra: Map<String, Any> = emptyMap()
    ): Map<String, Any?> = buildMap {
        put("orderId",    orderId)
        put("storeId",    storeId)
        put("type",       type)
        put("actorType",  AppConfig.ACTOR_TYPE_STAFF)
        put("actorId",    staffUid)
        put("actorName",  staffName)
        put("fromStatus", fromStatus)
        put("toStatus",   toStatus)
        put("message",    message)
        put("createdAt",  FieldValue.serverTimestamp())
        putAll(extra)
    }

    private suspend fun writeOrderItems(
        orderId: String,
        storeId: String,
        cartItems: List<CartItem>
    ) {
        if (cartItems.isEmpty()) return
        val batch = db.batch()
        val ts = FieldValue.serverTimestamp()
        cartItems.forEach { cart ->
            val docRef = db.collection(Collections.ORDER_ITEMS).document()
            val payload = mapOf(
                ItemField.ORDER_ID         to orderId,
                ItemField.STORE_ID         to storeId,
                ItemField.MENU_ITEM_ID     to cart.menuItem.id,
                ItemField.NAME             to cart.menuItem.name,
                ItemField.QTY              to cart.qty,
                ItemField.UNIT_PRICE       to cart.unitPrice,
                ItemField.LINE_TOTAL       to cart.lineTotal,
                ItemField.FLAVOR           to cart.flavor,
                ItemField.STAPLE           to cart.staple,
                ItemField.SELECTED_OPTIONS to cart.selectedOptions,
                ItemField.NOTES            to cart.notes,
                ItemField.SOURCE           to AppConfig.ORDER_SOURCE,
                ItemField.GROUP_ID         to cart.groupId,
                ItemField.GROUP_LABEL      to cart.groupLabel,
                ItemField.ITEM_ROLE        to cart.itemRole,
                ItemField.CREATED_AT       to ts
            )
            batch.set(docRef, payload)
        }
        batch.commit().await()
    }
}
