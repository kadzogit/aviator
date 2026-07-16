import { db, FieldValue } from "../lib/firebase.js";

const MIN = { KES: 10, TZS: 10000, UGX: 3000 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, amount, currency, phoneNumber } = req.body;

  if (!uid || !amount || !currency)
    return res.status(400).json({ error: "Missing fields: uid, amount, currency" });
  if (isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const min     = MIN[currency];
  if (!min) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
  const rounded = Math.round(Number(amount) / 10) * 10;
  if (rounded < min)
    return res.status(400).json({ error: `Minimum withdrawal is ${min.toLocaleString()} ${currency}` });

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const user = userDoc.data();
    if (rounded > (user.balance || 0))
      return res.status(400).json({ error: "Insufficient balance" });

    const phone = phoneNumber || user.phone;
    if (!phone) return res.status(400).json({ error: "No phone number provided" });

    // Atomic: deduct balance + create transaction
    const txnRef = db.collection("transactions").doc();
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const bal  = snap.data().balance || 0;
      if (rounded > bal) throw new Error("Insufficient balance");
      t.update(userRef, { balance: bal - rounded });
      t.set(txnRef, {
        id:           txnRef.id,
        uid,
        type:         "withdraw",
        amount:       rounded,
        currency,
        phoneNumber:  phone,
        fullName:     user.fullName || "",
        email:        user.email    || "",
        status:       "pending",
        adminNote:    null,
        requestedAt:  new Date().toISOString(),
        timestamp:    new Date().toISOString(),
      });
    });

    return res.status(200).json({
      status:        "pending",
      transactionId: txnRef.id,
      message:       `Withdrawal of ${rounded.toLocaleString()} ${currency} submitted. Pending admin approval.`,
    });
  } catch (e) {
    console.error("Withdraw error:", e.message);
    return res.status(500).json({ error: e.message || "Withdrawal failed" });
  }
}
