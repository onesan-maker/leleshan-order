package com.leleshan.pos.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.leleshan.pos.AppConfig
import com.leleshan.pos.AppConfig.Collections
import com.leleshan.pos.AppConfig.MenuField
import com.leleshan.pos.data.model.MenuItem
import com.leleshan.pos.data.model.OptionGroup
import com.leleshan.pos.data.model.OptionItem
import kotlinx.coroutines.tasks.await

class MenuRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    /**
     * 讀取 menu_items 與 combo_templates，合併後依 POS 排序返回。
     * 只回傳 posVisible=true、未售完、已啟用的品項。
     */
    suspend fun loadPosMenuItems(): Result<List<MenuItem>> = runCatching {
        val storeId = AppConfig.STORE_ID
        val items = mutableListOf<MenuItem>()

        // ── menu_items ──────────────────────────────────────
        val menuSnap = db.collection(Collections.MENU_ITEMS)
            .whereEqualTo(MenuField.STORE_ID, storeId)
            .get()
            .await()

        for (doc in menuSnap.documents) {
            val d = doc.data ?: continue
            val item = mapDocToMenuItem(doc.id, d, type = "item")
            if (item.isAvailable) items.add(item)
        }

        // ── combo_templates ──────────────────────────────────
        val comboSnap = db.collection(Collections.COMBOS)
            .whereEqualTo(MenuField.STORE_ID, storeId)
            .get()
            .await()

        for (doc in comboSnap.documents) {
            val d = doc.data ?: continue
            val item = mapDocToMenuItem(doc.id, d, type = "combo")
            if (item.isAvailable) items.add(item)
        }

        items.sortedBy { it.effectiveSort }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapDocToMenuItem(
        id: String,
        d: Map<String, Any?>,
        type: String
    ): MenuItem {
        val enabled = when (val v = d[MenuField.ENABLED]) {
            is Boolean -> v
            is String  -> v == "true"
            else       -> true
        }
        val posVisible = when (val v = d[MenuField.POS_VISIBLE]) {
            is Boolean -> v
            null       -> true   // 未設定視為可見
            else       -> true
        }
        val tags = (d[MenuField.TAGS] as? List<*>)
            ?.mapNotNull { it as? String } ?: emptyList()

        val optionGroups = parseOptionGroups(d[MenuField.OPTION_GROUPS])

        return MenuItem(
            id           = id,
            storeId      = d[MenuField.STORE_ID] as? String ?: "",
            name         = d[MenuField.NAME]     as? String ?: "",
            price        = (d[MenuField.PRICE] as? Number)?.toInt() ?: 0,
            categoryId   = d[MenuField.CATEGORY_ID] as? String ?: "",
            sort         = (d[MenuField.SORT] as? Number)?.toInt() ?: 999,
            posSortOrder = (d[MenuField.POS_SORT] as? Number)?.toInt(),
            posVisible   = posVisible,
            isSoldOut    = d[MenuField.IS_SOLD_OUT] as? Boolean ?: false,
            enabled      = enabled,
            tags         = tags,
            optionGroups = optionGroups,
            type         = if (tags.contains("套餐")) "combo" else type
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseOptionGroups(raw: Any?): List<OptionGroup> {
        val list = raw as? List<*> ?: return emptyList()
        return list.mapNotNull { g ->
            val gMap = g as? Map<String, Any?> ?: return@mapNotNull null
            val opts = (gMap["options"] as? List<*>)?.mapNotNull { o ->
                val oMap = o as? Map<String, Any?> ?: return@mapNotNull null
                OptionItem(
                    id    = oMap["id"]    as? String ?: "",
                    name  = oMap["name"]  as? String ?: "",
                    price = (oMap["price"] as? Number)?.toInt() ?: 0
                )
            } ?: emptyList()
            OptionGroup(
                id      = gMap["id"]   as? String ?: "",
                name    = gMap["name"] as? String ?: "",
                type    = gMap["type"] as? String ?: "single",
                options = opts
            )
        }
    }
}
