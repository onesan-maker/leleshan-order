package com.leleshan.printeragent.data

import java.util.Date
import java.util.UUID

/** 一筆列印操作的結果記錄（只存在記憶體，供 UI 顯示）。 */
data class PrintLog(
    val logId: String       = UUID.randomUUID().toString(),
    val orderId: String     = "",
    val orderNumber: String = "",
    val customerName: String= "",
    val timestamp: Date     = Date(),
    val success: Boolean    = true,
    val message: String     = ""
)
