import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useGameContext } from "../context/GameContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import GameCanvas from "../components/GameCanvas";
import BettingPanel from "../components/BettingPanel";
import LeftPanel from "../components/LeftPanelOptimized";
import WalletModal from "../components/WalletModal";
import { useNavigate } from "react-router-dom";

function MultiplierBadge({ value }) {
  const v   = parseFloat(value);
  const cls = v >= 10 ? "mult-badge gold" : v >= 2 ? "mult-badge blue" : "mult-badge red";
  return (
    <span className={cls}>
      {value.toFixed ? value.toFixed(2) : value}x
    </span>
  );
}

export default function Game() {
  const { profile, logout, user } = useAuth();
  const {
    multiplier, gamePhase, pastMultipliers,
    currency, activeBalance, liveBets,
    muted, setMuted,
  } = useGameContext();

  const [walletMode, setWalletMode] = useState(null);
  const navigate = useNavigate();

  async function toggleMode() {
    if (!user) return;
    const newMode = profile?.mode === "demo" ? "real" : "demo";
    await updateDoc(doc(db, "users", user.uid), { mode: newMode });
    window.location.reload();
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const multColor =
    gamePhase === "crashed" ? "#ff1744"
    : multiplier >= 10 ? "#ffd700"
    : multiplier >= 3  ? "#00e5ff"
    : "#ffffff";

  const multGlow =
    gamePhase === "crashed" ? "0 0 40px rgba(255,23,68,0.7)"
    : multiplier >= 10 ? "0 0 40px rgba(255,215,0,0.6)"
    : multiplier >= 3  ? "0 0 40px rgba(0,229,255,0.5)"
    : "0 0 30px rgba(255,255,255,0.3)";

  const activePlayers = liveBets.filter(b => b.result === "pending").length;
  const totalBetted   = liveBets.filter(b => b.result === "pending")
                                .reduce((s, b) => s + (b.stake || 0), 0);

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <div className="game-page dark-mode">

      {/* ── TOP NAV ─────────────────────────────────────────── */}
      <nav className="game-nav">
        <div className="nav-logo">
          <img
            src="https://cdn.egamersworld.com/cdn-cgi/image/width=690,quality=75,format=webp/uploads/blog/1680089925161.webp"
            alt="Aviator"
            className="nav-plane-img"
            onError={e => { e.target.style.display = "none"; }}
          />
          <span className="logo-word">AVIATOR</span>
        </div>

        {/* Past multipliers scroll */}
        <div className="nav-history">
          {pastMultipliers.slice(0, 20).map((m, i) => (
            <MultiplierBadge key={i} value={m} />
          ))}
        </div>

        <div className="nav-right">
          {/* Admin Dashboard Link */}
          {isAdmin && (
            <button 
              className="btn-admin-nav"
              onClick={() => navigate("/admin")}
              style={{
                background: "rgba(232,0,61,0.2)",
                border: "1px solid #e8003d",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
                marginRight: "10px",
                boxShadow: "0 0 10px rgba(232,0,61,0.3)"
              }}
            >
              🛠 ADMIN DASHBOARD
            </button>
          )}

          {/* Sound */}
          <button
            className="btn-mute"
            onClick={() => setMuted(m => !m)}
            title={muted ? "Unmute sound" : "Mute sound"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          {/* Mode toggle */}
          <button
            className={`mode-toggle ${profile?.mode === "demo" ? "demo-active" : "real-active"}`}
            onClick={toggleMode}
            title="Switch between Demo and Real"
          >
            {profile?.mode === "demo" ? "🎮 Demo" : "💰 Real"}
          </button>

          {/* Balance */}
          <div className="nav-balance-wrap">
            <span className="nav-bal-label">
              {profile?.mode === "demo" ? "Demo Bal" : "Balance"}
            </span>
            <span className="nav-balance">
              {activeBalance.toLocaleString()} {currency}
            </span>
          </div>

          {/* Deposit / Withdraw */}
          {profile?.mode !== "demo" && (
            <>
              <button className="btn-deposit" onClick={() => setWalletMode("deposit")}>
                + Deposit
              </button>
              <button className="btn-withdraw" onClick={() => setWalletMode("withdraw")}>
                Withdraw
              </button>
            </>
          )}

          {/* User info */}
          <div className="nav-user">
            <div className="nav-avatar">
              {(profile?.fullName || "P").charAt(0).toUpperCase()}
            </div>
            <span className="nav-username">
              {profile?.fullName?.split(" ")[0] || "Player"}
            </span>
            {profile?.role === "superadmin" && (
              <span className="superadmin-badge">SUPER ADMIN</span>
            )}
            {profile?.role === "admin" && (
              <span className="admin-badge">ADMIN</span>
            )}
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Demo banner */}
      {profile?.mode === "demo" && (
        <div className="demo-mode-bar">
          🎮 FUN MODE &nbsp;|&nbsp; Demo balance:{" "}
          {(profile?.demoBalance || 0).toLocaleString()} {currency}
          &nbsp;|&nbsp;
          <button className="demo-switch-btn" onClick={toggleMode}>
            Switch to Real Money →
          </button>
        </div>
      )}

      {/* ── MAIN BODY ────────────────────────────────────────── */}
      <div className="game-body">

        {/* LEFT PANEL */}
        <div className="game-left">
          <LeftPanel />
        </div>

        {/* CENTER: Canvas + Betting */}
        <div className="game-center">

          {/* Live stats bar */}
          {gamePhase === "flying" && activePlayers > 0 && (
            <div className="live-stats-bar">
              <span className="live-dot" />
              <span className="live-stat">
                <strong>{activePlayers}</strong> players
              </span>
              <span className="live-divider">|</span>
              <span className="live-stat">
                Total bet: <strong>{totalBetted.toLocaleString()} {currency}</strong>
              </span>
            </div>
          )}

          {/* Canvas */}
          <div className="canvas-wrap">
            <GameCanvas
              multiplier={multiplier}
              gamePhase={gamePhase}
              liveBets={liveBets}
            />

            {/* Multiplier display */}
            <div
              className="multiplier-display"
              style={{ color: multColor, textShadow: multGlow }}
            >
              {gamePhase === "crashed" ? (
                <div className="crashed-block">
                  <span className="crashed-label">FLEW AWAY</span>
                  <span className="crashed-text">{multiplier.toFixed(2)}x</span>
                </div>
              ) : gamePhase === "waiting" ? (
                <span className="waiting-text">Waiting for next round...</span>
              ) : (
                <span className="flying-mult">{multiplier.toFixed(2)}x</span>
              )}
            </div>

            <div className="provably-fair">🔒 Provably Fair</div>
          </div>

          {/* Betting panel */}
          <BettingPanel />
        </div>
      </div>

      {walletMode && (
        <WalletModal mode={walletMode} onClose={() => setWalletMode(null)} />
      )}
    </div>
  );
}
