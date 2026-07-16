import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, limit, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db }       from "../lib/firebase";
import { useAuth }  from "../context/AuthContext";
import { useGameContext } from "../context/GameContext";

// ── Helpers ───────────────────────────────────────────────────
const AVATARS = ["🎮","🦅","🚀","💎","🔥","⚡","🎯","🏆","👑","🎲","🌟","💫","🦁","🐉","⚔️"];
function avatar(uid) { return AVATARS[(uid?.charCodeAt(0) || 0) % AVATARS.length]; }
function maskName(name) {
  if (!name) return "d***1";
  const p = name.split(" ");
  const f = p[0] || "";
  return f.length > 2 ? f[0] + "***" + (p[1]?.[0] || "") : f + "***";
}

// ── All Bets Tab ──────────────────────────────────────────────
function AllBets() {
  const { liveBets, currency } = useGameContext();
  return (
    <div className="bets-panel">
      <div className="bets-summary">
        <span>{liveBets.length} Bets this round</span>
        <span>Total win {currency}</span>
      </div>
      <div className="bets-header">
        <span>Player</span><span>Bet</span><span>X</span><span>Win</span>
      </div>
      <div className="bets-list">
        {!liveBets.length && <div className="empty-state">Waiting for bets...</div>}
        {liveBets.map(b => (
          <div key={b.id} className={`bet-row ${b.result === "win" ? "row-win" : b.result === "lose" ? "row-lose" : ""}`}>
            <span className="player-cell">
              <span className="player-avatar">{avatar(b.uid)}</span>
              <span className="player-name">{maskName(b.fullName || b.email)}</span>
            </span>
            <span>{b.stake?.toLocaleString()}</span>
            <span className={b.cashoutMultiplier ? "mult-green" : ""}>
              {b.cashoutMultiplier ? `${b.cashoutMultiplier}x` : ""}
            </span>
            <span className={b.winnings ? "win-green" : ""}>
              {b.winnings ? b.winnings.toLocaleString() : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Previous Bets Tab ─────────────────────────────────────────
function PreviousBets() {
  const { user }    = useAuth();
  const { currency } = useGameContext();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "bets"),
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(30)
    );
    getDocs(q).then(snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  return (
    <div className="bets-panel">
      <div className="bets-header">
        <span>Round</span><span>Stake</span><span>Cashout</span><span>Result</span>
      </div>
      <div className="bets-list">
        {!history.length && <div className="empty-state">No bets yet</div>}
        {history.map(b => (
          <div key={b.id} className={`bet-row ${b.result === "win" ? "row-win" : "row-lose"}`}>
            <span style={{ fontSize: 10, opacity: 0.5 }}>{b.roundId?.slice(0,6)}…</span>
            <span>{b.stake?.toLocaleString()}</span>
            <span>{b.cashoutMultiplier ? `${b.cashoutMultiplier}x` : "—"}</span>
            <span className={b.result === "win" ? "win-green" : "lose-red"}>
              {b.result || "pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Wins Tab ──────────────────────────────────────────────
function TopBets() {
  const [top, setTop] = useState([]);
  useEffect(() => {
    const q = query(
      collection(db, "bets"),
      where("result", "==", "win"),
      orderBy("winnings", "desc"),
      limit(20)
    );
    getDocs(q).then(snap => setTop(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  return (
    <div className="bets-panel">
      <div className="bets-header">
        <span>Player</span><span>Bet</span><span>X</span><span>Win</span>
      </div>
      <div className="bets-list">
        {!top.length && <div className="empty-state">No top wins yet</div>}
        {top.map(b => (
          <div key={b.id} className="bet-row row-win">
            <span className="player-cell">
              <span className="player-avatar">{avatar(b.uid)}</span>
              <span className="player-name">{maskName(b.fullName || b.email)}</span>
            </span>
            <span>{b.stake?.toLocaleString()}</span>
            <span className="mult-green">{b.cashoutMultiplier}x</span>
            <span className="win-green">{b.winnings?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat Tab ──────────────────────────────────────────────────
function ChatTab() {
  const { user, profile } = useAuth();
  const [msgs,   setMsgs]  = useState([]);
  const [text,   setText]  = useState("");
  const bottomRef          = useRef(null);
  const canChat = profile?.chatEnabled || profile?.role === "admin";

  useEffect(() => {
    const q    = query(collection(db, "chat"), orderBy("createdAt", "asc"), limit(60));
    const unsub = onSnapshot(q, snap => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    });
    return unsub;
  }, []);

  async function send() {
    if (!text.trim() || !canChat) return;
    await addDoc(collection(db, "chat"), {
      uid:       user.uid,
      name:      profile?.fullName || maskName(profile?.email),
      text:      text.trim(),
      createdAt: serverTimestamp(),
    });
    setText("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-msgs">
        {msgs.map(m => (
          <div key={m.id} className={`chat-msg ${m.uid === user?.uid ? "own-msg" : ""}`}>
            <span className="chat-avatar">{avatar(m.uid)}</span>
            <div className="chat-bubble">
              <span className="chat-name">{m.name}</span>
              <span className="chat-text">{m.text}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canChat ? (
        <div className="chat-input-row">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Type a message…"
            maxLength={200}
          />
          <button onClick={send}>➤</button>
        </div>
      ) : (
        <div className="chat-locked">🔒 Chat restricted — admin must enable for your account</div>
      )}
    </div>
  );
}

// ── Main Left Panel ───────────────────────────────────────────
export default function LeftPanel() {
  const [tab, setTab] = useState("all");

  return (
    <div className="left-panel">
      <div className="panel-tabs">
        {[["all","All Bets"],["prev","Previous"],["top","Top"],["chat","Chat"]].map(([k,l]) => (
          <button
            key={k}
            className={`panel-tab ${tab === k ? "active" : ""}`}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "all"  && <AllBets />}
      {tab === "prev" && <PreviousBets />}
      {tab === "top"  && <TopBets />}
      {tab === "chat" && <ChatTab />}
    </div>
  );
}
