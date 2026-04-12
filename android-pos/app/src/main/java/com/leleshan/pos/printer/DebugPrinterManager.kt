package com.leleshan.pos.printer

import android.util.Log
import com.leleshan.pos.data.model.CartItem
import kotlinx.coroutines.*

/**
 * DEBUG_PRINTER = true 時使用。
 * 不呼叫 SUNMI，只輸出 log，讓開發者在電腦端驗收格式。
 */
class DebugPrinterManager : PrinterContract {

    override val isReady = true

    override fun bind(onReady: () -> Unit, onFail: (String) -> Unit) {
        Log.i(TAG, "[DEBUG] 模擬印表機已就緒")
        onReady()
    }

    override fun unbind() {
        Log.i(TAG, "[DEBUG] 模擬印表機已關閉")
    }

    override fun printOrder(
        pickupNumber: String,
        customerName: String,
        note: String,
        items: List<CartItem>,
        total: Int,
        onDone: (Boolean, String) -> Unit
    ) {
        val plainText = ReceiptFormatter.formatPlainText(
            pickupNumber, customerName, note, items, total
        )
        Log.i(TAG, "\n========== 模擬列印開始 ==========\n$plainText\n========== 模擬列印結束 ==========")

        // 模擬 800ms 延遲
        CoroutineScope(Dispatchers.Main).launch {
            delay(800)
            onDone(true, "模擬列印成功")
        }
    }

    companion object {
        private const val TAG = "DebugPrinter"
    }
}
