# 樂樂山 LIFF 點餐系統

這個版本已經填入正式設定，可直接部署到 Firebase Hosting。

## 已完成

- LIFF ID 已設定：`2008047700-HIAn2llR`
- Firebase 已初始化
- Firestore 寫入 collection：`orders`
- 可在 LINE 內讀取 `profile.displayName`
- 純前端版本，沒有使用 npm、Node server

## 主要檔案

- `index.html`
- `app.js`
- `config.js`
- `styles.css`
- `firebase.json`
- `.firebaserc`

## 訂單寫入格式

送出後會寫入 Firestore `orders`，欄位包含：

- `userName`
- `lineDisplayName`
- `lineUserId`
- `items`
- `note`
- `totalAmount`
- `totalQuantity`
- `source`
- `createdAt`

## 部署方式

如果你的電腦已安裝 Firebase CLI，直接在這個資料夾執行：

```bash
firebase deploy
```

## 重要提醒

要能正式寫入 Firestore，Firebase 專案的 Firestore 規則必須允許前端頁面新增 `orders` 文件。若你還沒設定規則，前端會初始化成功，但送單時會被 Firestore 拒絕。

至少要確認 LIFF Endpoint URL 與實際部署網址一致：

- `https://leleshan-system.web.app`

如果你要，我下一步可以直接幫你再補：

1. 訂單後台管理頁
2. Firestore 安全規則
3. 出餐狀態更新功能
