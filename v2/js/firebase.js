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
let firebaseInitPromise = null;

function buildFirebaseSingleton() {
  const app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  const db = getFirestore(app);
  return {
    app,
    db,
    projectId: FIREBASE_WEB_CONFIG.projectId
  };
}

export function getFirebase() {
  if (firebase) return firebase;
  firebase = buildFirebaseSingleton();
  if (!firebaseInitPromise) firebaseInitPromise = Promise.resolve(firebase);
  return firebase;
}

export async function initFirebase() {
  if (firebase) return firebase;
  if (firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = Promise.resolve()
    .then(() => {
      if (firebase) return firebase;
      firebase = buildFirebaseSingleton();
      return firebase;
    })
    .catch(error => {
      firebaseInitPromise = null;
      throw error;
    });
  return firebaseInitPromise;
}

export function getFirestoreDb() {
  return getFirebase().db;
}
