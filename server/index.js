const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ─── In-memory queue state ───────────────────────────────────────────────────
let state = {
  patients: [],          // { token, name, addedAt }
  currentToken: null,    // token number currently being served
  avgConsultTime: 5,     // minutes per patient (set by receptionist)
  nextToken: 1,
  calledAt: null,        // timestamp when current patient was called
};

// ─── Helper: compute fresh wait estimates for each patient ───────────────────
function computeQueue() {
  const waiting = state.patients.filter(
    (p) => p.token !== state.currentToken
  );

  let estimatedWaitMinutes = 0;

  // Time already spent on current patient
  if (state.calledAt) {
    const elapsed = (Date.now() - state.calledAt) / 1000 / 60;
    const remaining = Math.max(0, state.avgConsultTime - elapsed);
    estimatedWaitMinutes = remaining;
  }

  const waitingWithEta = waiting.map((p, index) => {
    const waitAfterCurrent = estimatedWaitMinutes + index * state.avgConsultTime;
    return {
      ...p,
      position: index + 1,
      estimatedWaitMinutes: Math.round(waitAfterCurrent),
    };
  });

  return {
    currentToken: state.currentToken,
    avgConsultTime: state.avgConsultTime,
    nextToken: state.nextToken,
    waiting: waitingWithEta,
    totalInQueue: waiting.length,
  };
}

// ─── Broadcast updated queue to all clients ──────────────────────────────────
function broadcast() {
  io.emit("queue:update", computeQueue());
}

// ─── REST endpoints (used on first load) ────────────────────────────────────
app.get("/api/queue", (req, res) => {
  res.json(computeQueue());
});

// ─── Socket.IO events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] Client connected: ${socket.id}`);

  // Send current state immediately on connect
  socket.emit("queue:update", computeQueue());

  // ── receptionist:add_patient ──────────────────────────────────────────────
  // Payload: { name: string }
  socket.on("receptionist:add_patient", ({ name }) => {
    if (!name || typeof name !== "string") return;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;

    const patient = {
      token: state.nextToken++,
      name: trimmed,
      addedAt: Date.now(),
    };
    state.patients.push(patient);
    console.log(`[ADD] Token ${patient.token} — ${patient.name}`);
    broadcast();
  });

  // ── receptionist:call_next ────────────────────────────────────────────────
  // No payload needed
  socket.on("receptionist:call_next", () => {
    const waiting = state.patients.filter(
      (p) => p.token !== state.currentToken
    );

    // Remove the current patient from list (consultation done)
    if (state.currentToken !== null) {
      state.patients = state.patients.filter(
        (p) => p.token !== state.currentToken
      );
    }

    if (waiting.length === 0) {
      state.currentToken = null;
      state.calledAt = null;
      console.log("[NEXT] Queue is empty");
    } else {
      // The first waiting patient in queue order
      const next = state.patients.find((p) => p.token !== state.currentToken);
      // After removal above, first patient IS the next
      const refiltered = state.patients[0];
      state.currentToken = refiltered ? refiltered.token : null;
      state.calledAt = Date.now();
      console.log(`[NEXT] Now serving token ${state.currentToken}`);
    }

    broadcast();
  });

  // ── receptionist:set_consult_time ─────────────────────────────────────────
  // Payload: { minutes: number }
  socket.on("receptionist:set_consult_time", ({ minutes }) => {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) return;
    state.avgConsultTime = mins;
    console.log(`[CONFIG] Avg consult time set to ${mins} min`);
    broadcast();
  });

  // ── receptionist:reset_queue ──────────────────────────────────────────────
  socket.on("receptionist:reset_queue", () => {
    state = {
      patients: [],
      currentToken: null,
      avgConsultTime: state.avgConsultTime,
      nextToken: 1,
      calledAt: null,
    };
    console.log("[RESET] Queue cleared");
    broadcast();
  });

  socket.on("disconnect", () => {
    console.log(`[-] Client disconnected: ${socket.id}`);
  });
});

// ─── Re-broadcast every 30 seconds so wait times stay fresh ─────────────────
setInterval(() => {
  if (state.currentToken !== null) broadcast();
}, 30000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🏥 Queue Cure server running on http://localhost:${PORT}\n`);
});
