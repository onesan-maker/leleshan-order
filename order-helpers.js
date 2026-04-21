(function () {
  var PUBLIC_BOARD_STATUSES = ["cooking", "packing", "ready", "preparing"];
  var ACTIVE_QUEUE_STATUSES = ["new", "accepted", "preparing", "cooking", "packing"];
  var KDS_ACTIVE_STATUSES = ["new", "accepted", "preparing", "ready"];
  // 2026-04-21 現役狀態流（無 pending_confirmation 閘門）：
  //   accepted → preparing → ready → completed
  //                                 └→ cancelled（任一階段可轉）
  // 下列標 [legacy] 的 key 僅供讀取舊資料；新寫入應只使用現役狀態。
  // pending_confirmation 已於 2026-04 移除（見 functions/index.js 的流程停用註解）。
  var STATUS_META = {
    accepted:  { label: "製作中",  tone: "accepted" },
    preparing: { label: "製作中",  tone: "cooking" },
    ready:     { label: "可取餐",  tone: "ready" },
    completed: { label: "已完成",  tone: "picked" },
    cancelled: { label: "已取消",  tone: "cancelled" },
    // [legacy] 舊資料相容：經 LEGACY_STATUS_MAP 轉換後通常不會直接 lookup 這裡，
    // 保留是為了極端情況下（未映射）仍有顯示 fallback。
    new:       { label: "新訂單",  tone: "new" },
    cooking:   { label: "製作中",  tone: "cooking" },
    packing:   { label: "包裝中",  tone: "packing" },
    picked_up: { label: "已取餐",  tone: "picked" }
  };
  var LEGACY_STATUS_MAP = {
    cooking:   "preparing",
    packing:   "preparing",
    picked_up: "completed",
    done:      "ready"
  };
  // Source label 雙版本（單一真相）：
  //   long  → 取餐看板 / 後台訂單列表（完整敘述）
  //   short → KDS / 空間緊湊的徽章
  var SOURCE_LABELS = {
    walk_in:   "現場顧客",
    phone:     "電話訂",
    line:      "LINE點餐",
    liff:      "LINE點餐",
    pos:       "現場顧客",
    ubereats:  "UberEats",
    foodpanda: "Foodpanda",
    manual:    "人工建立"
  };
  var SOURCE_LABELS_SHORT = {
    walk_in:   "現場",
    phone:     "電話",
    line:      "LINE",
    liff:      "LINE",
    pos:       "現場",
    ubereats:  "UberEats",
    foodpanda: "Foodpanda",
    manual:    "人工"
  };
  var STATUS_DEFAULT_MINUTES = {
    new:       3,
    accepted:  2,
    preparing: 8,
    cooking:   8,
    packing:   2,
    ready:     0,
    completed: 0,
    picked_up: 0,
    cancelled: 0
  };

  function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function resolve(value, fallback) {
    return value == null || value === "" ? fallback : value;
  }

  function mapLegacyStatus(status) {
    return LEGACY_STATUS_MAP[status] || status || "new";
  }

  function sourceLabel(source, options) {
    var useShort = !!(options && options.short);
    var table = useShort ? SOURCE_LABELS_SHORT : SOURCE_LABELS;
    var fallback = useShort ? "現場" : "現場顧客";
    return table[source] || fallback;
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    // Firestore Timestamp 序列化後的 plain object（可能來自 cache / REST / postMessage）
    if (typeof value === "object" && typeof value.seconds === "number") {
      var nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return new Date(value.seconds * 1000 + Math.floor(nanos / 1e6));
    }
    if (typeof value === "number") {
      // 小於 1e12 視為 unix 秒、否則視為毫秒
      return new Date(value < 1e12 ? value * 1000 : value);
    }
    if (typeof value === "string") {
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function toMillis(value) {
    var dateValue = toDate(value);
    return dateValue ? dateValue.getTime() : 0;
  }

  function now() {
    return new Date();
  }

  function formatDateTime(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleString("zh-TW", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatTime(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleTimeString("zh-TW", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDate(value) {
    var dateValue = toDate(value);
    if (!dateValue) return "";
    return dateValue.toLocaleDateString("zh-TW");
  }

  function elapsedMinutes(fromValue) {
    var millis = toMillis(fromValue);
    if (!millis) return 0;
    return Math.max(0, Math.floor((Date.now() - millis) / 60000));
  }

  function isFutureScheduled(order) {
    return toMillis(order.scheduled_pickup_at) > Date.now() + 5 * 60000;
  }

  var KDS_DEFAULT_PREP_MINUTES = 6;

  // 動態出餐時間規則預設值。Admin 後台可覆寫到 settings.kdsTimingRules
  // v2.6：金額加時改為分段封頂（tiered_cap）；新增 largeOrderRule。
  // v2.7：排隊基礎時間改為「有限平行處理」模型。現場前提：6 孔煮麵爐，但人腦
  //       專注力約可平行吸收 2.5 單。因此前 2 單差距小（5→6）；第 3 單進入明顯
  //       等待（8）；第 4 單後每張 +3（11、14、17、20…）。不做完整派工模擬，
  //       只對 queueBaseMinutes 重新塑形。
  //       保留 first/second/third/afterThirdIncrement 欄位做為 slots 不存在時的
  //       legacy fallback；保留 stepAmount/stepMinutes 作 amountRule legacy fallback。
  var DEFAULT_KDS_TIMING_RULES = {
    queueBaseMinutes: {
      mode: "parallel_capacity",
      slots: [
        { position: 1, minutes: 5 },
        { position: 2, minutes: 6 },
        { position: 3, minutes: 8 },
        { position: 4, minutes: 11 },
        { position: 5, minutes: 14 },
        { position: 6, minutes: 17 }
      ],
      afterLastIncrement: 3,
      first: 5,
      second: 6,
      third: 8,
      afterThirdIncrement: 3
    },
    amountRule: {
      mode: "tiered_cap",
      baseAmount: 200,
      tiers: [
        { upTo: 200, minutes: 0 },
        { upTo: 400, minutes: 2 },
        { upTo: 700, minutes: 4 },
        { upTo: null, minutes: 6 }
      ],
      stepAmount: 100,
      stepMinutes: 2,
      roundUp: true
    },
    largeOrderRule: {
      enabled: true,
      itemCountThreshold1: 25,
      extraMinutes1: 1,
      itemCountThreshold2: 35,
      extraMinutes2: 2,
      groupCountThreshold1: 3,
      groupCountThreshold2: 4
    },
    longCookRule: {
      enabled: true,
      minMinutes: 6.5,
      keywords: ["火鍋料", "寬粉", "水餃", "玉米筍", "烏龍麵"]
    },
    startBufferMinutes: 1,
    overdueAlertAfterMinutes: 3
  };

  function formatHmLocal(ms) {
    if (!ms) return "";
    var d = new Date(ms);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function mergeDefaults(target, defaults) {
    var result = {};
    var key;
    for (key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        var dv = defaults[key];
        var tv = target && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
        if (dv && typeof dv === "object" && !Array.isArray(dv)) {
          result[key] = mergeDefaults(tv && typeof tv === "object" ? tv : {}, dv);
        } else {
          result[key] = tv !== undefined && tv !== null ? tv : dv;
        }
      }
    }
    return result;
  }

  // 從 settings 讀取 KDS 出餐規則，缺欄自動補上預設值
  function getKdsTimingRules(settings) {
    var raw = settings && settings.kdsTimingRules;
    if (!raw || typeof raw !== "object") return JSON.parse(JSON.stringify(DEFAULT_KDS_TIMING_RULES));
    return mergeDefaults(raw, DEFAULT_KDS_TIMING_RULES);
  }

  // 組數：有 groups[].items[] 非空就以 groups 數為準；否則退到平坦 items → 視為 1 組
  function getOrderGroupCount(order) {
    if (!order) return 0;
    if (Array.isArray(order.groups) && order.groups.length) {
      var valid = order.groups.filter(function (g) { return g && Array.isArray(g.items) && g.items.length > 0; });
      if (valid.length) return valid.length;
    }
    if (Array.isArray(order.items) && order.items.length) return 1;
    return 0;
  }

  // 品項總數：以 qty 為準（缺 qty 以 1 計）；有 groups 就以 groups 為主，避免重複計算
  function getOrderItemCount(order) {
    if (!order) return 0;
    var count = 0;
    var groups = Array.isArray(order.groups) ? order.groups : [];
    var validGroups = groups.filter(function (g) { return g && Array.isArray(g.items) && g.items.length > 0; });
    if (validGroups.length) {
      validGroups.forEach(function (g) {
        g.items.forEach(function (it) {
          var q = Number(it && it.qty);
          if (!Number.isFinite(q) || q < 1) q = 1;
          count += q;
        });
      });
      return count;
    }
    if (Array.isArray(order.items)) {
      order.items.forEach(function (it) {
        var q = Number(it && it.qty);
        if (!Number.isFinite(q) || q < 1) q = 1;
        count += q;
      });
    }
    return count;
  }

  // v2.7 有限平行處理：以 slots 指定「第 N 張訂單」對應的基礎分鐘數。
  //   - 若有 slots：精準取對應 position；pos 超過最後一格 → 用最後一格 + afterLastIncrement 每張加一次
  //   - 若無 slots（legacy）：退回 first/second/third + afterThirdIncrement
  //   - 若連 legacy 欄位都缺 → 落到 hard-coded 預設
  //   容錯：slots 會先排序，且即使 slots 有缺 position，也能以「≤ pos 的最近一格」為主
  function getQueueBaseMinutes(queuePosition, rules) {
    var q = (rules && rules.queueBaseMinutes) || DEFAULT_KDS_TIMING_RULES.queueBaseMinutes;
    var pos = Number(queuePosition);
    if (!Number.isFinite(pos) || pos < 1) pos = 1;
    if (Array.isArray(q.slots) && q.slots.length) {
      var slots = q.slots.slice().filter(function (s) { return s && Number.isFinite(Number(s.position)); })
        .sort(function (a, b) { return Number(a.position) - Number(b.position); });
      if (slots.length) {
        for (var i = 0; i < slots.length; i++) {
          if (Number(slots[i].position) === pos) return Number(slots[i].minutes) || 0;
        }
        var last = slots[slots.length - 1];
        var lastPos = Number(last.position);
        if (pos > lastPos) {
          var inc = Number(q.afterLastIncrement);
          if (!Number.isFinite(inc)) inc = 3;
          return (Number(last.minutes) || 0) + (pos - lastPos) * inc;
        }
        // pos < slots 最小值或落在缺口 → 用 ≤ pos 的最近一格
        var candidate = slots[0];
        for (var j = 0; j < slots.length; j++) {
          if (Number(slots[j].position) <= pos) candidate = slots[j];
        }
        return Number(candidate.minutes) || 0;
      }
    }
    // Legacy fallback
    var first = Number(q.first); if (!Number.isFinite(first)) first = 5;
    var second = Number(q.second); if (!Number.isFinite(second)) second = 7;
    var third = Number(q.third); if (!Number.isFinite(third)) third = 10;
    var afterInc = Number(q.afterThirdIncrement); if (!Number.isFinite(afterInc)) afterInc = 3;
    if (pos === 1) return first;
    if (pos === 2) return second;
    if (pos === 3) return third;
    return third + (pos - 3) * afterInc;
  }

  // 分段封頂金額加時：遍歷 tiers，第一個 upTo >= total 的 tier 勝出；upTo === null 視為無上限
  function calcAmountTiered(total, tiers) {
    if (!Array.isArray(tiers) || !tiers.length) return 0;
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i] || {};
      var upTo = t.upTo;
      var mins = Number(t.minutes) || 0;
      if (upTo == null || Number(total) <= Number(upTo)) return mins;
    }
    return Number(tiers[tiers.length - 1].minutes) || 0;
  }

  // 超大單微幅加時：group / item 規則取「較大級」而不是相加
  function calcExtraLargeMinutes(groupCount, itemCount, rule) {
    if (!rule || rule.enabled === false) return 0;
    var g1 = Number(rule.groupCountThreshold1);
    var g2 = Number(rule.groupCountThreshold2);
    var i1 = Number(rule.itemCountThreshold1);
    var i2 = Number(rule.itemCountThreshold2);
    var extra1 = Number(rule.extraMinutes1);
    var extra2 = Number(rule.extraMinutes2);
    if (!Number.isFinite(extra1)) extra1 = 1;
    if (!Number.isFinite(extra2)) extra2 = 2;
    var level = 0;
    if (Number.isFinite(g2) && groupCount >= g2) level = Math.max(level, 2);
    else if (Number.isFinite(g1) && groupCount >= g1) level = Math.max(level, 1);
    if (Number.isFinite(i2) && itemCount >= i2) level = Math.max(level, 2);
    else if (Number.isFinite(i1) && itemCount >= i1) level = Math.max(level, 1);
    if (level === 2) return extra2;
    if (level === 1) return extra1;
    return 0;
  }

  // 集中訂單 items 供 SKU / 名稱比對（未來擴充 SKU 清單時，結構已就緒）
  function collectOrderItemProbes(order) {
    var probes = [];
    if (!order) return probes;
    function push(source) {
      if (!source) return;
      var name = String(source.name == null ? "" : source.name).trim();
      var sku = String((source.sku != null ? source.sku : (source.itemId != null ? source.itemId : (source.productId != null ? source.productId : (source.id != null ? source.id : "")))) || "").trim();
      var flavor = String(source.selectedFlavor || source.flavor || "").trim();
      var staple = String(source.selectedStaple || source.staple || "").trim();
      probes.push({ name: name, sku: sku, flavor: flavor, staple: staple, raw: source });
    }
    if (Array.isArray(order.groups)) {
      order.groups.forEach(function (g) {
        if (g && Array.isArray(g.items)) g.items.forEach(push);
      });
    }
    if (Array.isArray(order.items)) order.items.forEach(push);
    return probes;
  }

  // 將長煮食材判斷獨立出來；未來可擴充 SKU 清單，目前以名稱 fallback 為主
  // rules: { enabled, minMinutes, keywords: [string], skus?: [string] }
  function matchLongCookItems(order, rules) {
    var result = { matchedNames: [], matchedSkus: [], floorApplied: false };
    if (!order || !rules || rules.enabled === false) return result;
    var probes = collectOrderItemProbes(order);
    var nameKeywords = Array.isArray(rules.keywords) ? rules.keywords.map(function (k) { return String(k == null ? "" : k).trim(); }).filter(Boolean) : [];
    var skuKeywords = Array.isArray(rules.skus) ? rules.skus.map(function (k) { return String(k == null ? "" : k).trim(); }).filter(Boolean) : [];
    var seenName = {};
    var seenSku = {};
    probes.forEach(function (p) {
      // 1. 若有 SKU 且在 SKU 清單：優先命中
      if (p.sku && skuKeywords.length) {
        for (var i = 0; i < skuKeywords.length; i++) {
          if (p.sku === skuKeywords[i] && !seenSku[p.sku]) {
            seenSku[p.sku] = true;
            result.matchedSkus.push(p.sku);
            if (p.name && !seenName[p.name]) { seenName[p.name] = true; result.matchedNames.push(p.name); }
            return;
          }
        }
      }
      // 2. 名稱子字串比對（包含 name / flavor / staple）
      var haystacks = [p.name, p.flavor, p.staple].filter(Boolean);
      for (var j = 0; j < haystacks.length; j++) {
        var s = haystacks[j];
        for (var k = 0; k < nameKeywords.length; k++) {
          if (nameKeywords[k] && s.indexOf(nameKeywords[k]) >= 0) {
            if (!seenName[s]) { seenName[s] = true; result.matchedNames.push(s); }
            return;
          }
        }
      }
    });
    return result;
  }

  // 安全收斂訂單所有「名稱類」字串（品項名 + 口味 + 主食），供關鍵字比對
  function collectOrderItemNames(order) {
    var names = [];
    if (!order) return names;
    var seen = {};
    function push(name) {
      var n = String(name == null ? "" : name).trim();
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    }
    if (Array.isArray(order.groups)) {
      order.groups.forEach(function (g) {
        if (g && Array.isArray(g.items)) {
          g.items.forEach(function (it) {
            if (!it) return;
            push(it.name);
            push(it.selectedFlavor);
            push(it.flavor);
            push(it.selectedStaple);
            push(it.staple);
          });
        }
        if (g && g.flavor) push(g.flavor);
        if (g && g.staple) push(g.staple);
      });
    }
    if (Array.isArray(order.items)) {
      order.items.forEach(function (it) {
        if (!it) return;
        push(it.name);
        push(it.selectedFlavor);
        push(it.flavor);
        push(it.selectedStaple);
        push(it.staple);
      });
    }
    return names;
  }

  // 由 active 訂單陣列建立隊列位置對照：{ map: {id -> 1-based position}, count, sortedIds }
  function buildKdsQueueInfo(activeOrders) {
    var list = Array.isArray(activeOrders) ? activeOrders.slice() : [];
    var sorted = sortOrdersByCreatedAsc(list);
    var map = {};
    var sortedIds = [];
    sorted.forEach(function (o, i) {
      var id = String(o && o.id || "");
      if (!id) return;
      map[id] = i + 1;
      sortedIds.push(id);
    });
    return { map: map, count: sortedIds.length, sortedIds: sortedIds };
  }

  // 估算單筆訂單的預估製作分鐘數，回傳 {prepMinutes, breakdown}
  function estimateOrderPrepMinutes(order, context, rules) {
    var r = rules && typeof rules === "object" ? mergeDefaults(rules, DEFAULT_KDS_TIMING_RULES) : JSON.parse(JSON.stringify(DEFAULT_KDS_TIMING_RULES));
    var amountRule = r.amountRule;
    var longCook = r.longCookRule;

    // 決定 queuePosition。若 context 帶 queueInfo 就查 map；退而求其次看 queuePosition
    var queuePosition = 1;
    if (context && context.queueInfo && order && order.id != null) {
      var pos = context.queueInfo.map && context.queueInfo.map[String(order.id)];
      if (Number.isFinite(Number(pos))) queuePosition = Number(pos);
      else if (Number.isFinite(Number(context.queueInfo.count))) queuePosition = Number(context.queueInfo.count) + 1;
    } else if (context && Number.isFinite(Number(context.queuePosition))) {
      queuePosition = Number(context.queuePosition);
    }
    if (queuePosition < 1) queuePosition = 1;

    var queueBaseMinutes = getQueueBaseMinutes(queuePosition, r);

    var total = Number(order && (order.total != null ? order.total : (order.totalAmount != null ? order.totalAmount : order.totalPrice))) || 0;

    // 金額加時：優先 tiers（tiered_cap），缺 tiers 時退回舊的 step 線性
    var amountMinutes = 0;
    if (Array.isArray(amountRule.tiers) && amountRule.tiers.length) {
      amountMinutes = calcAmountTiered(total, amountRule.tiers);
    } else {
      var baseAmt = Number(amountRule.baseAmount);
      var stepAmt = Number(amountRule.stepAmount);
      var stepMin = Number(amountRule.stepMinutes);
      if (Number.isFinite(baseAmt) && Number.isFinite(stepAmt) && stepAmt > 0 && Number.isFinite(stepMin) && total > baseAmt) {
        var excess = total - baseAmt;
        var steps = amountRule.roundUp === false ? Math.floor(excess / stepAmt) : Math.ceil(excess / stepAmt);
        amountMinutes = steps * stepMin;
      }
    }

    // 超大單微幅加時（獨立於 amountMinutes）
    var groupCount = getOrderGroupCount(order);
    var itemCount = getOrderItemCount(order);
    var extraLargeOrderMinutes = calcExtraLargeMinutes(groupCount, itemCount, r.largeOrderRule);

    // 若額外的 context 提供模擬值（供後台試算器用），優先使用
    if (context) {
      if (Number.isFinite(Number(context.groupCount))) {
        groupCount = Number(context.groupCount);
      }
      if (Number.isFinite(Number(context.itemCount))) {
        itemCount = Number(context.itemCount);
      }
      if (context && (Number.isFinite(Number(context.groupCount)) || Number.isFinite(Number(context.itemCount)))) {
        extraLargeOrderMinutes = calcExtraLargeMinutes(groupCount, itemCount, r.largeOrderRule);
      }
    }

    var subtotalMinutes = queueBaseMinutes + amountMinutes + extraLargeOrderMinutes;

    var longCookMatch = matchLongCookItems(order, longCook);
    var finalMinutes = subtotalMinutes;
    var longCookFloorApplied = false;

    if (longCookMatch.matchedNames.length > 0 || longCookMatch.matchedSkus.length > 0) {
      var minMin = Number(longCook && longCook.minMinutes);
      if (!Number.isFinite(minMin)) minMin = 6.5;
      if (subtotalMinutes < minMin) {
        finalMinutes = minMin;
        longCookFloorApplied = true;
      }
    }

    var prepMinutes = Math.max(1, Math.ceil(finalMinutes));

    return {
      prepMinutes: prepMinutes,
      breakdown: {
        queuePosition: queuePosition,
        queueBaseMinutes: queueBaseMinutes,
        amountMinutes: amountMinutes,
        extraLargeOrderMinutes: extraLargeOrderMinutes,
        subtotalMinutes: subtotalMinutes,
        longCookFloorApplied: longCookFloorApplied,
        longCookMatchedItems: longCookMatch.matchedNames.map(function (n) { return { name: n, keyword: n }; }),
        longCookMatchedNames: longCookMatch.matchedNames,
        longCookMatchedSkus: longCookMatch.matchedSkus,
        groupCount: groupCount,
        itemCount: itemCount,
        finalMinutes: finalMinutes
      }
    };
  }

  // ── 鎖定估時：首次進入 KDS 時寫回 order.timing，之後顯示都吃這份快照 ──
  function hasLockedTiming(order) {
    return !!(order && order.timing && Number.isFinite(Number(order.timing.lockedPrepMinutes)) && Number(order.timing.lockedPrepMinutes) > 0);
  }

  function normalizeLockedTiming(raw) {
    if (!raw || typeof raw !== "object") return null;
    var lp = Number(raw.lockedPrepMinutes);
    if (!Number.isFinite(lp) || lp <= 0) return null;
    return {
      lockedPrepMinutes: lp,
      lockedStartCookAt: raw.lockedStartCookAt || null,
      estimatedReadyAt: raw.estimatedReadyAt || null,
      queuePositionAtLock: Number(raw.queuePositionAtLock) || 0,
      queueBaseMinutes: Number(raw.queueBaseMinutes) || 0,
      amountMinutes: Number(raw.amountMinutes) || 0,
      extraLargeOrderMinutes: Number(raw.extraLargeOrderMinutes) || 0,
      groupCount: Number(raw.groupCount) || 0,
      itemCount: Number(raw.itemCount) || 0,
      longCookFloorApplied: !!raw.longCookFloorApplied,
      longCookMatchedItems: Array.isArray(raw.longCookMatchedItems) ? raw.longCookMatchedItems.slice() : [],
      longCookMatchedSkus: Array.isArray(raw.longCookMatchedSkus) ? raw.longCookMatchedSkus.slice() : [],
      estimatedBy: raw.estimatedBy || "kds_rule_v2",
      lockedAt: raw.lockedAt || null
    };
  }

  // 建立 timing 鎖定快照（純計算，不寫 DB）
  function computeOrderTimingLock(orderData, context, rules) {
    var est = estimateOrderPrepMinutes(orderData, context, rules);
    var createdAtMs = toMillis(orderData && orderData.created_at) || Date.now();
    var pickupAtMs = toMillis(orderData && orderData.scheduled_pickup_at);
    var hasPickup = pickupAtMs > 0;
    var prepMs = est.prepMinutes * 60000;
    var effectivePickup = hasPickup ? pickupAtMs : (createdAtMs + prepMs);
    var startCookAt = new Date(effectivePickup - prepMs).toISOString();
    var estimatedReadyAt = new Date(effectivePickup).toISOString();
    return {
      lockedPrepMinutes: est.prepMinutes,
      lockedStartCookAt: startCookAt,
      estimatedReadyAt: estimatedReadyAt,
      queuePositionAtLock: est.breakdown.queuePosition,
      queueBaseMinutes: est.breakdown.queueBaseMinutes,
      amountMinutes: est.breakdown.amountMinutes,
      extraLargeOrderMinutes: est.breakdown.extraLargeOrderMinutes || 0,
      groupCount: est.breakdown.groupCount || 0,
      itemCount: est.breakdown.itemCount || 0,
      longCookFloorApplied: est.breakdown.longCookFloorApplied,
      longCookMatchedItems: est.breakdown.longCookMatchedNames || [],
      longCookMatchedSkus: est.breakdown.longCookMatchedSkus || [],
      estimatedBy: "kds_rule_v2_6"
      // lockedAt 在 ensureOrderTimingLocked 寫入時用 serverTimestamp
    };
  }

  // Transaction 安全鎖定：若文件已有 lockedPrepMinutes 則略過寫入
  // 呼叫端應自行維護 per-session guard，避免同一訂單在同一分頁被多次觸發 transaction
  async function ensureOrderTimingLocked(options) {
    var db = options.db;
    var orderId = options.orderId;
    var context = options.context || {};
    var rules = options.rules || DEFAULT_KDS_TIMING_RULES;
    if (!db || !orderId) return null;
    // 快速路徑：若傳入的本地 order 已鎖 -> 直接回傳（不發 transaction）
    if (options.order && hasLockedTiming(options.order)) {
      return normalizeLockedTiming(options.order.timing);
    }
    var ref = db.collection("orders").doc(String(orderId));
    var finalTiming = null;
    try {
      await db.runTransaction(async function (tx) {
        var snap = await tx.get(ref);
        if (!snap.exists) return;
        var cur = snap.data() || {};
        if (cur.timing && Number.isFinite(Number(cur.timing.lockedPrepMinutes)) && Number(cur.timing.lockedPrepMinutes) > 0) {
          finalTiming = normalizeLockedTiming(cur.timing);
          return;
        }
        var timing = computeOrderTimingLock(cur, context, rules);
        timing.lockedAt = serverTimestamp();
        tx.update(ref, { timing: timing });
        finalTiming = normalizeLockedTiming(timing);
      });
    } catch (err) {
      console.warn("[Orders] ensureOrderTimingLocked failed.", { orderId: orderId, error: err && err.message || err });
    }
    return finalTiming;
  }

  // KDS 時間狀態機：以 pickupAt（取餐時間）為主，startCookAt = pickupAt - prepMinutes
  // 回傳四階段：waiting_to_start / should_start / overdue（due 合併入 should_start 尾段）
  // 若無 scheduled_pickup_at，則視為即時單，pickupAt = createdAt + prepMinutes
  // prepMinutes 優先讀取 order.timing.lockedPrepMinutes（第二輪鎖定值），否則即時計算
  function getKdsTimingMeta(order, nowMs, context, rules) {
    nowMs = typeof nowMs === "number" ? nowMs : Date.now();
    var createdAtMs = toMillis(order && order.created_at);
    var pickupAtMsRaw = toMillis(order && order.scheduled_pickup_at);

    var prepMinutes, breakdown, locked = null;
    if (hasLockedTiming(order)) {
      locked = normalizeLockedTiming(order.timing);
      prepMinutes = locked.lockedPrepMinutes;
      breakdown = {
        queuePosition: locked.queuePositionAtLock,
        queueBaseMinutes: locked.queueBaseMinutes,
        amountMinutes: locked.amountMinutes,
        extraLargeOrderMinutes: locked.extraLargeOrderMinutes || 0,
        subtotalMinutes: locked.queueBaseMinutes + locked.amountMinutes + (locked.extraLargeOrderMinutes || 0),
        longCookFloorApplied: locked.longCookFloorApplied,
        longCookMatchedItems: (locked.longCookMatchedItems || []).map(function (n) { return { name: n, keyword: n }; }),
        longCookMatchedNames: locked.longCookMatchedItems || [],
        longCookMatchedSkus: locked.longCookMatchedSkus || [],
        groupCount: locked.groupCount || 0,
        itemCount: locked.itemCount || 0,
        finalMinutes: locked.lockedPrepMinutes,
        locked: true,
        estimatedBy: locked.estimatedBy
      };
    } else {
      var estimate = estimateOrderPrepMinutes(order, context, rules);
      prepMinutes = estimate.prepMinutes;
      breakdown = estimate.breakdown;
      breakdown.locked = false;
    }
    var prepMs = prepMinutes * 60 * 1000;

    var hasPickup = pickupAtMsRaw > 0;
    // 只有預約時間明顯晚於下單（> prepMinutes）才算「預約單」
    var isScheduled = hasPickup && createdAtMs > 0 && (pickupAtMsRaw - createdAtMs) > prepMs;
    var effectivePickupAtMs = hasPickup
      ? pickupAtMsRaw
      : (createdAtMs ? createdAtMs + prepMs : nowMs + prepMs);
    var startCookAtMs = effectivePickupAtMs - prepMs;

    var pickupHm = formatHmLocal(effectivePickupAtMs);
    var createdHm = formatHmLocal(createdAtMs);
    var secondaryBase;
    if (isScheduled) {
      secondaryBase = "預約 " + pickupHm + " 取餐";
    } else if (createdHm) {
      secondaryBase = createdHm + " 下單";
    } else {
      secondaryBase = "";
    }
    var secondaryLabel = secondaryBase
      ? ("預估 " + prepMinutes + " 分｜" + secondaryBase)
      : ("預估 " + prepMinutes + " 分");

    var base = {
      isScheduled: isScheduled,
      createdAtMs: createdAtMs,
      pickupAtMs: effectivePickupAtMs,
      prepMinutes: prepMinutes,
      startCookAtMs: startCookAtMs,
      secondaryLabel: secondaryLabel,
      breakdown: breakdown,
      locked: !!locked,
      lockedTiming: locked
    };

    if (nowMs < startCookAtMs) {
      var minutesToStart = Math.max(1, Math.ceil((startCookAtMs - nowMs) / 60000));
      base.statusPhase = "waiting_to_start";
      base.primaryLabel = minutesToStart + " 分後開做";
      base.minutesToStart = minutesToStart;
      base.minutesToPickup = Math.ceil((effectivePickupAtMs - nowMs) / 60000);
      base.overdueMinutes = 0;
      return base;
    }

    if (nowMs < effectivePickupAtMs) {
      var rawMinsToPickup = Math.ceil((effectivePickupAtMs - nowMs) / 60000);
      var minutesToPickup = rawMinsToPickup < 1 ? 1 : rawMinsToPickup;
      base.statusPhase = "should_start";
      base.primaryLabel = minutesToPickup <= 1 ? "現在開做" : ("距取餐 " + minutesToPickup + " 分");
      base.minutesToStart = 0;
      base.minutesToPickup = minutesToPickup;
      base.overdueMinutes = 0;
      return base;
    }

    var overdueMinutes = Math.max(1, Math.ceil((nowMs - effectivePickupAtMs) / 60000));
    base.statusPhase = "overdue";
    base.primaryLabel = "已逾時 " + overdueMinutes + " 分";
    base.minutesToStart = 0;
    base.minutesToPickup = 0;
    base.overdueMinutes = overdueMinutes;
    return base;
  }

  // 2026-04-21 P4：寫入端只輸出正式欄位 groupId/groupLabel/groupIndex。
  //   options.stripLegacy === true → 略過 partId/partLabel/partIndex/
  //     sourceGroupId/sourceGroupIndex/sourceGroupLabel/groupKey 這 7 個冗餘欄位。
  //   預設 false（讀路徑）→ 全數輸出，維持既有 UI / legacy 訂單相容。
  // 讀路徑的別名 fallback 保留：groupId ← sourceGroupId ← partId。
  function normalizeItem(item, options) {
    var stripLegacy = !!(options && options.stripLegacy);
    var unitPrice = Number(resolve(item && (item.unit_price || item.price), 0));
    var qty = Number(resolve(item && item.qty, 0));
    var subtotal = Number(resolve(item && item.subtotal, unitPrice * qty));
    var partIndexRaw = Number(resolve(
      item && item.partIndex,
      resolve(item && item.groupIndex, resolve(item && item.sourceGroupIndex, null))
    ));
    var partIndex = Number.isFinite(partIndexRaw) && partIndexRaw > 0 ? partIndexRaw : null;
    var relationKey = resolve(item && (item.parentLineId || item.parentItemId || item.attachTo || item.bundleId), "");
    var lineKey = resolve(item && (item.lineId || item.itemLineId), "");
    var groupId = resolve(item && item.groupId, resolve(item && item.sourceGroupId, resolve(item && item.partId, "")));
    var groupLabel = resolve(item && item.groupLabel, resolve(item && item.sourceGroupLabel, resolve(item && item.partLabel, "")));
    var result = {
      sku: resolve(item && (item.sku || item.itemId), ""),
      itemId: resolve(item && (item.itemId || item.sku), ""),
      type: resolve(item && item.type, ""),
      posType: resolve(item && item.posType, ""),
      isGift: !!(item && item.isGift),
      giftType: resolve(item && item.giftType, ""),
      giftSlot: resolve(item && item.giftSlot, ""),
      giftLabel: resolve(item && item.giftLabel, ""),
      name: resolve(item && item.name, "未命名品項"),
      qty: qty,
      flavor: resolve(item && item.flavor, resolve(item && item.selectedFlavor, resolve(item && item.flavorName, ""))),
      selectedFlavor: resolve(item && item.selectedFlavor, resolve(item && item.flavor, resolve(item && item.flavorName, ""))),
      staple: resolve(item && item.staple, resolve(item && item.selectedStaple, resolve(item && item.stapleName, ""))),
      selectedStaple: resolve(item && item.selectedStaple, resolve(item && item.staple, resolve(item && item.stapleName, ""))),
      options: Array.isArray(item && item.options) ? item.options : [],
      unit_price: unitPrice,
      price: unitPrice,
      subtotal: subtotal,
      item_note: resolve(item && (item.item_note || item.note), ""),
      groupId: groupId,
      groupLabel: groupLabel,
      groupIndex: partIndex,
      personIndex: Number(resolve(item && item.personIndex, 0)) || 0,
      seatIndex: Number(resolve(item && item.seatIndex, 0)) || 0,
      seatLabel: resolve(item && item.seatLabel, ""),
      assignee: resolve(item && item.assignee, ""),
      bundleId: resolve(item && item.bundleId, ""),
      parentLineId: relationKey,
      lineId: lineKey,
      sequence: Number(resolve(item && item.sequence, 0)) || 0,
      slot: resolve(item && item.slot, "")
    };
    if (!stripLegacy) {
      // 讀路徑：保留 7 個冗餘欄位以相容老訂單 UI / fallback 鏈
      result.sourceGroupId = groupId;
      result.sourceGroupIndex = partIndex;
      result.sourceGroupLabel = groupLabel;
      result.partId = groupId;
      result.partLabel = groupLabel;
      result.partIndex = partIndex;
      result.groupKey = resolve(item && item.groupKey, "");
    }
    return result;
  }

  function deriveDisplayName(data) {
    if (data.display_name) return data.display_name;
    if (data.customer_name && data.label) return data.label + " " + data.customer_name;
    if (data.customer_name) return data.customer_name;
    if (data.label) return data.label;
    return "現場顧客";
  }

  function normalizeOrder(input, docId) {
    var data = input || {};
    var items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];
    var subtotal = Number(resolve(data.subtotal, resolve(data.totalAmount, resolve(data.totalPrice, 0))));
    if (!subtotal && items.length) {
      subtotal = items.reduce(function (sum, item) { return sum + Number(item.subtotal || 0); }, 0);
    }
    var total = Number(resolve(data.total, resolve(data.totalAmount, resolve(data.totalPrice, subtotal))));
    var normalized = {
      id: resolve(data.id, docId || ""),
      storeId: resolve(data.storeId, data.store_id || (window.APP_CONFIG && window.APP_CONFIG.store && window.APP_CONFIG.store.defaultStoreId) || "store_1"),
      customer_name: resolve(data.customer_name, resolve(data.userName, resolve(data.pickupName, resolve(data.name, "")))),
      customer_phone: resolve(data.customer_phone, resolve(data.customerPhone, "")),
      label: resolve(data.label, sourceLabel(resolve(data.source, "liff"))),
      source: resolve(data.source, "liff"),
      display_name: resolve(data.display_name, ""),
      display_code: resolve(data.display_code, ""),
      status: mapLegacyStatus(data.status),
      items: items,
      subtotal: subtotal,
      total: total,
      note: resolve(data.note, ""),
      internal_note: resolve(data.internal_note, resolve(data.internalNote, "")),
      scheduled_pickup_date: resolve(data.scheduled_pickup_date, resolve(data.pickupDateValue, "")),
      scheduled_pickup_time: resolve(data.scheduled_pickup_time, resolve(data.pickupTime, "")),
      scheduled_pickup_at: resolve(data.scheduled_pickup_at, resolve(data.pickupDateTimeISO, "")),
      estimated_minutes: typeof data.estimated_minutes === "number" ? data.estimated_minutes : null,
      queue_number: resolve(data.queue_number, 0),
      created_at: resolve(data.created_at, data.createdAt),
      started_at: resolve(data.started_at, data.startedAt),
      packed_at: resolve(data.packed_at, data.packedAt),
      ready_at: resolve(data.ready_at, data.readyAt),
      completed_at: resolve(data.completed_at, data.completedAt),
      picked_up_at: resolve(data.picked_up_at, data.pickedUpAt),
      cancelled_at: resolve(data.cancelled_at, data.cancelledAt),
      updated_at: resolve(data.updated_at, data.updatedAt),
      inventoryAdjusted: !!data.inventoryAdjusted,
      pointsGranted: !!data.pointsGranted,
      userId: resolve(data.userId, ""),
      lineUserId: resolve(data.lineUserId, ""),
      pickupNumber: resolve(data.pickupNumber, ""),
      giftPromotionResult: resolve(data.giftPromotionResult, null),
      groups: Array.isArray(data.groups) ? data.groups : null,
      timing: data.timing && typeof data.timing === "object" ? data.timing : null,
      raw: data
    };
    normalized.display_name = deriveDisplayName(normalized);
    return normalized;
  }

  // 將 groups[].items[] 的每個 item 轉為寫入用正規形（去 legacy 別名）
  function normalizeGroupsForWrite(groups) {
    if (!Array.isArray(groups)) return null;
    return groups.map(function (g) {
      if (!g || typeof g !== "object") return g;
      var out = {};
      for (var k in g) if (Object.prototype.hasOwnProperty.call(g, k)) out[k] = g[k];
      if (Array.isArray(g.items)) {
        out.items = g.items.map(function (it) { return normalizeItem(it, { stripLegacy: true }); });
      }
      return out;
    });
  }

  // 群組輕量驗證（僅 warn，不 throw）— 用於寫入前追蹤異常來源
  function validateGroupsLoose(groups, orderIdHint) {
    if (!Array.isArray(groups)) return;
    var tag = "[buildCreatePayload" + (orderIdHint ? ":" + orderIdHint : "") + "]";
    groups.forEach(function (g, idx) {
      if (!g || typeof g !== "object") {
        console.warn(tag + " groups[" + idx + "] 不是物件，已忽略驗證。");
        return;
      }
      if (!g.id) console.warn(tag + " groups[" + idx + "] 缺 id（預期為 groupId 定義）");
      if (!g.label) console.warn(tag + " groups[" + idx + "] 缺 label（顯示用）");
      if (!Number.isFinite(Number(g.index))) console.warn(tag + " groups[" + idx + "] 缺 index 或格式錯誤");
      if (!Array.isArray(g.items) || g.items.length === 0) console.warn(tag + " groups[" + idx + "] 無 items");
    });
  }

  /**
   * 建立訂單寫入 payload。
   *
   * ── Canonical groups schema（P4 起唯一真相，2026-04-21）──
   * order.groups : Array<Group> | null
   *   Group {
   *     id:     string    // 群組唯一 key（對齊 item.groupId）
   *     label:  string    // 顯示用名（例：「第 1 組」、「A 點」）
   *     index:  number    // 1-based 序號（UI 排序 + legacy fallback）
   *     items:  Array<Item>
   *     flavor? staple? ...  // 可選 context（套餐口味等）
   *   }
   *   Item { sku, itemId, name, qty, unit_price, subtotal,
   *          groupId, groupLabel, groupIndex,   ← 僅此三個為群組識別正式欄位
   *          flavor, staple, options[], item_note, ... }
   *
   * 不再輸出 partId/partLabel/partIndex/sourceGroupId/sourceGroupIndex/
   * sourceGroupLabel/groupKey（讀路徑仍接受，寫路徑一律沉默丟棄）。
   */
  function buildCreatePayload(options) {
    var status = mapLegacyStatus(options.status || "new");
    var source = options.source || "liff";
    var label = options.label || sourceLabel(source);
    var createdAt = serverTimestamp();
    var itemList = (options.items || []).map(function (it) {
      return normalizeItem(it, { stripLegacy: true });
    });
    validateGroupsLoose(options.groups, options.id);
    var subtotal = Number(resolve(options.subtotal, itemList.reduce(function (sum, item) {
      return sum + Number(item.subtotal || 0);
    }, 0)));
    var total = Number(resolve(options.total, subtotal));
    var payload = {
      id: options.id,
      storeId: options.storeId,
      customer_name: resolve(options.customer_name, ""),
      customer_phone: resolve(options.customer_phone, ""),
      label: label,
      source: source,
      display_name: resolve(options.display_name, label + (options.customer_name ? " " + options.customer_name : "")),
      display_code: resolve(options.display_code, ""),
      status: status,
      items: itemList,
      subtotal: subtotal,
      total: total,
      note: resolve(options.note, ""),
      internal_note: resolve(options.internal_note, ""),
      scheduled_pickup_date: resolve(options.scheduled_pickup_date, ""),
      scheduled_pickup_time: resolve(options.scheduled_pickup_time, ""),
      scheduled_pickup_at: resolve(options.scheduled_pickup_at, ""),
      estimated_minutes: STATUS_DEFAULT_MINUTES[status] != null ? STATUS_DEFAULT_MINUTES[status] : 3,
      queue_number: resolve(options.queue_number, Date.now()),
      created_at: createdAt,
      updated_at: createdAt,
      createdAt: createdAt,
      updatedAt: createdAt,
      totalAmount: total,
      totalPrice: total,
      memberId: resolve(options.memberId, resolve(options.userId, null)),
      userId: resolve(options.userId, null),
      lineUserId: resolve(options.lineUserId, null),
      lineDisplayName: resolve(options.lineDisplayName, null),
      linePictureUrl: resolve(options.linePictureUrl, null),
      notificationStatus: {
        receivedPushSent: false,
        receivedPushSentAt: null,
        receivedPushError: null,
        readyPushSent: false,
        readyPushSentAt: null,
        readyPushError: null,
        cancelledPushSent: false,
        cancelledPushSentAt: null,
        cancelledPushError: null
      },
      userName: resolve(options.customer_name, ""),
      paymentMethod: resolve(options.paymentMethod, "cash"),
      paymentStatus: resolve(options.paymentStatus, "pending"),
      inventoryAdjusted: false,
      pointsGranted: false,
      earnedPoints: Number(resolve(options.earnedPoints, Math.floor(total / 100))),
      pickupDateLabel: resolve(options.pickupDateLabel, ""),
      pickupDateValue: resolve(options.scheduled_pickup_date, ""),
      pickupTime: resolve(options.scheduled_pickup_time, ""),
      pickupDateTimeISO: resolve(options.scheduled_pickup_at, ""),
      storeStatusAtCheckout: resolve(options.storeStatusAtCheckout, ""),
      appliedPromotion: resolve(options.appliedPromotion, null),
      giftPromotionResult: resolve(options.giftPromotionResult, null),
      isTest: resolve(options.isTest, false),
      pickupNumber: resolve(options.pickupNumber, null),
      pickupSequence: resolve(options.pickupSequence, null),
      groups: normalizeGroupsForWrite(options.groups)
    };
    if (status === "accepted") {
      payload.accepted_at = serverTimestamp();
      payload.acceptedAt  = serverTimestamp();
    }
    return payload;
  }

  function buildOrderItemsPayload(options) {
    var orderId = options.orderId;
    var storeId = options.storeId;
    var source = options.source || "liff";
    var createdAt = serverTimestamp();
    return (options.items || []).map(function (item) {
      return {
        orderId: orderId,
        storeId: storeId,
        menuItemId: resolve(item.sku || item.itemId, ""),
        type: resolve(item.type, ""),
        isGift: !!item.isGift,
        giftType: resolve(item.giftType, ""),
        giftSlot: resolve(item.giftSlot, ""),
        giftLabel: resolve(item.giftLabel, ""),
        name: resolve(item.name, ""),
        qty: Number(item.qty || 0),
        unitPrice: Number(item.unit_price || item.price || 0),
        lineTotal: Number(item.subtotal || 0),
        flavor: resolve(item.flavor || item.flavorName, ""),
        selectedFlavor: resolve(item.selectedFlavor || item.flavor || item.flavorName, ""),
        staple: resolve(item.staple || item.stapleName, ""),
        selectedStaple: resolve(item.selectedStaple || item.staple || item.stapleName, ""),
        selectedOptions: Array.isArray(item.options) ? item.options : [],
        notes: resolve(item.item_note || item.itemNote || item.note, ""),
        // P4 2026-04-21：寫入端只保留正式 group 欄位，讀路徑仍接受 partId/sourceGroupId 別名
        groupId: resolve(item.groupId || item.sourceGroupId || item.partId, ""),
        groupIndex: Number(resolve(item.groupIndex || item.sourceGroupIndex || item.partIndex, 0)) || 0,
        groupLabel: resolve(item.groupLabel || item.sourceGroupLabel || item.partLabel, ""),
        source: source,
        createdAt: createdAt
      };
    });
  }

  function buildOrderEventPayload(options) {
    return {
      orderId: options.orderId || "",
      storeId: options.storeId || "",
      type: options.type || "status_changed",
      actorType: options.actorType || "system",
      actorId: options.actorId || "",
      actorName: options.actorName || "",
      fromStatus: options.fromStatus || null,
      toStatus: options.toStatus || null,
      message: options.message || "",
      createdAt: serverTimestamp()
    };
  }

  function sortOrdersByCreatedAsc(list) {
    return list.slice().sort(function (left, right) {
      return toMillis(left.created_at) - toMillis(right.created_at);
    });
  }

  function estimateMinutes(order, orders) {
    var status = mapLegacyStatus(order.status);
    if (status === "ready" || status === "completed" || status === "picked_up" || status === "cancelled") return 0;
    if (typeof order.estimated_minutes === "number" && order.estimated_minutes >= 0) return order.estimated_minutes;
    if (status === "preparing" || status === "packing") {
      var elapsed = elapsedMinutes(order.started_at || order.created_at);
      return Math.max(3, 8 - Math.min(5, Math.floor(elapsed / 2)));
    }
    if (status === "accepted") return 2;
    var queue = sortOrdersByCreatedAsc(orders || []).filter(function (item) {
      return ACTIVE_QUEUE_STATUSES.indexOf(mapLegacyStatus(item.status)) >= 0
        && toMillis(item.created_at) <= toMillis(order.created_at);
    });
    var ahead = Math.max(0, queue.length - 1);
    if (ahead <= 1) return 5;
    if (ahead <= 3) return 8;
    if (ahead <= 5) return 12;
    return 18;
  }

  function etaText(order, orders) {
    var status = mapLegacyStatus(order.status);
    if (status === "ready") return "可取餐";
    if (status === "completed") return "已完成";
    if (status === "picked_up") return "已取餐";
    if (status === "cancelled") return "已取消";
    var minutes = estimateMinutes(order, orders);
    if ((status === "preparing" || status === "packing") && minutes <= 1) return "即將完成";
    if (minutes <= 0) return "即將完成";
    return "約 " + minutes + " 分";
  }

  function statusMeta(status) {
    return STATUS_META[mapLegacyStatus(status)] || STATUS_META.new;
  }

  function buildTimelineUpdates(order, nextStatus) {
    var updates = {
      status: nextStatus,
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      estimated_minutes: STATUS_DEFAULT_MINUTES[nextStatus] != null ? STATUS_DEFAULT_MINUTES[nextStatus] : 0
    };
    if (!order.created_at && !order.raw.createdAt && !order.raw.created_at) {
      updates.created_at = serverTimestamp();
      updates.createdAt = serverTimestamp();
    }
    if (nextStatus === "accepted") {
      updates.accepted_at = serverTimestamp();
    }
    if ((nextStatus === "preparing" || nextStatus === "cooking") && !order.started_at) {
      updates.started_at = serverTimestamp();
      updates.startedAt = serverTimestamp();
    }
    if (nextStatus === "packing") {
      updates.packed_at = serverTimestamp();
      updates.packedAt = serverTimestamp();
    }
    if (nextStatus === "ready") {
      updates.ready_at = serverTimestamp();
      updates.readyAt = serverTimestamp();
    }
    if (nextStatus === "completed") {
      updates.completed_at = serverTimestamp();
      updates.completedAt = serverTimestamp();
      if (!order.ready_at) {
        updates.ready_at = serverTimestamp();
        updates.readyAt = serverTimestamp();
      }
    }
    if (nextStatus === "picked_up") {
      updates.picked_up_at = serverTimestamp();
      updates.pickedUpAt = serverTimestamp();
    }
    if (nextStatus === "cancelled") {
      updates.cancelled_at = serverTimestamp();
      updates.cancelledAt = serverTimestamp();
    }
    return updates;
  }

  function subscribeStoreOrders(options) {
    var db = options.db;
    var storeId = options.storeId;
    return db.collection("orders").where("storeId", "==", storeId).onSnapshot(function (snapshot) {
      var orders = snapshot.docs.map(function (doc) {
        return normalizeOrder(doc.data(), doc.id);
      });
      console.log("[Orders] Snapshot received.", { storeId: storeId, count: orders.length });
      if (typeof options.onData === "function") options.onData(orders);
    }, function (error) {
      console.error("[Orders] Snapshot failed.", error);
      if (typeof options.onError === "function") options.onError(error);
    });
  }

  async function updateOrderStatus(options) {
    var db = options.db;
    var orderId = options.orderId;
    var storeId = options.storeId;
    var nextStatus = mapLegacyStatus(options.nextStatus);
    console.log("[Orders] Updating status.", { orderId: orderId, storeId: storeId, nextStatus: nextStatus });
    var ref = db.collection("orders").doc(orderId);
    await db.runTransaction(async function (tx) {
      var snap = await tx.get(ref);
      if (!snap.exists) throw new Error("找不到訂單資料");
      var order = normalizeOrder(snap.data(), snap.id);
      if (storeId && order.storeId !== storeId) throw new Error("訂單不屬於目前門市");

      var prevStatus = order.status;
      var updates = buildTimelineUpdates(order, nextStatus);

      if (!order.inventoryAdjusted && ["accepted", "preparing", "cooking", "packing", "ready", "picked_up"].indexOf(nextStatus) >= 0) {
        order.items.forEach(function (item) {
          var sku = item.sku || item.itemId;
          if (!sku || !item.qty) return;
          tx.set(db.collection("inventory").doc(order.storeId + "_" + sku), {
            storeId: order.storeId,
            itemId: sku,
            stock: firebase.firestore.FieldValue.increment(-Math.abs(Number(item.qty || 0))),
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        updates.inventoryAdjusted = true;
      }

      if (!order.pointsGranted && nextStatus === "completed" && order.userId) {
        var pointRule = options.pointRule || { amountPerPoint: 100, pointsPerUnit: 1 };
        var amountPerPoint = Number(pointRule.amountPerPoint || (pointRule.spendX_getY && pointRule.spendX_getY.x) || 100) || 100;
        var pointsPerUnit = Number(pointRule.pointsPerUnit || (pointRule.spendX_getY && pointRule.spendX_getY.y) || 1) || 1;
        var earnedPoints = Math.floor(Number(order.total || 0) / amountPerPoint) * pointsPerUnit;
        var userRef = db.collection("users").doc(order.userId);
        var userSnap = await tx.get(userRef);
        var currentPoints = userSnap.exists ? Number(userSnap.data().currentPoints || userSnap.data().points || 0) : 0;
        tx.set(userRef, {
          memberId: order.memberId || order.userId,
          userId: order.userId,
          storeId: order.storeId,
          name: order.customer_name || "",
          lineUserId: order.lineUserId || "",
          currentPoints: firebase.firestore.FieldValue.increment(earnedPoints),
          totalEarnedPoints: firebase.firestore.FieldValue.increment(earnedPoints),
          points: firebase.firestore.FieldValue.increment(earnedPoints),
          lastPointAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });

        var pointLogPayload = {
          userId: order.userId,
          lineUserId: order.lineUserId || "",
          storeId: order.storeId,
          orderId: orderId,
          delta: earnedPoints,
          amount: earnedPoints,
          beforePoints: currentPoints,
          afterPoints: currentPoints + earnedPoints,
          reason: "order_complete",
          source: "system",
          operator: options.actorUid || "system",
          operatorName: options.actorName || "",
          createdAt: serverTimestamp()
        };
        var txnId = "pt_" + orderId + "_" + Date.now();
        tx.set(db.collection("point_transactions").doc(txnId), pointLogPayload);
        tx.set(db.collection("point_logs").doc(txnId), pointLogPayload);
        updates.pointsGranted = true;
        updates.earnedPoints = earnedPoints;
      }

      if (nextStatus === "cancelled" && options.cancelReason) {
        updates.cancel_reason = options.cancelReason;
      }
      if (options.actorUid) updates.last_status_actor_uid = options.actorUid;
      if (options.actorName) updates.last_status_actor_name = options.actorName;
      tx.set(ref, updates, { merge: true });

      // Write order_event for status change
      var eventRef = db.collection("order_events").doc();
      tx.set(eventRef, buildOrderEventPayload({
        orderId: orderId,
        storeId: order.storeId,
        type: "status_changed",
        actorType: options.actorType || "staff",
        actorId: options.actorUid || "",
        actorName: options.actorName || "",
        fromStatus: prevStatus,
        toStatus: nextStatus,
        message: ""
      }));
    });
  }

  function safeName(order) {
    return order.display_name || order.customer_name || order.label || order.id;
  }

  function itemSummary(items, maxLines) {
    var normalized = Array.isArray(items) ? items.map(normalizeItem) : [];
    var lines = normalized.slice(0, maxLines || normalized.length).map(function (item) {
      var detail = [];
      if (item.flavor) detail.push(item.flavor);
      if (item.staple) detail.push("主食：" + item.staple);
      if (Array.isArray(item.options) && item.options.length) {
        detail.push(item.options.map(function (option) {
          return typeof option === "string" ? option : (option.value ? option.name + "：" + option.value : option.name || option.label || "");
        }).filter(Boolean).join(" / "));
      }
      return item.name + " x" + Number(item.qty || 0) + (detail.length ? "（" + detail.join("／") + "）" : "");
    });
    if (normalized.length > lines.length) lines.push("...還有 " + (normalized.length - lines.length) + " 項");
    return lines;
  }

  window.LeLeShanOrders = {
    PUBLIC_BOARD_STATUSES: PUBLIC_BOARD_STATUSES,
    ACTIVE_QUEUE_STATUSES: ACTIVE_QUEUE_STATUSES,
    KDS_ACTIVE_STATUSES: KDS_ACTIVE_STATUSES,
    mapLegacyStatus: mapLegacyStatus,
    sourceLabel: sourceLabel,
    normalizeItem: normalizeItem,
    normalizeOrder: normalizeOrder,
    buildCreatePayload: buildCreatePayload,
    buildOrderItemsPayload: buildOrderItemsPayload,
    buildOrderEventPayload: buildOrderEventPayload,
    sortOrdersByCreatedAsc: sortOrdersByCreatedAsc,
    estimateMinutes: estimateMinutes,
    etaText: etaText,
    statusMeta: statusMeta,
    buildTimelineUpdates: buildTimelineUpdates,
    subscribeStoreOrders: subscribeStoreOrders,
    updateOrderStatus: updateOrderStatus,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    formatTime: formatTime,
    elapsedMinutes: elapsedMinutes,
    isFutureScheduled: isFutureScheduled,
    getKdsTimingMeta: getKdsTimingMeta,
    getKdsTimingRules: getKdsTimingRules,
    DEFAULT_KDS_TIMING_RULES: DEFAULT_KDS_TIMING_RULES,
    estimateOrderPrepMinutes: estimateOrderPrepMinutes,
    collectOrderItemNames: collectOrderItemNames,
    collectOrderItemProbes: collectOrderItemProbes,
    matchLongCookItems: matchLongCookItems,
    getOrderGroupCount: getOrderGroupCount,
    getOrderItemCount: getOrderItemCount,
    calcAmountTiered: calcAmountTiered,
    calcExtraLargeMinutes: calcExtraLargeMinutes,
    getQueueBaseMinutes: getQueueBaseMinutes,
    buildKdsQueueInfo: buildKdsQueueInfo,
    hasLockedTiming: hasLockedTiming,
    normalizeLockedTiming: normalizeLockedTiming,
    computeOrderTimingLock: computeOrderTimingLock,
    ensureOrderTimingLocked: ensureOrderTimingLocked,
    safeName: safeName,
    itemSummary: itemSummary,
    toDate: toDate,
    toMillis: toMillis
  };
})();
