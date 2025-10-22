//src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

// Read from Vite env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // optional
};

// Initialize once
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persist sessions across tabs/reloads (prevents “logout” blips on tab switch)
try {
  setPersistence(auth, browserLocalPersistence);
} catch (_) {
  // ignore (SSR or unsupported env)
}

// (Optional) Analytics — only in the browser
export let analytics = undefined;
if (typeof window !== "undefined" && firebaseConfig.measurementId) {
  // Lazy-load to avoid pulling analytics during SSR/build
  import("firebase/analytics").then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  }).catch(() => {});
}
