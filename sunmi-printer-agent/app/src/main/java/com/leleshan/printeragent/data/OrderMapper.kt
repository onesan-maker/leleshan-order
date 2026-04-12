package com.leleshan.printeragent.data

import com.google.firebase.Timestamp

/**
 * Firestore DocumentSnapshot.data → Order 的集中映射。
 *
 * 所有欄位名稱判斷只在這裡處理，並做容錯（欄位不存在時給預設值）。
 * 若 Firestore 欄位名稱改變，只要改這一個檔案。
 */
object OrderMapper {

    @Suppress("UNCHECKED_CAST")
    fun fromDocument(id: String, data: Map<String, Any?>): Order {
        val itemsList = (data["items"] as? List<*>)
            ?.mapNotNull { (it as? Map<String, Any?>)?.let { m -> fromItemMap(m) } }
            ?: emptyList()

        return Order(
            id           = id,
            // 相容 "orderNumber" / "order_number" / fallback 到 id 後 4 碼
            orderNumber  = str(data, "orderNumber", "order_number")
                           ?: id.takeLast(4).uppercase(),
            customerName = str(data, "customerName", "customer_name") ?: "",
            pickupTime   = str(data, "pickupTime",   "pickup_time")   ?: "",
            notes        = str(data, "notes")                          ?: "",
            totalAmount  = long(data, "totalAmount", "total")          ?: 0L,
            createdAt    = (data["createdAt"] as? Timestamp)?.toDate(),
            items        = itemsList,
            printed      = data["printed"] as? Boolean ?: false,
            printedAt    = (data["printedAt"] as? Timestamp)?.toDate(),
            printAttempts= int(data, "printAttempts")                   ?: 0,
            printError   = data["printError"] as? String
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun fromItemMap(data: Map<String, Any?>): OrderItem {
        val options = (data["options"] as? List<*>)
            ?.mapNotNull { it as? String } ?: emptyList()
        return OrderItem(
            name      = str(data, "name")                          ?: "",
            quantity  = int(data, "quantity", "qty")               ?: 1,
            unitPrice = long(data, "unitPrice", "unit_price")      ?: 0L,
            lineTotal = long(data, "lineTotal", "line_total")      ?: 0L,
            type      = str(data, "type")                          ?: "",
            flavor    = str(data, "flavor")                        ?: "",
            staple    = str(data, "staple")                        ?: "",
            options   = options,
            notes     = str(data, "notes")                         ?: ""
        )
    }

    // ── 小工具：多鍵容錯取值 ──

    private fun str(data: Map<String, Any?>, vararg keys: String): String? {
        for (k in keys) (data[k] as? String)?.let { return it }
        return null
    }

    private fun long(data: Map<String, Any?>, vararg keys: String): Long? {
        for (k in keys) {
            when (val v = data[k]) {
                is Long   -> return v
                is Int    -> return v.toLong()
                is Double -> return v.toLong()
            }
        }
        return null
    }

    private fun int(data: Map<String, Any?>, vararg keys: String): Int? {
        for (k in keys) {
            when (val v = data[k]) {
                is Long -> return v.toInt()
                is Int  -> return v
            }
        }
        return null
    }
}
