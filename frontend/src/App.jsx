import { useState, useEffect } from "react";
 
const API = "https://v2i-fullstack.onrender.com";
 
// ─── Auth ────────────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
 
  const login = async (username, password) => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Invalid credentials" };
  };
 
  const logout = () => { setUser(null); setToken(null); };
 
  return { user, token, login, logout };
}
 
// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
 
  const handleLogin = async () => {
    if (!username || !password) { setError("Enter username and password"); return; }
    setLoading(true);
    setError("");
    const result = await onLogin(username, password);
    if (!result.ok) setError(result.error);
    setLoading(false);
  };
 
  const fill = (u, p) => { setUsername(u); setPassword(p); setError(""); };
 
  return (
    <div style={styles.loginBg}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <div style={styles.loginIcon}>🚦</div>
          <h1 style={styles.loginTitle}>V2I Signal Sync</h1>
          <p style={styles.loginSub}>Emergency Vehicle Management System</p>
        </div>
 
        <div style={styles.demoRow}>
          <button style={styles.demoBtn} onClick={() => fill("admin", "admin123")}>Admin</button>
          <button style={styles.demoBtn} onClick={() => fill("dispatcher", "disp456")}>Dispatcher</button>
          <button style={styles.demoBtn} onClick={() => fill("officer", "officer789")}>Officer</button>
        </div>
 
        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
        />
        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
        />
 
        {error && <div style={styles.errorBox}>{error}</div>}
 
        <button style={styles.loginBtn} onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}
 
// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, token, logout }) {
  const [tab, setTab] = useState("overview");
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
 
  // Polling instead of Socket.IO — works on Render free tier
  useEffect(() => {
    const fetchStatus = () => {
      fetch(`${API}/api/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          setStatus(data);
          if (data.recent_alerts) setAlerts(data.recent_alerts);
          setConnected(true);
        })
        .catch(() => setConnected(false));
    };
 
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [token]);
 
  const forceGreen = async (signalId) => {
    if (user.role === "officer") return;
    await fetch(`${API}/api/signal/${signalId}/force_green`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  };
 
  const releaseSignal = async (signalId) => {
    if (user.role === "officer") return;
    await fetch(`${API}/api/signal/${signalId}/release`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  };
 
  const TABS = ["overview", "vehicles", "signals", "alerts"];
 
  return (
    <div style={styles.dashBg}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <span style={styles.navLogo}>🚦 V2I Signal Sync</span>
        <div style={styles.navTabs}>
          {TABS.map(t => (
            <button
              key={t}
              style={{ ...styles.navTab, ...(tab === t ? styles.navTabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={styles.navRight}>
          <span style={{ ...styles.dot, background: connected ? "#22c55e" : "#ef4444" }} />
          <span style={styles.navUser}>{user.username} ({user.role})</span>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>
 
      {/* Content */}
      <div style={styles.content}>
        {tab === "overview" && <OverviewTab status={status} alerts={alerts} />}
        {tab === "vehicles" && <VehiclesTab status={status} />}
        {tab === "signals" && <SignalsTab status={status} forceGreen={forceGreen} releaseSignal={releaseSignal} userRole={user.role} />}
        {tab === "alerts" && <AlertsTab alerts={alerts} />}
      </div>
    </div>
  );
}
 
// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ status, alerts }) {
  if (!status) return <LoadingSpinner />;
  const vehicles = status.vehicles || [];
  const signals = status.signals || [];
  const active = vehicles.filter(v => v.active).length;
  const overridden = signals.filter(s => s.forced_green).length;
 
  return (
    <div>
      <div style={styles.kpiRow}>
        <KpiCard label="Active Vehicles" value={active} color="#3b82f6" icon="🚑" />
        <KpiCard label="Total Vehicles" value={vehicles.length} color="#8b5cf6" icon="🚒" />
        <KpiCard label="Signals Overridden" value={overridden} color="#f59e0b" icon="🔴" />
        <KpiCard label="Total Signals" value={signals.length} color="#10b981" icon="🟢" />
      </div>
 
      <div style={styles.twoCol}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Fleet Status</h3>
          {vehicles.map(v => (
            <div key={v.id} style={styles.fleetRow}>
              <span style={{ fontSize: 20 }}>{vehicleIcon(v.type)}</span>
              <div style={{ flex: 1, marginLeft: 10 }}>
                <div style={styles.fleetName}>{v.id}</div>
                <div style={styles.fleetType}>{v.type}</div>
              </div>
              <span style={{ ...styles.badge, background: v.active ? "#22c55e22", color: "#22c55e" }}>
                {v.active ? "Active" : "Idle"}
              </span>
            </div>
          ))}
        </div>
 
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Signal Grid</h3>
          <div style={styles.signalGrid}>
            {signals.map(s => (
              <div key={s.id} style={{ ...styles.signalCell, background: s.forced_green ? "#22c55e33" : "#1e293b" }}>
                <div style={{ fontSize: 22 }}>{s.forced_green ? "🟢" : "🔴"}</div>
                <div style={styles.signalLabel}>{s.id}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
 
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Recent Alerts</h3>
        {alerts.slice(0, 5).map((a, i) => (
          <div key={i} style={styles.alertRow}>
            <span style={styles.alertIcon}>🔔</span>
            <span style={styles.alertMsg}>{a.message || JSON.stringify(a)}</span>
            <span style={styles.alertTime}>{a.time || ""}</span>
          </div>
        ))}
        {alerts.length === 0 && <p style={styles.empty}>No alerts yet</p>}
      </div>
    </div>
  );
}
 
// ─── Vehicles Tab ─────────────────────────────────────────────────────────────
function VehiclesTab({ status }) {
  if (!status) return <LoadingSpinner />;
  const vehicles = status.vehicles || [];
 
  return (
    <div style={styles.gridCards}>
      {vehicles.map(v => (
        <div key={v.id} style={styles.vehicleCard}>
          <div style={styles.vehicleCardTop}>
            <span style={{ fontSize: 36 }}>{vehicleIcon(v.type)}</span>
            <div style={{ marginLeft: 12 }}>
              <div style={styles.vehicleId}>{v.id}</div>
              <div style={styles.vehicleType}>{v.type}</div>
            </div>
            <span style={{ ...styles.badge, marginLeft: "auto", background: v.active ? "#22c55e22" : "#64748b22", color: v.active ? "#22c55e" : "#94a3b8" }}>
              {v.active ? "Active" : "Idle"}
            </span>
          </div>
          <div style={styles.vehicleInfo}>
            <InfoRow label="Latitude" value={v.lat?.toFixed(5) ?? "—"} />
            <InfoRow label="Longitude" value={v.lon?.toFixed(5) ?? "—"} />
            <InfoRow label="Speed" value={v.speed ? `${v.speed} km/h` : "—"} />
            <InfoRow label="Nearest Signal" value={v.nearest_signal ?? "—"} />
          </div>
        </div>
      ))}
    </div>
  );
}
 
// ─── Signals Tab ─────────────────────────────────────────────────────────────
function SignalsTab({ status, forceGreen, releaseSignal, userRole }) {
  if (!status) return <LoadingSpinner />;
  const signals = status.signals || [];
 
  return (
    <div style={styles.gridCards}>
      {signals.map(s => (
        <div key={s.id} style={{ ...styles.signalCard, borderColor: s.forced_green ? "#22c55e" : "#334155" }}>
          <div style={styles.signalCardTop}>
            <span style={{ fontSize: 32 }}>{s.forced_green ? "🟢" : "🔴"}</span>
            <div style={{ marginLeft: 12 }}>
              <div style={styles.vehicleId}>{s.id}</div>
              <div style={styles.vehicleType}>{s.location || "Chennai"}</div>
            </div>
          </div>
          <div style={styles.vehicleInfo}>
            <InfoRow label="Phase" value={s.phase ?? "—"} />
            <InfoRow label="Timer" value={s.timer ? `${s.timer}s` : "—"} />
            <InfoRow label="Forced Green" value={s.forced_green ? "Yes" : "No"} />
          </div>
          {userRole !== "officer" && (
            <div style={styles.btnRow}>
              <button style={styles.greenBtn} onClick={() => forceGreen(s.id)}>Force Green</button>
              <button style={styles.redBtn} onClick={() => releaseSignal(s.id)}>Release</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
 
// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab({ alerts }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>All Alerts ({alerts.length})</h3>
      {alerts.length === 0 && <p style={styles.empty}>No alerts recorded yet.</p>}
      <table style={styles.table}>
        <thead>
          <tr>
            {["#", "Message", "Vehicle", "Signal", "Time"].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a, i) => (
            <tr key={i} style={i % 2 === 0 ? styles.trEven : {}}>
              <td style={styles.td}>{i + 1}</td>
              <td style={styles.td}>{a.message ?? JSON.stringify(a)}</td>
              <td style={styles.td}>{a.vehicle ?? "—"}</td>
              <td style={styles.td}>{a.signal ?? "—"}</td>
              <td style={styles.td}>{a.time ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
 
// ─── Small Components ─────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}
 
function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}
 
function LoadingSpinner() {
  return <div style={styles.loading}>Loading data…</div>;
}
 
function vehicleIcon(type) {
  const map = { ambulance: "🚑", fire_truck: "🚒", police: "🚓", default: "🚨" };
  return map[type?.toLowerCase()] ?? map.default;
}
 
// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, token, login, logout } = useAuth();
  if (!user) return <LoginPage onLogin={login} />;
  return <Dashboard user={user} token={token} logout={logout} />;
}
 
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  // Login
  loginBg: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" },
  loginCard: { background: "#1e293b", borderRadius: 16, padding: 40, width: 380, boxShadow: "0 25px 50px #0008" },
  loginHeader: { textAlign: "center", marginBottom: 24 },
  loginIcon: { fontSize: 48 },
  loginTitle: { color: "#f1f5f9", fontSize: 24, fontWeight: 700, margin: "8px 0 4px" },
  loginSub: { color: "#94a3b8", fontSize: 13 },
  demoRow: { display: "flex", gap: 8, marginBottom: 20 },
  demoBtn: { flex: 1, padding: "8px 0", background: "#334155", border: "none", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13 },
  input: { width: "100%", padding: "12px 14px", marginBottom: 12, background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 14, boxSizing: "border-box" },
  errorBox: { background: "#ef444422", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 },
  loginBtn: { width: "100%", padding: 14, background: "#3b82f6", border: "none", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  // Dashboard
  dashBg: { minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "system-ui, sans-serif" },
  navbar: { display: "flex", alignItems: "center", padding: "0 24px", height: 56, background: "#1e293b", borderBottom: "1px solid #334155", gap: 16 },
  navLogo: { fontWeight: 700, fontSize: 16, color: "#f1f5f9", marginRight: 8 },
  navTabs: { display: "flex", gap: 4 },
  navTab: { padding: "6px 14px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", borderRadius: 6, fontSize: 13 },
  navTabActive: { background: "#334155", color: "#f1f5f9" },
  navRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  navUser: { color: "#94a3b8", fontSize: 13 },
  logoutBtn: { padding: "5px 12px", background: "#ef444422", border: "1px solid #ef4444", borderRadius: 6, color: "#fca5a5", cursor: "pointer", fontSize: 12 },
  content: { padding: 24, maxWidth: 1200, margin: "0 auto" },
  // Cards
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 },
  kpiCard: { background: "#1e293b", borderRadius: 12, padding: 20, textAlign: "center" },
  kpiValue: { fontSize: 32, fontWeight: 700, margin: "8px 0 4px" },
  kpiLabel: { color: "#94a3b8", fontSize: 13 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  card: { background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { color: "#f1f5f9", fontSize: 15, fontWeight: 600, marginBottom: 16, marginTop: 0 },
  fleetRow: { display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e293b" },
  fleetName: { color: "#f1f5f9", fontWeight: 600, fontSize: 14 },
  fleetType: { color: "#94a3b8", fontSize: 12 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  signalGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  signalCell: { borderRadius: 8, padding: "12px 8px", textAlign: "center" },
  signalLabel: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  alertRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0f172a" },
  alertIcon: { fontSize: 16 },
  alertMsg: { flex: 1, color: "#cbd5e1", fontSize: 13 },
  alertTime: { color: "#64748b", fontSize: 12 },
  empty: { color: "#64748b", fontSize: 13 },
  gridCards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  vehicleCard: { background: "#1e293b", borderRadius: 12, padding: 20 },
  vehicleCardTop: { display: "flex", alignItems: "center", marginBottom: 16 },
  vehicleId: { color: "#f1f5f9", fontWeight: 700, fontSize: 15 },
  vehicleType: { color: "#94a3b8", fontSize: 12, textTransform: "capitalize" },
  vehicleInfo: { borderTop: "1px solid #334155", paddingTop: 12 },
  infoRow: { display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 },
  infoLabel: { color: "#94a3b8" },
  infoValue: { color: "#f1f5f9", fontWeight: 500 },
  signalCard: { background: "#1e293b", borderRadius: 12, padding: 20, border: "1px solid #334155" },
  signalCardTop: { display: "flex", alignItems: "center", marginBottom: 16 },
  btnRow: { display: "flex", gap: 8, marginTop: 14 },
  greenBtn: { flex: 1, padding: "8px 0", background: "#22c55e22", border: "1px solid #22c55e", borderRadius: 6, color: "#22c55e", cursor: "pointer", fontSize: 13 },
  redBtn: { flex: 1, padding: "8px 0", background: "#ef444422", border: "1px solid #ef4444", borderRadius: 6, color: "#fca5a5", cursor: "pointer", fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 12px", color: "#94a3b8", borderBottom: "1px solid #334155", fontWeight: 600 },
  td: { padding: "10px 12px", color: "#cbd5e1", borderBottom: "1px solid #1e293b" },
  trEven: { background: "#0f172a22" },
  loading: { color: "#94a3b8", textAlign: "center", padding: 40 },
};