# 🏥 Queue Cure '26
> Real-time clinic queue management — Queue Cure '26 Hackathon (Wooble)

## Problem
76% of India's 1.5 million clinics run on paper tokens and shouting. Patients wait 2–3 hours with zero visibility. Doctors have no dashboard.

## Solution
Queue Cure '26 is a real-time two-screen web app that:
- Lets the **receptionist** add patients, call next token, and set consultation time
- Gives the **waiting room** live updates on current token, queue position, and wait estimates
- Syncs **instantly** across all screens via WebSockets — no refresh needed

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Real-time | Socket.IO (client) |
| Backend | Express.js + Node.js |
| Real-time | Socket.IO (server) |
| State | In-memory (production: Redis) |

---

## Project Structure

```
queue-cure/
├── server/
│   ├── index.js          ← Express + Socket.IO server
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx       ← Router setup
│   │   ├── main.jsx      ← React entry point
│   │   ├── socket.js     ← Socket.IO singleton
│   │   ├── index.css     ← Global styles
│   │   └── pages/
│   │       ├── Receptionist.jsx   ← Screen 1
│   │       └── WaitingRoom.jsx    ← Screen 2
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── README.md
├── SOCKET_DIAGRAM.md
└── THOUGHT_PROCESS.md
```

---

## Setup & Run

### Prerequisites
- Node.js 18+
- npm

### 1. Install dependencies
```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Start the server
```bash
cd server
npm run dev        # development (nodemon, auto-restart)
# OR
npm start          # production
```
Server runs on → `http://localhost:4000`

### 3. Start the client (new terminal)
```bash
cd client
npm run dev
```
Client runs on → `http://localhost:3000`

### 4. Open both screens
| Screen | URL |
|--------|-----|
| Receptionist | http://localhost:3000/ |
| Waiting Room | http://localhost:3000/waiting |

> Open both in different browser tabs/windows to see live sync in action.

---

## Socket Events

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `receptionist:add_patient` | `{ name }` | Add patient to queue |
| Client → Server | `receptionist:call_next` | — | Call next patient |
| Client → Server | `receptionist:set_consult_time` | `{ minutes }` | Update avg consult time |
| Client → Server | `receptionist:reset_queue` | — | Clear entire queue |
| Server → All | `queue:update` | Full queue state | Broadcast on every change |

---

## Wait Time Calculation
```
remaining_for_current = max(0, avg_consult_time − elapsed_minutes)
wait_for_patient_N = remaining_for_current + (N × avg_consult_time)
```
Time is computed dynamically from `calledAt` timestamp — not hardcoded.

---

## Features
- ✅ Live sync across all clients on "Call Next"
- ✅ Dynamic wait time from real timestamps
- ✅ Token tracking by number (waiting room)
- ✅ Auto-reconnect on connection drop
- ✅ Queue reset with confirmation
- ✅ Mobile responsive

---

## Deployment
- **Backend**: Render / Railway / Fly.io (set `PORT` env var)
- **Frontend**: Vercel / Netlify (set `VITE_SERVER_URL` to deployed backend URL)

---

## Author
**Lohitha** — B.Tech CSE (Cyber Security), Raghu Engineering College  
GitHub: [github.com/lohitha-1357](https://github.com/lohitha-1357)
