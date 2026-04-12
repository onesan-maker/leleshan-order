package com.leleshan.pos.util

import java.text.SimpleDateFormat
import java.util.*

object DateUtils {
    private val tz = TimeZone.getTimeZone("Asia/Taipei")

    fun todayTaiwanString(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.TAIWAN)
        sdf.timeZone = tz
        return sdf.format(Date())
    }

    fun formatTimestamp(date: Date?): String {
        if (date == null) return "--"
        val sdf = SimpleDateFormat("MM/dd HH:mm", Locale.TAIWAN)
        sdf.timeZone = tz
        return sdf.format(date)
    }
}
