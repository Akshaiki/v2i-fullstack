"""
V2I Signal Sync — Flask Backend with Auth + Socket.IO
"""
import os, time, math, random, threading, json
from functools import wraps
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "v2i-secret-2024")
CORS(app, origins="*", supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading", logger=False, engineio_logger=False)

# ─── Simple user store (replace with DB in production) ─────────
USERS = {
    "admin": {"password": "admin123", "role": "admin", "name": "Admin User"},
    "dispatcher": {"password": "disp456", "role": "dispatcher", "name": "Control Room"},
    "officer": {"password": "officer789", "role": "officer", "name": "Field Officer"},
}

# Active sessions (token → username)
_sessions: dict[str, str] = {}

def generate_token(username: str) -> str:
    import hashlib, secrets
    token = secrets.token_hex(32)
    _sessions[token] = username
    return token

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "")
        if token not in _sessions:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Config ─────────────────────────────────────────────────────
BASE_LAT, BASE_LON = 13.0827, 80.2707
ALERT_RADIUS_KM = 3.0
EARTH_RADIUS_KM = 6371.0

# ─── Models ─────────────────────────────────────────────────────
class Vehicle:
    def __init__(self, vid, vtype, call_sign, lat, lon, speed, heading, dispatch):
        self.vehicle_id = vid
        self.vehicle_type = vtype
        self.call_sign = call_sign
        self.latitude = lat
        self.longitude = lon
        self.speed_kmh = speed
        self.heading_deg = heading
        self.dispatched_to = dispatch
        self.active = True
        self._target_lat = lat + random.uniform(-0.02, 0.02)
        self._target_lon = lon + random.uniform(-0.02, 0.02)

    ICONS = {"Police Car":"🚓","Ambulance":"🚑","Fire Engine":"🚒","HAZMAT Unit":"🚛","Medical Van":"🚐"}

    @property
    def icon(self): return self.ICONS.get(self.vehicle_type, "🚨")

    def move(self):
        dlat = self._target_lat - self.latitude
        dlon = self._target_lon - self.longitude
        dist = math.sqrt(dlat**2 + dlon**2)
        if dist < 0.001:
            self._target_lat = BASE_LAT + random.uniform(-0.03, 0.03)
            self._target_lon = BASE_LON + random.uniform(-0.03, 0.03)
            return
        step = min(0.0005, dist)
        self.latitude += (dlat / dist) * step
        self.longitude += (dlon / dist) * step
        self.speed_kmh = random.uniform(50, 95)
        self.heading_deg = (math.degrees(math.atan2(dlon, dlat)) + 360) % 360

    def to_dict(self):
        return {"vehicle_id":self.vehicle_id,"vehicle_type":self.vehicle_type,
                "icon":self.icon,"call_sign":self.call_sign,
                "latitude":round(self.latitude,5),"longitude":round(self.longitude,5),
                "speed_kmh":round(self.speed_kmh,1),"heading_deg":round(self.heading_deg,1),
                "active":self.active,"dispatched_to":self.dispatched_to}


class Signal:
    STATES = ["green","yellow","red"]
    COLORS = {"green":"#22c55e","yellow":"#eab308","red":"#ef4444"}
    EMOJIS = {"green":"🟢","yellow":"🟡","red":"🔴"}
    DURATIONS = {"green":45,"yellow":5,"red":40}

    def __init__(self, sid, name, lat, lon, state):
        self.signal_id = sid
        self.location_name = name
        self.latitude = lat
        self.longitude = lon
        self.current_state = state
        self.state_start = time.time() - random.uniform(0, 20)
        self.priority_override = False

    @property
    def seconds_until_change(self):
        dur = self.DURATIONS.get(self.current_state, 30)
        return max(0.0, dur - (time.time() - self.state_start))

    def tick(self):
        if self.priority_override: return
        if (time.time() - self.state_start) >= self.DURATIONS.get(self.current_state, 30):
            idx = self.STATES.index(self.current_state)
            self.current_state = self.STATES[(idx+1) % 3]
            self.state_start = time.time()

    def to_dict(self):
        return {"signal_id":self.signal_id,"location_name":self.location_name,
                "latitude":self.latitude,"longitude":self.longitude,
                "current_state":self.current_state,"color":self.COLORS[self.current_state],
                "emoji":self.EMOJIS[self.current_state],
                "seconds_until_change":round(self.seconds_until_change,1),
                "priority_override":self.priority_override}


# ─── System State ────────────────────────────────────────────────
def haversine(lat1,lon1,lat2,lon2):
    p1,p2 = math.radians(lat1),math.radians(lat2)
    dp,dl = math.radians(lat2-lat1),math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a),math.sqrt(1-a))

VEHICLES = [
    Vehicle("POL-001","Police Car","ALPHA-1",   BASE_LAT+0.010,BASE_LON+0.012,65,270,"Bank robbery — Anna Salai"),
    Vehicle("AMB-007","Ambulance","BRAVO-7",    BASE_LAT-0.015,BASE_LON+0.020,80,45, "Cardiac emergency — Adyar"),
    Vehicle("FIRE-003","Fire Engine","CHARLIE-3",BASE_LAT+0.025,BASE_LON-0.018,70,180,"Building fire — T. Nagar"),
    Vehicle("HAZ-002","HAZMAT Unit","DELTA-2",  BASE_LAT-0.030,BASE_LON-0.025,55,90, "Chemical spill — Manali"),
    Vehicle("MED-005","Medical Van","ECHO-5",   BASE_LAT+0.035,BASE_LON+0.030,60,315,"Mass casualty — Marina Beach"),
    Vehicle("POL-012","Police Car","FOXTROT-12",BASE_LAT+0.002,BASE_LON-0.010,90,0,  "High speed chase — ECR"),
]

