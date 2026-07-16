import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyAvZEzj4bGQMIjLu5Z5o8lq_nm7M8Es8s4",
  authDomain:        "aviator-6827d.firebaseapp.com",
  projectId:         "aviator-6827d",
  storageBucket:     "aviator-6827d.firebasestorage.app",
  messagingSenderId: "183407795313",
  appId:             "1:183407795313:web:f4af116bd1cdc7ee604fd0",
  measurementId:     "G-M7LEMFL0Q9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
