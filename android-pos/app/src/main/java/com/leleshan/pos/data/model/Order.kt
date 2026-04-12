package com.leleshan.pos.data.model

import com.google.firebase.Timestamp

/** 從 Firestore 讀取的訂單摘要（用於追加訂單畫面）。 */
data class Order(
    val id: String           = "",
    val storeId: String      = "",
    val status: String       = "new",
    val customerName: String = "",
    val pickupNumber: String = "",
    val total: Int           = 0,
    val itemCount: Int       = 0,
    val note: String         = "",
    val createdAt: Timestamp?= null,
    val source: String       = "pos"
) {
    val displayLabel: String get() = "$pickupNumber $customerName"
    val canAppend: Boolean   get() = status !in listOf("completed","picked_up","cancelled")
}
