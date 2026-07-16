import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc,
  onSnapshot, query, orderBy, limit, where, updateDoc,
  addDoc, serverTimestamp, runTransaction, deleteDoc,
} from "firebase/firestore";

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAvZEzj4bGQMIjLu5Z5o8lq_nm7M8Es8s4",
  authDomain:        "aviator-6827d.firebaseapp.com",
  projectId:         "aviator-6827d",
  storageBucket:     "aviator-6827d.firebasestorage.app",
  messagingSenderId: "183407795313",
  appId:             "1:183407795313:web:f4af116bd1cdc7ee604fd0",
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────
function statusColor(s) {
  if (s === "success" || s === "approved") return "#00e676";
  if (s === "declined" || s === "failed")  return "#ff1744";
  return "#ffc107";
}
function statusLabel(s) {
  const m = {
    pending:"⏳ Pending", approved:"✅ Approved", declined:"❌ Declined",
    success:"✅ Success", failed:"❌ Failed", processing:"🔄 Processing",
  };
  return m[s] || s;
}
function fmt(n)  { return (n || 0).toLocaleString(); }
function fmtDate(v) {
  if (!v) return "—";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}

// ── Admin logger ─────────────────────────────────────────────
async function logAction(adminUid, adminName, action, targetUid, details) {
  try {
    await addDoc(collection(db, "adminLogs"), {
      adminUid, adminName, action, targetUid, details,
      timestamp: serverTimestamp(),
    });
  } catch (e) { console.error("Log error:", e); }
}

