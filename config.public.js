// US→Asia 遷移：切換新專案時同步改 functionsRegion / firebaseConfig / store.siteUrl。
// 所有 callable 呼叫都透過 window.APP_CONFIG.functionsRegion 讀取（見 liff-ordering 各 client *.js）。
window.APP_CONFIG = {
  liffId: "2008047700-HIAn2llR",
  functionsRegion: "us-central1",
  firebaseConfig: {
    apiKey: "AIzaSyCM4lo9QE5JvG7DFRtoWjw88t3CuLQDtxc",
    authDomain: "leleshan-order.firebaseapp.com",
    projectId: "leleshan-order",
    storageBucket: "leleshan-order.firebasestorage.app",
    messagingSenderId: "725150919521",
    appId: "1:725150919521:web:3b3824f60d32b092d87320",
    measurementId: "G-RD1HL8ZFKV"
  },
  store: {
    name: "璅?撅?皝舀遠撌",
    orderCollection: "orders",
    siteUrl: "https://leleshan-order.web.app",
    defaultStoreId: "store_1"
  },
  googlePlaces: {
    placeId: "ChIJC9xYBNw1aDQRXwaH1BnkK6w",
    apiKey: "AIzaSyCM4lo9QE5JvG7DFRtoWjw88t3CuLQDtxc"
  }
};
