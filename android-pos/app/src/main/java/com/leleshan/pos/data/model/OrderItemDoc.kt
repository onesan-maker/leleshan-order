package com.leleshan.pos.data.model

import com.google.firebase.Timestamp

/**
 * 從 Firestore order_items collection 讀回的品項文件。
 * 與 CartItem 不同：CartItem 是本地暫存；OrderItemDoc 是已寫入 Firestore 的持久資料。
 */
data class OrderItemDoc(
    val docId: String          = "",
    val orderId: String        = "",
    val storeId: String        = "",
    val menuItemId: String     = "",
    val name: String           = "",
    val qty: Int               = 1,
    val unitPrice: Int         = 0,
    val lineTotal: Int         = 0,
    val flavor: String         = "",
    val staple: String         = "",
    @Suppress("UNCHECKED_CAST")
    val selectedOptions: List<Map<String, Any>> = emptyList(),
    val notes: String          = "",
    val source: String         = "",
    // 分份
    val groupId: String        = "g1",
    val groupLabel: String     = "第1份",
    val itemRole: String       = "main",
    val createdAt: Timestamp?  = null
) {
    val isCombo: Boolean get() = staple.isNotBlank()

    /** 同一個 group 的所有 main 品項小計（統計用） */
    val displayName: String get() = buildString {
        append(name)
        if (isCombo) append(" 套餐")
    }
}

/** 把 order_items 依 groupId 分組後的結構 */
data class OrderGroup(
    val groupId: String,
    val groupLabel: String,
    val items: List<OrderItemDoc>
) {
    val subtotal: Int get() = items.sumOf { it.lineTotal }
    val mainItem: OrderItemDoc? get() = items.firstOrNull { it.itemRole == "main" }
        ?: items.firstOrNull()
}
