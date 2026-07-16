import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  collection, query, where, onSnapshot,
  orderBy, limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const MIN      = { KES: 10, TZS: 10000, UGX: 3000 };
const CURRENCY = { KE: "KES", TZ: "TZS",  UG: "UGX"  };
const DIAL     = { KE: "254", TZ: "255",  UG: "256"   };
const FLAG     = { KE: "🇰🇪",  TZ: "🇹🇿",  UG: "🇺🇬"   };

function statusColor(s) {
  if (s === "success" || s === "approved") return "#00e676";
  if (s === "declined"|| s === "failed")   return "#ff1744";
  return "#ffc107";
}
function statusLabel(s) {
  return { pending:"⏳ Pending", approved:"✅ Approved",
           declined:"❌ Declined", success:"✅ Success",
           failed:"❌ Failed" }[s] || s;
}

// ── IntaSend Payment Button initialiser ───────────────────────
// Called once user clicks "Pay with Card / M-PESA"
function openIntaSendPopup({ amount, currency, email, phone, firstName, lastName, apiRef, onComplete, onFailed }) {
  if (!window.IntaSend) {
    alert("Payment SDK not loaded. Please refresh.");
    return;
  }
  new window.IntaSend({
    publicAPIKey: "ISPubKey_live_a920434e-7123-4c26-9e30-6d01cc8befb7",
    live: true,
  })
  .on("COMPLETE", (result) => onComplete && onComplete(result))
  .on("FAILED",   (result) => onFailed  && onFailed(result))
  .on("IN-PROGRESS", () => {});

  // Trigger the embedded button click
  const btn = document.getElementById("intasend-pay-trigger");
  if (btn) btn.click();
}

