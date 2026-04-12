package com.leleshan.pos.data.model

import java.util.UUID

/**
 * POS 本地購物車項目。
 * 列印與送單時會轉換成 Firestore order_items 文件。
 *
 * groupId / groupLabel / itemRole 用於「分份」功能：
 *   同一組 groupId 的品項屬於同一份，groupLabel 顯示為「第1份」「第2份」
 */
data class CartItem(
    val cartId: String       = UUID.randomUUID().toString(),
    val menuItem: MenuItem,
    val qty: Int             = 1,
    val flavor: String       = "",       // 風味名稱，e.g. "紅油麻辣"
    val flavorId: String     = "",
    val staple: String       = "",       // 主食名稱，e.g. "白飯"
    val stapleId: String     = "",
    val stapleExtraPrice: Int= 0,        // 主食加價
    val selectedOptions: List<Map<String,Any>> = emptyList(),
    val notes: String        = "",
    // 分份欄位
    val groupId: String      = "g1",
    val groupLabel: String   = "第1份",
    val itemRole: String     = "main"    // "main" | "addon"
) {
    val unitPrice: Int get() = menuItem.price + stapleExtraPrice
    val lineTotal: Int get() = unitPrice * qty

    /** 建立嵌入在 orders.items 的 Map（與 JS buildCreatePayload 格式對應） */
    fun toOrderItemMap(): Map<String, Any> = buildMap {
        put("itemId",    menuItem.id)
        put("name",      menuItem.name)
        put("qty",       qty)
        put("flavor",    flavor)
        put("options",   selectedOptions)
        put("unit_price",unitPrice)
        put("price",     unitPrice)
        put("subtotal",  lineTotal)
        put("item_note", notes)
    }
}
