// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// تكوين Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC4lRLZEIaHDfeoigFxvjqQhxbIkU9NUuE",
    authDomain: "hala9i.firebaseapp.com",
    projectId: "hala9i",
    storageBucket: "hala9i.appspot.com",
    messagingSenderId: "1068748204618",
    appId: "1:1068748204618:web:238df060c97d48a735d4b3",
    measurementId: "G-2Y45YBERGG"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();  // استدعاء getAuth بدون باراميتر
auth.useDeviceLanguage();  // استخدام لغة الجهاز

const db = getFirestore(app);

export { auth, db };
