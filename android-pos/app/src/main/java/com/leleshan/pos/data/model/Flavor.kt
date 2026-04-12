package com.leleshan.pos.data.model

/** 對應 defaults.js 的 flavors 陣列 */
data class Flavor(
    val id: String,
    val name: String,
    val spicyLabel: String = "",
    val sort: Int = 0
) {
    companion object {
        /** 預設五種口味（與 defaults.js 完全對應） */
        val defaults = listOf(
            Flavor("red-oil",      "紅油麻辣",  "辣度可調整",  10),
            Flavor("green-pepper", "青花椒麻",  "偏麻不死辣",  20),
            Flavor("vine-pepper",  "藤椒清麻",  "清爽微麻",    30),
            Flavor("clear-broth",  "清湯原味",  "不辣",        40),
            Flavor("tomato",       "番茄",      "微酸微辣",    50)
        )
    }
}
