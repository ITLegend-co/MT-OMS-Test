import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDgULIWfz-bPawZ0FeGijNE-t-04C6HABM",
  authDomain: "mt-oms-291df.firebaseapp.com",
  projectId: "mt-oms-291df",
  storageBucket: "mt-oms-291df.firebasestorage.app",
  messagingSenderId: "172779151273",
  appId: "1:172779151273:web:b3a4f8179759a0e3676eb8"
};

// Malaysia deployments normally use the Singapore RTDB endpoint.
// If your Firebase console shows another URL, change only this value.
export const databaseURL =
  localStorage.getItem("mtoms.databaseURL") ||
  "https://mt-oms-291df-default-rtdb.asia-southeast1.firebasedatabase.app";

export const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, databaseURL);
