package com.leleshan.pos.printer

import com.leleshan.pos.AppConfig
import com.leleshan.pos.data.model.CartItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 把訂單轉成小票段落清單。
 *
 * SUNMI T2 58mm 熱感紙：
 *   ASCII / 半形 = 1 unit
 *   中文 / 全形  = 2 units
 *   有效列寬 W = 32 units（約 16 中文字）
 *
 * 金額右對齊用 cjkPadEnd，避免中文寬度計算錯誤。
 */
object ReceiptFormatter {

    /** 58mm 紙的有效字元寬度（ASCII 單位） */
    private val W   = AppConfig.RECEIPT_LINE_WIDTH      // 32
    private val dFmt= SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.TAIWAN)

    data class ReceiptLine(
        val text: String,
        val align: Align   = Align.LEFT,
        val bold: Boolean  = false,
        val size: Float    = 24f
    )
    enum class Align { LEFT, CENTER, RIGHT }

    // ─────────────────────────────────────────────────────
    // 主入口
    // ─────────────────────────────────────────────────────
    fun format(
        pickupNumber: String,
        customerName: String,
        note: String,
        items: List<CartItem>,
        total: Int
    ): List<ReceiptLine> = buildList {

        // ── 店名 ──────────────────────────────────────────
        add(line("=".repeat(W)))
        add(line(AppConfig.STORE_NAME, Align.CENTER, bold = true, size = 28f))
        add(line("現場點餐單", Align.CENTER, size = 24f))
        add(line("-".repeat(W)))

        // ── 訂單資訊 ───────────────────────────────────────
        add(blank())
        add(line("取餐號碼：$pickupNumber", bold = true, size = 26f))
        if (customerName.isNotBlank())
            add(line("顧客：$customerName"))
        add(line("-".repeat(W)))

        // ── 品項（依 groupId 分組）────────────────────────
        add(blank())
        val groups = items.groupBy { it.groupId }
        val multiGroup = groups.size > 1

        groups.entries.forEachIndexed { gIdx, (_, groupItems) ->
            val label = groupItems.first().groupLabel

            if (multiGroup) {
                add(blank())
                add(line("[ $label ]", bold = true, size = 24f))
                add(line("- ".repeat(W / 2)))
            }

            // main 品項先印，addon 後印
            val sorted = groupItems.sortedBy { if (it.itemRole == "main") 0 else 1 }

            for (item in sorted) {
                val nameLabel = item.menuItem.name + if (item.menuItem.isCombo) " 套餐" else ""
                val priceLabel = "NT\$${item.lineTotal}"

                // 品名 x數量 右對齊金額
                add(line(twoColCjk(
                    left  = "$nameLabel x${item.qty}",
                    right = priceLabel,
                    width = W
                ), bold = item.itemRole == "main"))

                // 口味 / 主食 / 選項（縮排 2 格）
                if (item.flavor.isNotBlank())
                    add(line("  口味：${item.flavor}", size = 22f))
                if (item.staple.isNotBlank())
                    add(line("  主食：${item.staple}", size = 22f))
                for (opt in item.selectedOptions) {
                    val v = opt["value"] as? String ?: continue
                    val n = opt["name"]  as? String ?: ""
                    add(line("  $n：$v", size = 22f))
                }
                if (item.notes.isNotBlank())
                    add(line("  備：${item.notes}", size = 20f))
            }

            // 分組小計（多份才顯示）
            if (multiGroup) {
                val subtotal = groupItems.sumOf { it.lineTotal }
                add(line(twoColCjk("  小計", "NT\$$subtotal", W), size = 22f))
            }
        }

        // ── 備註 ──────────────────────────────────────────
        if (note.isNotBlank()) {
            add(blank())
            add(line("-".repeat(W)))
            add(line("備註：", bold = true))
            note.split("、", "，", ",", "\n")
                .filter { it.isNotBlank() }
                .forEach { add(line("  ${it.trim()}")) }
        }

        // ── 合計 ──────────────────────────────────────────
        add(blank())
        add(line("=".repeat(W)))
        add(line(twoColCjk("合計", "NT\$$total", W), bold = true, size = 28f))
        add(line("=".repeat(W)))
        add(blank())
        add(line("列印：${dFmt.format(Date())}", size = 20f))
        add(blank())
    }

    // ─────────────────────────────────────────────────────
    // 純文字預覽（debug log / 驗收用）
    // ─────────────────────────────────────────────────────
    fun formatPlainText(
        pickupNumber: String,
        customerName: String,
        note: String,
        items: List<CartItem>,
        total: Int
    ): String = format(pickupNumber, customerName, note, items, total)
        .joinToString("\n") { it.toPlainText(W) }

    fun ReceiptLine.toPlainText(w: Int): String = when (align) {
        Align.CENTER -> text.cjkCenter(w)
        Align.RIGHT  -> text.cjkPadStart(w)
        Align.LEFT   -> text
    }

    // ─────────────────────────────────────────────────────
    // 測試用範例小票
    // ─────────────────────────────────────────────────────
    fun samplePlainText(): String = buildString {
        appendLine("================================")
        appendLine("        樂樂山 湯滷川味         ")
        appendLine("          現場點餐單            ")
        appendLine("--------------------------------")
        appendLine()
        appendLine("取餐號碼：007")
        appendLine("顧客：王先生")
        appendLine("--------------------------------")
        appendLine()
        appendLine("[ 第1份 ]")
        appendLine("- - - - - - - - - - - - - - - -")
        appendLine("經典組合 套餐 x1       NT\$130")
        appendLine("  口味：紅油麻辣")
        appendLine("  主食：白飯")
        appendLine("  小計               NT\$130")
        appendLine()
        appendLine("[ 第2份 ]")
        appendLine("- - - - - - - - - - - - - - - -")
        appendLine("麻辣豬排 x1            NT\$55")
        appendLine("  口味：藤椒清麻")
        appendLine("秋葵 x1                NT\$25")
        appendLine("  小計                NT\$80")
        appendLine()
        appendLine("--------------------------------")
        appendLine("備註：")
        appendLine("  少辣、不加蔥")
        appendLine()
        appendLine("================================")
        appendLine("合計             NT\$210")
        appendLine("================================")
        appendLine()
        appendLine("列印：2026-04-11 18:30")
    }

    // ─────────────────────────────────────────────────────
    // CJK 寬度工具
    // ─────────────────────────────────────────────────────

    /** 計算字串在熱感列印機上的顯示寬度（中文=2，ASCII=1） */
    fun String.displayWidth(): Int = sumOf { c -> if (c.isCjkOrFullWidth()) 2 else 1 }

    private fun Char.isCjkOrFullWidth(): Boolean {
        val cp = code
        return cp in 0x1100..0x11FF   // 韓文字母
            || cp in 0x2E80..0x2EFF   // CJK 部首
            || cp in 0x2F00..0x2FDF
            || cp in 0x3000..0x303F   // CJK 符號與標點（含全形空格）
            || cp in 0x3040..0x309F   // 平假名
            || cp in 0x30A0..0x30FF   // 片假名
            || cp in 0x3100..0x312F
            || cp in 0x3130..0x318F
            || cp in 0x3190..0x319F
            || cp in 0x31C0..0x31EF
            || cp in 0x31F0..0x31FF
            || cp in 0x3200..0x32FF
            || cp in 0x3300..0x33FF
            || cp in 0x3400..0x4DBF   // CJK 擴展 A
            || cp in 0x4E00..0x9FFF   // CJK 基本
            || cp in 0xA000..0xA48F
            || cp in 0xA490..0xA4CF
            || cp in 0xA960..0xA97F
            || cp in 0xAC00..0xD7AF   // 韓文
            || cp in 0xF900..0xFAFF   // CJK 相容
            || cp in 0xFE10..0xFE1F
            || cp in 0xFE30..0xFE4F   // CJK 相容形式
            || cp in 0xFF00..0xFFEF   // 半形片假名 / 全形 ASCII
    }

    /**
     * 兩欄對齊（CJK-aware）：左欄文字 + 填充空格 + 右欄金額。
     * 確保總顯示寬度 = width。
     */
    fun twoColCjk(left: String, right: String, width: Int = W): String {
        val used  = left.displayWidth() + right.displayWidth()
        val space = (width - used).coerceAtLeast(1)
        return left + " ".repeat(space) + right
    }

    fun String.cjkCenter(w: Int): String {
        val pad = (w - displayWidth()).coerceAtLeast(0)
        return " ".repeat(pad / 2) + this + " ".repeat(pad - pad / 2)
    }

    fun String.cjkPadStart(w: Int): String {
        val pad = (w - displayWidth()).coerceAtLeast(0)
        return " ".repeat(pad) + this
    }

    // ─────────────────────────────────────────────────────
    // 小工具
    // ─────────────────────────────────────────────────────
    private fun line(
        text: String,
        align: Align  = Align.LEFT,
        bold: Boolean = false,
        size: Float   = 24f
    ) = ReceiptLine(text, align, bold, size)

    private fun blank() = ReceiptLine("")
}
