import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfivn2i1Z1mfvNjk-q9voFv8GwA28jaco",
  authDomain: "kl-cricket.firebaseapp.com",
  projectId: "kl-cricket",
  storageBucket: "kl-cricket.firebasestorage.app",
  messagingSenderId: "629298214411",
  appId: "1:629298214411:web:69ae79b1f85ce3c9f3b90e",
  measurementId: "G-41G94HJFEQ"
};

// Initialize Firebase
let app, db, rtdb, auth, analytics;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    rtdb = getDatabase(app);
    auth = getAuth(app);
    analytics = getAnalytics(app);
    
    // Sign in anonymously for easy access to read/write data
    signInAnonymously(auth).catch((error) => {
        console.error("Anonymous auth failed:", error);
    });
} catch(e) {
    console.error("Firebase init failed:", e);
}

export { db, rtdb, auth };
