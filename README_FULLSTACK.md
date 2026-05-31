# 🚦 V2I Signal Sync — Fullstack Edition

A real-time Vehicle-to-Infrastructure system for emergency responders.
**React frontend + Flask/Socket.IO backend with authentication.**

---

## 📁 Project Structure
```
v2i_fullstack/
├── backend/
│   ├── app.py              ← Flask + Socket.IO server (single file)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx         ← Full React app (login + dashboard)
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Quick Start

### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 🔐 Login Credentials

| Role       | Username    | Password    | Access             |
|------------|-------------|-------------|-------------------|
| Admin      | admin       | admin123    | Full control       |
| Dispatcher | dispatcher  | disp456     | Signal overrides   |
| Officer    | officer     | officer789  | View only          |

---

## ✨ Features

### Login Page
- Secure token-based authentication
- Role-based access (admin / dispatcher / officer)
- Demo credential quick-fill buttons
- Animated tactical grid background

### Dashboard — 4 Tabs
| Tab | Description |
|-----|-------------|
| **Overview** | KPI cards, fleet status, signal network, live alert stream |
| **Vehicles** | Detailed real-time cards for all 6 emergency vehicles |
| **Signals** | Signal status + force-green override (admin/dispatcher) |
| **Alerts** | Full sortable alert history table |

### Real-time
- Socket.IO pushes status every 2 seconds
- Alert notifications flash in the UI instantly
- Signal phase countdowns update live

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/login` | No | Get JWT token |
| POST | `/api/logout` | Yes | Invalidate token |
| GET | `/api/me` | Yes | Current user info |
| GET | `/api/status` | Yes | Full system status |
| GET | `/api/alerts` | Yes | Alert history |
| POST | `/api/signals/:id/override` | Yes | Force green / release |

### Socket.IO Events
- `status_update` — full status payload every 2s
- `alert` — new alert event in real-time
