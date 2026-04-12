package com.leleshan.pos.printer

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.RemoteException
import android.util.Log
import com.leleshan.pos.data.model.CartItem
import woyou.aidlservice.cjt.ICallback
import woyou.aidlservice.cjt.IWoyouService

/**
 * DEBUG_PRINTER = false 時使用。
 * 綁定 SUNMI 內建 printer service 並透過 AIDL 呼叫列印。
 */
class SunmiPrinterManager(private val context: Context) : PrinterContract {

    private var service: IWoyouService? = null
    private var _isReady = false
    override val isReady: Boolean get() = _isReady

    // ── AIDL callback（非阻塞，只 log）──────────────────
    private val noopCallback = object : ICallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(code: Int, msg: String?) {
            Log.e(TAG, "Printer error $code: $msg")
        }
        override fun onPrintResult(code: Int, msg: String?) {
            Log.d(TAG, "printResult $code: $msg")
        }
    }

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service  = IWoyouService.Stub.asInterface(binder)
            _isReady = true
            Log.i(TAG, "SUNMI printer service connected")
            pendingOnReady?.invoke()
            pendingOnReady = null
        }
        override fun onServiceDisconnected(name: ComponentName) {
            service  = null
            _isReady = false
            Log.w(TAG, "SUNMI printer service disconnected")
        }
    }

    private var pendingOnReady: (() -> Unit)? = null

    override fun bind(onReady: () -> Unit, onFail: (String) -> Unit) {
        pendingOnReady = onReady
        val intent = Intent().apply {
            `package` = "woyou.aidlservice.cjt"
            action    = "woyou.aidlservice.cjt"
        }
        val bound = context.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        if (!bound) {
            pendingOnReady = null
            onFail("SUNMI printer service 未找到，請確認設備")
        }
    }

    override fun unbind() {
        if (_isReady) context.unbindService(conn)
        _isReady = false
        service  = null
    }

    // ── 列印主流程（buffer mode，正確順序：先佇列全部，最後才 exit）────
    override fun printOrder(
        pickupNumber: String,
        customerName: String,
        note: String,
        items: List<CartItem>,
        total: Int,
        onDone: (Boolean, String) -> Unit
    ) {
        val svc = service
        if (svc == null) { onDone(false, "印表機未連線"); return }

        try {
            // 1. 開啟緩衝（clean=true 清空舊緩衝）
            svc.enterPrinterBuffer(true)
            svc.printerInit(noopCallback)

            val lines = ReceiptFormatter.format(
                pickupNumber, customerName, note, items, total
            )

            // 2. 佇列所有列印指令
            var lastAlign = -1
            var lastBold  = -1
            var lastSize  = -1f

            for (line in lines) {
                val align = when (line.align) {
                    ReceiptFormatter.Align.CENTER -> 1
                    ReceiptFormatter.Align.RIGHT  -> 2
                    ReceiptFormatter.Align.LEFT   -> 0
                }
                // 只在變動時才送指令，減少無效呼叫
                if (align != lastAlign) {
                    svc.setAlignment(align, noopCallback); lastAlign = align
                }
                if (line.size != lastSize) {
                    svc.setFontSize(line.size, noopCallback); lastSize = line.size
                }
                val boldVal = if (line.bold) 1 else 0
                if (boldVal != lastBold) {
                    svc.setBold(boldVal, noopCallback); lastBold = boldVal
                }
                svc.printText(line.text + "\n", noopCallback)
            }

            // 3. 走紙 + 切紙（切紙前先走 5mm，確保切割位置正確）
            svc.printAndFeedPaper(5, noopCallback)
            svc.cutPaper(noopCallback)

            // 4. 提交緩衝並回報結果
            svc.exitPrinterBufferWithCallback(true, object : ICallback.Stub() {
                override fun onRunResult(isSuccess: Boolean) {
                    onDone(isSuccess, if (isSuccess) "列印成功" else "列印失敗")
                }
                override fun onReturnString(result: String?) {}
                override fun onRaiseException(code: Int, msg: String?) {
                    onDone(false, "印表機例外 $code: $msg")
                }
                override fun onPrintResult(code: Int, msg: String?) {
                    onDone(code == 0, if (code == 0) "列印成功" else "列印失敗 $msg")
                }
            })
        } catch (e: RemoteException) {
            onDone(false, "RemoteException: ${e.message}")
        }
    }

    companion object { private const val TAG = "SunmiPrinter" }
}
