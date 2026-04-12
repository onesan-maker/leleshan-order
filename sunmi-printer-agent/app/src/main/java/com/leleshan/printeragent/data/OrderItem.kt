package com.leleshan.printeragent.data

/**
 * 訂單內的單一品項。
 * 套餐（type == "combo"）時，staple / flavor / options 才有值。
 */
data class OrderItem(
    val name: String          = "",
    val quantity: Int         = 1,
    val unitPrice: Long       = 0L,
    val lineTotal: Long       = 0L,
    /** "combo" | "item" | "drink" | "" */
    val type: String          = "",
    /** 口味，如「藤椒」 */
    val flavor: String        = "",
    /** 主食，如「白飯」 */
    val staple: String        = "",
    /** 額外選項，如 ["加蛋", "不加辣"] */
    val options: List<String> = emptyList(),
    val notes: String         = ""
)
