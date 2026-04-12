package com.leleshan.pos.data.model

/** 對應 defaults.js 的 stapleOptions */
data class StapleOption(
    val id: String,
    val name: String,
    val price: Int = 0    // 0 = 免費；正值 = 加價
) {
    companion object {
        val defaults = listOf(
            StapleOption("rice-free",           "白飯",   0),
            StapleOption("instant-noodles-free","王子麵", 0),
            StapleOption("udon-extra",          "烏龍麵", 15),
            StapleOption("vermicelli-free",     "冬粉",   0),
            StapleOption("no-staple",           "不加主食",0)
        )
    }
}
