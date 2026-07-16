const API_KEY = process.env.NESTLINK_API_KEY;

async function runPrompt({ phone, amount, local_id, transaction_desc }) {
  const response = await fetch("https://api.nestlink.co.ke/runPrompt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Secret": API_KEY,
    },
    body: JSON.stringify({
      phone,
      amount,
      local_id,
      transaction_desc,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.msg || "NestLink request failed");
  }

  return data;
}

async function trackTransaction(local_id) {
  const response = await fetch("https://api.nestlink.co.ke/trackTransaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Secret": API_KEY,
    },
    body: JSON.stringify({
      local_id,
    }),
  });

  return await response.json();
}

export default {
  runPrompt,
  trackTransaction,
};
