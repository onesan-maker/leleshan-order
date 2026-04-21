# P2-A 追加修正 (v4 基準)

> 這份是 **P2-A 第二輪修正**。之前派發是 v3 基準，實作完部署後發現有三個視覺問題。本追加文件把基準升級為 v4，加入「compact 卡 + 欄位展開/收合」機制。
> 原 `README.md` + `P2_KDS_現場最佳化_檔案級任務包.md` 仍然有效，本文件為**增量補充**。

---

## 🎯 本輪要修的三個問題

### 問題 1：標題列不會隨視窗縮放
**現況**：`ops.css` 中 `body.kds-has-stats-bar .ops-topbar` 寫死 `height:48px`、`.kds-bar__brand` 寫死 `font-size:16px`、`.kds-bar__logo` 寫死 `28px`。視窗縮放時標題列不跟著變。

**修正**（`ops.css` 約 L880–L930）：
```css
body.kds-has-stats-bar .ops-topbar {
  height: clamp(40px, 4.5vh, 56px);
  min-height: clamp(40px, 4.5vh, 56px);
  max-height: clamp(40px, 4.5vh, 56px);
  padding: 0 clamp(10px, 1.2vw, 20px);
  gap: clamp(8px, 1vw, 16px);
  /* 其餘屬性不動 */
}
.kds-bar__brand { font-size: clamp(13px, 1.2vw, 17px); }
.kds-bar__logo  {
  width: clamp(22px, 2.2vw, 30px);
  height: clamp(22px, 2.2vw, 30px);
  font-size: clamp(11px, 1vw, 14px);
}
.kds-bar__live,
.kds-bar__info,
.kds-bar__update { font-size: clamp(10px, 0.9vw, 13px); }
```

---

### 問題 2：pending 卡太大 + 該用網格排列 + 只顯示最少資訊
**現況**：
- `renderCard()` 的 `isPending` 分支雖然隱藏了品項，但還是有 wait-bar 倒數、`⚠請確認` 浮標、「長按」副標等多餘元素
- `.kds-col__body` 是 `flex-direction:column`，卡片只會縱向堆疊，不是網格

**修正**：新增 **compact 卡**，未展開欄位所有卡都用它渲染。

#### 2-A. 在 `kds.js` 新增 `renderCardCompact(order)` 函式

放在既有 `renderCard(order)` 之後。參考 `KDS 可展開三欄 v4.html` 的 `cardCompactTpl()`（約 L1760–L1800）。

```js
function renderCardCompact(order) {
  var helpers   = window.LeLeShanOrders;
  var status    = order.status;
  var isPending = status === "pending_confirmation" || status === "new";
  var statusKey = isPending ? "pending"
    : status === "ready" ? "ready"
    : status === "preparing" ? "preparing" : "accepted";
  var wait  = getWaitInfo(order);
  var total = Number(order.total || 0);
  var primary = (STATUS_ACTIONS[status] || [])[0] || null;

  var ctaClass = "";
  if (primary) {
    if (primary.next === "accepted")       ctaClass = "accept";
    else if (primary.next === "ready")     ctaClass = "ready";
    else if (primary.next === "completed") ctaClass = "pickup";
  }

  var ctaHtml = primary
    ? '<button class="kds-btn kds-btn--main ' + ctaClass + '" type="button" ' +
        'data-order-id="' + esc(order.id) + '" ' +
        'data-next-status="' + esc(primary.next) + '">' + esc(primary.label) + '</button>'
    : '<button class="kds-btn kds-btn--main pickup" type="button" disabled style="opacity:0.5">—</button>';

  return '<article class="kds-card kds-card--compact kds-card--' + statusKey + '" data-id="' + esc(order.id) + '">' +
    '<div class="kds-card__hero">' +
      '<div class="kds-card__wait-bar ' + esc(wait.cls) + '">' + esc(wait.text) + '</div>' +
      '<div class="kds-card__number" data-expand="' + statusKey + '">' + esc(getPickupNumber(order)) + '</div>' +
    '</div>' +
    '<div class="kds-card__meta kds-card__meta--compact">' +
      '<span class="kds-src kds-src--' + esc(getSourceCode(order)) + '">' + esc(getSourceLabel(order)) + '</span>' +
      '<span class="kds-card__name">' + esc(getCustomerName(order)) + '</span>' +
    '</div>' +
    '<div class="kds-card__amount">$ ' + total.toLocaleString() + '</div>' +
    '<div class="kds-card__cta">' + ctaHtml +
      '<button class="kds-btn kds-btn--sub" type="button" data-cancel-order="true" data-order-id="' + esc(order.id) + '">✕</button>' +
    '</div>' +
    '</article>';
}
```

