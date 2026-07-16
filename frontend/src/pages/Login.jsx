import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [error,   setError]   = useState("");
  const [info,    setInfo]    = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/game");
    } catch {
      setError("Invalid email or password.");
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!email) return setError("Enter your email address first");
    try {
      await resetPassword(email);
      setInfo("Password reset link sent! Check your email.");
      setError("");
    } catch {
      setError("Could not send reset email. Check the address.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back">← Back</Link>
        <div className="auth-logo">✈ <span>AVIATOR</span></div>
        <h1>Welcome Back</h1>

        {error && <div className="auth-error">{error}</div>}
        {info  && <div className="auth-success">{info}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="john@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <button className="link-btn" onClick={handleReset}>
          Forgot password?
        </button>
        <p className="auth-switch">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