SIGNALS = [
    Signal("SIG-01","Anna Salai & Mount Rd",   BASE_LAT+0.005, BASE_LON+0.008,"green"),
    Signal("SIG-02","Adyar Flyover",           BASE_LAT-0.012, BASE_LON+0.018,"red"),
    Signal("SIG-03","T. Nagar Junction",       BASE_LAT+0.022, BASE_LON-0.015,"yellow"),
    Signal("SIG-04","Vadapalani Circle",       BASE_LAT+0.018, BASE_LON-0.030,"green"),
    Signal("SIG-05","Marina Beach Entrance",  BASE_LAT-0.025, BASE_LON+0.040,"red"),
    Signal("SIG-06","Koyambedu Terminal",      BASE_LAT+0.040, BASE_LON-0.020,"green"),
    Signal("SIG-07","Guindy Signal",           BASE_LAT-0.008, BASE_LON-0.005,"yellow"),
    Signal("SIG-08","Perambur Junction",       BASE_LAT+0.035, BASE_LON+0.015,"red"),
    Signal("SIG-09","Tambaram North Gate",     BASE_LAT-0.045, BASE_LON-0.010,"green"),
    Signal("SIG-10","Porur Signal",            BASE_LAT+0.012, BASE_LON-0.048,"red"),
]

alert_log = []
alerted_pairs = set()

def scan_loop():
    while True:
        for v in VEHICLES:
            if not v.active: continue
            v.move()
            for s in SIGNALS:
                s.tick()
                dist = haversine(v.latitude,v.longitude,s.latitude,s.longitude)
                key = (v.vehicle_id, s.signal_id)
                if dist <= ALERT_RADIUS_KM:
                    if key not in alerted_pairs:
                        eta = int((dist/max(v.speed_kmh,1))*3600)
                        alert = {
                            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                            "vehicle_id": v.vehicle_id,
                            "vehicle_type": v.vehicle_type,
                            "call_sign": v.call_sign,
                            "signal_id": s.signal_id,
                            "signal_location": s.location_name,
                            "signal_state": s.current_state,
                            "distance_km": round(dist,3),
                            "eta_seconds": eta,
                        }
                        alert_log.append(alert)
                        alerted_pairs.add(key)
                        socketio.emit("alert", alert)
                else:
                    alerted_pairs.discard(key)

        status = {
            "active_vehicles": sum(1 for v in VEHICLES if v.active),
            "total_signals": len(SIGNALS),
            "total_alerts": len(alert_log),
            "vehicles": [v.to_dict() for v in VEHICLES],
            "signals": [s.to_dict() for s in SIGNALS],
            "recent_alerts": alert_log[-20:],
        }
        socketio.emit("status_update", status)
        time.sleep(2)

# ─── Auth Routes ─────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username","").strip()
    password = data.get("password","")
    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error":"Invalid credentials"}), 401
    token = generate_token(username)
    return jsonify({"token":token,"username":username,"role":user["role"],"name":user["name"]})

@app.route("/api/logout", methods=["POST"])
@require_auth
def logout():
    auth = request.headers.get("Authorization","")
    token = auth.replace("Bearer ","")
    _sessions.pop(token, None)
    return jsonify({"message":"Logged out"})

@app.route("/api/me")
@require_auth
def me():
    auth = request.headers.get("Authorization","")
    token = auth.replace("Bearer ","")
    username = _sessions[token]
    user = USERS[username]
    return jsonify({"username":username,"role":user["role"],"name":user["name"]})

# ─── Data Routes ─────────────────────────────────────────────────
@app.route("/api/status")
@require_auth
def api_status():
    return jsonify({
        "active_vehicles": sum(1 for v in VEHICLES if v.active),
        "total_signals": len(SIGNALS),
        "total_alerts": len(alert_log),
        "vehicles": [v.to_dict() for v in VEHICLES],
        "signals": [s.to_dict() for s in SIGNALS],
        "recent_alerts": alert_log[-20:],
    })

@app.route("/api/alerts")
@require_auth
def api_alerts():
    return jsonify(alert_log[-50:])

@app.route("/api/signals/<signal_id>/override", methods=["POST"])
@require_auth
def signal_override(signal_id):
    sig = next((s for s in SIGNALS if s.signal_id == signal_id), None)
    if not sig: return jsonify({"error":"Not found"}), 404
    data = request.json or {}
    if data.get("action") == "force_green":
        sig.current_state = "green"
        sig.state_start = time.time()
        sig.priority_override = True
    elif data.get("action") == "release":
        sig.priority_override = False
    return jsonify(sig.to_dict())

if __name__ == "__main__":
    t = threading.Thread(target=scan_loop, daemon=True)
    t.start()
    print("🚦 V2I Backend running on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)