export default function handler(req, res) {
  res.status(200).json({
    status: "online",
    message: "Aviator Game API is running.",
    endpoints: ["/api/deposit", "/api/withdraw", "/api/ipn", "/api/history"]
  });
}
