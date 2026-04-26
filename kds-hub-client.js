/* ════════════════════════════════════════════════════════════════
   kds-hub-client.js — W11-B 雙 IP Hub 連線用戶端（IIFE）
   暴露 window.LELESHAN_HUB，供 kds.js / pickup-board.js 使用。

   主 URL：http://100.72.80.2:8080   （Tailscale — 跨地點可達）
   備 URL：http://192.168.1.50:8080   （店內區網 — 本地永遠可達）

   策略：
   - 每次請求先試「preferred」URL（初始為主）。
   - 失敗（timeout 5 s 或網路錯誤）→ 自動切換到另一個。
   - 切換成功後 sticky 保留，30 s 後才再試主 URL。
   - 兩個都失敗才拋出 HubUnavailableError。
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var HUB_URLS = [
    'http://100.72.80.2:8080',    /* 0 — 主 (Tailscale)  */
    'http://192.168.1.50:8080'    /* 1 — 備 (店內區網)   */
  ];
  var HUB_TIMEOUT        = 5000;   /* ms — 每個 URL 的 timeout */
  var PRIMARY_RECHECK_MS = 30000;  /* ms — 30 s 後才再試回主 URL */

  var preferredIdx     = 0;
  var lastPrimaryCheck = 0;

  /**
   * 嘗試單一 URL；回傳 Promise<Response>。
   * 失敗（包括 abort）一律 reject。
   */
  function tryUrl(baseUrl, path, init) {
    return new Promise(function (resolve, reject) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, HUB_TIMEOUT);
      var mergedInit = Object.assign({}, init, { signal: controller.signal });
      fetch(baseUrl + path, mergedInit)
        .then(function (res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function (e) {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  /**
   * 主要對外 API：hubFetch(path, init?) → Promise<Response>
   * 語意與 fetch() 相同，但自動處理雙 URL fallback。
   */
  async function hubFetch(path, init) {
    var now      = Date.now();
    var startIdx = preferredIdx;

    /* 30 s 後嘗試回主 URL（若目前不在主） */
    if (preferredIdx !== 0 && (now - lastPrimaryCheck) >= PRIMARY_RECHECK_MS) {
      startIdx        = 0;
      lastPrimaryCheck = now;
    }

    /* 建立嘗試順序：startIdx 優先，其餘依序附後 */
    var tryOrder = [startIdx];
    for (var i = 0; i < HUB_URLS.length; i++) {
      if (i !== startIdx) tryOrder.push(i);
    }

    var lastErr = null;
    for (var j = 0; j < tryOrder.length; j++) {
      var idx = tryOrder[j];
      try {
        var res = await tryUrl(HUB_URLS[idx], path, init);
        /* 成功：更新 preferred（若有切換） */
        if (preferredIdx !== idx) {
          console.log('[LELESHAN_HUB] switched to', HUB_URLS[idx]);
          preferredIdx = idx;
        }
        return res;
      } catch (e) {
        lastErr = e;
        console.warn(
          '[LELESHAN_HUB]', HUB_URLS[idx] + path,
          'failed:', (e && e.message) || String(e)
        );
      }
    }

    /* 兩個都失敗 */
    var errMsg = (lastErr && lastErr.message) || String(lastErr) || 'unknown';
    var err = new Error('[LELESHAN_HUB] All URLs unavailable. Last: ' + errMsg);
    err.name = 'HubUnavailableError';
    throw err;
  }

  /* 公開 API */
  window.LELESHAN_HUB = {
    /** 主要方法：與 fetch(path, init) 同介面，自動 fallback */
    fetch: hubFetch,
    /** 目前偏好的 base URL */
    getPreferredUrl: function () { return HUB_URLS[preferredIdx]; },
    /** 所有設定的 URL 列表 */
    getAllUrls: function () { return HUB_URLS.slice(); }
  };
})();
