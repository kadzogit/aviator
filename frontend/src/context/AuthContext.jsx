import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

// Auto-prepend country dialling code
const DIAL = { KE: "254", TZ: "255", UG: "256" };
function normalisePhone(raw, country) {
  if (!raw) return "";
  const s = raw.replace(/^\+/, "").replace(/^0/, "");
  const code = DIAL[country] || "254";
  return s.startsWith(code) ? s : code + s;
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  let unsubProfile = null;

  const unsubAuth = onAuthStateChanged(auth, (u) => {
    if (u) {
      setUser(u);

      unsubProfile = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data());
          }
        }
      );
    } else {
      setUser(null);
      setProfile(null);

      if (unsubProfile) {
        unsubProfile();
      }
    }

    setLoading(false);
  });

  return () => {
    unsubAuth();

    if (unsubProfile) {
      unsubProfile();
    }
  };
}, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setProfile(snap.data());
  }, [user]);

  async function register({ fullName, email, password, phone, country, startDemo }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const normPhone = normalisePhone(phone, country);
    const userData  = {
      uid:         cred.user.uid,
      fullName,
      email,
      phone:       normPhone,
      country,
      balance:     0,
      demoBalance: 50000,
      mode:        startDemo ? "demo" : "real",
      role:        "user",
      chatEnabled: false,
      createdAt:   serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), userData);
    setProfile(userData);
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists()) setProfile(snap.data());
  }

  async function logout()              { await signOut(auth); }
  async function resetPassword(email)  { await sendPasswordResetEmail(auth, email); }

  async function switchMode(newMode) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { mode: newMode });
    await refreshProfile();
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      register, login, logout, resetPassword,
      refreshProfile, switchMode,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
