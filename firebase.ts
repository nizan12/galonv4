import { initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBg4orJChJ8Kz4SKPFcY9aizvCub_ZgZJo",
  authDomain: "splitbillgalonschedule.firebaseapp.com",
  projectId: "splitbillgalonschedule",
  storageBucket: "splitbillgalonschedule.firebasestorage.app",
  messagingSenderId: "790325290130",
  appId: "1:790325290130:web:d79d0f39bdff31bec8b24b",
  measurementId: "G-NG78NZE1YZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);