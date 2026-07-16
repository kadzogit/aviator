import { db, FieldValue } from "../lib/firebase.js";
import nestlink from "../lib/nestlink.js";

export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");

if (req.method !== "GET") {
return res.status(405).json({ error: "Method not allowed" });
}

const { transactionId } = req.query;

if (!transactionId) {
return res.status(400).json({
error: "Missing transactionId",
});
}

try {
const txnRef = db.collection("transactions").doc(transactionId);
const txnDoc = await txnRef.get();

```
if (!txnDoc.exists) {
  return res.status(404).json({
    error: "Transaction not found",
  });
}

const txn = txnDoc.data();

if (txn.status === "success") {
  return res.status(200).json({
    status: "success",
    transaction: txn,
  });
}

const result = await nestlink.trackTransaction(transactionId);

const paid =
  result?.paid === true ||
  result?.data?.paid === true ||
  result?.result?.paid === true;

if (paid && txn.status !== "success") {
  await txnRef.update({
    status: "success",
    completedAt: new Date().toISOString(),
    nestlinkResponse: result,
  });

  await db.collection("users").doc(txn.uid).update({
    balance: FieldValue.increment(Number(txn.amount)),
  });

  return res.status(200).json({
    status: "success",
    credited: true,
  });
}

return res.status(200).json({
  status: txn.status,
  paymentResult: result,
});
```

} catch (e) {
console.error("NestLink status error:", e);

```
return res.status(500).json({
  error: e.message,
});
```

}
}
