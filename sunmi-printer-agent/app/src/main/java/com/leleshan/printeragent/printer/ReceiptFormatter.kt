package com.leleshan.printeragent.printer

import com.leleshan.printeragent.AppConfig
import com.leleshan.printeragent.data.Order
import com.leleshan.printeragent.data.OrderItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 負責把 Order 轉成小票文字段落。
 * PrinterManager 拿到 Receipt 後逐段呼叫 SUNMI API。
 */
object ReceiptFormatter {

    private val W = AppConfig.RECEIPT_LINE_WIDTH
    private val dateTimeFmt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.TAIWAN)
    private val timeFmt     = SimpleDateFormat("HH:mm",            Locale.TAIWAN)

    // ── 對外唯一入口 ──────────────────────────────────────

    /** 格式化訂單為可列印的 Receipt 物件。 */
    fun format(order: Order): Receipt {
        val segments = mutableListOf<PrintSegment>()

        // ── 店名 ──
        segments += PrintSegment.Separator("=")
        segments += PrintSegment.Center(AppConfig.STORE_NAME, bold = true, size = 28f)
        segments += PrintSegment.Center(AppConfig.RECEIPT_TITLE, bold = false, size = 24f)
        segments += PrintSegment.Separator("-")

        // ── 訂單資訊 ──
        segments += PrintSegment.BlankLine
        segments += PrintSegment.Left("訂單編號：${order.orderNumber}")
        if (order.customerName.isNotBlank())
            segments += PrintSegment.Left("顧客：${order.customerName}")
        if (order.pickupTime.isNotBlank())
            segments += PrintSegment.Left("取餐時間：${order.pickupTime}")
        segments += PrintSegment.Separator("-")

        // ── 品項 ──
        segments += PrintSegment.BlankLine
        for (item in order.items) {
            segments += formatItem(item)
        }

        // ── 備註 ──
        if (order.notes.isNotBlank()) {
            segments += PrintSegment.Separator("-")
            segments += PrintSegment.Left("備註：")
            for (line in order.notes.split("、", "，", ",", "\n")) {
                if (line.isNotBlank())
                    segments += PrintSegment.Left("  ${line.trim()}")
            }
        }

        // ── 合計 ──
        segments += PrintSegment.Separator("-")
        segments += PrintSegment.BlankLine
        segments += PrintSegment.Left("合計：NT\$${order.totalAmount}", bold = true, size = 26f)
        segments += PrintSegment.BlankLine

        // ── 列印時間 ──
        segments += PrintSegment.Left("列印時間：${dateTimeFmt.format(Date())}", size = 20f)
        segments += PrintSegment.Separator("=")

        return Receipt(segments)
    }

    // ── 格式化單一品項 ──────────────────────────────────

    private fun formatItem(item: OrderItem): PrintSegment.Composite {
        val parts = mutableListOf<PrintSegment>()

        // 品名列：左欄品名+數量，右欄金額
        val nameLabel = buildString {
            append(item.name)
            if (item.type.equals("combo", ignoreCase = true)) append(" 套餐")
        }
        val qtyLabel  = " x${item.quantity}"
        val priceLabel = "NT\$${item.lineTotal}"

        parts += PrintSegment.TwoColumn(
            left  = "$nameLabel$qtyLabel",
            right = priceLabel
        )

        // 套餐選項
        if (item.staple.isNotBlank())
            parts += PrintSegment.Left("  ＊ 主食：${item.staple}", size = 22f)
        if (item.flavor.isNotBlank())
            parts += PrintSegment.Left("  ＊ 口味：${item.flavor}", size = 22f)
        for (opt in item.options)
            if (opt.isNotBlank())
                parts += PrintSegment.Left("  ＊ ${opt}", size = 22f)
        if (item.notes.isNotBlank())
            parts += PrintSegment.Left("    備：${item.notes}", size = 20f)

        return PrintSegment.Composite(parts)
    }

    // ── 純文字預覽（debug log / 電腦驗收用）──────────────

    fun formatPlainText(order: Order): String {
        val sb = StringBuilder()
        for (seg in format(order).segments) {
            when (seg) {
                is PrintSegment.Separator  -> sb.appendLine(seg.char.repeat(W))
                is PrintSegment.Center     -> sb.appendLine(seg.text.center(W))
                is PrintSegment.Left       -> sb.appendLine(seg.text)
                is PrintSegment.TwoColumn  -> sb.appendLine(twoCol(seg.left, seg.right))
                is PrintSegment.BlankLine  -> sb.appendLine()
                is PrintSegment.Composite  -> {
                    for (s in seg.parts) {
                        when (s) {
                            is PrintSegment.Left      -> sb.appendLine(s.text)
                            is PrintSegment.TwoColumn -> sb.appendLine(twoCol(s.left, s.right))
                            else -> {}
                        }
                    }
                }
            }
        }
        return sb.toString()
    }

    private fun twoCol(left: String, right: String): String {
        val total = W
        val space = total - left.length - right.length
        return if (space > 0) left + " ".repeat(space) + right
        else "$left $right"
    }

    private fun String.center(width: Int): String {
        val pad = (width - this.length).coerceAtLeast(0)
        val l = pad / 2
        val r = pad - l
        return " ".repeat(l) + this + " ".repeat(r)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 資料型別
// ─────────────────────────────────────────────────────────────────────────────

/** 已格式化的小票，包含一組列印段落。 */
data class Receipt(val segments: List<PrintSegment>)

/** 列印段落的 sealed class，讓 PrinterManager 按型別呼叫對應 SUNMI API。 */
sealed class PrintSegment {
    data class Separator(val char: String = "-")                       : PrintSegment()
    data class Center(val text: String,
                      val bold: Boolean = false,
                      val size: Float = 24f)                           : PrintSegment()
    data class Left(val text: String,
                    val bold: Boolean = false,
                    val size: Float = 24f)                             : PrintSegment()
    data class TwoColumn(val left: String, val right: String)          : PrintSegment()
    object BlankLine                                                   : PrintSegment()
    data class Composite(val parts: List<PrintSegment>)                : PrintSegment()
}
