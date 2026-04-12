package com.leleshan.pos.printer

import com.leleshan.pos.data.model.CartItem

/** 列印功能的統一介面。SunmiPrinterManager 與 DebugPrinterManager 都實作此介面。 */
interface PrinterContract {
    val isReady: Boolean
    fun bind(onReady: () -> Unit, onFail: (String) -> Unit)
    fun unbind()
    fun printOrder(
        pickupNumber: String,
        customerName: String,
        note: String,
        items: List<CartItem>,
        total: Int,
        onDone: (success: Boolean, msg: String) -> Unit
    )
}