// ── Login Screen ─────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists() || !["admin","superadmin"].includes(snap.data().role)) {
        await signOut(auth);
        throw new Error("Not an admin account");
      }
      onLogin({ uid: cred.user.uid, ...snap.data() });
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={s.loginPage}>
      <div style={s.loginCard}>
        <div style={s.loginLogo}>✈ AVIATOR ADMIN</div>
        <h2 style={s.loginTitle}>Admin Portal</h2>
        {err && <div style={s.errBox}>{err}</div>}
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <input style={s.input} type="email" placeholder="Admin email" value={email}
            onChange={e=>setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password" value={pass}
            onChange={e=>setPass(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color="#00e676", icon, onClick }) {
  return (
    <div style={{...s.statCard, borderColor:color+"33", cursor:onClick?"pointer":"default"}}
      onClick={onClick}>
      <div style={{fontSize:26,marginBottom:5}}>{icon}</div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{label}</div>
      <div style={{fontSize:24,fontWeight:900,color,fontFamily:"'Orbitron',sans-serif"}}>{value}</div>
      {sub && <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

// ── Control Center (All-in-One) ──────────────────────────
function ControlCenter({ adminUser, gameState, users, bets, transactions, rounds, reload }) {
  const [loading, setLoading] = useState(false);
  const [mult, setMult] = useState("");
  const [msg, setMsg] = useState("");

  const activePlayers = bets.filter(b => b.result === "pending");
  const totalBetted = activePlayers.reduce((s, b) => s + (b.stake || 0), 0);
  const isSuperAdmin = adminUser?.role === "superadmin";

  async function forceCrash(m) {
    if (!isSuperAdmin) return alert("Super Admin only");
    const val = parseFloat(m);
    if (isNaN(val) || val < 1) return alert("Invalid multiplier");
    if (!confirm(`Force crash at ${val}x?`)) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "gameState", "current"), {
        phase: "crashed",
        crashMultiplier: val,
        updatedAt: serverTimestamp(),
        forcedBy: adminUser.uid,
      }, { merge: true });
      setMsg(`Forced crash at ${val}x`);
      setTimeout(() => setMsg(""), 3000);
      reload();
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 20 }}>
      {/* Left Column: Live View & Controls */}
      <div>
        <div style={{ ...s.controlCard, background: "#12102a", border: "1px solid rgba(232,0,61,0.3)", position: "relative", minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {/* Mock Canvas / Preview */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, background: "radial-gradient(circle, #e8003d 0%, transparent 70%)" }} />
          <div style={{ fontSize: 100, fontWeight: 900, fontFamily: "'Orbitron', sans-serif", color: gameState?.phase === "crashed" ? "#ff1744" : "#fff", zIndex: 2, textShadow: "0 0 40px rgba(0,0,0,0.5)" }}>
            {gameState?.phase === "flying" ? (gameState?.multiplier || 1).toFixed(2) + "x" : gameState?.phase === "crashed" ? "FLEW AWAY" : "WAITING..."}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", zIndex: 2, marginTop: 10 }}>
            ROUND ID: {gameState?.roundId?.slice(0, 12) || "—"}
          </div>
          {msg && <div style={{ position: "absolute", top: 20, background: "#00e676", color: "#000", padding: "6px 16px", borderRadius: 20, fontWeight: 700, fontSize: 12, zIndex: 3 }}>{msg}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div style={s.controlCard}>
            <h4 style={s.sectionTitle}>🎯 Live Bets ({activePlayers.length})</h4>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#00e676" }}>KES {fmt(totalBetted)}</div>
            <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 10 }}>
              {activePlayers.map(b => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span>{b.fullName || "Player"}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(b.stake)}</span>
                </div>
              ))}
              {activePlayers.length === 0 && <div style={s.empty}>No active bets</div>}
            </div>
          </div>

          <div style={s.controlCard}>
            <h4 style={s.sectionTitle}>⚡ Quick Actions</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={{ ...s.dangerBtn, fontSize: 11, padding: "8px" }} onClick={() => forceCrash(1.01)}>Crash @ 1.01x</button>
              <button style={{ ...s.dangerBtn, fontSize: 11, padding: "8px" }} onClick={() => forceCrash(1.50)}>Crash @ 1.50x</button>
              <button style={{ ...s.dangerBtn, fontSize: 11, padding: "8px" }} onClick={() => forceCrash(2.00)}>Crash @ 2.00x</button>
              <button style={{ ...s.dangerBtn, fontSize: 11, padding: "8px" }} onClick={() => forceCrash(5.00)}>Crash @ 5.00x</button>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input style={{ ...s.input, flex: 1 }} placeholder="Custom mult (e.g. 10.5)" value={mult} onChange={e => setMult(e.target.value)} />
              <button style={s.dangerBtn} onClick={() => forceCrash(mult)}>CRASH</button>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: "rgba(0,229,255,0.05)", borderRadius: 8, border: "1px solid rgba(0,229,255,0.2)" }}>
              <h5 style={{ ...s.sectionTitle, marginBottom: 8, fontSize: 10, color: "#00e5ff" }}>🎯 MINI ODD CONTROL</h5>
              <div style={{ display: "flex", gap: 5 }}>
                {[1.1, 1.2, 1.5, 2.0, 3.0].map(v => (
                  <button key={v} style={{ ...s.smallBtn, flex: 1, padding: "4px 0", fontSize: 10 }} onClick={() => forceCrash(v)}>{v}x</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Recent Rounds & Stats */}
      <div>
        <div style={s.controlCard}>
          <h4 style={s.sectionTitle}>🕒 History & Active Users</h4>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
             <div style={{ flex: 1, background: "rgba(0,229,255,0.1)", padding: 8, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>ONLINE</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#00e5ff" }}>{users.length}</div>
             </div>
             <div style={{ flex: 1, background: "rgba(167,139,250,0.1)", padding: 8, borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>PLAYING</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#a78bfa" }}>{activePlayers.length}</div>
             </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflowY: "auto" }}>
            {rounds.slice(0, 50).map((r, i) => {
              const m = r.crashMultiplier || 0;
              const col = m >= 10 ? "#ffd700" : m >= 2 ? "#00e5ff" : "#ff6b8a";
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${col}44`, borderRadius: 4, padding: "2px 6px", fontSize: 10, color: col, fontFamily: "'Orbitron', sans-serif" }}>
                  {m.toFixed(2)}x
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...s.controlCard, marginTop: 16 }}>
          <h4 style={s.sectionTitle}>💰 Live Revenue (Today)</h4>
          {(() => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const deps = transactions.filter(t => t.type === "deposit" && (t.status === "success" || t.status === "approved") && new Date(t.timestamp || 0) >= today).reduce((s, t) => s + (t.amount || 0), 0);
            const wds = transactions.filter(t => t.type === "withdraw" && (t.status === "approved" || t.status === "success") && new Date(t.timestamp || 0) >= today).reduce((s, t) => s + (t.amount || 0), 0);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Deposits</span>
                  <span style={{ color: "#00e676", fontWeight: 700 }}>KES {fmt(deps)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Withdrawals</span>
                  <span style={{ color: "#ff1744", fontWeight: 700 }}>KES {fmt(wds)}</span>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>NET</span>
                  <span style={{ color: deps - wds >= 0 ? "#ffd700" : "#ff1744", fontWeight: 900 }}>KES {fmt(deps - wds)}</span>
                </div>
              </>
            );
          })()}
        </div>

        <div style={{ ...s.controlCard, marginTop: 16 }}>
          <h4 style={s.sectionTitle}>🔔 Recent Activity</h4>
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {transactions.slice(0, 10).map(t => (
              <div key={t.id} style={{ fontSize: 10, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: t.type === "deposit" ? "#00e676" : "#ff1744" }}>{t.type.toUpperCase()}</span>
                <span>{fmt(t.amount)}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{fmtDate(t.timestamp).split(",")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        <button style={{ ...s.btn, width: "100%", marginTop: 16, background: "rgba(0,229,255,0.1)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.3)" }} onClick={reload}>↻ Refresh All Data</button>
       </div>
      </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function Overview({ users, transactions, rounds, bets, gameState }) {
  const deps  = transactions.filter(t=>t.type==="deposit"&&(t.status==="success"||t.status==="approved"));
  const wds   = transactions.filter(t=>t.type==="withdraw"&&(t.status==="approved"||t.status==="success"));
  const yesterday = Date.now() - 86400000;
  const active = new Set(bets.filter(b=>new Date(b.timestamp||0).getTime()>yesterday).map(b=>b.uid));
  const totalDeposits  = deps.reduce((s,t)=>s+(t.amount||0),0);
  const totalWithdraws = wds.reduce((s,t)=>s+(t.amount||0),0);
  const revenue        = totalDeposits - totalWithdraws;
  const byCountry      = users.reduce((a,u)=>{a[u.country]=(a[u.country]||0)+1;return a},{});
  const pending        = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending");
  const totalBalance   = users.reduce((s,u)=>s+(u.balance||0),0);
  const totalBets      = bets.reduce((s,b)=>s+(b.stake||0),0);
  const totalWins      = bets.filter(b=>b.result==="win").reduce((s,b)=>s+(b.winnings||0),0);
  const houseEdge      = totalBets > 0 ? (((totalBets-totalWins)/totalBets)*100).toFixed(1) : "0.0";

  const today = new Date(); today.setHours(0,0,0,0);
  const todayDeps = deps.filter(t=>new Date(t.timestamp||0)>=today).reduce((s,t)=>s+(t.amount||0),0);
  const todayWds  = wds.filter(t=>new Date(t.timestamp||0)>=today).reduce((s,t)=>s+(t.amount||0),0);

  return (
    <div>
      {/* Live game state */}
      <div style={{...s.gameStateBox, borderColor: gameState?.phase==="flying"?"rgba(0,230,118,0.4)":"rgba(255,193,7,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:gameState?.phase==="flying"?"#00e676":"#ffc107",boxShadow:`0 0 8px ${gameState?.phase==="flying"?"#00e676":"#ffc107"}`}}/>
          <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,color:"rgba(255,255,255,0.8)"}}>
            LIVE GAME: <strong style={{color:gameState?.phase==="flying"?"#00e676":gameState?.phase==="crashed"?"#ff1744":"#ffc107"}}>
              {(gameState?.phase||"unknown").toUpperCase()}
            </strong>
          </span>
          {gameState?.phase==="flying" && (
            <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>
              Round: {gameState?.roundId?.slice(0,8)}...
            </span>
          )}
        </div>
      </div>

      <div style={s.statsGrid}>
        <StatCard icon="💰" label="Total Deposits"    value={`KES ${fmt(totalDeposits)}`}  color="#00e676"/>
        <StatCard icon="💸" label="Total Withdrawals" value={`KES ${fmt(totalWithdraws)}`} color="#ff6b8a"/>
        <StatCard icon="📈" label="Net Revenue"       value={`KES ${fmt(revenue)}`}        color="#ffd700"/>
        <StatCard icon="🏦" label="Total User Balance"value={`KES ${fmt(totalBalance)}`}   color="#00e5ff"/>
        <StatCard icon="👥" label="Total Users"       value={users.length}                 color="#a78bfa"/>
        <StatCard icon="🎮" label="Active (24h)"      value={active.size}                  color="#34d399"/>
        <StatCard icon="🎲" label="Total Rounds"      value={rounds.length}                color="#fb923c"/>
        <StatCard icon="🎯" label="Total Bets"        value={bets.length}                  color="#60a5fa"/>
        <StatCard icon="⏳" label="Pending Withdrawals" value={pending.length}             color="#ffc107" sub="Awaiting approval"/>
        <StatCard icon="📊" label="House Edge"        value={`${houseEdge}%`}              color="#e879f9"/>
        <StatCard icon="📅" label="Today Deposits"    value={`KES ${fmt(todayDeps)}`}      color="#4ade80"/>
        <StatCard icon="📅" label="Today Withdrawals" value={`KES ${fmt(todayWds)}`}       color="#f87171"/>
      </div>

      <h3 style={s.sectionTitle}>🌍 Country Breakdown</h3>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
        {Object.entries(byCountry).map(([c,n])=>(
          <div key={c} style={{background:"#1e1940",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px 24px",textAlign:"center"}}>
            <div style={{fontSize:24}}>{c==="KE"?"🇰🇪":c==="TZ"?"🇹🇿":"🇺🇬"}</div>
            <div style={{fontWeight:700,fontSize:20,color:"#fff"}}>{n}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{c==="KE"?"Kenya":c==="TZ"?"Tanzania":"Uganda"}</div>
          </div>
        ))}
      </div>

      <h3 style={s.sectionTitle}>✈ Recent Round Multipliers</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:28}}>
        {rounds.slice(0,40).map((r,i)=>{
          const m   = r.crashMultiplier||0;
          const col = m>=10?"#ffd700":m>=3?"#00e5ff":"#ff6b8a";
          return (
            <span key={i} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${col}44`,borderRadius:20,padding:"4px 12px",fontSize:12,fontFamily:"'Orbitron',sans-serif",color:col}}>
              {m.toFixed(2)}x
            </span>
          );
        })}
      </div>

      <h3 style={s.sectionTitle}>📊 Bet Results Distribution</h3>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {[
          {label:"Wins",  count:bets.filter(b=>b.result==="win").length,  color:"#00e676"},
          {label:"Losses",count:bets.filter(b=>b.result==="lose").length, color:"#ff6b8a"},
          {label:"Pending",count:bets.filter(b=>b.result==="pending").length,color:"#ffc107"},
        ].map(({label,count,color})=>(
          <div key={label} style={{background:"#1e1940",border:`1px solid ${color}33`,borderRadius:10,padding:"12px 20px",textAlign:"center",minWidth:120}}>
            <div style={{fontSize:22,fontWeight:900,color,fontFamily:"'Orbitron',sans-serif"}}>{count}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PHASE 5: Super Admin Game Controls ───────────────────────
function GameControls({ adminUser, gameState, reload }) {
  const [loading,        setLoading]        = useState(false);
  const [queueMult,      setQueueMult]      = useState("");
  const [queueList,      setQueueList]      = useState([]);
  const [announcement,   setAnnouncement]   = useState("");
  const [maintenanceMode,setMaintenanceMode]= useState(false);
  const [houseEdge,      setHouseEdge]      = useState(5);
  const [minBet,         setMinBet]         = useState(10);
  const [maxBet,         setMaxBet]         = useState(100000);
  const [maxMultiplier,  setMaxMultiplier]  = useState(200);
  const [roundDelay,     setRoundDelay]     = useState(8);
  const [msg,            setMsg]            = useState("");

  const isSuperAdmin = adminUser?.role === "superadmin";

  // Load current settings
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "gameSettings", "config"));
      if (snap.exists()) {
        const d = snap.data();
        setHouseEdge(d.houseEdge ?? 5);
        setMinBet(d.minBet ?? 10);
        setMaxBet(d.maxBet ?? 100000);
        setMaxMultiplier(d.maxMultiplier ?? 200);
        setRoundDelay(d.roundDelay ?? 8);
        setMaintenanceMode(d.maintenanceMode ?? false);
        setQueueList(d.queuedMultipliers ?? []);
      }
    })();
  }, []);

  function showMsg(m, isErr = false) {
    setMsg({ text: m, err: isErr });
    setTimeout(() => setMsg(""), 4000);
  }

  // Force crash current round
  async function forceCrash() {
    if (!isSuperAdmin) return showMsg("Super Admin only", true);
    if (!confirm("Force crash the current round NOW?")) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "gameState", "current"), {
        phase:          "crashed",
        crashMultiplier: 1.01,
        updatedAt:       serverTimestamp(),
        forcedBy:        adminUser.uid,
      }, { merge: true });
      await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "FORCE_CRASH", "gameState", "Forced crash at 1.01x");
      showMsg("Round force-crashed at 1.01x");
    } catch(e) { showMsg(e.message, true); }
    setLoading(false);
  }

  // Force crash at specific multiplier
  async function forceCrashAt(mult) {
    if (!isSuperAdmin) return showMsg("Super Admin only", true);
    const m = parseFloat(mult);
    if (isNaN(m) || m < 1) return showMsg("Invalid multiplier", true);
    if (!confirm(`Force crash at ${m}x?`)) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "gameState", "current"), {
        phase:          "crashed",
        crashMultiplier: m,
        updatedAt:       serverTimestamp(),
        forcedBy:        adminUser.uid,
      }, { merge: true });
      await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "FORCE_CRASH", "gameState", `Forced crash at ${m}x`);
      showMsg(`Round force-crashed at ${m}x`);
    } catch(e) { showMsg(e.message, true); }
    setLoading(false);
  }

  // Queue a multiplier for next round
  async function addQueuedMultiplier() {
    const m = parseFloat(queueMult);
    if (isNaN(m) || m < 1.01) return showMsg("Enter valid multiplier (≥ 1.01)", true);
    const newList = [...queueList, m];
    setQueueList(newList);
    await setDoc(doc(db, "gameSettings", "config"), { queuedMultipliers: newList }, { merge: true });
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "QUEUE_MULTIPLIER", "gameSettings", `Queued ${m}x`);
    setQueueMult("");
    showMsg(`${m}x queued for upcoming round`);
  }

  async function removeQueued(idx) {
    const newList = queueList.filter((_,i)=>i!==idx);
    setQueueList(newList);
    await setDoc(doc(db, "gameSettings", "config"), { queuedMultipliers: newList }, { merge: true });
  }

  async function clearQueue() {
    if (!confirm("Clear all queued multipliers?")) return;
    setQueueList([]);
    await setDoc(doc(db, "gameSettings", "config"), { queuedMultipliers: [] }, { merge: true });
    showMsg("Queue cleared");
  }

  // Save game settings
  async function saveSettings() {
    if (!isSuperAdmin) return showMsg("Super Admin only", true);
    setLoading(true);
    try {
      await setDoc(doc(db, "gameSettings", "config"), {
        houseEdge, minBet, maxBet, maxMultiplier, roundDelay, maintenanceMode,
        updatedAt: serverTimestamp(), updatedBy: adminUser.uid,
      }, { merge: true });
      await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "UPDATE_SETTINGS", "gameSettings",
        `houseEdge:${houseEdge}%, minBet:${minBet}, maxBet:${maxBet}`);
      showMsg("Settings saved successfully");
    } catch(e) { showMsg(e.message, true); }
    setLoading(false);
  }

  // Toggle maintenance mode
  async function toggleMaintenance() {
    if (!isSuperAdmin) return showMsg("Super Admin only", true);
    const newVal = !maintenanceMode;
    setMaintenanceMode(newVal);
    await setDoc(doc(db, "gameSettings", "config"), { maintenanceMode: newVal }, { merge: true });
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "MAINTENANCE_MODE", "gameSettings", newVal?"Enabled":"Disabled");
    showMsg(`Maintenance mode ${newVal?"ENABLED":"DISABLED"}`);
  }

  // Send announcement
  async function sendAnnouncement() {
    if (!announcement.trim()) return;
    await addDoc(collection(db, "announcements"), {
      text:      announcement,
      createdBy: adminUser.uid,
      adminName: adminUser.fullName || adminUser.email,
      timestamp: serverTimestamp(),
      active:    true,
    });
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "ANNOUNCEMENT", "announcements", announcement);
    setAnnouncement("");
    showMsg("Announcement sent to all players");
  }

  // Reset game state
  async function resetGameState() {
    if (!isSuperAdmin) return showMsg("Super Admin only", true);
    if (!confirm("Reset game state to waiting? This will end the current round.")) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "gameState", "current"), {
        phase:          "waiting",
        crashMultiplier: null,
        startTime:       null,
        startTimeMs:     null,
        updatedAt:       serverTimestamp(),
        resetBy:         adminUser.uid,
      }, { merge: true });
      await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "RESET_GAME", "gameState", "Manual game state reset");
      showMsg("Game state reset to waiting");
    } catch(e) { showMsg(e.message, true); }
    setLoading(false);
  }

  return (
    <div>
      {msg && (
        <div style={{...s.msgBox, background:msg.err?"rgba(255,23,68,0.12)":"rgba(0,230,118,0.1)", borderColor:msg.err?"rgba(255,23,68,0.3)":"rgba(0,230,118,0.3)", color:msg.err?"#ff6b8a":"#00e676", marginBottom:16}}>
          {msg.text}
        </div>
      )}

      {!isSuperAdmin && (
        <div style={{...s.msgBox,background:"rgba(255,193,7,0.1)",borderColor:"rgba(255,193,7,0.3)",color:"#ffc107",marginBottom:16}}>
          ⚠️ Some controls require Super Admin privileges
        </div>
      )}

      {/* Live Game Status */}
      <div style={{...s.controlCard, borderColor:"rgba(0,230,118,0.25)"}}>
        <h3 style={{...s.sectionTitle,marginBottom:14}}>🎮 Live Game Status</h3>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:gameState?.phase==="flying"?"#00e676":"#ffc107",boxShadow:`0 0 10px ${gameState?.phase==="flying"?"#00e676":"#ffc107"}`}}/>
            <span style={{color:"rgba(255,255,255,0.8)",fontFamily:"'Orbitron',sans-serif",fontSize:13}}>
              {(gameState?.phase||"UNKNOWN").toUpperCase()}
            </span>
          </div>
          {gameState?.roundId && (
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>
              Round: {gameState.roundId.slice(0,16)}...
            </span>
          )}
        </div>
      </div>

      {/* Force Crash Controls */}
      <div style={{...s.controlCard, borderColor:"rgba(255,23,68,0.3)"}}>
        <h3 style={{...s.sectionTitle,marginBottom:14,color:"#ff6b8a"}}>⚡ Force Crash Controls</h3>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
          <button style={{...s.dangerBtn}} disabled={loading||!isSuperAdmin} onClick={forceCrash}>
            💥 Force Crash NOW (1.01x)
          </button>
          <button style={{...s.dangerBtn,background:"rgba(255,100,0,0.15)",borderColor:"rgba(255,100,0,0.4)",color:"#ff8c00"}}
            disabled={loading||!isSuperAdmin}
            onClick={()=>{const m=prompt("Crash at multiplier:");if(m)forceCrashAt(m);}}>
            💥 Force Crash at Custom x
          </button>
          <button style={{...s.warnBtn}} disabled={loading||!isSuperAdmin} onClick={resetGameState}>
            🔄 Reset Game State
          </button>
        </div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>⚠️ Force crash immediately ends the current round at the specified multiplier. All active bets will be lost.</p>
      </div>

      {/* Queue Multipliers */}
      <div style={{...s.controlCard, borderColor:"rgba(0,229,255,0.25)"}}>
        <h3 style={{...s.sectionTitle,marginBottom:14,color:"#00e5ff"}}>📋 Queue Multipliers</h3>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:12}}>
          Set specific crash multipliers for upcoming rounds. They will be used in order, then random generation resumes.
        </p>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...s.input,flex:1}} type="number" min="1.01" step="0.01"
            placeholder="e.g. 5.00" value={queueMult} onChange={e=>setQueueMult(e.target.value)}/>
          <button style={{...s.successBtn}} onClick={addQueuedMultiplier}>+ Queue</button>
          {queueList.length > 0 && (
            <button style={{...s.warnBtn}} onClick={clearQueue}>Clear All</button>
          )}
        </div>
        {queueList.length > 0 ? (
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {queueList.map((m,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(0,229,255,0.1)",border:"1px solid rgba(0,229,255,0.3)",borderRadius:8,padding:"5px 10px"}}>
                <span style={{fontFamily:"'Orbitron',sans-serif",color:"#00e5ff",fontSize:13,fontWeight:700}}>
                  #{i+1}: {m}x
                </span>
                <button style={{background:"none",border:"none",color:"#ff6b8a",cursor:"pointer",fontSize:14,padding:"0 2px"}}
                  onClick={()=>removeQueued(i)}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:12}}>No multipliers queued — using random generation</div>
        )}
      </div>

      {/* Game Settings */}
      <div style={{...s.controlCard, borderColor:"rgba(255,215,0,0.25)"}}>
        <h3 style={{...s.sectionTitle,marginBottom:14,color:"#ffd700"}}>⚙️ Game Settings</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:16}}>
          {[
            {label:"House Edge (%)",  val:houseEdge,    set:setHouseEdge,    min:0,   max:20,   step:0.5},
            {label:"Min Bet (KES)",   val:minBet,       set:setMinBet,       min:1,   max:1000, step:1},
            {label:"Max Bet (KES)",   val:maxBet,       set:setMaxBet,       min:100, max:1e6,  step:100},
            {label:"Max Multiplier",  val:maxMultiplier,set:setMaxMultiplier,min:10,  max:1000, step:10},
            {label:"Round Delay (s)", val:roundDelay,   set:setRoundDelay,   min:3,   max:30,   step:1},
          ].map(({label,val,set,min,max,step})=>(
            <div key={label}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
              <input style={{...s.input,width:"100%"}} type="number" min={min} max={max} step={step}
                value={val} onChange={e=>set(Number(e.target.value))} disabled={!isSuperAdmin}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button style={{...s.successBtn}} onClick={saveSettings} disabled={loading||!isSuperAdmin}>
            💾 Save Settings
          </button>
          <button style={{...s.warnBtn, background:maintenanceMode?"rgba(0,230,118,0.1)":"rgba(255,193,7,0.1)", borderColor:maintenanceMode?"rgba(0,230,118,0.3)":"rgba(255,193,7,0.3)", color:maintenanceMode?"#00e676":"#ffc107"}}
            onClick={toggleMaintenance} disabled={!isSuperAdmin}>
            {maintenanceMode ? "🟢 Disable Maintenance" : "🔧 Enable Maintenance"}
          </button>
        </div>
      </div>

      {/* Announcements */}
      <div style={{...s.controlCard, borderColor:"rgba(124,77,255,0.3)"}}>
        <h3 style={{...s.sectionTitle,marginBottom:14,color:"#a78bfa"}}>📢 Send Announcement</h3>
        <div style={{display:"flex",gap:8}}>
          <input style={{...s.input,flex:1}} type="text" placeholder="Message to all players..."
            value={announcement} onChange={e=>setAnnouncement(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&sendAnnouncement()}/>
          <button style={{...s.successBtn}} onClick={sendAnnouncement}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Withdrawals Tab ───────────────────────────────────────────
function Withdrawals({ transactions, adminUid, reload }) {
  const [note,    setNote]    = useState({});
  const [loading, setLoading] = useState({});
  const pending   = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending");
  const processed = transactions.filter(t=>t.type==="withdraw"&&t.status!=="pending");

  async function process(txnId, action) {
    setLoading(l=>({...l,[txnId]:true}));
    try {
      const res = await fetch("/api/admin/process-withdrawal", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ adminUid, transactionId:txnId, action, note:note[txnId]||"" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      alert(`Withdrawal ${action}d: ${d.message}`);
      reload();
    } catch(e) { alert("Error: "+e.message); }
    setLoading(l=>({...l,[txnId]:false}));
  }

  return (
    <div>
      <h3 style={s.sectionTitle}>⏳ Pending Withdrawals ({pending.length})</h3>
      {pending.length===0 && <div style={s.empty}>No pending withdrawals</div>}
      {pending.map(t=>(
        <div key={t.id} style={s.withdrawCard}>
          <div style={s.withdrawHeader}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{t.fullName||"—"}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{t.email}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#ffc107"}}>{fmt(t.amount)} {t.currency}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{t.phoneNumber}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:10}}>
            Requested: {fmtDate(t.requestedAt || t.timestamp)}
          </div>
          <input style={{...s.input,marginBottom:8,fontSize:12}}
            placeholder="Add note (optional)" value={note[t.id]||""}
            onChange={e=>setNote(n=>({...n,[t.id]:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{...s.btn,background:"#00e676",color:"#000",flex:1}} disabled={loading[t.id]}
              onClick={()=>process(t.id,"approve")}>
              {loading[t.id]?"Processing...":"✅ Approve & Pay"}
            </button>
            <button style={{...s.btn,background:"#ff1744",color:"#fff",flex:1}} disabled={loading[t.id]}
              onClick={()=>process(t.id,"decline")}>
              ❌ Decline
            </button>
          </div>
        </div>
      ))}

      <h3 style={{...s.sectionTitle,marginTop:32}}>📋 Processed Withdrawals ({processed.length})</h3>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Name","Amount","Phone","Status","Note","Date"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {processed.map(t=>(
              <tr key={t.id} style={s.tr}>
                <td style={s.td}>{t.fullName||"—"}</td>
                <td style={s.td}>{fmt(t.amount)} {t.currency}</td>
                <td style={s.td}>{t.phoneNumber}</td>
                <td style={s.td}><span style={{color:statusColor(t.status)}}>{statusLabel(t.status)}</span></td>
                <td style={s.td}>{t.adminNote||"—"}</td>
                <td style={s.td}>{fmtDate(t.processedAt||t.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Enhanced Users Tab ────────────────────────────────────────
function Users({ users, adminUser, reload }) {
  const [filter,    setFilter]    = useState("");
  const [loading,   setLoading]   = useState({});
  const [editUser,  setEditUser]  = useState(null);
  const [newBal,    setNewBal]    = useState("");
  const [sortBy,    setSortBy]    = useState("fullName");
  const [sortDir,   setSortDir]   = useState("asc");

  const isSuperAdmin = adminUser?.role === "superadmin";

  async function toggleChat(uid, current) {
    setLoading(l=>({...l,[uid]:true}));
    await updateDoc(doc(db,"users",uid),{chatEnabled:!current});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "TOGGLE_CHAT", uid, !current?"Enabled":"Disabled");
    reload(); setLoading(l=>({...l,[uid]:false}));
  }

  async function toggleRole(uid, current) {
    if (!isSuperAdmin) return alert("Super Admin only");
    const newRole = current==="admin"?"user":"admin";
    if (!confirm(`Change role to ${newRole}?`)) return;
    await updateDoc(doc(db,"users",uid),{role:newRole});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "CHANGE_ROLE", uid, `→ ${newRole}`);
    reload();
  }

  async function setSuperAdmin(uid) {
    if (!isSuperAdmin) return alert("Super Admin only");
    if (!confirm("Grant SUPER ADMIN role? This is irreversible without manual DB edit.")) return;
    await updateDoc(doc(db,"users",uid),{role:"superadmin"});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "SET_SUPERADMIN", uid, "Granted superadmin");
    reload();
  }

  async function banUser(uid, current) {
    if (!isSuperAdmin) return alert("Super Admin only");
    const newBanned = !current;
    if (!confirm(`${newBanned?"BAN":"UNBAN"} this user?`)) return;
    await updateDoc(doc(db,"users",uid),{banned:newBanned});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, newBanned?"BAN_USER":"UNBAN_USER", uid, "");
    reload();
  }

  async function adjustBalance(uid, field) {
    if (!isSuperAdmin) return alert("Super Admin only");
    const amount = parseFloat(newBal);
    if (isNaN(amount)) return alert("Enter valid amount");
    if (!confirm(`Set ${field} to ${amount}?`)) return;
    await updateDoc(doc(db,"users",uid),{[field]:amount});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "ADJUST_BALANCE", uid, `${field}=${amount}`);
    setEditUser(null); setNewBal("");
    reload();
  }

  async function resetDemoBalance(uid) {
    await updateDoc(doc(db,"users",uid),{demoBalance:10000});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "RESET_DEMO", uid, "Reset to 10000");
    reload();
  }

  async function forceMode(uid, mode) {
    await updateDoc(doc(db,"users",uid),{mode});
    await logAction(adminUser.uid, adminUser.fullName||adminUser.email, "FORCE_MODE", uid, `→ ${mode}`);
    reload();
  }

  const filtered = users
    .filter(u=>!filter||(u.email||"").includes(filter)||(u.fullName||"").toLowerCase().includes(filter.toLowerCase())||(u.phone||"").includes(filter))
    .sort((a,b)=>{
      const av = a[sortBy]||"", bv = b[sortBy]||"";
      return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });

  function SortBtn({field,label}) {
    return (
      <th style={{...s.th,cursor:"pointer",userSelect:"none"}} onClick={()=>{setSortBy(field);setSortDir(d=>d==="asc"?"desc":"asc");}}>
        {label} {sortBy===field?(sortDir==="asc"?"↑":"↓"):""}
      </th>
    );
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h3 style={{...s.sectionTitle,margin:0}}>👥 Users ({filtered.length}/{users.length})</h3>
        <input style={{...s.input,width:280,margin:0}} placeholder="Search name, email, phone..."
          value={filter} onChange={e=>setFilter(e.target.value)}/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead>
            <tr>
              <SortBtn field="fullName" label="Name"/>
              <SortBtn field="email"    label="Email"/>
              <th style={s.th}>Phone</th>
              <th style={s.th}>Country</th>
              <SortBtn field="balance"  label="Balance"/>
              <th style={s.th}>Demo Bal</th>
              <th style={s.th}>Mode</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Chat</th>
              <th style={s.th}>Status</th>
              <th style={{...s.th,minWidth:240}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u.uid||u.id} style={{...s.tr, background:u.banned?"rgba(255,23,68,0.05)":"transparent"}}>
                <td style={s.td}>{u.fullName||"—"}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>{u.phone}</td>
                <td style={s.td}>{u.country==="KE"?"🇰🇪":u.country==="TZ"?"🇹🇿":"🇺🇬"} {u.country}</td>
                <td style={s.td}>
                  <span style={{color:"#ffd700",fontWeight:700,fontFamily:"'Orbitron',sans-serif",fontSize:11}}>
                    {fmt(u.balance)}
                  </span>
                </td>
                <td style={s.td}>{fmt(u.demoBalance)}</td>
                <td style={s.td}>
                  <span style={{color:u.mode==="demo"?"#ffc107":"#00e676",fontSize:11,fontWeight:700}}>
                    {u.mode||"real"}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{color:u.role==="superadmin"?"#ffd700":u.role==="admin"?"#00e5ff":"rgba(255,255,255,0.4)",fontSize:11,fontWeight:700}}>
                    {u.role||"user"}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{color:u.chatEnabled?"#00e676":"#ff6b8a",fontSize:11}}>
                    {u.chatEnabled?"✓":"✗"}
                  </span>
                </td>
                <td style={s.td}>
                  {u.banned
                    ? <span style={{color:"#ff1744",fontSize:11,fontWeight:700}}>🚫 BANNED</span>
                    : <span style={{color:"#00e676",fontSize:11}}>✓ Active</span>}
                </td>
                <td style={s.td}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button style={{...s.smallBtn,background:u.chatEnabled?"rgba(255,23,68,0.2)":"rgba(0,230,118,0.2)",color:u.chatEnabled?"#ff6b8a":"#00e676"}}
                      disabled={loading[u.uid]} onClick={()=>toggleChat(u.uid,u.chatEnabled)}>
                      {u.chatEnabled?"Revoke Chat":"Allow Chat"}
                    </button>
                    {isSuperAdmin && (
                      <>
                        <button style={{...s.smallBtn,background:"rgba(255,215,0,0.1)",color:"#ffd700"}}
                          onClick={()=>toggleRole(u.uid,u.role)}>
                          {u.role==="admin"?"→ User":"→ Admin"}
                        </button>
                        <button style={{...s.smallBtn,background:u.banned?"rgba(0,230,118,0.1)":"rgba(255,23,68,0.1)",color:u.banned?"#00e676":"#ff6b8a"}}
                          onClick={()=>banUser(u.uid,u.banned)}>
                          {u.banned?"Unban":"Ban"}
                        </button>
                        <button style={{...s.smallBtn,background:"rgba(0,229,255,0.1)",color:"#00e5ff"}}
                          onClick={()=>{setEditUser(u);setNewBal(u.balance||0);}}>
                          Edit Bal
                        </button>
                        <button style={{...s.smallBtn,background:"rgba(124,77,255,0.1)",color:"#a78bfa"}}
                          onClick={()=>resetDemoBalance(u.uid)}>
                          Reset Demo
                        </button>
                        <button style={{...s.smallBtn,background:"rgba(255,100,0,0.1)",color:"#fb923c"}}
                          onClick={()=>forceMode(u.uid,u.mode==="demo"?"real":"demo")}>
                          {u.mode==="demo"?"→ Real":"→ Demo"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Balance Modal */}
      {editUser && (
        <div style={s.modalOverlay} onClick={()=>setEditUser(null)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <h3 style={{...s.sectionTitle,marginBottom:16}}>Edit Balance: {editUser.fullName}</h3>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5}}>REAL BALANCE</div>
              <div style={{display:"flex",gap:8}}>
                <input style={{...s.input,flex:1}} type="number" value={newBal} onChange={e=>setNewBal(e.target.value)}/>
                <button style={{...s.successBtn}} onClick={()=>adjustBalance(editUser.uid,"balance")}>Set</button>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:5}}>DEMO BALANCE</div>
              <div style={{display:"flex",gap:8}}>
                <input style={{...s.input,flex:1}} type="number" defaultValue={editUser.demoBalance||0}
                  onChange={e=>setNewBal(e.target.value)}/>
                <button style={{...s.successBtn}} onClick={()=>adjustBalance(editUser.uid,"demoBalance")}>Set</button>
              </div>
            </div>
            {editUser.role !== "superadmin" && (
              <button style={{...s.dangerBtn,width:"100%",marginBottom:8}}
                onClick={()=>setSuperAdmin(editUser.uid)}>
                ⭐ Grant Super Admin
              </button>
            )}
            <button style={{...s.smallBtn,width:"100%",marginTop:4}} onClick={()=>setEditUser(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transactions Tab ──────────────────────────────────────────
function Transactions({ transactions }) {
  const [filter,  setFilter]  = useState("all");
  const [search,  setSearch]  = useState("");
  const [dateFrom,setDateFrom]= useState("");
  const [dateTo,  setDateTo]  = useState("");

  let filtered = filter==="all" ? transactions : transactions.filter(t=>t.type===filter);
  if (search) filtered = filtered.filter(t=>(t.fullName||"").toLowerCase().includes(search.toLowerCase())||(t.email||"").includes(search)||(t.phoneNumber||"").includes(search));
  if (dateFrom) filtered = filtered.filter(t=>new Date(t.timestamp||0)>=new Date(dateFrom));
  if (dateTo)   filtered = filtered.filter(t=>new Date(t.timestamp||0)<=new Date(dateTo+" 23:59:59"));

  const totalAmount = filtered.reduce((s,t)=>s+(t.amount||0),0);

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {["all","deposit","withdraw"].map(f=>(
          <button key={f} style={{...s.filterBtn,background:filter===f?"rgba(232,0,61,0.2)":"rgba(255,255,255,0.05)",color:filter===f?"#ff6b8a":"rgba(255,255,255,0.5)",borderColor:filter===f?"rgba(232,0,61,0.4)":"rgba(255,255,255,0.1)"}}
            onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
        <input style={{...s.input,width:200,margin:0}} placeholder="Search name/email/phone" value={search} onChange={e=>setSearch(e.target.value)}/>
        <input style={{...s.input,width:140,margin:0}} type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
        <input style={{...s.input,width:140,margin:0}} type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
      </div>
      <div style={{marginBottom:12,fontSize:12,color:"rgba(255,255,255,0.4)"}}>
        Showing {filtered.length} transactions | Total: <strong style={{color:"#ffd700"}}>KES {fmt(totalAmount)}</strong>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Type","Name","Amount","Currency","Phone","Status","Date"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(t=>(
              <tr key={t.id} style={s.tr}>
                <td style={s.td}><span style={{color:t.type==="deposit"?"#00e676":"#ff6b8a",fontWeight:700,textTransform:"uppercase",fontSize:11}}>{t.type}</span></td>
                <td style={s.td}>{t.fullName||"—"}</td>
                <td style={s.td}><strong>{fmt(t.amount)}</strong></td>
                <td style={s.td}>{t.currency}</td>
                <td style={s.td}>{t.phoneNumber||"—"}</td>
                <td style={s.td}><span style={{color:statusColor(t.status)}}>{statusLabel(t.status)}</span></td>
                <td style={s.td}>{fmtDate(t.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Rounds Tab ────────────────────────────────────────────────
function Rounds({ rounds }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all" ? rounds
    : filter==="high" ? rounds.filter(r=>(r.crashMultiplier||0)>=10)
    : filter==="mid"  ? rounds.filter(r=>(r.crashMultiplier||0)>=3&&(r.crashMultiplier||0)<10)
    : rounds.filter(r=>(r.crashMultiplier||0)<3);

  const avg = rounds.length ? (rounds.reduce((s,r)=>s+(r.crashMultiplier||0),0)/rounds.length).toFixed(2) : 0;
  const max = rounds.length ? Math.max(...rounds.map(r=>r.crashMultiplier||0)).toFixed(2) : 0;
  const min = rounds.length ? Math.min(...rounds.map(r=>r.crashMultiplier||0)).toFixed(2) : 0;

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{l:"Avg Multiplier",v:`${avg}x`,c:"#00e5ff"},{l:"Max Multiplier",v:`${max}x`,c:"#ffd700"},{l:"Min Multiplier",v:`${min}x`,c:"#ff6b8a"},{l:"Total Rounds",v:rounds.length,c:"#a78bfa"}].map(({l,v,c})=>(
          <div key={l} style={{background:"#1e1940",border:`1px solid ${c}33`,borderRadius:10,padding:"12px 18px",textAlign:"center",minWidth:120}}>
            <div style={{fontSize:18,fontWeight:900,color:c,fontFamily:"'Orbitron',sans-serif"}}>{v}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["all","All"],["high","≥10x"],["mid","3-10x"],["low","<3x"]].map(([k,l])=>(
          <button key={k} style={{...s.filterBtn,background:filter===k?"rgba(232,0,61,0.2)":"rgba(255,255,255,0.05)",color:filter===k?"#ff6b8a":"rgba(255,255,255,0.5)",borderColor:filter===k?"rgba(232,0,61,0.4)":"rgba(255,255,255,0.1)"}}
            onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Round ID","Crash Multiplier","Phase","Started","Ended","Duration"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(r=>{
              const m   = r.crashMultiplier||0;
              const col = m>=10?"#ffd700":m>=3?"#00e5ff":"#ff6b8a";
              const start = r.startTime?.toDate?.();
              const end   = r.endTime?.toDate?.();
              const dur   = start&&end ? `${((end-start)/1000).toFixed(1)}s` : "—";
              return (
                <tr key={r.id} style={s.tr}>
                  <td style={{...s.td,fontSize:10,opacity:.55}}>{r.id?.slice(0,14)}...</td>
                  <td style={s.td}><span style={{color:col,fontWeight:900,fontFamily:"'Orbitron',sans-serif",fontSize:15}}>{m.toFixed(2)}x</span></td>
                  <td style={s.td}>{r.phase}</td>
                  <td style={s.td}>{fmtDate(r.startTime)}</td>
                  <td style={s.td}>{fmtDate(r.endTime)}</td>
                  <td style={s.td}>{dur}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bets Tab ──────────────────────────────────────────────────
function Bets({ bets }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  let filtered = filter==="all" ? bets : bets.filter(b=>b.result===filter);
  if (search) filtered = filtered.filter(b=>(b.fullName||"").toLowerCase().includes(search.toLowerCase())||(b.email||"").includes(search));

  const totalStake = filtered.reduce((s,b)=>s+(b.stake||0),0);
  const totalWins  = filtered.filter(b=>b.result==="win").reduce((s,b)=>s+(b.winnings||0),0);

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {["all","win","lose","pending"].map(f=>(
          <button key={f} style={{...s.filterBtn,background:filter===f?"rgba(232,0,61,0.2)":"rgba(255,255,255,0.05)",color:filter===f?"#ff6b8a":"rgba(255,255,255,0.5)",borderColor:filter===f?"rgba(232,0,61,0.4)":"rgba(255,255,255,0.1)"}}
            onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
        <input style={{...s.input,width:220,margin:0}} placeholder="Search player..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:14,fontSize:12,color:"rgba(255,255,255,0.4)"}}>
        <span>Showing: <strong style={{color:"#fff"}}>{filtered.length}</strong></span>
        <span>Total Staked: <strong style={{color:"#ffd700"}}>KES {fmt(totalStake)}</strong></span>
        <span>Total Won: <strong style={{color:"#00e676"}}>KES {fmt(totalWins)}</strong></span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Player","Email","Stake","Currency","Auto Cashout","Result","Cashout @","Winnings","Mode","Date"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(b=>(
              <tr key={b.id} style={s.tr}>
                <td style={s.td}>{b.fullName||"—"}</td>
                <td style={{...s.td,fontSize:11,opacity:.6}}>{b.email||"—"}</td>
                <td style={s.td}><strong>{fmt(b.stake)}</strong></td>
                <td style={s.td}>{b.currency}</td>
                <td style={s.td}>{b.autoCashout?`${b.autoCashout}x`:"Manual"}</td>
                <td style={s.td}><span style={{color:b.result==="win"?"#00e676":b.result==="lose"?"#ff6b8a":"#ffc107",fontWeight:700}}>{b.result||"pending"}</span></td>
                <td style={s.td}>{b.cashoutMultiplier?`${b.cashoutMultiplier}x`:"—"}</td>
                <td style={s.td}>{b.winnings?fmt(b.winnings):"—"}</td>
                <td style={s.td}><span style={{fontSize:11,color:b.mode==="demo"?"#ffc107":"#00e676"}}>{b.mode||"real"}</span></td>
                <td style={s.td}>{fmtDate(b.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Admin Logs Tab ────────────────────────────────────────────
function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db,"adminLogs"),orderBy("timestamp","desc"),limit(200));
    const unsub = onSnapshot(q, snap=>{
      setLogs(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return unsub;
  }, []);

  const actionColor = (a) => {
    if (a?.includes("CRASH"))  return "#ff6b8a";
    if (a?.includes("BAN"))    return "#ff1744";
    if (a?.includes("SUPER"))  return "#ffd700";
    if (a?.includes("ADMIN"))  return "#00e5ff";
    if (a?.includes("BALANCE"))return "#a78bfa";
    return "rgba(255,255,255,0.6)";
  };

  return (
    <div>
      <h3 style={s.sectionTitle}>📋 Admin Activity Logs ({logs.length})</h3>
      {loading && <div style={s.empty}>Loading logs...</div>}
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Admin","Action","Target","Details","Time"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {logs.map(l=>(
              <tr key={l.id} style={s.tr}>
                <td style={s.td}>{l.adminName||l.adminUid?.slice(0,8)||"—"}</td>
                <td style={s.td}><span style={{color:actionColor(l.action),fontWeight:700,fontSize:11,fontFamily:"'Orbitron',sans-serif"}}>{l.action}</span></td>
                <td style={{...s.td,fontSize:10,opacity:.5}}>{l.targetUid?.slice(0,12)||"—"}</td>
                <td style={s.td}>{l.details||"—"}</td>
                <td style={s.td}>{fmtDate(l.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Announcements Tab ─────────────────────────────────────────
function Announcements({ adminUser }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db,"announcements"),orderBy("timestamp","desc"),limit(50));
    const unsub = onSnapshot(q, snap=>{
      setList(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function toggleActive(id, current) {
    await updateDoc(doc(db,"announcements",id),{active:!current});
  }
  async function deleteAnn(id) {
    if (!confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db,"announcements",id));
  }

  return (
    <div>
      <h3 style={s.sectionTitle}>📢 Announcements ({list.length})</h3>
      {loading && <div style={s.empty}>Loading...</div>}
      {list.map(a=>(
        <div key={a.id} style={{...s.withdrawCard,borderColor:a.active?"rgba(0,230,118,0.3)":"rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:14,marginBottom:5}}>{a.text}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>
                By {a.adminName||"—"} · {fmtDate(a.timestamp)}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button style={{...s.smallBtn,color:a.active?"#00e676":"rgba(255,255,255,0.4)"}}
                onClick={()=>toggleActive(a.id,a.active)}>
                {a.active?"Active":"Inactive"}
              </button>
              <button style={{...s.smallBtn,color:"#ff6b8a"}} onClick={()=>deleteAnn(a.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Admin App ────────────────────────────────────────────
export default function AdminApp() {
  const [adminUser,   setAdminUser]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab,         setTab]         = useState("overview");
  const [users,       setUsers]       = useState([]);
  const [transactions,setTransactions]= useState([]);
  const [rounds,      setRounds]      = useState([]);
  const [bets,        setBets]        = useState([]);
  const [gameState,   setGameState]   = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      if (u) {
        const snap = await getDoc(doc(db,"users",u.uid));
        if (snap.exists() && ["admin","superadmin"].includes(snap.data().role)) {
          setAdminUser({uid:u.uid,...snap.data()});
        } else {
          await signOut(auth); setAdminUser(null);
        }
      } else setAdminUser(null);
      setAuthLoading(false);
    });
  },[]);

  useEffect(()=>{
    if (!adminUser) return;
    loadAll();
    // Live game state listener
    const unsubState = onSnapshot(doc(db,"gameState","current"), snap=>{
      if (snap.exists()) setGameState(snap.data());
    });
    // Live data listeners
    const unsubUsers = onSnapshot(collection(db,"users"), snap => {
      setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    const unsubTx = onSnapshot(query(collection(db,"transactions"),orderBy("timestamp","desc"),limit(500)), snap => {
      setTransactions(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    const unsubRounds = onSnapshot(query(collection(db,"rounds"),orderBy("startTime","desc"),limit(200)), snap => {
      setRounds(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    const unsubBets = onSnapshot(query(collection(db,"bets"),orderBy("timestamp","desc"),limit(500)), snap => {
      setBets(snap.docs.map(d=>({id:d.id,...d.data()})));
    });

    return () => {
      unsubState(); unsubUsers(); unsubTx(); unsubRounds(); unsubBets();
    };
  },[adminUser]);

  async function loadAll() {
    setDataLoading(true);
    // Initial fetch is now supplemented by live listeners
    const [uSnap,tSnap,rSnap,bSnap] = await Promise.all([
      getDocs(collection(db,"users")),
      getDocs(query(collection(db,"transactions"),orderBy("timestamp","desc"),limit(500))),
      getDocs(query(collection(db,"rounds"),orderBy("startTime","desc"),limit(200))),
      getDocs(query(collection(db,"bets"),orderBy("timestamp","desc"),limit(500))),
    ]);
    setUsers(uSnap.docs.map(d=>({id:d.id,...d.data()})));
    setTransactions(tSnap.docs.map(d=>({id:d.id,...d.data()})));
    setRounds(rSnap.docs.map(d=>({id:d.id,...d.data()})));
    setBets(bSnap.docs.map(d=>({id:d.id,...d.data()})));
    setDataLoading(false);
  }

  const pendingCount = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending").length;
  const isSuperAdmin = adminUser?.role === "superadmin";

  if (authLoading) return (
    <div style={{...s.page,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>
      Loading...
    </div>
  );
  if (!adminUser) return <AdminLogin onLogin={u=>{setAdminUser(u);}}/>;

  const TABS = [
    {k:"control-center",l:"🚀 Control Center"},
    {k:"overview",     l:"📊 Overview"},
    {k:"game-controls",l:"🎮 Game Controls"},
    {k:"withdrawals",  l:`💸 Withdrawals${pendingCount>0?` (${pendingCount})`:""}`},
    {k:"users",        l:"👥 Users"},
    {k:"transactions", l:"💳 Transactions"},
    {k:"rounds",       l:"✈ Rounds"},
    {k:"bets",         l:"🎯 Bets"},
    {k:"logs",         l:"📋 Admin Logs"},
    {k:"announcements",l:"📢 Announcements"},
  ];

  return (
    <div style={s.page}>
      {/* Top nav */}
      <nav style={s.nav}>
        <div style={s.navLogo}>✈ AVIATOR ADMIN</div>
        <div style={s.navTabs}>
          {TABS.map(({k,l})=>(
            <button key={k} style={{...s.navTab,background:tab===k?"rgba(232,0,61,0.15)":"transparent",color:tab===k?"#ff6b8a":"rgba(255,255,255,0.45)",borderBottom:tab===k?"2px solid #e8003d":"2px solid transparent"}}
              onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.6)",fontWeight:600}}>{adminUser.fullName||adminUser.email}</span>
            <span style={{fontSize:10,color:isSuperAdmin?"#ffd700":"#00e5ff",fontWeight:700,fontFamily:"'Orbitron',sans-serif"}}>
              {isSuperAdmin?"⭐ SUPER ADMIN":"🛡 ADMIN"}
            </span>
          </div>
          <button style={{...s.smallBtn,color:"rgba(255,255,255,0.4)"}} onClick={()=>signOut(auth)}>Logout</button>
          <button style={{...s.smallBtn,background:"rgba(0,229,255,0.1)",color:"#00e5ff"}} onClick={loadAll}>↻ Refresh</button>
        </div>
      </nav>

      {/* Live game state indicator */}
      <div style={{background:"#12102a",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"6px 20px",display:"flex",alignItems:"center",gap:12,fontSize:12}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:gameState?.phase==="flying"?"#00e676":"#ffc107",boxShadow:`0 0 6px ${gameState?.phase==="flying"?"#00e676":"#ffc107"}`}}/>
        <span style={{color:"rgba(255,255,255,0.5)"}}>
          Game: <strong style={{color:gameState?.phase==="flying"?"#00e676":gameState?.phase==="crashed"?"#ff1744":"#ffc107"}}>
            {(gameState?.phase||"unknown").toUpperCase()}
          </strong>
        </span>
        {gameState?.roundId && <span style={{color:"rgba(255,255,255,0.3)"}}>Round: {gameState.roundId.slice(0,10)}...</span>}
        <span style={{marginLeft:"auto",color:"rgba(255,255,255,0.25)",fontSize:11}}>
          {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Content */}
      <div style={s.content}>
        {dataLoading && <div style={s.loadingBar}>Loading data...</div>}
        {tab==="control-center" && <ControlCenter adminUser={adminUser} gameState={gameState} users={users} bets={bets} transactions={transactions} rounds={rounds} reload={loadAll}/>}
        {tab==="overview"      && <Overview users={users} transactions={transactions} rounds={rounds} bets={bets} gameState={gameState}/>}
        {tab==="game-controls" && <GameControls adminUser={adminUser} gameState={gameState} reload={loadAll}/>}
        {tab==="withdrawals"   && <Withdrawals transactions={transactions} adminUid={adminUser.uid} reload={loadAll}/>}
        {tab==="users"         && <Users users={users} adminUser={adminUser} reload={loadAll}/>}
        {tab==="transactions"  && <Transactions transactions={transactions}/>}
        {tab==="rounds"        && <Rounds rounds={rounds}/>}
        {tab==="bets"          && <Bets bets={bets}/>}
        {tab==="logs"          && <AdminLogs/>}
        {tab==="announcements" && <Announcements adminUser={adminUser}/>}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  page:       {background:"#0e0b1e",minHeight:"100vh",color:"#e8e8f0",fontFamily:"'Inter',sans-serif"},
  nav:        {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",background:"#12102a",borderBottom:"1px solid rgba(232,0,61,0.2)",height:52,gap:12,flexWrap:"wrap"},
  navLogo:    {fontFamily:"'Orbitron',sans-serif",color:"#e8003d",fontWeight:900,fontSize:16,letterSpacing:2,flexShrink:0,textShadow:"0 0 12px rgba(232,0,61,0.5)"},
  navTabs:    {display:"flex",gap:2,flex:1,overflowX:"auto"},
  navTab:     {padding:"0 14px",height:52,border:"none",background:"transparent",cursor:"pointer",fontSize:12,fontWeight:600,letterSpacing:0.3,whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"},
  content:    {padding:24,maxWidth:1500,margin:"0 auto"},
  loadingBar: {background:"rgba(0,229,255,0.08)",border:"1px solid rgba(0,229,255,0.2)",color:"#00e5ff",padding:"8px 16px",borderRadius:8,marginBottom:20,fontSize:12},
  statsGrid:  {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12,marginBottom:28},
  statCard:   {background:"#1e1940",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px",transition:"border-color 0.2s,transform 0.15s"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:13,letterSpacing:1,color:"rgba(255,255,255,0.65)",marginBottom:16,marginTop:0},
  table:      {width:"100%",borderCollapse:"collapse",fontSize:12,background:"#1a1535",borderRadius:10,overflow:"hidden"},
  th:         {background:"#16122e",padding:"10px 14px",textAlign:"left",color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  tr:         {borderBottom:"1px solid rgba(255,255,255,0.04)"},
  td:         {padding:"9px 14px",color:"#e8e8f0",verticalAlign:"middle"},
  empty:      {padding:32,textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:13},
  withdrawCard:{background:"#1e1940",border:"1px solid rgba(255,193,7,0.25)",borderRadius:12,padding:18,marginBottom:12},
  withdrawHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  loginPage:  {minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse at top,#1a0a35,#0e0b1e)"},
  loginCard:  {background:"#1e1940",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"40px 36px",width:360,display:"flex",flexDirection:"column",gap:16},
  loginLogo:  {fontFamily:"'Orbitron',sans-serif",color:"#e8003d",fontSize:22,fontWeight:900,letterSpacing:3,textAlign:"center"},
  loginTitle: {textAlign:"center",fontFamily:"'Orbitron',sans-serif",fontSize:15,color:"rgba(255,255,255,0.7)",margin:0},
  input:      {background:"#16122e",border:"1px solid rgba(255,255,255,0.1)",color:"#e8e8f0",padding:"9px 12px",borderRadius:8,fontSize:13,outline:"none",fontFamily:"'Inter',sans-serif",transition:"border-color 0.2s"},
  btn:        {padding:"11px 0",background:"#e8003d",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Orbitron',sans-serif",letterSpacing:1,transition:"opacity 0.2s"},
  smallBtn:   {background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",padding:"5px 11px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",transition:"all 0.2s"},
  filterBtn:  {padding:"6px 14px",border:"1px solid",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:600,transition:"all 0.2s"},
  errBox:     {background:"rgba(255,23,68,0.1)",border:"1px solid rgba(255,23,68,0.25)",color:"#ff6b8a",padding:"10px 14px",borderRadius:8,fontSize:12,textAlign:"center"},
  msgBox:     {padding:"10px 14px",borderRadius:8,fontSize:12,border:"1px solid",textAlign:"center"},
  controlCard:{background:"#1e1940",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:20,marginBottom:16},
  dangerBtn:  {background:"rgba(255,23,68,0.15)",border:"1px solid rgba(255,23,68,0.4)",color:"#ff6b8a",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Orbitron',sans-serif",letterSpacing:0.5,transition:"all 0.2s"},
  warnBtn:    {background:"rgba(255,193,7,0.1)",border:"1px solid rgba(255,193,7,0.3)",color:"#ffc107",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",transition:"all 0.2s"},
  successBtn: {background:"rgba(0,230,118,0.12)",border:"1px solid rgba(0,230,118,0.3)",color:"#00e676",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",transition:"all 0.2s"},
  gameStateBox:{background:"#1e1940",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 16px",marginBottom:16},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20},
  modalCard:  {background:"#1e1940",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:28,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"},
};