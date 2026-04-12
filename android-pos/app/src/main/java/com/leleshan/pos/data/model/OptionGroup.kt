package com.leleshan.pos.data.model

data class OptionItem(
    val id: String    = "",
    val name: String  = "",
    val price: Int    = 0
)

data class OptionGroup(
    val id: String           = "",
    val name: String         = "",
    val type: String         = "single",  // "single" | "multiple"
    val options: List<OptionItem> = emptyList()
)
