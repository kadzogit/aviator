import { db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

export async function logAdminAction(
  adminUid,
  adminName,
  action,
  targetUid = "",
  details = ""
) {
  try {
    await addDoc(collection(db, "adminLogs"), {
      adminUid,
      adminName,
      action,
      targetUid,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Admin log error:", error);
  }
}
