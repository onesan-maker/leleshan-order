(function () {
  var NORMALIZED_STATUS_MAP = {
    cooking: "preparing",
    packing: "preparing",
    done: "ready",
    picked_up: "completed",
    canceled: "cancelled"
  };

  var STATUS_LABEL_MAP = {
    new: "製作中",
    accepted: "製作中",
    preparing: "製作中",
    ready: "可取餐",
    completed: "已完成",
    picked_up: "已取餐",
    cancelled: "已取消",
    unknown: "未知"
  };

  function normalize(status) {
    var key = String(status || "").trim().toLowerCase();
    if (!key) return "unknown";
    return NORMALIZED_STATUS_MAP[key] || key;
  }

  function getLabel(status) {
    var normalized = normalize(status);
    return STATUS_LABEL_MAP[normalized] || STATUS_LABEL_MAP.unknown;
  }

  function getMeta(status) {
    return {
      key: normalize(status),
      label: getLabel(status)
    };
  }

  window.LeLeShanOrderStatus = {
    normalize: normalize,
    getLabel: getLabel,
    getMeta: getMeta
  };
})();