#### 2-B. 在 `ops.css` 檔尾追加 compact 卡樣式

```css
/* ─── compact 卡（收合欄用） ─── */
.kds-card--compact { display: flex; flex-direction: column; overflow: hidden; }
.kds-card--compact .kds-card__hero { padding: 8px 10px 4px; }
.kds-card--compact .kds-card__number {
  font-size: clamp(28px, 3.5vw, 42px); line-height: 1;
  cursor: pointer; transition: transform 150ms;
}
.kds-card--compact .kds-card__number:hover { transform: scale(0.96); opacity: 0.85; }
.kds-card--compact .kds-card__meta--compact { padding: 2px 10px 4px; font-size: 12px; }
.kds-card--compact .kds-card__name { font-weight: 800; color: var(--kds-text); }
.kds-card--compact .kds-card__amount {
  padding: 4px 10px 10px;
  font-size: clamp(14px, 1.4vw, 18px);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.kds-card--compact .kds-card__cta { height: 48px; min-height: 48px; margin-top: auto; }
.kds-card--compact .kds-card__cta .kds-btn--main { height: 48px; font-size: 15px; }
.kds-card--compact .kds-card__cta .kds-btn--sub  { height: 48px; width: 48px; font-size: 16px; }
.kds-card--compact .kds-card__cta .kds-btn--sub::after { font-size: 8px; bottom: 4px; }
.kds-card--compact .kds-card__wait-bar { font-size: 11px; padding: 1px 6px; top: 6px; right: 6px; }

/* compact 狀態下不要紅色脈動光暈、不要 ⚠請確認 浮標 */
.kds-card--compact.kds-card--pending { animation: none; border-width: 2px; }
.kds-card--compact.kds-card--pending .kds-card__hero::before { display: none; }

/* 未展開欄：2 欄網格（壓過既有 flex-direction:column）*/
.kds-col:not(.kds-is-expanded) .kds-col__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 8px 44px;
  align-content: start;
}
```

---

### 問題 3：完全缺少欄位展開/收合機制
點欄位 header 應該把該欄展開（另兩欄縮成 60px 直寫細條）。展開欄的卡用既有 `renderCard()`（完整品項 + 大 CTA），其他欄用 compact。

#### 3-A. `kds.js` 頂部（IIFE 內）新增狀態

```js
var expandedCol = null;  // null | "pending" | "work" | "ready"
```

#### 3-B. 改寫 `render()` 的渲染迴圈

```js
["pending", "work", "ready"].forEach(function (k) {
  var col  = document.getElementById("kds-col-" + k);
  var body = document.getElementById("kds-body-" + k);
  var list = cols[k];

  col.classList.toggle("kds-is-expanded",  expandedCol === k);
  col.classList.toggle("kds-is-collapsed", expandedCol !== null && expandedCol !== k);

  if (list.length === 0) {
    var emptyLabel = ({ pending: "待確認", work: "製作中", ready: "可取餐" })[k];
    body.innerHTML = '<div class="kds-empty">無' + emptyLabel + '</div>';
  } else if (expandedCol === k) {
    body.innerHTML = list.map(renderCard).join("");
  } else {
    body.innerHTML = list.map(renderCardCompact).join("");
  }
  document.getElementById("kds-ct-" + k).textContent = list.length;
});
```

#### 3-C. 綁定點擊事件（init 階段，綁一次）

