package com.leleshan.printeragent

/**
 * 全域設定，所有可調整的參數都集中在這裡。
 * 上機前只需改這一個檔案。
 */
object AppConfig {

    // ─────────────────────────────────────────────
    // 開發 / 驗收模式
    // ─────────────────────────────────────────────

    /**
     * true  → 模擬印表機（不呼叫 SUNMI service，只輸出 log）
     * false → 真實呼叫 SUNMI printer service
     *
     * 上機部署前請改為 false。
     */
    const val DEBUG_PRINTER = true

    /**
     * true  → 使用內建假訂單，不連接 Firestore
     *         適合在電腦／模擬器驗收 UI 與列印格式
     * false → 監聽真實 Firestore
     */
    const val USE_DEMO_DATA = false

    // ─────────────────────────────────────────────
    // 店家資訊
    // ─────────────────────────────────────────────

    const val STORE_NAME     = "樂樂山"
    const val RECEIPT_TITLE  = "現場點餐單"

    // 小票紙張每行字元數（58mm ≈ 32，80mm ≈ 48）
    const val RECEIPT_LINE_WIDTH = 32

    // ─────────────────────────────────────────────
    // Firestore 欄位名稱（集中管理，避免散落各處）
    // ─────────────────────────────────────────────

    object Firestore {
        const val COLLECTION       = "orders"

        // 查詢用
        const val FIELD_PRINTED    = "printed"
        const val FIELD_CREATED_AT = "createdAt"

        // 列印狀態（寫回欄位）
        const val FIELD_PRINTED_AT      = "printedAt"
        const val FIELD_PRINT_ATTEMPTS  = "printAttempts"
        const val FIELD_PRINT_ERROR     = "printError"
    }

    // ─────────────────────────────────────────────
    // 行為參數
    // ─────────────────────────────────────────────

    /** 模擬列印延遲 ms（debug 用） */
    const val FAKE_PRINT_DELAY_MS = 800L

    /** 畫面上最多顯示幾筆列印 log */
    const val MAX_LOG_ENTRIES = 30

    /** 最多幾筆同時在印列隊列 */
    const val MAX_QUEUE_SIZE = 10
}
