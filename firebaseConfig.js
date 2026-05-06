// SC/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4whQds7SyCu8a_T0T7dW7IZXn15kY_Yk",
  authDomain: "ai-app-class1.firebaseapp.com",
  projectId: "ai-app-class1",
  storageBucket: "ai-app-class1.firebasestorage.app",
  messagingSenderId: "1054359784208",
  appId: "1:1054359784208:web:85407a52d0daf78a987395",
  measurementId: "G-2KFYE1FNEN",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
