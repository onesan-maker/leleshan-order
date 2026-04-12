package com.leleshan.pos

/**
 * 全域設定。上機前只需改這一個檔案。
 * 欄位名稱與既有 JS 端完全對應，集中管理避免散落。
 */
object AppConfig {

    // ── 門市 ──────────────────────────────────────────────
    const val STORE_ID   = "store_1"       // 必須與 Firestore 一致
    const val STORE_NAME = "樂樂山 湯滷川味"

    // ── 模式 ──────────────────────────────────────────────
    /** true = 不呼叫 SUNMI，只輸出 log；false = 真實列印 */
    const val DEBUG_PRINTER = true

    // ── 小票格式 ──────────────────────────────────────────
    const val RECEIPT_LINE_WIDTH = 32   // 58mm 紙 ≈ 32 字元

    // ── Firestore 集合名稱 ────────────────────────────────
    object Collections {
        const val ORDERS        = "orders"
        const val ORDER_ITEMS   = "order_items"
        const val ORDER_EVENTS  = "order_events"
        const val MENU_ITEMS    = "menu_items"
        const val COMBOS        = "combo_templates"
        const val COUNTERS      = "order_counters"
        const val STORES        = "stores"
    }

    // ── orders 欄位（與 JS buildCreatePayload 完全對應）──
    object OrderField {
        const val STORE_ID              = "storeId"
        const val STATUS                = "status"
        const val SOURCE                = "source"
        const val CUSTOMER_NAME         = "customer_name"
        const val LABEL                 = "label"
        const val DISPLAY_NAME          = "display_name"
        const val ITEMS                 = "items"
        const val SUBTOTAL              = "subtotal"
        const val TOTAL                 = "total"
        const val TOTAL_AMOUNT          = "totalAmount"
        const val TOTAL_PRICE           = "totalPrice"
        const val ITEM_COUNT            = "itemCount"
        const val PICKUP_NUMBER         = "pickupNumber"
        const val PICKUP_SEQUENCE       = "pickupSequence"
        const val PICKUP_DATE           = "scheduled_pickup_date"
        const val PICKUP_TIME_FIELD     = "scheduled_pickup_time"
        const val NOTE                  = "note"
        const val PAYMENT_METHOD        = "paymentMethod"
        const val PAYMENT_STATUS        = "paymentStatus"
        const val CREATED_AT            = "createdAt"
        const val CREATED_AT2           = "created_at"
        const val UPDATED_AT            = "updatedAt"
        const val UPDATED_AT2           = "updated_at"
        const val IS_TEST               = "isTest"
    }

    // ── order_items 欄位 ──────────────────────────────────
    object ItemField {
        const val ORDER_ID          = "orderId"
        const val STORE_ID          = "storeId"
        const val MENU_ITEM_ID      = "menuItemId"
        const val NAME              = "name"
        const val QTY               = "qty"
        const val UNIT_PRICE        = "unitPrice"
        const val LINE_TOTAL        = "lineTotal"
        const val FLAVOR            = "flavor"
        const val STAPLE            = "staple"
        const val SELECTED_OPTIONS  = "selectedOptions"
        const val NOTES             = "notes"
        const val SOURCE            = "source"
        const val GROUP_ID          = "groupId"      // 分份用（新增欄位）
        const val GROUP_LABEL       = "groupLabel"   // 分份用（新增欄位）
        const val ITEM_ROLE         = "itemRole"     // "main"|"addon"（分份用）
        const val CREATED_AT        = "createdAt"
    }

    // ── order_events type 枚舉 ────────────────────────────
    object EventType {
        const val ORDER_CREATED  = "order_created"
        const val STATUS_CHANGED = "status_changed"
        const val APPENDED       = "order_appended"
    }

    // ── menu_items 欄位 ───────────────────────────────────
    object MenuField {
        const val STORE_ID       = "storeId"
        const val NAME           = "name"
        const val PRICE          = "price"
        const val POS_VISIBLE    = "posVisible"
        const val POS_SORT       = "posSortOrder"
        const val IS_SOLD_OUT    = "isSoldOut"
        const val ENABLED        = "enabled"
        const val IS_ACTIVE      = "isActive"
        const val CATEGORY_ID    = "categoryId"
        const val SORT           = "sort"
        const val OPTION_GROUPS  = "optionGroups"
        const val TAGS           = "tags"
    }

    // ── 訂單固定值 ────────────────────────────────────────
    const val ORDER_SOURCE       = "pos"
    const val ORDER_LABEL        = "現場"
    const val ORDER_STATUS_NEW   = "new"
    const val PAYMENT_CASH       = "cash"
    const val PAYMENT_PENDING    = "pending"
    const val ACTOR_TYPE_STAFF   = "staff"
}
