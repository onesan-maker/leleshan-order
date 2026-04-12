package com.leleshan.printeragent.data

/** UI 狀態指示器用的簡單資料類別。 */
data class StatusInfo(
    val isOk: Boolean,
    val label: String
) {
    companion object {
        val IDLE    = StatusInfo(false, "未連線")
        val OK      = StatusInfo(true,  "已連線")
        val LISTEN  = StatusInfo(true,  "監聽中")
        val ERROR   = StatusInfo(false, "錯誤")
        fun error(msg: String) = StatusInfo(false, "錯誤：$msg")
        fun ok(msg: String)    = StatusInfo(true, msg)
    }
}
