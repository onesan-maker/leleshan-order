package com.leleshan.pos.ui.pos

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.commit
import com.leleshan.pos.AppConfig
import com.leleshan.pos.R
import com.leleshan.pos.printer.PrinterContract
import com.leleshan.pos.printer.PrinterFactory

class MainActivity : AppCompatActivity() {

    lateinit var printer: PrinterContract
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // 綁定印表機（debug 或 SUNMI）
        printer = PrinterFactory.create(this)
        printer.bind(
            onReady = { updatePrinterStatus("印表機就緒", ok = true) },
            onFail  = { msg -> updatePrinterStatus(msg, ok = false) }
        )

        // debug banner
        if (AppConfig.DEBUG_PRINTER) {
            findViewById<View>(R.id.debugBanner).visibility = View.VISIBLE
        }

        if (savedInstanceState == null) {
            supportFragmentManager.commit {
                replace(R.id.fragmentContainer, PosFragment())
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        printer.unbind()
    }

    private fun updatePrinterStatus(msg: String, ok: Boolean) {
        runOnUiThread {
            val tv = findViewById<TextView>(R.id.tvPrinterStatus)
            tv?.text = if (ok) "✔ 印表機：$msg" else "✘ 印表機：$msg"
            tv?.setTextColor(
                getColor(if (ok) android.R.color.holo_green_dark else android.R.color.holo_red_dark)
            )
        }
    }
}
