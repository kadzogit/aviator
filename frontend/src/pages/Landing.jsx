import { Link } from "react-router-dom";

const PAST = ["2.14x","1.03x","5.67x","218.49x","1.31x","3.80x","13.85x","6.03x","1.70x","4.44x"];

export default function Landing() {
  return (
    <div className="landing-page">
      {/* ── NAV ── */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="logo-plane">✈</span>
          <span className="logo-text">Aviator</span>
        </div>
        <div className="landing-nav-links">
          <Link to="/login"            className="btn-login">Login</Link>
          <Link to="/register"         className="btn-register">Register</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="landing-hero">
        {/* Multiplier history strip */}
        <div className="hero-multipliers">
          {PAST.map((m, i) => {
            const v   = parseFloat(m);
            const cls = v >= 10 ? "hero-mult gold" : v >= 2 ? "hero-mult blue" : "hero-mult red";
            return <span key={i} className={cls}>{m}</span>;
          })}
        </div>

        {/* Game preview */}
        <div className="hero-game-preview">
          <div className="preview-label">FUN MODE PREVIEW</div>
          <div className="preview-canvas">
            <div className="preview-curve"></div>
            <div className="preview-plane">✈</div>
            <div className="preview-multiplier">6.80x</div>
          </div>
        </div>

        {/* CTA */}
        <h1 className="hero-title">
          <span className="hero-title-red">AVIATOR</span>
          <span className="hero-title-white"> — Cash Out Before It Flies Away</span>
        </h1>
        <p className="hero-sub">
          Play with real money or try the free demo. M-PESA &amp; Card deposits in seconds.
        </p>
        <div className="hero-btns">
          <Link to="/register"         className="hero-btn-play">🚀 Play Now</Link>
          <Link to="/register?demo=1"  className="hero-btn-demo">🎮 Try Demo Free</Link>
        </div>
        <div className="hero-features">
          <span>✅ Free Demo (50,000 KES)</span>
          <span>✅ M-PESA &amp; Card</span>
          <span>✅ Instant Cashout</span>
          <span>✅ Kenya · Tanzania · Uganda</span>
        </div>
      </div>
    </div>
  );
}
