import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDgULIWfz-bPawZ0FeGijNE-t-04C6HABM",
  authDomain: "mt-oms-291df.firebaseapp.com",
  projectId: "mt-oms-291df",
  storageBucket: "mt-oms-291df.firebasestorage.app",
  messagingSenderId: "172779151273",
  appId: "1:172779151273:web:b3a4f8179759a0e3676eb8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
