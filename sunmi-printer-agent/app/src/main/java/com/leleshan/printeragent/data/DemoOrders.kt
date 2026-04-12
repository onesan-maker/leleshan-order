package com.leleshan.printeragent.data

import java.util.Date

/**
 * USE_DEMO_DATA = true 時使用的假訂單資料。
 * 用途：在電腦或模擬器上驗收 UI 與列印格式，不需要真實 Firestore。
 */
object DemoOrders {

    fun getSample(): List<Order> = listOf(
        Order(
            id           = "demo-001",
            orderNumber  = "A102",
            customerName = "王先生",
            pickupTime   = "18:30",
            notes        = "少辣、不加蔥",
            totalAmount  = 200L,
            createdAt    = Date(),
            items = listOf(
                OrderItem(
                    name      = "經典組合",
                    quantity  = 1,
                    unitPrice = 130L,
                    lineTotal = 130L,
                    type      = "combo",
                    staple    = "白飯",
                    flavor    = "藤椒"
                ),
                OrderItem(
                    name      = "豬肉片",
                    quantity  = 1,
                    unitPrice = 45L,
                    lineTotal = 45L
                ),
                OrderItem(
                    name      = "秋葵",
                    quantity  = 1,
                    unitPrice = 25L,
                    lineTotal = 25L
                )
            )
        ),
        Order(
            id           = "demo-002",
            orderNumber  = "A103",
            customerName = "張小姐",
            pickupTime   = "18:45",
            notes        = "",
            totalAmount  = 155L,
            createdAt    = Date(),
            items = listOf(
                OrderItem(
                    name      = "麻辣豬排",
                    quantity  = 2,
                    unitPrice = 55L,
                    lineTotal = 110L,
                    type      = "item",
                    options   = listOf("加辣", "不加蔥")
                ),
                OrderItem(
                    name      = "紫菜蛋花湯",
                    quantity  = 1,
                    unitPrice = 45L,
                    lineTotal = 45L
                )
            )
        )
    )
}
