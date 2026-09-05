import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyDt0DjUhafGZ2D-co3ZhZlIde_Qe1K5trw",
  authDomain: "oni-kishin-f59b4.firebaseapp.com",
  projectId: "oni-kishin-f59b4",
  storageBucket: "oni-kishin-f59b4.firebasestorage.app",
  messagingSenderId: "523789047478",
  appId: "1:523789047478:web:c7e250d094c38abe61f817",
});

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
export const firebaseDb = getFirestore(app);
