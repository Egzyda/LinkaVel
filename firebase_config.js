// ================================================
// FILE: firebase_config.js (新規作成)
// ================================================
// Firebase SDKの設定と初期化
// 注意: Firebaseコンソール > Project Settings > General > Your apps から
// CDN版の設定を取得して書き換えてください。

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebaseの初期化 (Compat版)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  
  // グローバル変数として公開
  window.db = firebase.firestore();
  window.auth = firebase.auth();
  
  console.log("Firebase Initialized.");
} else {
  console.error("Firebase SDK not loaded.");
}