```js
// 點欄位 header → 切換展開/收合
document.querySelectorAll(".kds-col__head").forEach(function (h) {
  h.addEventListener("click", function () {
    var col = h.closest(".kds-col");
    var key = col.id.replace("kds-col-", "");
    expandedCol = (expandedCol === key) ? null : key;
    applyExpanded();
    render();
  });
});

// 點 compact 卡的取餐號 → 展開該欄（事件委派，避免重綁）
document.addEventListener("click", function (e) {
  var num = e.target.closest(".kds-card--compact .kds-card__number");
  if (!num) return;
  expandedCol = num.getAttribute("data-expand");
  applyExpanded();
  render();
});

function applyExpanded() {
  var board = document.getElementById("kds-board");
  var widths = {
    pending: "minmax(0, 1fr) 60px 60px",
    work:    "60px minmax(0, 1fr) 60px",
    ready:   "60px 60px minmax(0, 1fr)"
  };
  if (expandedCol) {
    board.setAttribute("data-expanded", expandedCol);
    board.style.setProperty("grid-template-columns", widths[expandedCol], "important");
  } else {
    board.removeAttribute("data-expanded");
    board.style.removeProperty("grid-template-columns");
  }
}
```

#### 3-D. `ops.css` 補收合欄樣式

```css
/* 收合欄：標題旋轉 90°（直寫）、隱藏 body */
.kds-col.kds-is-collapsed { overflow: hidden; }
.kds-col.kds-is-collapsed .kds-col__head {
  cursor: pointer;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  padding: 12px 6px;
  justify-content: flex-start;
  height: 100%;
}
.kds-col.kds-is-collapsed .kds-col__body { display: none; }
.kds-col.kds-is-collapsed .kds-col__count {
  margin: 8px auto 0;
  transform: rotate(180deg);
}
/* 展開欄的卡維持原 renderCard 樣式（已在前面定義，不用改） */
```

---

## ✅ 驗證清單

- [ ] 瀏覽器縮放 50% / 100% / 150%，標題列字體和高度**跟著縮放**（用 `clamp()` 驗證）
- [ ] 未展開：三欄皆為 2 欄網格，compact 卡**只顯示**：取餐號 / 來源+姓名 / $金額 / CTA
- [ ] compact 卡**沒有**：品項列表、`⚠請確認` 浮標、「長按」副標、「預約」標籤、紅色脈動光暈
- [ ] 點欄位 header → 該欄展開，另兩欄縮成 60px 直寫細條
- [ ] 展開欄的卡 = 原 `renderCard()` 樣式（有品項 A/B 群組、大 CTA、紅脈動效果）
- [ ] 再點同一 header 或點細條 → 收合回 3 欄網格
- [ ] 點 compact 卡的「取餐號」也會展開該欄
- [ ] 接單 / 完成出餐 / 已取餐按鈕都正常運作
- [ ] 無 console error
- [ ] 快取版本號更新為 `?v=20260419-p2a-v4`（html + css + js）

---

## 📚 參考對應表

| 實作位置 | 對應 v4 原型位置 |
|---|---|
| `renderCardCompact()` | `cardCompactTpl()` @ L1760–L1800 |
| `applyExpanded()` | `applyExpanded()` @ L1997–L2025 |
| render() 分流 | render() 內 `expandedCol === k` 判斷 @ L1897–L1913 |
| compact 卡 CSS | `.card--compact` @ L623–L666 |
| 收合欄 CSS | `.col.is-collapsed` @ L143 附近 |
| topbar clamp 縮放 | 本文件 2-A 為新增規範，v4 原型尚未套 clamp |

---

## 🚨 硬性約束（同原任務包，再次強調）
1. `renderCard()` **完全不動**（只新增 `renderCardCompact()`）
2. 按鈕 onClick 函式名稱與 state.orders 欄位完全不動
3. 所有新 class 保持 `.kds-` 前綴
4. `.ops-stats` 維持 `display:none` 不可刪
5. 編碼 UTF-8、保留 script tag 順序
6. commit：`feat(kds): P2-A v4 展開收合與 compact 卡`
