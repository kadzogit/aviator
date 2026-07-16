import { db, FieldValue } from "../lib/firebase.js";

// IntaSend sends webhook POST to this endpoint on payment events.
// Register this URL in IntaSend dashboard → Settings → Webhooks:
// https://aviator-full-project.vercel.app/api/webhook

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const payload = req.body;
    console.log("IntaSend webhook received:", JSON.stringify(payload));

    // IntaSend webhook body shape:
    // { invoice_id, state, api_ref, amount, currency, account, ... }
    const {
      invoice_id,
      state,
      api_ref,     // this is our txnRef.id we passed as api_ref
      amount,
      currency,
    } = payload;

    if (!api_ref) {
      console.warn("No api_ref in webhook payload");
      return res.status(200).json({ received: true }); // always 200 to IntaSend
    }

    const txnRef = db.collection("transactions").doc(api_ref);
    const txnDoc = await txnRef.get();

    if (!txnDoc.exists) {
      console.warn("Transaction not found for api_ref:", api_ref);
      return res.status(200).json({ received: true });
    }

    const txn = txnDoc.data();

    // IntaSend states: PENDING, PROCESSING, COMPLETE, FAILED, CANCELLED
    if (state === "COMPLETE") {
      await txnRef.update({
        status:      "success",
        intasendState: state,
        intasendInvoiceId: invoice_id,
        completedAt: new Date().toISOString(),
      });

      // Credit user balance for successful deposits
      if (txn.type === "deposit") {
        await db.collection("users").doc(txn.uid).update({
          balance: FieldValue.increment(txn.amount),
        });
        console.log(`Credited ${txn.amount} ${txn.currency} to user ${txn.uid}`);
      }
    } else if (state === "FAILED" || state === "CANCELLED") {
      await txnRef.update({
        status:        "failed",
        intasendState: state,
        updatedAt:     new Date().toISOString(),
      });
    } else {
      // PENDING or PROCESSING — update state only
      await txnRef.update({
        intasendState: state,
        updatedAt:     new Date().toISOString(),
      });
    }

    // Always return 200 so IntaSend stops retrying
    return res.status(200).json({ received: true, state });
  } catch (e) {
    console.error("Webhook error:", e.message);
    // Still return 200 to prevent IntaSend retry storms
    return res.status(200).json({ received: true, error: e.message });
  }
}
