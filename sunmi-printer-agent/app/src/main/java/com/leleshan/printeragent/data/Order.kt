package com.leleshan.printeragent.data

import java.util.Date

/**
 * Firestore 訂單的本地模型。
 * 對應欄位名稱見 AppConfig.Firestore 與 OrderMapper。
 */
data class Order(
    val id: String              = "",
    val orderNumber: String     = "",
    val customerName: String    = "",
    val pickupTime: String      = "",
    val notes: String           = "",
    val totalAmount: Long       = 0L,
    val createdAt: Date?        = null,
    val items: List<OrderItem>  = emptyList(),

    // ── 列印狀態欄位 ──
    val printed: Boolean        = false,
    val printedAt: Date?        = null,
    val printAttempts: Int      = 0,
    val printError: String?     = null
)
