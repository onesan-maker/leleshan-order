export {};

declare global {
  interface Window {
    APP_CONFIG: {
      liffId: string;
      functionsRegion: string;
      firebaseConfig: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
      };
      store: { name: string; orderCollection: string; siteUrl: string; defaultStoreId: string };
      googlePlaces: { placeId: string; apiKey: string };
    };
    /** Firebase compat shim — injected by src/lib/firebase.ts after modular SDK initializes */
    __posv2_sts?: () => unknown;
  }
}
