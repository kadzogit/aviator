import { db } from "../lib/firebase.js";
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const [betsSnap, txnSnap] = await Promise.all([
      db.collection("bets")
        .where("uid", "==", uid)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get(),
      db.collection("transactions")
        .where("uid", "==", uid)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get(),
    ]);

    return res.status(200).json({
      bets:         betsSnap.docs.map(d => d.data()),
      transactions: txnSnap.docs.map(d => d.data()),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
