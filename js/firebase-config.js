import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC2RKkuY_aEQaHVDvAt_-T_29sPQ6HUp50",
    authDomain: "calletano-restaurant.firebaseapp.com",
    projectId: "calletano-restaurant",
    storageBucket: "calletano-restaurant.firebasestorage.app",
    messagingSenderId: "1036720006578",
    appId: "1:1036720006578:web:31b305a61a353f324bb0ab",
    measurementId: "G-VBPRFGMZ1J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const appFirebase = app;

// Analytics a prueba de bloqueos
import("https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js")
    .then((module) => {
        module.getAnalytics(app);
        console.log("Analytics activado.");
    })
    .catch(() => {
        console.warn("Analytics bloqueado por privacidad (Safari/AdBlocker).");
    });