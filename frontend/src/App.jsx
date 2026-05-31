import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";


// ─── Auth Context ─────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("v2i_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("v2i_token") || null);

  const login = async (username, password) => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    localStorage.setItem("v2i_token", data.token);
    localStorage.setItem("v2i_user", JSON.stringify({ username: data.username, role: data.role, name: data.name }));
    setToken(data.token);
    setUser({ username: data.username, role: data.role, name: data.name });
    return data;
  };

  const logout = async () => {
    try {
      await fetch(`${API}/api/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    localStorage.removeItem("v2i_token");
    localStorage.removeItem("v2i_user");
    setToken(null);
    setUser(null);
  };

  return { user, token, login, logout };
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(form.username, form.password);
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = (u, p) => {
    setForm({ username: u, password: p });
  };

  return (
    <div style={styles.loginBg}>
      {/* Animated grid */}
      <div style={styles.gridOverlay} />
      {/* Scan line */}
      <div style={styles.scanLine} />

      <div style={styles.loginWrap}>
        {/* Logo / branding */}
        <div style={styles.loginBrand}>
          <div style={styles.loginIconRing}>
            <span style={{ fontSize: 36 }}>🚦</span>
          </div>
          <h1 style={styles.loginTitle}>V2I SIGNAL SYNC</h1>
          <p style={styles.loginSubtitle}>Emergency Responder Command System</p>
          <div style={styles.loginBadge}>SECURE PORTAL</div>
        </div>

        {/* Form card */}
        <div style={styles.loginCard}>
          <h2 style={styles.loginCardTitle}>OPERATOR LOGIN</h2>

          {error && (
            <div style={styles.loginError}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>USERNAME</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>👤</span>
                <input
                  style={styles.input}
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Enter operator ID"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>PASSWORD</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>🔒</span>
                <input
                  style={{ ...styles.input, paddingRight: 44 }}
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={styles.eyeBtn}
                >{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>

            <button style={{ ...styles.loginBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? "AUTHENTICATING..." : "ACCESS SYSTEM →"}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={styles.demoSection}>
            <div style={styles.demoLabel}>DEMO CREDENTIALS</div>
            <div style={styles.demoGrid}>
              {[
                { label: "ADMIN", u: "admin", p: "admin123" },
                { label: "DISPATCHER", u: "dispatcher", p: "disp456" },
                { label: "OFFICER", u: "officer", p: "officer789" },
              ].map(d => (
                <button key={d.u} style={styles.demoBtn} onClick={() => demoLogin(d.u, d.p)}>
                  <span style={{ fontSize: 11, color: "#00d4ff", fontWeight: 700 }}>{d.label}</span>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{d.u}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ color: "#1e3a5f", fontSize: 11, textAlign: "center", marginTop: 16, fontFamily: "monospace" }}>
          Sri Ramachandra Institute · V2I Research Project
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, token, logout }) {
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [connected, setConnected] = useState(false);
  const [newAlertIds, setNewAlertIds] = useState(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    // Initial fetch
    fetch(`${API}/api/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setStatus).catch(() => {});

    // Socket.IO
    const socket = io(API, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("status_update", data => setStatus(data));
    socket.on("alert", alert => {
      setAlerts(prev => {
        const next = [alert, ...prev].slice(0, 50);
        return next;
      });
      setNewAlertIds(prev => new Set([...prev, alert.timestamp + alert.vehicle_id]));
      setTimeout(() => {
        setNewAlertIds(prev => {
          const n = new Set(prev);
          n.delete(alert.timestamp + alert.vehicle_id);
          return n;
        });
      }, 3000);
    });
    return () => socket.disconnect();
  }, [token]);

  const forceGreen = async (signalId) => {
    await fetch(`${API}/api/signals/${signalId}/override`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_green" }),
    });
  };

  const releaseOverride = async (signalId) => {
    await fetch(`${API}/api/signals/${signalId}/override`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release" }),
    });
  };

  const tabs = ["overview", "vehicles", "signals", "alerts"];

  return (
    <div style={styles.dashBg}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerLogo}>🚦</div>
          <div>
            <div style={styles.headerTitle}>V2I SIGNAL SYNC</div>
            <div style={styles.headerSub}>Emergency Responder Command</div>
          </div>
        </div>
        <div style={styles.headerCenter}>
          {tabs.map(t => (
            <button
              key={t}
              style={{ ...styles.tabBtn, ...(activeTab === t ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={styles.headerRight}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {user.role.toUpperCase()} · <span style={{ color: connected ? "#22c55e" : "#ef4444" }}>
                {connected ? "● LIVE" : "○ OFFLINE"}
              </span>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={logout}>LOGOUT</button>
        </div>
      </header>

      {/* Content */}
      <div style={styles.dashContent}>
        {activeTab === "overview" && <OverviewTab status={status} alerts={alerts} newAlertIds={newAlertIds} />}
        {activeTab === "vehicles" && <VehiclesTab vehicles={status?.vehicles || []} />}
        {activeTab === "signals" && (
          <SignalsTab signals={status?.signals || []} onForceGreen={forceGreen} onRelease={releaseOverride} userRole={user.role} />
        )}
        {activeTab === "alerts" && <AlertsTab alerts={alerts} statusAlerts={status?.recent_alerts || []} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ status, alerts, newAlertIds }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const stats = [
    { label: "Active Vehicles", value: status?.active_vehicles ?? "—", color: "#00d4ff", icon: "🚨" },
    { label: "Signal Network", value: status?.total_signals ?? "—", color: "#00d4ff", icon: "🚦" },
    { label: "Alerts Sent", value: status?.total_alerts ?? "—", color: "#eab308", icon: "📡" },
    { label: "Alert Radius", value: "3.0 km", color: "#22c55e", icon: "📍" },
  ];

  const signalCounts = { green: 0, yellow: 0, red: 0 };
  (status?.signals || []).forEach(s => { if (signalCounts[s.current_state] !== undefined) signalCounts[s.current_state]++; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Clock */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#64748b" }}>
          SYSTEM TIME: <span style={{ color: "#00d4ff" }}>{time.toLocaleTimeString()}</span> ·
          DATE: <span style={{ color: "#00d4ff" }}>{time.toLocaleDateString()}</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {Object.entries(signalCounts).map(([state, count]) => (
            <div key={state} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: state === "green" ? "#22c55e" : state === "yellow" ? "#eab308" : "#ef4444" }} />
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>{count} {state.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Two-column: vehicles + alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Vehicle fleet */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>🚨 EMERGENCY FLEET</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(status?.vehicles || []).map(v => (
              <div key={v.vehicle_id} style={styles.vehicleRow}>
                <span style={{ fontSize: 24 }}>{v.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {v.vehicle_type}
                    <span style={styles.callSignBadge}>{v.call_sign}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{v.dispatched_to}</div>
                  <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
                    {v.speed_kmh} km/h · {v.latitude.toFixed(4)}°N, {v.longitude.toFixed(4)}°E
                  </div>
                </div>
                <div style={styles.activeBadge}>ACTIVE</div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal grid */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>🚦 SIGNAL NETWORK</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(status?.signals || []).map(s => (
              <div key={s.signal_id} style={styles.sigCard}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: `0 0 8px ${s.color}` }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{s.signal_id}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{s.location_name.slice(0, 18)}</div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8" }}>
                    {s.current_state.toUpperCase()} · {Math.round(s.seconds_until_change)}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert log */}
      <div style={styles.panel}>
        <div style={styles.panelTitle}>📡 LIVE ALERT STREAM</div>
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {[...alerts, ...(status?.recent_alerts || [])].slice(0, 15).length === 0 ? (
            <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
              No alerts yet — system scanning...
            </div>
          ) : (
            [...alerts, ...(status?.recent_alerts || [])].slice(0, 15).map((a, i) => {
              const isNew = newAlertIds.has(a.timestamp + a.vehicle_id);
              const stateColor = a.signal_state === "green" ? "#22c55e" : a.signal_state === "yellow" ? "#eab308" : "#ef4444";
              return (
                <div key={i} style={{ ...styles.alertRow, ...(isNew ? { background: "rgba(0,212,255,0.06)", borderLeft: "2px solid #00d4ff" } : {}) }}>
                  <span style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, minWidth: 70 }}>
                    {a.timestamp?.slice(11) || ""}
                  </span>
                  <span style={{ ...styles.stateBadge, background: `${stateColor}22`, color: stateColor, border: `1px solid ${stateColor}` }}>
                    {a.signal_state?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, flex: 1 }}>
                    <strong>{a.vehicle_type}</strong> {a.vehicle_id} → {a.signal_location}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{a.distance_km} km</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────
function VehiclesTab({ vehicles }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.panelTitle}>🚨 EMERGENCY VEHICLE FLEET — REAL-TIME TRACKING</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {vehicles.map(v => (
          <div key={v.vehicle_id} style={{ ...styles.panel, borderLeft: `3px solid #00d4ff` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 40 }}>{v.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v.vehicle_type}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#00d4ff" }}>{v.call_sign} · {v.vehicle_id}</div>
              </div>
              <div style={{ marginLeft: "auto", ...styles.activeBadge }}>ACTIVE</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["📍 Latitude", `${v.latitude.toFixed(5)}°`],
                ["📍 Longitude", `${v.longitude.toFixed(5)}°`],
                ["⚡ Speed", `${v.speed_kmh} km/h`],
                ["🧭 Heading", `${v.heading_deg.toFixed(1)}°`],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#0d1626", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "#e2e8f0" }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d1626", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#64748b" }}>🎯 DISPATCHED TO</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{v.dispatched_to}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Signals Tab ─────────────────────────────────────────────────────────────
function SignalsTab({ signals, onForceGreen, onRelease, userRole }) {
  const canControl = userRole === "admin" || userRole === "dispatcher";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.panelTitle}>🚦 SIGNAL NETWORK — STATUS & CONTROL</div>
      {!canControl && (
        <div style={{ color: "#64748b", fontSize: 12, fontFamily: "monospace", padding: "8px 16px", background: "#0d1626", borderRadius: 6, border: "1px solid #1f2d40" }}>
          ⚠ OFFICER role — view only. Signal override requires DISPATCHER or ADMIN access.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {signals.map(s => {
          const stateColor = s.current_state === "green" ? "#22c55e" : s.current_state === "yellow" ? "#eab308" : "#ef4444";
          return (
            <div key={s.signal_id} style={{ ...styles.panel, borderLeft: `3px solid ${stateColor}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: stateColor, boxShadow: `0 0 16px ${stateColor}` }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{s.signal_id}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.location_name}</div>
                </div>
                <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: stateColor }}>
                  {Math.round(s.seconds_until_change)}s
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  ["STATE", s.current_state.toUpperCase()],
                  ["PRIORITY", s.priority_override ? "⚡ OVERRIDE" : "NORMAL"],
                  ["LAT", `${s.latitude.toFixed(4)}°`],
                  ["LON", `${s.longitude.toFixed(4)}°`],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: "#0d1626", borderRadius: 6, padding: "6px 10px" }}>
                    <div style={{ fontSize: 9, color: "#64748b" }}>{label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: label === "STATE" ? stateColor : "#e2e8f0" }}>{val}</div>
                  </div>
                ))}
              </div>
              {canControl && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...styles.controlBtn, background: s.priority_override ? "#1e3a1e" : "#0f2d1a", color: "#22c55e", borderColor: "#22c55e" }}
                    onClick={() => onForceGreen(s.signal_id)}
                    disabled={s.priority_override}
                  >⚡ FORCE GREEN</button>
                  <button
                    style={{ ...styles.controlBtn, background: "#1a1a2e", color: "#94a3b8", borderColor: "#334155" }}
                    onClick={() => onRelease(s.signal_id)}
                    disabled={!s.priority_override}
                  >RELEASE</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab({ alerts, statusAlerts }) {
  const all = [...alerts, ...statusAlerts]
    .filter((a, i, arr) => arr.findIndex(x => x.timestamp === a.timestamp && x.vehicle_id === a.vehicle_id) === i)
    .slice(0, 50);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={styles.panelTitle}>📡 ALERT HISTORY — {all.length} EVENTS</div>
      </div>
      <div style={styles.panel}>
        {all.length === 0 ? (
          <div style={{ textAlign: "center", color: "#475569", padding: 40, fontFamily: "monospace" }}>
            No alerts recorded yet. System is scanning...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "100px 90px 100px 1fr 120px 80px 70px", gap: 8, padding: "8px 12px", fontSize: 10, color: "#475569", fontFamily: "monospace", borderBottom: "1px solid #1f2d40" }}>
              <span>TIME</span><span>VEHICLE</span><span>TYPE</span><span>SIGNAL</span><span>LOCATION</span><span>DIST</span><span>STATE</span>
            </div>
            {all.map((a, i) => {
              const stateColor = a.signal_state === "green" ? "#22c55e" : a.signal_state === "yellow" ? "#eab308" : "#ef4444";
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 90px 100px 1fr 120px 80px 70px", gap: 8, padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #0d1626", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 11 }}>{a.timestamp?.slice(11)}</span>
                  <span style={{ fontFamily: "monospace", color: "#00d4ff", fontSize: 11 }}>{a.vehicle_id}</span>
                  <span style={{ color: "#94a3b8" }}>{a.vehicle_type}</span>
                  <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 11 }}>{a.signal_id}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{a.signal_location?.slice(0, 18)}</span>
                  <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{a.distance_km} km</span>
                  <span style={{ ...styles.stateBadge, background: `${stateColor}22`, color: stateColor, border: `1px solid ${stateColor}` }}>
                    {a.signal_state?.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  // Login
  loginBg: { minHeight: "100vh", background: "#020817", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  gridOverlay: {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
  },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 2, background: "rgba(0,212,255,0.15)",
    animation: "scanAnim 4s linear infinite",
    zIndex: 1,
  },
  loginWrap: { position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%", maxWidth: 420, padding: "0 20px" },
  loginBrand: { textAlign: "center" },
  loginIconRing: { width: 80, height: 80, border: "2px solid #00d4ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 0 40px rgba(0,212,255,0.2)" },
  loginTitle: { fontSize: 28, fontWeight: 900, letterSpacing: 4, color: "#e2e8f0", fontFamily: "'Courier New', monospace", margin: "0 0 6px" },
  loginSubtitle: { fontSize: 12, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" },
  loginBadge: { display: "inline-block", marginTop: 10, padding: "3px 12px", border: "1px solid #00d4ff", color: "#00d4ff", fontSize: 10, letterSpacing: 2, fontFamily: "monospace", borderRadius: 2 },
  loginCard: { background: "#0a0f1e", border: "1px solid #1f2d40", borderRadius: 12, padding: 28, width: "100%", boxShadow: "0 0 60px rgba(0,0,0,0.6)" },
  loginCardTitle: { fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#64748b", fontFamily: "monospace", marginBottom: 20, textAlign: "center" },
  loginError: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 4, display: "flex", gap: 8, alignItems: "center" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 10, letterSpacing: 2, color: "#475569", fontFamily: "monospace" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: 12, fontSize: 14, pointerEvents: "none" },
  input: { width: "100%", background: "#0d1626", border: "1px solid #1f2d40", borderRadius: 6, padding: "11px 12px 11px 38px", color: "#e2e8f0", fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box" },
  eyeBtn: { position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#64748b", padding: 4 },
  loginBtn: { background: "#00d4ff", color: "#020817", border: "none", borderRadius: 6, padding: "13px", fontSize: 13, fontWeight: 800, letterSpacing: 2, fontFamily: "monospace", cursor: "pointer", marginTop: 4 },
  demoSection: { marginTop: 20, paddingTop: 16, borderTop: "1px solid #1f2d40" },
  demoLabel: { fontSize: 9, letterSpacing: 2, color: "#334155", fontFamily: "monospace", textAlign: "center", marginBottom: 10 },
  demoGrid: { display: "flex", gap: 8 },
  demoBtn: { flex: 1, background: "#0d1626", border: "1px solid #1f2d40", borderRadius: 6, padding: "8px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },

  // Dashboard
  dashBg: { minHeight: "100vh", background: "#070d1a", color: "#e2e8f0", fontFamily: "'Rajdhani', sans-serif" },
  header: { background: "#0a0f1e", borderBottom: "1px solid #1f2d40", padding: "12px 28px", display: "flex", alignItems: "center", gap: 20, position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 200 },
  headerLogo: { fontSize: 28 },
  headerTitle: { fontSize: 16, fontWeight: 800, letterSpacing: 2, color: "#00d4ff", lineHeight: 1 },
  headerSub: { fontSize: 10, color: "#475569", letterSpacing: 1, fontFamily: "monospace" },
  headerCenter: { display: "flex", gap: 4, flex: 1, justifyContent: "center" },
  headerRight: { display: "flex", alignItems: "center", gap: 14, minWidth: 200, justifyContent: "flex-end" },
  tabBtn: { background: "none", border: "1px solid #1f2d40", color: "#64748b", padding: "6px 16px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace" },
  tabActive: { background: "rgba(0,212,255,0.1)", borderColor: "#00d4ff", color: "#00d4ff" },
  logoutBtn: { background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "6px 14px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace" },
  dashContent: { padding: "24px 28px", maxWidth: 1400, margin: "0 auto" },

  // Shared
  panel: { background: "#0a0f1e", border: "1px solid #1f2d40", borderRadius: 10, padding: 20 },
  panelTitle: { fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#475569", fontFamily: "monospace", marginBottom: 16, textTransform: "uppercase" },
  statCard: { background: "#0a0f1e", border: "1px solid #1f2d40", borderRadius: 10, padding: 20, textAlign: "center" },
  statValue: { fontSize: 40, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginTop: 6 },
  vehicleRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #0d1626" },
  callSignBadge: { display: "inline-block", background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff", color: "#00d4ff", fontSize: 10, padding: "1px 7px", borderRadius: 3, marginLeft: 8, fontFamily: "monospace" },
  activeBadge: { background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e", color: "#22c55e", fontSize: 10, padding: "2px 8px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700, flexShrink: 0 },
  sigCard: { display: "flex", alignItems: "flex-start", gap: 8, background: "#0d1626", borderRadius: 6, padding: "10px 12px" },
  alertRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid #0d1626", borderRadius: 4 },
  stateBadge: { fontSize: 10, fontFamily: "monospace", fontWeight: 700, padding: "2px 7px", borderRadius: 3 },
  controlBtn: { flex: 1, padding: "7px", borderRadius: 4, border: "1px solid", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace" },
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, token, login, logout } = useAuth();

  if (!user || !token) return <LoginPage onLogin={login} />;
  return <Dashboard user={user} token={token} logout={logout} />;
}
