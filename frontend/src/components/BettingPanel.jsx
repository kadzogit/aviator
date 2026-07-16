import { useState } from "react";
import { useGameContext } from "../context/GameContext";
import { useAuth }  from "../context/AuthContext";

const QUICK = [100, 200, 500, 10000];

function BetSlot({ slotIdx }) {
  const { gamePhase, bets, queuedBets, setQueuedBets, placeBet, queueBet, cashout, currency, activeBalance, error, winNotif } = useGameContext();
  const { profile } = useAuth();

  const [tab,         setTab]         = useState("manual");
  const [stake,       setStake]       = useState(10);
  const [autoCashout, setAutoCashout] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);

  const minStake = { KES: 10, TZS: 1000, UGX: 500 }[currency] || 10;
  const bet      = bets[slotIdx];
  const canBet    = gamePhase === "waiting" && !bet;
  const canCashout = gamePhase === "flying" && bet && !bet.cashedOut && !bet.lost;

  // Compute live cashout value
  const { multiplier } = useGameContext();
  const liveWin = bet && !bet.cashedOut ? (bet.stake * multiplier).toFixed(2) : null;

  function adj(delta) {
    setStake(s => Math.max(minStake, Math.round((s + delta) / 10) * 10));
  }

 async function handleBet() {

  if (stake < minStake) return;

  const auto =
    autoEnabled && autoCashout
      ? parseFloat(autoCashout)
      : null;

  if (gamePhase === "waiting") {

    await placeBet(
      slotIdx,
      stake,
      auto
    );

  } else {

    queueBet(
      slotIdx,
      stake,
      auto
    );

  }

}

  const slotClass = [
    "bet-slot",
    bet && !bet.cashedOut && !bet.lost ? "active-slot" : "",
    bet?.cashedOut ? "won-slot" : "",
    bet?.lost      ? "lost-slot" : "",
  ].join(" ").trim();

  const thisWin = winNotif?.slotIdx === slotIdx ? winNotif : null;

  return (
    <div className={slotClass}>
      {/* Win flash */}
      {thisWin && (
        <div className="slot-win-flash">
          🎉 +{thisWin.winnings.toLocaleString()} {currency} @ {thisWin.mult.toFixed(2)}x
        </div>
      )}

      {/* Tabs */}
      <div className="bet-tabs">
        <button className={`bet-tab ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>
          Bet
        </button>
        <button className={`bet-tab ${tab === "auto" ? "active" : ""}`} onClick={() => setTab("auto")}>
          Auto
        </button>
      </div>

      {/* Stake row */}
      <div className="stake-control">
        <button className="stake-adj" onClick={() => adj(-10)} disabled={!!bet}>−</button>
        <div className="stake-input-wrap">
          <input
            type="number"
            value={stake}
            min={minStake}
            step={10}
            onChange={e => setStake(Number(e.target.value))}
            disabled={!!bet}
          />
        </div>
        <button className="stake-adj" onClick={() => adj(10)} disabled={!!bet}>+</button>
      </div>

      {/* Quick amounts */}
      <div className="quick-amounts">
        {QUICK.map(q => (
          <button
            key={q}
            className={`quick-amt ${stake === q ? "selected" : ""}`}
            onClick={() => setStake(q)}
            disabled={!!bet}
          >
            {q.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Auto cashout (shown in Auto tab) */}
      {tab === "auto" && (
        <div className="auto-cashout-row">
          <label className="auto-label">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={e => setAutoEnabled(e.target.checked)}
              disabled={!!bet}
            />
            Auto Cash Out at
          </label>
          <input
            type="number"
            className="auto-input"
            value={autoCashout}
            min="1.10"
            step="0.10"
            placeholder="2.00"
            onChange={e => setAutoCashout(e.target.value)}
            disabled={!autoEnabled || !!bet}
          />
          <span className="auto-x">✕</span>
        </div>
      )}

      {/* Action button */}
{canCashout ? (
  <button
    className="btn-cashout"
    onClick={() => cashout(slotIdx)}
  >
    <span>Cash Out</span>
    <span className="cashout-amount">
      {liveWin} {currency}
    </span>
  </button>
) : (
  <button
    className="btn-bet"
    onClick={handleBet}
    disabled={
      bet ||
      (stake < minStake)
    }
  >
    {queuedBets[slotIdx] ? (
  <div className="queued-wrapper">

    <div className="queued-text">
      Waiting for next round
    </div>

    <button
      className="queued-cancel"
      onClick={(e) => {
        e.stopPropagation();

        setQueuedBets(prev => {
          const next = [...prev];
          next[slotIdx] = null;
          return next;
        });
      }}
    >
      Cancel
    </button>

  </div>
) : (
  <>
        <span style={{fontSize: 15, fontWeight: 700}}>
          Bet
        </span>

        <span className="bet-amount" style={{fontSize: 19, fontWeight: 800}}>
          {stake.toFixed(2)} {currency}
        </span>
      </>
    )}
  </button>
)}
       </div>
  );
}
      
export default function BettingPanel() {
  const { error } = useGameContext();
  return (
    <div className="betting-panel">
      {error && <div className="bet-error">{error}</div>}
      <div className="bet-slots">
        <BetSlot slotIdx={0} />
        <BetSlot slotIdx={1} />
      </div>
    </div>
  );
}
