// US→Asia 遷移：切換新專案時同步改 functionsRegion / firebaseConfig / store.siteUrl。
// 所有 callable 呼叫都透過 window.APP_CONFIG.functionsRegion 讀取（見 liff-ordering 各 client *.js）。
window.APP_CONFIG = {
  liffId: "2008047700-HIAn2llR",
  functionsRegion: "asia-east1",
  firebaseConfig: {
    apiKey: "AIzaSyClnMaU0rW8QSWdOoNL5GROgnsM0l-lixI",
    authDomain: "leleshan-system.firebaseapp.com",
    projectId: "leleshan-system",
    storageBucket: "leleshan-system.firebasestorage.app",
    messagingSenderId: "806566521240",
    appId: "1:806566521240:web:bcf7ff0c02f9cd5124a3ed"
  },
  store: {
    name: "樂樂山 湯滷川味",
    orderCollection: "orders",
    siteUrl: "https://leleshan-system.web.app",
    defaultStoreId: "store_1"
  },
  googlePlaces: {
    placeId: "ChIJC9xYBNw1aDQRXwaH1BnkK6w",
    apiKey: "AIzaSyClnMaU0rW8QSWdOoNL5GROgnsM0l-lixI"
  }
};
