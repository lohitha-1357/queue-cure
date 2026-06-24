import React, { useState, useEffect } from "react";
import { socket } from "../socket";

// Format minutes nicely
function fmtWait(mins) {
  if (mins === 0) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function WaitingRoom() {
  const [queue, setQueue] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [myToken, setMyToken] = useState(null);
  const [prevCurrent, setPrevCurrent] = useState(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    socket.on("queue:update", (data) => {
      setQueue((prev) => {
        if (prev && prev.currentToken !== data.currentToken) {
          // Token changed — flash the board
          setFlash(true);
          setTimeout(() => setFlash(false), 700);
        }
        return data;
      });
    });
    return () => socket.off("queue:update");
  }, []);

  const myInfo = queue?.waiting.find((p) => p.token === myToken);
  const imNext = queue && myToken && queue.waiting[0]?.token === myToken;
  const imServing = queue && myToken && queue.currentToken === myToken;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Patient Waiting Room</h1>
          <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: 2 }}>
            Updates instantly — no need to refresh
          </p>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          Live
        </span>
      </div>

      {/* Big current token display */}
      <div className={`card token-display ${flash ? "flash-card" : ""}`}
        style={{ transition: "background .4s", background: flash ? "var(--teal-lt)" : "var(--white)" }}>
        <div className="token-label">Now Serving</div>
        {queue?.currentToken ? (
          <>
            <div className="token-number">{String(queue.currentToken).padStart(3, "0")}</div>
            <div className="token-name">
              {queue.waiting.length === 0 && queue.currentToken
                ? "Please proceed to the doctor"
                : "Please proceed to the doctor"}
            </div>
          </>
        ) : (
          <div style={{ padding: "24px 0", color: "var(--muted)", fontWeight: 600 }}>
            No patient being seen yet
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-val">{queue?.totalInQueue ?? "—"}</div>
          <div className="stat-label">Ahead of Next Call</div>
        </div>
        <div className="stat">
          <div className="stat-val">
            {queue ? fmtWait(queue.totalInQueue * queue.avgConsultTime) : "—"}
          </div>
          <div className="stat-label">Max Wait Ahead</div>
        </div>
        <div className="stat">
          <div className="stat-val">{queue?.avgConsultTime ?? "—"}</div>
          <div className="stat-label">Min / Consult</div>
        </div>
      </div>

      {/* My token lookup */}
      <div className="card">
        <div className="card-title">Track Your Token</div>
        <div className="input-row">
          <input
            type="number"
            placeholder="Enter your token number…"
            value={tokenInput}
            min={1}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => setMyToken(Number(tokenInput))}
            disabled={!tokenInput}
          >
            Track
          </button>
        </div>

        {myToken && (
          <div style={{ marginTop: 18 }}>
            {imServing ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "2rem" }}>🎉</div>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--teal)", marginTop: 8 }}>
                  It's your turn! Token #{myToken}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>Please proceed to the doctor's room.</div>
              </div>
            ) : myInfo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div className="q-token" style={{ width: 56, height: 56, fontSize: "1.1rem" }}>
                  {myToken}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{myInfo.name}</div>
                  <div className="position-badge">#{myInfo.position} in queue</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>Estimated wait</div>
                  <div style={{ fontWeight: 800, fontSize: "1.4rem", color: imNext ? "var(--green)" : "var(--amber)" }}>
                    {fmtWait(myInfo.estimatedWaitMinutes)}
                  </div>
                  {imNext && (
                    <div style={{ fontSize: ".75rem", color: "var(--green)", fontWeight: 700 }}>
                      You're next!
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)", marginTop: 8, fontSize: ".9rem" }}>
                Token #{myToken} not found in current queue.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full waiting list */}
      <div className="card">
        <div className="card-title">Queue ({queue?.totalInQueue ?? 0} waiting)</div>
        {!queue || queue.waiting.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <p>Queue is empty. No wait time!</p>
          </div>
        ) : (
          <ul className="queue-list">
            {queue.waiting.map((p) => (
              <li
                key={p.token}
                className={`queue-item ${p.token === myToken ? "queue-item-active" : ""}`}
              >
                <div className="q-token">{p.token}</div>
                <div className="q-name">
                  {p.token === myToken ? p.name : "Patient"}{" "}
                  {p.token === myToken && (
                    <span style={{ fontSize: ".72rem", color: "var(--teal)", fontWeight: 700 }}>(You)</span>
                  )}
                </div>
                <div className="q-meta">
                  <div>#{p.position} in line</div>
                  <div className="q-wait">~{fmtWait(p.estimatedWaitMinutes)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
