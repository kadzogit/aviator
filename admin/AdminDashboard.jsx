import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, getDoc, query, orderBy, limit,
  onSnapshot, updateDoc, serverTimestamp, where,
} from "firebase/firestore";
import { db } from "../frontend/src/lib/firebase";

export default function AdminDashboard({ adminUser }) {
  const [gameState, setGameState] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("overview");

  // Live listener for gameState only
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "gameState", "current"), (snap) => {
      if (snap.exists()) setGameState(snap.data());
    });
    return unsub;
  }, []);

  // Manual refresh for users
  async function refreshUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading users:", err);
    }
    setLoading(false);
  }

  // Manual refresh for transactions
  async function refreshTransactions() {
    setLoading(true);
    try {
      const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(200));
      const snap = await getDocs(q);
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading transactions:", err);
    }
    setLoading(false);
  }

  // Manual refresh for rounds
  async function refreshRounds() {
    setLoading(true);
    try {
      const q = query(collection(db, "rounds"), orderBy("startTime", "desc"), limit(100));
      const snap = await getDocs(q);
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading rounds:", err);
    }
    setLoading(false);
  }

  // Manual refresh for active bets
  async function refreshBets() {
    setLoading(true);
    try {
      const q = query(collection(db, "bets"), where("result", "==", "pending"), limit(100));
      const snap = await getDocs(q);
      setBets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading bets:", err);
    }
    setLoading(false);
  }

  // Load all data on mount
  useEffect(() => {
    refreshUsers();
    refreshTransactions();
    refreshRounds();
    refreshBets();
  }, []);

  const activePlayers = bets.length;
  const totalBetted = bets.reduce((s, b) => s + (b.stake || 0), 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>✈ AVIATOR ADMIN DASHBOARD</h1>
        <div style={styles.userInfo}>
          <span>{adminUser?.fullName || "Admin"}</span>
          <span style={styles.role}>{adminUser?.role?.toUpperCase()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          ["overview", "📊 Overview"],
          ["game", "🎮 Game Control"],
          ["users", "👥 Users"],
          ["transactions", "💰 Transactions"],
          ["rounds", "🎯 Rounds"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...styles.tab,
              ...(tab === key ? styles.tabActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === "overview" && <OverviewTab gameState={gameState} users={users} transactions={transactions} rounds={rounds} bets={bets} />}
        {tab === "game" && <GameControlTab gameState={gameState} adminUser={adminUser} />}
        {tab === "users" && (
          <DataTab
            title="Users"
            data={users}
            columns={["id", "fullName", "email", "balance", "role"]}
            onRefresh={refreshUsers}
            loading={loading}
          />
        )}
        {tab === "transactions" && (
          <DataTab
            title="Transactions"
            data={transactions}
            columns={["id", "uid", "type", "amount", "status", "timestamp"]}
            onRefresh={refreshTransactions}
            loading={loading}
          />
        )}
        {tab === "rounds" && (
          <DataTab
            title="Rounds"
            data={rounds}
            columns={["id", "crashMultiplier", "startTime", "endedAt"]}
            onRefresh={refreshRounds}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ gameState, users, transactions, rounds, bets }) {
  const activePlayers = bets.length;
  const totalBetted = bets.reduce((s, b) => s + (b.stake || 0), 0);

  return (
    <div style={styles.grid}>
      <StatCard label="Current Multiplier" value={gameState?.multiplier?.toFixed(2) || "—"} color="#ffd700" />
      <StatCard label="Game Phase" value={gameState?.phase?.toUpperCase() || "—"} color="#00e5ff" />
      <StatCard label="Active Players" value={activePlayers} color="#00e676" />
      <StatCard label="Total Betted" value={`${totalBetted.toLocaleString()} KES`} color="#e8003d" />
      <StatCard label="Total Users" value={users.length} color="#a78bfa" />
      <StatCard label="Pending Transactions" value={transactions.filter(t => t.status === "pending").length} color="#ffc107" />
    </div>
  );
}

function GameControlTab({ gameState, adminUser }) {
  const [mult, setMult] = useState("");
  const [msg, setMsg] = useState("");
  const isSuperAdmin = adminUser?.role === "superadmin";

  async function forceCrash(m) {
    if (!isSuperAdmin) return alert("Super Admin only");
    const val = parseFloat(m);
    if (isNaN(val) || val < 1) return alert("Invalid multiplier");
    if (!confirm(`Force crash at ${val}x?`)) return;

    try {
      await updateDoc(doc(db, "gameState", "current"), {
        phase: "crashed",
        crashMultiplier: val,
        updatedAt: serverTimestamp(),
        forcedBy: adminUser.uid,
      });
      setMsg(`✅ Forced crash at ${val}x`);
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={styles.controlPanel}>
      <div style={styles.controlCard}>
        <h3>Current Game State</h3>
        <div style={styles.statLine}>
          <span>Phase:</span>
          <span style={{ fontWeight: 700, color: "#00e5ff" }}>{gameState?.phase?.toUpperCase()}</span>
        </div>
        <div style={styles.statLine}>
          <span>Multiplier:</span>
          <span style={{ fontWeight: 700, color: "#ffd700" }}>{gameState?.multiplier?.toFixed(2)}x</span>
        </div>
        <div style={styles.statLine}>
          <span>Round ID:</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{gameState?.roundId?.slice(0, 12)}…</span>
        </div>
      </div>

      <div style={styles.controlCard}>
        <h3>Force Crash</h3>
        {msg && <div style={styles.successMsg}>{msg}</div>}
        <div style={styles.buttonGrid}>
          {[1.01, 1.5, 2.0, 5.0, 10.0].map(v => (
            <button
              key={v}
              onClick={() => forceCrash(v)}
              style={styles.crashBtn}
            >
              {v}x
            </button>
          ))}
        </div>
        <div style={styles.customCrash}>
          <input
            type="number"
            value={mult}
            onChange={e => setMult(e.target.value)}
            placeholder="Custom multiplier"
            style={styles.input}
          />
          <button onClick={() => forceCrash(mult)} style={styles.crashBtn}>
            CRASH
          </button>
        </div>
      </div>
    </div>
  );
}

function DataTab({ title, data, columns, onRefresh, loading }) {
  return (
    <div style={styles.dataPanel}>
      <div style={styles.dataHeader}>
        <h3>{title}</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          {columns.map(col => (
            <div key={col} style={styles.tableCell}>
              {col.toUpperCase()}
            </div>
          ))}
        </div>
        <div style={styles.tableBody}>
          {data.slice(0, 50).map((row, i) => (
            <div key={i} style={styles.tableRow}>
              {columns.map(col => (
                <div key={col} style={styles.tableCell}>
                  {typeof row[col] === "object"
                    ? JSON.stringify(row[col]).slice(0, 30)
                    : String(row[col]).slice(0, 50)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderColor: color + "44" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}

const styles = {
  container: {
    background: "#0e0b1e",
    color: "#e8e8f0",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
    padding: 0,
  },
  header: {
    background: "#12102a",
    borderBottom: "1px solid rgba(232,0,61,0.2)",
    padding: "20px 30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    display: "flex",
    gap: 15,
    alignItems: "center",
  },
  role: {
    background: "rgba(255,215,0,0.15)",
    color: "#ffd700",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#1a1535",
    padding: "0 30px",
  },
  tab: {
    background: "none",
    border: "none",
    color: "rgba(232,232,240,0.5)",
    padding: "12px 20px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    borderBottom: "2px solid transparent",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#e8e8f0",
    borderBottomColor: "#e8003d",
  },
  content: {
    padding: "30px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 20,
  },
  statCard: {
    background: "#1a1535",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 20,
  },
  controlPanel: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  controlCard: {
    background: "#1a1535",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 20,
  },
  statLine: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  crashBtn: {
    background: "rgba(232,0,61,0.2)",
    border: "1px solid rgba(232,0,61,0.4)",
    color: "#ff6b8a",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    transition: "all 0.2s",
  },
  customCrash: {
    display: "flex",
    gap: 8,
  },
  input: {
    flex: 1,
    background: "#12102a",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e8e8f0",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 14,
  },
  successMsg: {
    background: "rgba(0,230,118,0.1)",
    color: "#00e676",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 12,
  },
  dataPanel: {
    background: "#1a1535",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
  },
  dataHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  refreshBtn: {
    background: "rgba(0,229,255,0.1)",
    border: "1px solid rgba(0,229,255,0.3)",
    color: "#00e5ff",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  },
  table: {
    overflow: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 1,
    background: "#12102a",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontWeight: 700,
    fontSize: 11,
    color: "rgba(232,232,240,0.5)",
    textTransform: "uppercase",
  },
  tableBody: {
    maxHeight: "500px",
    overflowY: "auto",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 1,
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 12,
  },
  tableCell: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
