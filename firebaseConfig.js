// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAoAaYFPBYUuFoMeK7E6vKuNQZ2e2RHdVs",
  authDomain: "spotify-app-b4f9d.firebaseapp.com",
  projectId: "spotify-app-b4f9d",
  storageBucket: "spotify-app-b4f9d.firebasestorage.app",
  messagingSenderId: "45511841363",
  appId: "1:45511841363:web:a1cda054b76ff5b56458a6",
  measurementId: "G-3CXJ2CPHJT",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
