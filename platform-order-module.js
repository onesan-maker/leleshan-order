(function () {
  var HEADER_MAP = {
    orderId: ["order id", "order_id", "訂單編號", "訂單號碼", "merchant order id", "order number"],
    orderTime: ["order time", "order_time", "訂單時間", "created at", "created_at", "date", "訂單建立時間"],
    orderStatus: ["order status", "status", "訂單狀態"],
    subtotalAmount: ["subtotal", "subtotal amount", "小計", "商品小計"],
    totalAmount: ["total", "total amount", "總額", "訂單總額", "net payout"],
    deliveryFee: ["delivery fee", "配送費", "外送費"],
    serviceFee: ["service fee", "服務費", "平台服務費", "commission"],
    discountAmount: ["discount", "discount amount", "折扣", "優惠折抵"],
    refundAmount: ["refund", "refund amount", "退款金額"],
    customerName: ["customer name", "顧客姓名", "customer"],
    platformStoreId: ["store id", "merchant id", "store identifier", "平台門市編號"],
    itemName: ["item name", "商品名稱", "menu item", "品項名稱"],
    itemId: ["item id", "menu item id", "merchant item id", "商品編號"],
    quantity: ["quantity", "qty", "數量"],
    unitPrice: ["item price", "unit price", "單價", "商品價格", "price"],
    itemSubtotal: ["item total", "line total", "line subtotal", "品項小計", "商品小計"],
    modifiers: ["modifiers", "modifier", "options", "add-ons", "加料", "選項"],
    notes: ["notes", "備註", "special instructions", "item note"]
  };

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function findHeader(headers, candidates) {
    var normalized = headers.map(normalizeHeader);
    for (var i = 0; i < candidates.length; i += 1) {
      var index = normalized.indexOf(normalizeHeader(candidates[i]));
      if (index >= 0) return headers[index];
    }
    return "";
  }

  function getCell(row, headers, key) {
    var header = findHeader(headers, HEADER_MAP[key] || []);
    return header ? row[header] : "";
  }

  function stableHash(value) {
    var input = String(value || "");
    var hash = 2166136261;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ("0000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function buildMappingKey(platform, storeId, itemName, itemId) {
    return "map_" + stableHash([platform, storeId, itemId || "", itemName || ""].join("|"));
  }

  function buildOrderDocId(platform, storeId, platformOrderId) {
    return "po_" + stableHash([platform, storeId, platformOrderId].join("|"));
  }

  function buildItemKey(platformOrderId, index, itemName, itemId, modifiers) {
    return "poi_" + stableHash([platformOrderId, index, itemId || "", itemName || "", JSON.stringify(modifiers || [])].join("|"));
  }

  function buildMovementDocId(storeId, source, sourceOrderId, sku, sourceItemKey) {
    return "im_" + stableHash([storeId, source, sourceOrderId, sku, sourceItemKey].join("|"));
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    var cleaned = String(value).replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    var parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function parseDateValue(value) {
    if (!value) return null;
    var dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  function parseList(value) {
    if (!value) return [];
    return String(value).split(/[;,|]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function parseCsvText(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i += 1) {
      var char = text[i];
      var next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some(function (value) { return value !== ""; })) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      if (row.some(function (value) { return value !== ""; })) rows.push(row);
    }
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0].map(function (item) { return String(item || "").trim(); });
    return {
      headers: headers,
      rows: rows.slice(1).map(function (values) {
        var obj = {};
        headers.forEach(function (header, index) {
          obj[header] = values[index] != null ? String(values[index]).trim() : "";
        });
        return obj;
      })
    };
  }

  function validateHeaders(headers) {
    var required = ["orderId", "orderTime", "itemName", "quantity"];
    var missing = required.filter(function (key) {
      return !findHeader(headers, HEADER_MAP[key]);
    });
    return { valid: missing.length === 0, missing: missing };
  }

  function normalizeParsedRows(platform, storeId, parsed, fileName) {
    var validation = validateHeaders(parsed.headers);
    if (!validation.valid) {
      throw new Error("CSV 缺少必要欄位：" + validation.missing.join(", "));
    }

    var orders = {};
    var failedRows = [];
    parsed.rows.forEach(function (row, index) {
      var platformOrderId = getCell(row, parsed.headers, "orderId");
      var orderTimeRaw = getCell(row, parsed.headers, "orderTime");
      var orderTime = parseDateValue(orderTimeRaw);
      var itemName = getCell(row, parsed.headers, "itemName");
      var quantity = parseNumber(getCell(row, parsed.headers, "quantity"));
      if (!platformOrderId || !orderTime || !itemName || quantity === null) {
        failedRows.push({
          row_number: index + 2,
          reason: "缺少必要欄位或格式錯誤",
          payload: row
        });
        return;
      }

      var mappingKey = buildMappingKey(platform, storeId, itemName, getCell(row, parsed.headers, "itemId"));
      var orderKey = buildOrderDocId(platform, storeId, platformOrderId);
      if (!orders[orderKey]) {
        orders[orderKey] = {
          id: orderKey,
          platform: platform,
          store_id: storeId,
          platform_store_id: getCell(row, parsed.headers, "platformStoreId") || "",
          platform_order_id: platformOrderId,
          order_time: orderTime,
          order_status: getCell(row, parsed.headers, "orderStatus") || "",
          subtotal_amount: parseNumber(getCell(row, parsed.headers, "subtotalAmount")),
          total_amount: parseNumber(getCell(row, parsed.headers, "totalAmount")),
          delivery_fee: parseNumber(getCell(row, parsed.headers, "deliveryFee")),
          service_fee: parseNumber(getCell(row, parsed.headers, "serviceFee")),
          discount_amount: parseNumber(getCell(row, parsed.headers, "discountAmount")),
          refund_amount: parseNumber(getCell(row, parsed.headers, "refundAmount")),
          customer_name: getCell(row, parsed.headers, "customerName") || "",
          normalized_items: [],
          mapping_keys: [],
          raw_rows: [],
          source_file_name: fileName
        };
      }

      var itemIndex = orders[orderKey].normalized_items.length;
      var modifiers = parseList(getCell(row, parsed.headers, "modifiers"));
      orders[orderKey].normalized_items.push({
        platform_item_name: itemName,
        platform_item_id: getCell(row, parsed.headers, "itemId") || "",
        quantity: quantity,
        unit_price: parseNumber(getCell(row, parsed.headers, "unitPrice")),
        subtotal: parseNumber(getCell(row, parsed.headers, "itemSubtotal")),
        modifiers: modifiers,
        notes: getCell(row, parsed.headers, "notes") || "",
        mapping_key: mappingKey,
        source_item_key: buildItemKey(platformOrderId, itemIndex, itemName, getCell(row, parsed.headers, "itemId"), modifiers)
      });
      if (orders[orderKey].mapping_keys.indexOf(mappingKey) < 0) {
        orders[orderKey].mapping_keys.push(mappingKey);
      }
      orders[orderKey].raw_rows.push(row);
    });

    var orderList = Object.keys(orders).map(function (key) { return orders[key]; });
    var times = orderList.map(function (order) { return order.order_time; }).filter(Boolean).sort(function (left, right) { return left - right; });
    return {
      headers: parsed.headers,
      orders: orderList,
      failedRows: failedRows,
      dateRangeStart: times[0] || null,
      dateRangeEnd: times[times.length - 1] || null
    };
  }

  async function computeFileHash(text) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      var digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest)).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    }
    return "fallback_" + stableHash(text);
  }

  window.PlatformOrderModule = {
    parseCsvText: parseCsvText,
    normalizeParsedRows: normalizeParsedRows,
    computeFileHash: computeFileHash,
    buildMappingKey: buildMappingKey,
    buildOrderDocId: buildOrderDocId,
    buildMovementDocId: buildMovementDocId,
    buildItemKey: buildItemKey,
    parseNumber: parseNumber,
    parseDateValue: parseDateValue
  };
})();
