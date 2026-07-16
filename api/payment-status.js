import { db, FieldValue } from "../lib/firebase.js";
import nestlink from "../lib/nestlink.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const { transactionId } = req.query;

  if (!transactionId) {
    return res.status(400).json({
      error: "transactionId required",
    });
  }

  try {
    const txnRef = db.collection("transactions").doc(transactionId);
    const txnDoc = await txnRef.get();

    if (!txnDoc.exists) {
      return res.status(404).json({
        error: "Transaction not found",
      });
    }

    const txn = txnDoc.data();

    const result = await nestlink.trackTransaction(transactionId);
      console.log(
      "NESTLINK TRACK RESULT:",
      JSON.stringify(result, null, 2)
      );
    const paid =
      result?.data?.paid === true ||
      result?.paid === true ||
      result?.status === "success";

    if (paid && txn.status === "pending") {
      await txnRef.update({
        status: "success",
        completedAt: new Date().toISOString(),
      });

      await db.collection("users").doc(txn.uid).update({
        balance: FieldValue.increment(txn.amount),
      });

      return res.status(200).json({
        status: "success",
        credited: true,
      });
    }

    return res.status(200).json({
      status: txn.status,
      transaction: txn,
      nestlink: result,
    });
  } catch (e) {
    console.error("Payment status error:", e.message);

    return res.status(500).json({
      error: e.message,
    });
  }
}
