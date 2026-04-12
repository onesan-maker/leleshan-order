package com.leleshan.pos.data.model

/**
 * 對應 Firestore menu_items collection。
 * 欄位名稱見 AppConfig.MenuField。
 */
data class MenuItem(
    val id: String               = "",
    val storeId: String          = "",
    val name: String             = "",
    val price: Int               = 0,
    val categoryId: String       = "",
    val sort: Int                = 999,
    val posSortOrder: Int?       = null,
    val posVisible: Boolean      = true,
    val isSoldOut: Boolean       = false,
    val enabled: Boolean         = true,
    val tags: List<String>       = emptyList(),
    val optionGroups: List<OptionGroup> = emptyList(),
    /** "item" 或 "combo" */
    val type: String             = "item"
) {
    val effectiveSort: Int get() = posSortOrder ?: sort
    val isCombo: Boolean  get() = type == "combo" || tags.contains("套餐")
    val isAvailable: Boolean get() = enabled && posVisible && !isSoldOut
}
