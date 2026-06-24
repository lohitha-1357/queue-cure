import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

export default function Receptionist() {
  const [queue, setQueue] = useState(null);
  const [name, setName] = useState("");
  const [consultTime, setConsultTime] = useState(5);
  const [toast, setToast] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    socket.on("queue:update", (data) => {
      setQueue(data);
      setConsultTime(data.avgConsultTime);
    });
    return () => socket.off("queue:update");
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addPatient(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    socket.emit("receptionist:add_patient", { name: trimmed });
    setName("");
    showToast(`✅ Token #${queue ? queue.nextToken : "?"} — ${trimmed} added`);
    inputRef.current?.focus();
  }

  function callNext() {
    if (!queue || queue.totalInQueue === 0) return;
    socket.emit("receptionist:call_next");
    showToast("📣 Next patient called");
  }

  function updateConsultTime() {
    socket.emit("receptionist:set_consult_time", { minutes: consultTime });
    showToast(`⏱ Avg consult time set to ${consultTime} min`);
  }

  function resetQueue() {
    if (!window.confirm("Reset entire queue? This cannot be undone.")) return;
    socket.emit("receptionist:reset_queue");
    showToast("🔄 Queue has been reset");
  }

  const allPatients = queue
    ? [
        ...(queue.currentToken !== null
          ? [{ token: queue.currentToken, name: "— serving —", serving: true }]
          : []),
        ...queue.waiting,
      ]
    : [];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Receptionist Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: 2 }}>
            Manage patient queue in real-time
          </p>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          Live
        </span>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-val">{queue?.totalInQueue ?? "—"}</div>
          <div className="stat-label">Waiting</div>
        </div>
        <div className="stat">
          <div className="stat-val">{queue?.currentToken ?? "—"}</div>
          <div className="stat-label">Now Serving</div>
        </div>
        <div className="stat">
          <div className="stat-val">{queue?.avgConsultTime ?? "—"}</div>
          <div className="stat-label">Min / Patient</div>
        </div>
        <div className="stat">
          <div className="stat-val">{queue ? (queue.totalInQueue * queue.avgConsultTime) : "—"}</div>
          <div className="stat-label">Est. Total Wait (min)</div>
        </div>
      </div>

      {/* Add Patient */}
      <div className="card">
        <div className="card-title">Add New Patient</div>
        <form className="input-row" onSubmit={addPatient}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Patient name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            + Add Token
          </button>
        </form>
      </div>

      {/* Call Next + Consult Time */}
      <div className="card">
        <div className="card-title">Controls</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: "1rem", padding: "14px 28px", letterSpacing: ".3px" }}
            onClick={callNext}
            disabled={!queue || queue.totalInQueue === 0}
          >
            📣 Call Next Patient
          </button>

          <div className="consult-row">
            <label>Avg. consult time</label>
            <input
              type="number"
              min={1}
              max={120}
              value={consultTime}
              onChange={(e) => setConsultTime(Number(e.target.value))}
            />
            <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>minutes</span>
            <button className="btn btn-sm" style={{ background: "var(--border)", color: "var(--navy)" }} onClick={updateConsultTime}>
              Update
            </button>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="card">
        <div className="section-header">
          <div className="card-title" style={{ margin: 0 }}>
            Queue ({queue?.totalInQueue ?? 0} waiting)
          </div>
          <button className="btn btn-sm btn-danger" onClick={resetQueue}>
            Reset Queue
          </button>
        </div>

        {allPatients.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏥</div>
            <p>No patients in queue. Add one above.</p>
          </div>
        ) : (
          <ul className="queue-list">
            {allPatients.map((p) => (
              <li key={p.token} className={`queue-item ${p.serving ? "queue-item-active" : ""}`}>
                <div className="q-token">{p.token}</div>
                <div className="q-name">
                  {p.name}
                  {p.serving && (
                    <div style={{ fontSize: ".72rem", color: "var(--teal)", fontWeight: 700, marginTop: 2 }}>
                      ▶ Currently being served
                    </div>
                  )}
                </div>
                <div className="q-meta">
                  {!p.serving && (
                    <>
                      <div>#{p.position} in line</div>
                      <div className="q-wait">~{p.estimatedWaitMinutes} min</div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
