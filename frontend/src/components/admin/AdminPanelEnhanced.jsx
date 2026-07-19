import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, getDoc, updateDoc, query, orderBy, limit, where,
  onSnapshot, serverTimestamp, deleteDoc, addDoc, setDoc
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function AdminPanelEnhanced({ adminUser }) {
  const [gameState, setGameState] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bets, setBets] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Live listener for critical game data
  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, "gameState", "current"), (snap) => {
      if (snap.exists()) setGameState(snap.data());
    });
    const unsubBets = onSnapshot(query(collection(db, "bets"), where("result", "==", "pending")), (snap) => {
      setBets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubGame(); unsubBets(); };
  }, []);

  // Manual refresh functions
  async function refreshUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function refreshTransactions() {
    setLoading(true);
    try {
      const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(100));
      const snap = await getDocs(q);
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function refreshRounds() {
    setLoading(true);
    try {
      const q = query(collection(db, "rounds"), orderBy("startTime", "desc"), limit(50));
      const snap = await getDocs(q);
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function refreshLogs() {
    setLoading(true);
    try {
      const q = query(collection(db, "adminLogs"), orderBy("timestamp", "desc"), limit(50));
      const snap = await getDocs(q);
      setAdminLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  useEffect(() => {
    refreshUsers();
    refreshTransactions();
    refreshRounds();
    refreshLogs();
  }, []);

  // Admin actions
  async function forceCrash(multiplier) {
    if (adminUser?.role !== "superadmin") return alert("Super Admin only");
    const val = parseFloat(multiplier);
    if (isNaN(val) || val < 1) return alert("Invalid multiplier");
    if (!confirm(`Force crash at ${val}x?`)) return;

    try {
      await updateDoc(doc(db, "gameState", "current"), {
        phase: "crashed",
        crashMultiplier: val,
        forcedBy: adminUser.uid,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "adminLogs"), {
        adminUid: adminUser.uid,
        adminName: adminUser.fullName,
        action: "FORCE_CRASH",
        details: { multiplier: val },
        timestamp: serverTimestamp(),
      });
      setMsg(`✅ Forced crash at ${val}x`);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert(e.message); }
  }

  async function resetGameState() {
    if (adminUser?.role !== "superadmin") return alert("Super Admin only");
    if (!confirm("Reset game state? This will clear stuck rounds.")) return;
    try {
      await updateDoc(doc(db, "gameState", "current"), {
        phase: "waiting",
        multiplier: 1,
        updatedAt: serverTimestamp(),
        roundId: "reset-" + Date.now(),
      });
      setMsg("✅ Game state reset");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert(e.message); }
  }

  async function creditUser(uid, amount) {
    if (adminUser?.role !== "superadmin") return alert("Super Admin only");
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      const newBal = (snap.data().balance || 0) + parseFloat(amount);
      await updateDoc(userRef, { balance: newBal });
      await addDoc(collection(db, "adminLogs"), {
        adminUid: adminUser.uid,
        adminName: adminUser.fullName,
        action: "CREDIT_USER",
        targetUid: uid,
        details: { amount, newBal },
        timestamp: serverTimestamp(),
      });
      setMsg("✅ User credited");
      refreshUsers();
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>✈ AVIATOR CONTROL CENTER</h1>
        <div style={styles.userInfo}>
          <span>{adminUser?.fullName}</span>
          <span style={styles.role}>{adminUser?.role?.toUpperCase()}</span>
        </div>
      </div>

      {msg && <div style={styles.successMsg}>{msg}</div>}

      <div style={styles.tabs}>
        {[["dashboard","📊 Dashboard"],["game","🎮 Game Control"],["users","👥 Users"],["transactions","💰 Transactions"],["logs","📋 Logs"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{...styles.tab, ...(tab === k ? styles.tabActive : {})}}>{l}</button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === "dashboard" && <DashboardTab gameState={gameState} users={users} transactions={transactions} bets={bets} rounds={rounds} />}
        {tab === "game" && <GameControlTab gameState={gameState} onCrash={forceCrash} onReset={resetGameState} bets={bets} rounds={rounds} />}
        {tab === "users" && <UsersTab users={users} onRefresh={refreshUsers} onCredit={creditUser} loading={loading} />}
        {tab === "transactions" && <TransactionsTab transactions={transactions} onRefresh={refreshTransactions} loading={loading} />}
        {tab === "logs" && <LogsTab logs={adminLogs} onRefresh={refreshLogs} loading={loading} />}
      </div>
    </div>
  );
}

function DashboardTab({ gameState, users, transactions, bets, rounds }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const deps = transactions.filter(t => t.type === "deposit" && t.status === "approved" && new Date(t.timestamp?.toDate?.() || 0) >= today).reduce((s,t) => s + (t.amount || 0), 0);
  const wds = transactions.filter(t => t.type === "withdraw" && t.status === "approved" && new Date(t.timestamp?.toDate?.() || 0) >= today).reduce((s,t) => s + (t.amount || 0), 0);

  return (
    <div style={styles.dashboardGrid}>
      <StatCard label="Live Multiplier" value={(gameState?.multiplier || 1).toFixed(2) + "x"} color="#ffd700" />
      <StatCard label="Active Players" value={bets.length} color="#00e5ff" />
      <StatCard label="Today Deposits" value={deps.toLocaleString() + " KES"} color="#00e676" />
      <StatCard label="Today Withdrawals" value={wds.toLocaleString() + " KES"} color="#ff1744" />
      <StatCard label="Today NET" value={(deps - wds).toLocaleString() + " KES"} color="#a78bfa" />
      <StatCard label="Total Users" value={users.length} color="#ffffff" />
    </div>
  );
}

function GameControlTab({ gameState, onCrash, onReset, bets, rounds }) {
  const [customMult, setCustomMult] = useState("");
  return (
    <div style={styles.controlLayout}>
      <div style={styles.card}>
        <h3>Live View</h3>
        <div style={styles.livePreview}>
          <div style={styles.liveMult}>{(gameState?.multiplier || 1).toFixed(2)}x</div>
          <div style={styles.livePhase}>{gameState?.phase?.toUpperCase()}</div>
        </div>
        <button onClick={onReset} style={styles.resetBtn}>⚠️ EMERGENCY RESET</button>
      </div>

      <div style={styles.card}>
        <h3>Force Crash</h3>
        <div style={styles.btnGrid}>
          {[1.01, 1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0].map(v => (
            <button key={v} onClick={() => onCrash(v)} style={styles.crashBtn}>{v}x</button>
          ))}
        </div>
        <div style={styles.inputGroup}>
          <input type="number" value={customMult} onChange={e => setCustomMult(e.target.value)} placeholder="Custom multiplier" style={styles.input} />
          <button onClick={() => onCrash(customMult)} style={styles.crashBtn}>CRASH</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Recent Rounds</h3>
        <div style={styles.roundHistory}>
          {rounds.map((r, i) => (
            <div key={i} style={{...styles.roundItem, color: r.crashMultiplier >= 2 ? "#00e5ff" : "#ff6b8a"}}>
              {r.crashMultiplier?.toFixed(2)}x
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, onRefresh, onCredit, loading }) {
  const [amt, setAmt] = useState("");
  return (
    <div style={styles.dataPanel}>
      <div style={styles.panelHeader}>
        <h3>Users ({users.length})</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>{loading ? "..." : "🔄 Refresh"}</button>
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Name</span><span>Email</span><span>Balance</span><span>Actions</span>
        </div>
        {users.map(u => (
          <div key={u.id} style={styles.tableRow}>
            <span>{u.fullName}</span><span>{u.email}</span><span>{u.balance?.toLocaleString()}</span>
            <div style={styles.actionGroup}>
              <input type="number" placeholder="Amt" onChange={e => setAmt(e.target.value)} style={styles.smallInput} />
              <button onClick={() => onCredit(u.id, amt)} style={styles.smallBtn}>Credit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsTab({ transactions, onRefresh, loading }) {
  return (
    <div style={styles.dataPanel}>
      <div style={styles.panelHeader}>
        <h3>Transactions</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>{loading ? "..." : "🔄 Refresh"}</button>
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Type</span><span>Amount</span><span>Status</span><span>Date</span>
        </div>
        {transactions.map(t => (
          <div key={t.id} style={styles.tableRow}>
            <span style={{color: t.type === "deposit" ? "#00e676" : "#ff1744"}}>{t.type.toUpperCase()}</span>
            <span>{t.amount?.toLocaleString()}</span>
            <span>{t.status}</span>
            <span>{new Date(t.timestamp?.toDate?.() || 0).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ logs, onRefresh, loading }) {
  return (
    <div style={styles.dataPanel}>
      <div style={styles.panelHeader}>
        <h3>Admin Logs</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>{loading ? "..." : "🔄 Refresh"}</button>
      </div>
      <div style={styles.table}>
        {logs.map(l => (
          <div key={l.id} style={styles.tableRow}>
            <span>{l.adminName}</span><span>{l.action}</span><span>{JSON.stringify(l.details)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{...styles.statCard, borderColor: color + "44"}}>
      <div style={{fontSize: 12, opacity: 0.6}}>{label}</div>
      <div style={{fontSize: 24, fontWeight: 900, color, marginTop: 5}}>{value}</div>
    </div>
  );
}

const styles = {
  container: { background: "#0e0b1e", color: "#fff", minHeight: "100vh", fontFamily: "Inter, sans-serif" },
  header: { background: "#12102a", padding: "20px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(232,0,61,0.2)" },
  role: { background: "rgba(255,215,0,0.1)", color: "#ffd700", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  tabs: { display: "flex", background: "#1a1535", padding: "0 30px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  tab: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", padding: "15px 20px", cursor: "pointer", fontWeight: 600, borderBottom: "2px solid transparent" },
  tabActive: { color: "#fff", borderBottomColor: "#e8003d" },
  content: { padding: 30 },
  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 },
  statCard: { background: "#1a1535", border: "1px solid", borderRadius: 12, padding: 20 },
  controlLayout: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 },
  card: { background: "#1a1535", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.05)" },
  livePreview: { height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0e0b1e", borderRadius: 8, marginBottom: 15 },
  liveMult: { fontSize: 48, fontWeight: 900, color: "#fff" },
  livePhase: { fontSize: 12, color: "#00e5ff", fontWeight: 700 },
  btnGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 15 },
  crashBtn: { background: "rgba(232,0,61,0.2)", border: "1px solid #e8003d", color: "#fff", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 700 },
  resetBtn: { width: "100%", background: "rgba(255,23,68,0.1)", border: "1px solid #ff1744", color: "#ff1744", padding: "12px", borderRadius: 8, cursor: "pointer", fontWeight: 700 },
  inputGroup: { display: "flex", gap: 8 },
  input: { flex: 1, background: "#0e0b1e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 12px", borderRadius: 6 },
  roundHistory: { display: "flex", flexWrap: "wrap", gap: 6 },
  roundItem: { background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 },
  dataPanel: { background: "#1a1535", borderRadius: 12, overflow: "hidden" },
  panelHeader: { padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  refreshBtn: { background: "rgba(0,229,255,0.1)", border: "1px solid #00e5ff", color: "#00e5ff", padding: "6px 12px", borderRadius: 6, cursor: "pointer" },
  table: { width: "100%", padding: 20 },
  tableHeader: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", fontWeight: 700, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12, opacity: 0.5 },
  tableRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.02)", fontSize: 13, alignItems: "center" },
  actionGroup: { display: "flex", gap: 5 },
  smallInput: { width: 60, background: "#0e0b1e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "4px 8px", borderRadius: 4 },
  smallBtn: { background: "#00e676", color: "#000", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 700 },
  successMsg: { background: "#00e676", color: "#000", padding: "10px 30px", fontWeight: 700, fontSize: 14 },
};
