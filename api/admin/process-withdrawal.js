import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import IntaSend from "intasend-node";

// ── Firebase Admin init ──────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64 || "", "base64").toString("utf8");
    if (!projectId || !clientEmail || !privateKey) throw new Error("Missing Firebase Admin credentials");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

// ── IntaSend client ──────────────────────────────────────────
const intasend = new IntaSend(
  process.env.INTASEND_PUBLISHABLE_KEY,
  process.env.INTASEND_SECRET_KEY,
  process.env.INTASEND_TEST_MODE === "true"
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { adminUid, transactionId, action, note } = req.body;

  if (!adminUid || !transactionId || !action)
    return res.status(400).json({ error: "Missing: adminUid, transactionId, action" });
  if (!["approve", "decline"].includes(action))
    return res.status(400).json({ error: "action must be 'approve' or 'decline'" });

  try {
    const db = getDb();

    // ── Verify admin or superadmin ──────────────────────────
    const adminDoc = await db.collection("users").doc(adminUid).get();
    if (!adminDoc.exists || !["admin","superadmin"].includes(adminDoc.data().role))
      return res.status(403).json({ error: "Unauthorized — admin only" });

    // ── Fetch transaction ───────────────────────────────────
    const txnRef = db.collection("transactions").doc(transactionId);
    const txnDoc = await txnRef.get();
    if (!txnDoc.exists) return res.status(404).json({ error: "Transaction not found" });

    const txn = txnDoc.data();
    if (txn.type !== "withdraw")  return res.status(400).json({ error: "Not a withdrawal" });
    if (txn.status !== "pending") return res.status(400).json({ error: `Already ${txn.status}` });

    const now = new Date().toISOString();

    // ── DECLINE — refund held balance ───────────────────────
    if (action === "decline") {
      await db.runTransaction(async (t) => {
        t.update(db.collection("users").doc(txn.uid), {
          balance: FieldValue.increment(txn.amount),
        });
        t.update(txnRef, {
          status:      "declined",
          adminNote:   note || null,
          processedAt: now,
          processedBy: adminUid,
        });
      });
      return res.status(200).json({
        status:  "declined",
        message: "Withdrawal declined. Balance refunded to user.",
      });
    }

    // ── APPROVE — trigger IntaSend M-PESA B2C payout ────────
    const sendMoney = intasend.sendMoney();
    const response  = await sendMoney.mpesa({
      currency:     txn.currency,
      transactions: [{
        name:      txn.fullName || "Player",
        account:   txn.phoneNumber,
        amount:    txn.amount,
        narrative: "Aviator withdrawal payout",
      }],
    });

    await txnRef.update({
      status:            "approved",
      adminNote:         note || null,
      processedAt:       now,
      processedBy:       adminUid,
      intasendPayoutRef: response?.tracking_id || response?.id || null,
    });

    return res.status(200).json({
      status:  "approved",
      message: `Payout of ${txn.amount} ${txn.currency} initiated to ${txn.phoneNumber}.`,
      intasendRef: response?.tracking_id || response?.id,
    });

  } catch (e) {
    console.error("process-withdrawal error:", e?.response?.data || e.message);
    return res.status(500).json({
      error: `Error: ${e?.response?.data?.message || e.message}`,
    });
  }
}
