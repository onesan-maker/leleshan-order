package com.leleshan.pos.printer

import android.content.Context
import com.leleshan.pos.AppConfig

object PrinterFactory {
    fun create(context: Context): PrinterContract =
        if (AppConfig.DEBUG_PRINTER) DebugPrinterManager()
        else SunmiPrinterManager(context)
}
