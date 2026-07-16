import { db, FieldValue } from "../lib/firebase.js";
import nestlink from "../lib/nestlink.js";
import IntaSend from "intasend-node";

const MIN = { KES: 10, TZS: 10000, UGX: 3000 };

const intasend = new IntaSend(
  process.env.INTASEND_PUBLISHABLE_KEY,
  process.env.INTASEND_SECRET_KEY,
  process.env.INTASEND_TEST_MODE === "true"
);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, amount, currency, phoneNumber, method = "MPESA" } = req.body;
  // method: "MPESA" | "CARD"

  // ── Validation ────────────────────────────────────────────
  if (!uid || !amount || !currency)
    return res.status(400).json({ error: "Missing required fields: uid, amount, currency" });
  if (isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const min     = MIN[currency];
  if (!min) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
 const rounded = Number(amount);
  if (rounded < min)
    return res.status(400).json({ error: `Minimum deposit is ${min.toLocaleString()} ${currency}` });

  if (method === "MPESA" && !phoneNumber)
    return res.status(400).json({ error: "Phone number required for M-PESA" });

  let txnRef;
  try {
    // ── Fetch user ───────────────────────────────────────────
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    const appUrl = process.env.APP_URL || "https://aviator-full-project.vercel.app";

    // ── Save pending transaction ─────────────────────────────
    txnRef = db.collection("transactions").doc();
    await txnRef.set({
      id:          txnRef.id,
      uid,
      type:        "deposit",
      amount:      rounded,
      currency,
      phoneNumber: phoneNumber || null,
      method,
      status:      "pending",
      timestamp:   new Date().toISOString(),
    });

    // ── M-PESA STK Push ──────────────────────────────────────
   if (method === "MPESA") {
  const response = await nestlink.runPrompt({
    phone: phoneNumber,
    amount: rounded,
    local_id: txnRef.id,
    transaction_desc: `Deposit ${rounded} ${currency}`,
  });

  await txnRef.update({
    nestlinkRequestId: response?.data?.MerchantRequestID || null,
    nestlinkCheckoutId: response?.data?.CheckoutRequestID || null,
  });

  return res.status(200).json({
    status: "pending",
    transactionId: txnRef.id,
    confirmationLink: response?.data?.ConfirmationLink,
    message: response?.msg || "STK Push sent successfully",
  });
}

    // ── Card / Checkout Link ─────────────────────────────────
    if (method === "CARD") {
      const collection = intasend.collection();
      const response   = await collection.charge({
        first_name:   user.fullName?.split(" ")[0] || "Player",
        last_name:    user.fullName?.split(" ").slice(1).join(" ") || "",
        email:        user.email || "",
        host:         appUrl,
        method:       "CARD-PAYMENT",
        amount:       rounded,
        currency,
        api_ref:      txnRef.id,
        redirect_url: `${appUrl}/game`,
      });

      await txnRef.update({ intasendInvoiceId: response.id || null, checkoutUrl: response.url });

      return res.status(200).json({
        status:        "pending",
        transactionId: txnRef.id,
        invoiceId:     response.id,
        checkoutUrl:   response.url,
        message:       "Card payment link generated.",
      });
    }

    return res.status(400).json({ error: "Invalid method. Use MPESA or CARD." });

  } catch (e) {
    console.error("Deposit error:", e?.response?.data || e.message);
    if (txnRef) {
      await txnRef.update({ status: "failed", error: e.message }).catch(() => {});
    }
    return res.status(500).json({
      error: e?.response?.data?.message || e.message || "Deposit failed",
    });
  }
}
