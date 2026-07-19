import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, getDoc, updateDoc, query, orderBy, limit, where,
  onSnapshot, serverTimestamp, deleteDoc, addDoc,
} from "firebase/firestore";
import { db } from "../frontend/src/lib/firebase";

export default function AdminPanelEnhanced({ adminUser }) {
  const [gameState, setGameState] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Live listener for gameState
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "gameState", "current"), (snap) => {
      if (snap.exists()) setGameState(snap.data());
    });
    return unsub;
  }, []);

  // Manual data refresh functions
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

  async function refreshAdminLogs() {
    setLoading(true);
    try {
      const q = query(collection(db, "adminLogs"), orderBy("timestamp", "desc"), limit(100));
      const snap = await getDocs(q);
      setAdminLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading logs:", err);
    }
    setLoading(false);
  }

  // Admin actions
  async function forceCrash(multiplier) {
    if (adminUser?.role !== "superadmin") {
      alert("Only Super Admin can force crash");
      return;
    }

    if (!confirm(`Force crash at ${multiplier}x?`)) return;

    try {
      await updateDoc(doc(db, "gameState", "current"), {
        phase: "crashed",
        crashMultiplier: multiplier,
        forcedBy: adminUser.uid,
        forcedAt: serverTimestamp(),
      });

      // Log the action
      await addDoc(collection(db, "adminLogs"), {
        adminUid: adminUser.uid,
        adminName: adminUser.fullName,
        action: "FORCE_CRASH",
        details: { multiplier },
        timestamp: serverTimestamp(),
      });

      setMsg(`✅ Forced crash at ${multiplier}x`);
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function creditUserBalance(userId, amount) {
    if (adminUser?.role !== "superadmin") {
      alert("Only Super Admin can credit balance");
      return;
    }

    if (!confirm(`Credit ${amount} to user ${userId}?`)) return;

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const currentBalance = userSnap.data()?.balance || 0;

      await updateDoc(userRef, {
        balance: currentBalance + amount,
        updatedAt: serverTimestamp(),
      });

      // Log the action
      await addDoc(collection(db, "adminLogs"), {
        adminUid: adminUser.uid,
        adminName: adminUser.fullName,
        action: "CREDIT_BALANCE",
        targetUid: userId,
        details: { amount, newBalance: currentBalance + amount },
        timestamp: serverTimestamp(),
      });

      setMsg(`✅ Credited ${amount} to user`);
      setTimeout(() => setMsg(""), 3000);
      refreshUsers();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function debitUserBalance(userId, amount) {
    if (adminUser?.role !== "superadmin") {
      alert("Only Super Admin can debit balance");
      return;
    }

    if (!confirm(`Debit ${amount} from user ${userId}?`)) return;

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const currentBalance = userSnap.data()?.balance || 0;

      if (currentBalance < amount) {
        alert("Insufficient balance");
        return;
      }

      await updateDoc(userRef, {
        balance: currentBalance - amount,
        updatedAt: serverTimestamp(),
      });

      // Log the action
      await addDoc(collection(db, "adminLogs"), {
        adminUid: adminUser.uid,
        adminName: adminUser.fullName,
        action: "DEBIT_BALANCE",
        targetUid: userId,
        details: { amount, newBalance: currentBalance - amount },
        timestamp: serverTimestamp(),
      });

      setMsg(`✅ Debited ${amount} from user`);
      setTimeout(() => setMsg(""), 3000);
      refreshUsers();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function approveTransaction(transactionId) {
    if (adminUser?.role !== "admin" && adminUser?.role !== "superadmin") {
      alert("Only admins can approve transactions");
      return;
    }

    try {
      await updateDoc(doc(db, "transactions", transactionId), {
        status: "approved",
        approvedBy: adminUser.uid,
        approvedAt: serverTimestamp(),
      });

      setMsg("✅ Transaction approved");
      setTimeout(() => setMsg(""), 3000);
      refreshTransactions();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function declineTransaction(transactionId) {
    if (adminUser?.role !== "admin" && adminUser?.role !== "superadmin") {
      alert("Only admins can decline transactions");
      return;
    }

    try {
      await updateDoc(doc(db, "transactions", transactionId), {
        status: "declined",
        declinedBy: adminUser.uid,
        declinedAt: serverTimestamp(),
      });

      setMsg("✅ Transaction declined");
      setTimeout(() => setMsg(""), 3000);
      refreshTransactions();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>✈ AVIATOR ADMIN PANEL</h1>
        <div style={styles.userInfo}>
          <span>{adminUser?.fullName}</span>
          <span style={styles.role}>{adminUser?.role?.toUpperCase()}</span>
        </div>
      </div>

      {/* Message */}
      {msg && <div style={styles.message}>{msg}</div>}

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          ["dashboard", "📊 Dashboard"],
          ["game", "🎮 Game Control"],
          ["users", "👥 Users"],
          ["transactions", "💰 Transactions"],
          ["logs", "📋 Logs"],
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
        {tab === "dashboard" && <DashboardTab gameState={gameState} users={users} transactions={transactions} />}
        {tab === "game" && <GameControlTab gameState={gameState} adminUser={adminUser} onForceCrash={forceCrash} />}
        {tab === "users" && (
          <UsersTab
            users={users}
            onRefresh={refreshUsers}
            onCredit={creditUserBalance}
            onDebit={debitUserBalance}
            loading={loading}
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab
            transactions={transactions}
            onRefresh={refreshTransactions}
            onApprove={approveTransaction}
            onDecline={declineTransaction}
            loading={loading}
          />
        )}
        {tab === "logs" && (
          <LogsTab logs={adminLogs} onRefresh={refreshAdminLogs} loading={loading} />
        )}
      </div>
    </div>
  );
}

function DashboardTab({ gameState, users, transactions }) {
  const pendingTransactions = transactions.filter(t => t.status === "pending").length;
  const totalDeposits = transactions
    .filter(t => t.type === "deposit" && t.status === "approved")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const totalWithdrawals = transactions
    .filter(t => t.type === "withdraw" && t.status === "approved")
    .reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div style={styles.dashboard}>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Current Multiplier</div>
        <div style={styles.statValue}>{gameState?.multiplier?.toFixed(2) || "—"}x</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Game Phase</div>
        <div style={styles.statValue}>{gameState?.phase?.toUpperCase()}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Users</div>
        <div style={styles.statValue}>{users.length}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Pending Transactions</div>
        <div style={styles.statValue}>{pendingTransactions}</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Deposits</div>
        <div style={styles.statValue}>{totalDeposits.toLocaleString()} KES</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Withdrawals</div>
        <div style={styles.statValue}>{totalWithdrawals.toLocaleString()} KES</div>
      </div>
    </div>
  );
}

function GameControlTab({ gameState, adminUser, onForceCrash }) {
  const [mult, setMult] = useState("");

  return (
    <div style={styles.controlPanel}>
      <div style={styles.card}>
        <h3>Current Game State</h3>
        <div style={styles.statLine}>
          <span>Phase:</span>
          <strong>{gameState?.phase?.toUpperCase()}</strong>
        </div>
        <div style={styles.statLine}>
          <span>Multiplier:</span>
          <strong>{gameState?.multiplier?.toFixed(2)}x</strong>
        </div>
        <div style={styles.statLine}>
          <span>Round ID:</span>
          <span style={{ fontSize: 12 }}>{gameState?.roundId?.slice(0, 12)}…</span>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Force Crash</h3>
        <div style={styles.buttonGrid}>
          {[1.01, 1.5, 2.0, 5.0, 10.0].map(v => (
            <button
              key={v}
              onClick={() => onForceCrash(v)}
              style={styles.actionBtn}
            >
              {v}x
            </button>
          ))}
        </div>
        <div style={styles.customInput}>
          <input
            type="number"
            value={mult}
            onChange={e => setMult(e.target.value)}
            placeholder="Custom multiplier"
            style={styles.input}
          />
          <button onClick={() => onForceCrash(parseFloat(mult))} style={styles.actionBtn}>
            CRASH
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, onRefresh, onCredit, onDebit, loading }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");

  return (
    <div style={styles.dataPanel}>
      <div style={styles.panelHeader}>
        <h3>User Management</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div>Email</div>
          <div>Full Name</div>
          <div>Balance</div>
          <div>Role</div>
          <div>Actions</div>
        </div>
        {users.slice(0, 50).map(user => (
          <div key={user.id} style={styles.tableRow}>
            <div>{user.email}</div>
            <div>{user.fullName}</div>
            <div>{(user.balance || 0).toLocaleString()} KES</div>
            <div>{user.role || "user"}</div>
            <div style={styles.actions}>
              <button
                onClick={() => {
                  setSelectedUser(user);
                  setCreditAmount("");
                }}
                style={styles.smallBtn}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedUser && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3>Edit User: {selectedUser.fullName}</h3>
            <div style={styles.modalField}>
              <label>Credit Amount:</label>
              <input
                type="number"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  onCredit(selectedUser.id, parseFloat(creditAmount));
                  setSelectedUser(null);
                }}
                style={styles.successBtn}
              >
                Credit
              </button>
              <button
                onClick={() => {
                  onDebit(selectedUser.id, parseFloat(creditAmount));
                  setSelectedUser(null);
                }}
                style={styles.dangerBtn}
              >
                Debit
              </button>
              <button onClick={() => setSelectedUser(null)} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsTab({ transactions, onRefresh, onApprove, onDecline, loading }) {
  return (
    <div style={styles.dataPanel}>
      <div style={styles.panelHeader}>
        <h3>Transactions</h3>
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div>Type</div>
          <div>Amount</div>
          <div>Status</div>
          <div>User</div>
          <div>Actions</div>
        </div>
        {transactions.slice(0, 50).map(tx => (
          <div key={tx.id} style={styles.tableRow}>
            <div>{tx.type}</div>
            <div>{(tx.amount || 0).toLocaleString()} KES</div>
            <div>{tx.status}</div>
            <div>{tx.email}</div>
            <div style={styles.actions}>
              {tx.status === "pending" && (
                <>
                  <button
                    onClick={() => onApprove(tx.id)}
                    style={styles.approveBtn}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onDecline(tx.id)}
                    style={styles.declineBtn}
                  >
                    ✗
                  </button>
                </>
              )}
            </div>
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
        <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div>Admin</div>
          <div>Action</div>
          <div>Target</div>
          <div>Time</div>
        </div>
        {logs.slice(0, 50).map(log => (
          <div key={log.id} style={styles.tableRow}>
            <div>{log.adminName}</div>
            <div>{log.action}</div>
            <div>{log.targetUid?.slice(0, 8) || "—"}</div>
            <div>{new Date(log.timestamp?.toDate?.() || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "#0e0b1e",
    color: "#e8e8f0",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
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
  message: {
    background: "rgba(0,230,118,0.1)",
    color: "#00e676",
    padding: "12px 30px",
    borderBottom: "1px solid rgba(0,230,118,0.2)",
    fontSize: 14,
    fontWeight: 600,
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
  dashboard: {
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
  statLabel: {
    fontSize: 12,
    color: "rgba(232,232,240,0.5)",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 900,
    color: "#ffd700",
  },
  controlPanel: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  card: {
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
    fontSize: 14,
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    background: "rgba(232,0,61,0.2)",
    border: "1px solid rgba(232,0,61,0.4)",
    color: "#ff6b8a",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  customInput: {
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
  },
  dataPanel: {
    background: "#1a1535",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
  },
  panelHeader: {
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
  },
  table: {
    overflow: "auto",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 1,
    background: "#12102a",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontWeight: 700,
    fontSize: 11,
    color: "rgba(232,232,240,0.5)",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 1,
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 12,
    alignItems: "center",
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  smallBtn: {
    background: "rgba(0,229,255,0.1)",
    border: "1px solid rgba(0,229,255,0.2)",
    color: "#00e5ff",
    padding: "4px 8px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
  },
  approveBtn: {
    background: "rgba(0,230,118,0.2)",
    border: "1px solid rgba(0,230,118,0.3)",
    color: "#00e676",
    padding: "4px 8px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: 700,
  },
  declineBtn: {
    background: "rgba(232,0,61,0.2)",
    border: "1px solid rgba(232,0,61,0.3)",
    color: "#ff6b8a",
    padding: "4px 8px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: 700,
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "#1a1535",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 30,
    maxWidth: 400,
  },
  modalField: {
    marginBottom: 20,
  },
  modalActions: {
    display: "flex",
    gap: 10,
  },
  successBtn: {
    flex: 1,
    background: "rgba(0,230,118,0.2)",
    border: "1px solid rgba(0,230,118,0.3)",
    color: "#00e676",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  dangerBtn: {
    flex: 1,
    background: "rgba(232,0,61,0.2)",
    border: "1px solid rgba(232,0,61,0.3)",
    color: "#ff6b8a",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  cancelBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e8e8f0",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
};
