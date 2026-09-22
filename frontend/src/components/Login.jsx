import { useState } from "react";
import { ArrowRight, BarChart3, Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { api } from "../api";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = mode === "login"
        ? await api.login({ username, password })
        : await api.register({ username, password });
      localStorage.setItem("asklyticsbi_token", session.token);
      localStorage.setItem("asklyticsbi_user", JSON.stringify(session.user));
      onAuthenticated(session.user);
    } catch (requestError) {
      setError(requestError.detail || "We could not complete that request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="brand-mark"><BarChart3 size={21} /></div>
        <p className="eyebrow"><Sparkles size={14} /> Intelligent business intelligence</p>
        <h1>AskLyticsBI</h1>
        <p className="showcase-copy">
          Turn complex planning data into clear decisions, with a workspace built for curious teams.
        </p>
        <div className="showcase-orbit orbit-one" />
        <div className="showcase-orbit orbit-two" />
        <div className="insight-card">
          <span>Live insight</span>
          <strong>See the signal sooner.</strong>
          <small>Ask a question. Make a move.</small>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-kicker">Your analytics workspace</div>
          <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="auth-subtitle">
            {mode === "login" ? "Sign in to continue exploring your data." : "Start turning your data into momentum."}
          </p>

          <form onSubmit={submit} className="auth-form">
            <label>
              Username
              <span className="field-wrap"><UserRound size={17} /><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required minLength={3} /></span>
            </label>
            <label>
              Password
              <span className="field-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Connecting..." : mode === "login" ? "Enter AskLyticsBI" : "Create account"}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New to AskLyticsBI?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
