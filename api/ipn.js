import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, serverTimestamp } from "firebase-admin/firestore";
import IntaSend from "intasend-node";

// Robust Firebase Initialization - Consider consolidating this into a shared utility
function getFirebaseAdmin() {
  if (getApps().length) return getFirestore();
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Decode the base64 encoded private key
  const privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase credentials: Check project_id, client_email, and private_key_base64.");
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return getFirestore();
}

const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY;
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
const INTASEND_TEST_MODE = process.env.INTASEND_TEST_MODE === "true";
const INTASEND_WEBHOOK_SECRET = process.env.INTASEND_WEBHOOK_SECRET; // New environment variable for webhook challenge

const intasend = new IntaSend(
  INTASEND_PUBLISHABLE_KEY,
  INTASEND_SECRET_KEY,
  INTASEND_TEST_MODE
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirebaseAdmin();

    // 1. Webhook Challenge Verification
    if (req.body.event === "INTASEND_CHALLENGE") {
      if (req.body.challenge === INTASEND_WEBHOOK_SECRET) {
        return res.status(200).json({ status: "success", message: "Challenge accepted" });
      } else {
        console.warn("Intasend Webhook Challenge Mismatch!");
        return res.status(403).json({ status: "failed", message: "Challenge failed" });
      }
    }

    // 2. Process IPN (Instant Payment Notification)
    const { event, data } = req.body;
    const { invoice_id, state, api_ref, tracking_id, amount, currency, customer_phone, customer_email } = data;

    if (!api_ref) {
      console.warn("Intasend IPN: Missing api_ref in data", req.body);
      return res.status(400).json({ error: "Missing api_ref" });
    }

    const txnRef = db.collection("transactions").doc(api_ref);
    const txnSnap = await txnRef.get();

    if (!txnSnap.exists) {
      console.error("Intasend IPN: Transaction not found for api_ref:", api_ref);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const txn = txnSnap.data();
    let newStatus = txn.status;

    // Map Intasend states to our internal statuses
    if (state === "COMPLETE") {
      newStatus = "success";
    } else if (state === "FAILED" || state === "CANCELLED") {
      newStatus = "failed";
    } else if (state === "PENDING") {
      newStatus = "processing";
    }

    // Prevent reprocessing successful transactions
    if (txn.status === "success" && newStatus === "success") {
      return res.status(200).json({ message: "Transaction already processed" });
    }

    // Update transaction status and details
    await txnRef.update({
      status: newStatus,
      intasendStatus: state,
      intasendInvoiceId: invoice_id,
      intasendTrackingId: tracking_id,
      updatedAt: serverTimestamp(),
      // Ensure amount and currency match, or update if necessary
      amount: amount || txn.amount,
      currency: currency || txn.currency,
      phoneNumber: customer_phone || txn.phoneNumber,
      email: customer_email || txn.email,
    });

    const isDeposit = txn.type === "deposit";
    const isWithdrawal = txn.type === "withdraw";

    // Credit user balance on successful deposit
    if (isDeposit && newStatus === "success" && txn.type === "deposit") {
      await db.collection("users").doc(txn.uid).update({
        balance: FieldValue.increment(txn.amount),
      });
    }

    // For successful withdrawals, the balance would have been decremented already (held)
    // If a withdrawal fails, we need to refund the user.
    if (isWithdrawal && newStatus === "failed" && txn.type === "withdraw") {
      // Only refund if the transaction was previously marked as 'approved' or 'processing' for payout
      // and the balance was already decremented.
      if (txn.status === "approved" || txn.status === "processing") { // Assuming 'approved' means balance was held
        await db.collection("users").doc(txn.uid).update({
          balance: FieldValue.increment(txn.amount),
        });
        await txnRef.update({ adminNote: (txn.adminNote || "") + "\nRefunded due to Intasend payout failure." });
      }
    }

    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (e) {
    console.error("Intasend IPN error:", e.message, req.body);
    return res.status(500).json({ error: e.message || "Failed to process webhook" });
  }
}
