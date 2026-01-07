// ================================================
// FILE: firebase_config.js (新規作成)
// ================================================
// Firebase SDKの設定と初期化
// 注意: Firebaseコンソール > Project Settings > General > Your apps から
// CDN版の設定を取得して書き換えてください。

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLO9xDiYRKqoBO6p8f9WEjMUsPJ_qym-Y",
  authDomain: "egzyda.firebaseapp.com",
  projectId: "egzyda",
  storageBucket: "egzyda.firebasestorage.app",
  messagingSenderId: "953734376474",
  appId: "1:953734376474:web:7f295970f1797cb0b775a3",
  measurementId: "G-0HM94115X8"
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