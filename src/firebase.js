import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configure with your Firebase credentials
const firebaseConfig = {
  apiKey: "AIzaSyB77-4gzP2tldtg_tAjQpdFXyGpaYJpxAs",
  authDomain: "ncip-wfh-dtr.firebaseapp.com",
  projectId: "ncip-wfh-dtr",
  storageBucket: "ncip-wfh-dtr.firebasestorage.app",
  messagingSenderId: "723065930450",
  appId: "1:723065930450:web:0603ce38e5da91e6d2230b"

};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

export default app;
