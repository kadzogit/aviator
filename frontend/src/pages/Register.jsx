import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link, useSearchParams } from "react-router-dom";

const COUNTRIES = [
  { code: "KE", name: "Kenya",    flag: "🇰🇪", dial: "254" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", dial: "255" },
  { code: "UG", name: "Uganda",   flag: "🇺🇬", dial: "256" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const isDemo       = params.get("demo") === "1";

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", country: "KE", password: "", confirmPassword: "",
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const upd = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    if (form.password.length < 6)               return setError("Password must be at least 6 characters");
    if (!form.fullName.trim())                  return setError("Full name is required");
    setError(""); setLoading(true);
    try {
      await register({ ...form, startDemo: isDemo });
      navigate("/game");
    } catch (err) {
      setError(err.message || "Registration failed");
    }
    setLoading(false);
  }

  const selectedCountry = COUNTRIES.find(c => c.code === form.country);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back">← Back</Link>
        <div className="auth-logo">✈ <span>AVIATOR</span></div>
        <h1>Create Account</h1>

        {isDemo && (
          <div className="demo-banner">
            🎮 Demo mode — you'll start with 50,000 {selectedCountry?.code === "KE" ? "KES" : selectedCountry?.code === "TZ" ? "TZS" : "UGX"} to practice
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" placeholder="John Doe" value={form.fullName} onChange={upd("fullName")} required />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="john@email.com" value={form.email} onChange={upd("email")} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <select value={form.country} onChange={upd("country")}>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Phone (+{selectedCountry?.dial})</label>
              <input
                type="tel"
                placeholder={`${selectedCountry?.dial}7XXXXXXXX`}
                value={form.phone}
                onChange={upd("phone")}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Min 6 characters" value={form.password} onChange={upd("password")} required minLength={6} />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={upd("confirmPassword")} required />
            </div>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign In</Link></p>
      </div>
    </div>
  );
}
