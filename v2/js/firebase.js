import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export const FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyDt0DjUhafGZ2D-co3ZhZlIde_Qe1K5trw",
  authDomain: "oni-kishin-f59b4.firebaseapp.com",
  projectId: "oni-kishin-f59b4",
  storageBucket: "oni-kishin-f59b4.firebasestorage.app",
  messagingSenderId: "523789047478",
  appId: "1:523789047478:web:c7e250d094c38abe61f817",
  measurementId: "G-TCZM9S9ZDT"
});

let firebase;

export function getFirebase() {
  if (firebase) return firebase;

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  const db = getFirestore(app);

  firebase = {
    app,
    db,
    projectId: FIREBASE_WEB_CONFIG.projectId
  };

  return firebase;
}

export function getFirestoreDb() {
  return getFirebase().db;
}
