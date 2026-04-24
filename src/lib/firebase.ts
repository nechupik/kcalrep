import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

console.log('ENV CHECK:', import.meta.env.VITE_FIREBASE_API_KEY ? 'KEY EXISTS' : 'KEY MISSING');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAENoyiyZtSeqbFRjPOGTXQUymTxN5z1YU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eattrack-aaed3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eattrack-aaed3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eattrack-aaed3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "741601163782",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:741601163782:web:83fd9260578c69b43de187",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