export default function WalletModal({ mode, onClose }) {
  const { user, profile } = useAuth();

  const country  = profile?.country || "KE";
  const currency = CURRENCY[country] || "KES";
  const min      = MIN[currency];
  const dialCode = DIAL[country];

  const [amount,       setAmount]       = useState(min);
  const [phone,        setPhone]        = useState(profile?.phone || "");
  const [payMethod,    setPayMethod]    = useState("MPESA"); // MPESA | CARD
  const [loading,      setLoading]      = useState(false);
  const [stage,        setStage]        = useState("form");  // form|stk-sent|card-redirect|success|error
  const [message,      setMessage]      = useState("");
  const [transactionId, setTransactionId] = useState(null);
  const [txHistory,    setTxHistory]    = useState([]);
  const [showHistory,  setShowHistory]  = useState(false);

  const rounded = Number(amount);

  // Live transaction history
  useEffect(() => {
    if (!showHistory || !user) return;
    const q = query(
      collection(db, "transactions"),
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, snap =>
      setTxHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [showHistory, user]);

  // Poll payment status after STK push
  useEffect(() => {
  if (stage !== "stk-sent" || !transactionId) return;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        `/api/payment-status?transactionId=${transactionId}`
      );

      const data = await res.json();

      if (data.status === "success") {
        setStage("success");
        setMessage(
          `Deposit of ${rounded.toLocaleString()} ${currency} confirmed! Balance updated.`
        );
        clearInterval(interval);
      }

      if (data.status === "failed") {
        setStage("error");
        setMessage("Payment failed or was cancelled.");
        clearInterval(interval);
      }
    } catch (err) {
      console.error(err);
    }
  }, 4000);

  return () => clearInterval(interval);
}, [stage, transactionId, rounded, currency]);

  // ── DEPOSIT ───────────────────────────────────────────────
  async function handleDeposit() {
    if (rounded < min) return setMessage(`Minimum is ${min.toLocaleString()} ${currency}`);
    if (payMethod === "MPESA" && !phone) return setMessage("Enter your M-PESA phone number");
    setLoading(true); setMessage("");

    try {
      const res  = await fetch("/api/deposit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid:      user.uid,
          amount:   rounded,
          currency,
          method:   payMethod,
          phoneNumber: payMethod === "MPESA" ? phone : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTransactionId(data.transactionId);

      if (payMethod === "MPESA") {
        setStage("stk-sent");
      } else {
        // Card — open checkout URL in new tab
        window.open(data.checkoutUrl, "_blank");
        setStage("card-redirect");
      }
    } catch (e) {
      setMessage(e.message);
      setStage("error");
    }
    setLoading(false);
  }

  // ── WITHDRAW ──────────────────────────────────────────────
  async function handleWithdraw() {
    if (rounded < min) return setMessage(`Minimum is ${min.toLocaleString()} ${currency}`);
    if (!phone)        return setMessage("Enter your M-PESA phone number");
    if (rounded > (profile?.balance || 0)) return setMessage("Insufficient balance");
    setLoading(true); setMessage("");

    try {
      const res  = await fetch("/api/withdraw", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, amount: rounded, currency, phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStage("success");
      setMessage(`Withdrawal of ${rounded.toLocaleString()} ${currency} submitted. Pending admin approval — funds sent to ${phone} once approved.`);
    } catch (e) {
      setMessage(e.message);
      setStage("error");
    }
    setLoading(false);
  }

  const quickAmounts = [min, min * 2, min * 5, min * 10];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="modal-header">
          <h2>{mode === "deposit" ? "💳 Deposit" : "💸 Withdraw"}</h2>
          <p className="modal-sub">
            {FLAG[country]} {country === "KE" ? "Kenya" : country === "TZ" ? "Tanzania" : "Uganda"}
            &nbsp;·&nbsp; {currency}
          </p>
        </div>

        {/* Account strip */}
        <div className="modal-account-strip">
          <span>👤 {profile?.fullName}</span>
          <span style={{ color: "#a0aec0", fontSize: 11 }}>{profile?.email}</span>
          <span style={{ color: "#00e676" }}>
            Balance: {(profile?.balance || 0).toLocaleString()} {currency}
          </span>
        </div>

        {/* ── FORM ── */}
        {stage === "form" && (
          <>
            {/* Payment method toggle (deposit only) */}
            {mode === "deposit" && (
              <div className="pay-method-row">
                <button
                  className={`pay-method-btn ${payMethod === "MPESA" ? "active" : ""}`}
                  onClick={() => setPayMethod("MPESA")}
                >
                  📱 M-PESA
                </button>
                <button
                  className={`pay-method-btn ${payMethod === "CARD" ? "active" : ""}`}
                  onClick={() => setPayMethod("CARD")}
                >
                  💳 Card
                </button>
              </div>
            )}

            <label className="modal-label">
              Amount ({currency}) — min {min.toLocaleString()}
            </label>
            <div className="modal-amount-row">
              <button onClick={() => setAmount(a => Math.max(min, Math.round((a - min) / 10) * 10))}>−</button>
              <input
                type="number"
                value={amount}
                min={min}
                step={10}
                onChange={e => setAmount(Number(e.target.value))}
              />
              <button onClick={() => setAmount(a => Math.round((a + min) / 10) * 10)}>+</button>
            </div>

            <div className="modal-quick">
              {quickAmounts.map(q => (
                <button
                  key={q}
                  className={`quick-modal-btn ${amount === q ? "active" : ""}`}
                  onClick={() => setAmount(q)}
                >
                  {q.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Phone number — for MPESA or withdraw */}
            {(payMethod === "MPESA" || mode === "withdraw") && (
              <>
                <label className="modal-label">
                  M-PESA Phone &nbsp;
                  <span style={{ color: "#a0aec0", fontSize: 10 }}>+{dialCode} {FLAG[country]}</span>
                </label>
                <input
                  className="modal-input"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={`${dialCode}7XXXXXXXX`}
                />
                <p style={{ fontSize: 11, color: "#a0aec0", marginTop: -6 }}>
                  Include country code e.g. {dialCode}712345678
                </p>
              </>
            )}

            {message && <div className="modal-error">{message}</div>}

            <button
              className="modal-action-btn"
              disabled={loading || rounded < min}
              onClick={mode === "deposit" ? handleDeposit : handleWithdraw}
            >
              {loading
                ? "Processing…"
                : mode === "deposit"
                  ? payMethod === "MPESA"
                    ? `📱 Send STK Push — ${rounded.toLocaleString()} ${currency}`
                    : `💳 Pay by Card — ${rounded.toLocaleString()} ${currency}`
                  : `💸 Request Withdrawal — ${rounded.toLocaleString()} ${currency}`
              }
            </button>
          </>
        )}

        {/* ── STK SENT ── */}
        {stage === "stk-sent" && (
          <div className="modal-stk-sent">
            <div className="stk-icon">📱</div>
            <h3>STK Push Sent!</h3>
            <p className="stk-msg">
              M-PESA payment request of{" "}
              <strong>{rounded.toLocaleString()} {currency}</strong> sent to{" "}
              <strong>+{phone}</strong>.
            </p>
            <div className="stk-steps">
              <div className="stk-step">① Check your phone for the M-PESA prompt</div>
              <div className="stk-step">② Enter your <strong>M-PESA PIN</strong> to confirm</div>
              <div className="stk-step">③ Your balance updates automatically</div>
            </div>
            <div className="stk-note">⏳ Waiting for payment confirmation…</div>
            <button className="modal-action-btn secondary" onClick={onClose}>
              Close (balance updates automatically)
            </button>
          </div>
        )}

        {/* ── CARD REDIRECT ── */}
        {stage === "card-redirect" && (
          <div className="modal-stk-sent">
            <div className="stk-icon">💳</div>
            <h3>Card Payment Window Opened</h3>
            <p className="stk-msg">
              Complete your card payment of <strong>{rounded.toLocaleString()} {currency}</strong>{" "}
              in the new tab. Your balance will update automatically once confirmed.
            </p>
            <button className="modal-action-btn" onClick={onClose}>Done</button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {stage === "success" && (
          <div className="modal-success-state">
            <div className="success-icon">✅</div>
            <p style={{ color: "#e8e8f0", textAlign: "center", lineHeight: 1.6 }}>{message}</p>
            {mode === "withdraw" && (
              <div className="withdraw-status-guide">
                <div className="status-item"><span style={{ color: "#ffc107" }}>⏳ Pending</span> — Awaiting admin review</div>
                <div className="status-item"><span style={{ color: "#00e676" }}>✅ Approved</span> — M-PESA funds sent</div>
                <div className="status-item"><span style={{ color: "#ff1744" }}>❌ Declined</span> — Balance refunded</div>
              </div>
            )}
            <button className="modal-action-btn" onClick={onClose}>Close</button>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === "error" && (
          <div className="modal-error-state">
            <div className="error-icon">❌</div>
            <p style={{ color: "#ff6b8a", textAlign: "center" }}>{message}</p>
            <button className="modal-action-btn" onClick={() => { setStage("form"); setMessage(""); }}>
              Try Again
            </button>
          </div>
        )}

        {/* Transaction history */}
        <button className="history-toggle" onClick={() => setShowHistory(s => !s)}>
          {showHistory ? "▲ Hide" : "▼ View"} Transaction History
        </button>
        {showHistory && (
          <div className="tx-history">
            {txHistory.map(tx => (
              <div key={tx.id} className="tx-row">
                <span className={`tx-type ${tx.type}`}>{tx.type}</span>
                <span>{tx.amount?.toLocaleString()} {tx.currency}</span>
                <span>{tx.phoneNumber || tx.method || "—"}</span>
                <span style={{ color: statusColor(tx.status), fontSize: 11 }}>
                  {statusLabel(tx.status)}
                </span>
              </div>
            ))}
            {!txHistory.length && <div className="empty-state">No transactions yet</div>}
          </div>
        )}
      </div>
    </div>
  );
}
