# Socket Event Diagram — Queue Cure '26

## Architecture Overview

```
┌─────────────────────┐         WebSocket          ┌──────────────────────┐
│  Receptionist Tab   │◄──────────────────────────►│                      │
│  (Browser Client A) │                             │   Node.js Server     │
└─────────────────────┘         WebSocket          │   (Express +         │
                                                    │    Socket.IO)        │
┌─────────────────────┐         WebSocket          │                      │
│  Waiting Room Tab   │◄──────────────────────────►│   In-Memory State    │
│  (Browser Client B) │                             │   { patients[],      │
└─────────────────────┘                             │     currentToken,    │
                                                    │     avgConsultTime } │
┌─────────────────────┐         WebSocket          │                      │
│  Waiting Room Tab   │◄──────────────────────────►│                      │
│  (Browser Client N) │                             └──────────────────────┘
└─────────────────────┘
```

---

## Event Flow Diagrams

### 1. Add Patient
```
Receptionist                    Server                    All Clients
     │                             │                           │
     │── receptionist:add_patient ─►│                           │
     │   { name: "Ravi Kumar" }    │                           │
     │                             │── Append to patients[]    │
     │                             │── nextToken++             │
     │                             │                           │
     │                             │── queue:update ──────────►│
     │                             │   { waiting, currentToken │
     │                             │     totalInQueue, ... }   │
```

### 2. Call Next Patient
```
Receptionist                    Server                    All Clients
     │                             │                           │
     │── receptionist:call_next ──►│                           │
     │                             │── Remove current patient  │
     │                             │── Set next as current     │
     │                             │── Record calledAt = now   │
     │                             │                           │
     │                             │── queue:update ──────────►│
     │                             │   (all screens update     │
     │                             │    within ~50ms)          │
```

### 3. Set Consult Time
```
Receptionist                    Server                    All Clients
     │                             │                           │
     │── receptionist:set_consult ─►│                          │
     │   { minutes: 7 }            │── Update avgConsultTime   │
     │                             │── Recompute all ETAs      │
     │                             │                           │
     │                             │── queue:update ──────────►│
```

### 4. New Client Connects
```
New Browser Tab                 Server
     │                             │
     │── socket.connect() ────────►│
     │                             │── Emit current state
     │◄── queue:update ────────────│   immediately to
     │    (full current state)     │   this client only
```

### 5. Client Disconnects & Reconnects
```
Client                          Server
     │── disconnect ────────────►│  (no state change)
     │                            │
     │── reconnect ───────────────►│
     │◄── queue:update ───────────│  (full state resent)
```

---

## State Shape (server → client)

```json
{
  "currentToken": 3,
  "avgConsultTime": 5,
  "nextToken": 7,
  "totalInQueue": 3,
  "waiting": [
    { "token": 4, "name": "Priya", "position": 1, "estimatedWaitMinutes": 3 },
    { "token": 5, "name": "Ravi",  "position": 2, "estimatedWaitMinutes": 8 },
    { "token": 6, "name": "Meena", "position": 3, "estimatedWaitMinutes": 13 }
  ]
}
```

---

## Wait Time Formula
```
elapsed      = (now - calledAt) / 60000          // ms → minutes
remaining    = max(0, avgConsultTime - elapsed)   // time left for current patient

For patient at position N (1-indexed in waiting[]):
  estimatedWait = remaining + (N × avgConsultTime)
```

All positions recompute on every `queue:update` — never cached or hardcoded.

---

## Concurrency Handling

| Scenario | Handling |
|----------|----------|
| Two receptionists click "Call Next" simultaneously | Single-threaded Node.js event loop processes events sequentially; no race condition possible |
| Client disconnects mid-session | Socket.IO auto-reconnect; server sends full state on reconnect |
| Receptionist adds patient while "Call Next" in flight | Event queue ensures ordering; broadcast after both mutations |
| Patient list is empty, Call Next clicked | Server checks `waiting.length === 0` and no-ops gracefully |
| Browser refresh | Client re-subscribes to `queue:update`; server pushes current state on `connection` event |

---

## Why WebSockets over Polling?

| | Short Polling | WebSockets |
|---|---|---|
| Latency | 1–5 seconds | ~50ms |
| Server load | High (constant requests) | Low (persistent connection) |
| Real-time feel | Choppy | Smooth |
| Implementation | Simple | Slightly more setup |

For a clinic queue where "Call Next" must be instantly visible to 10+ patients on their phones, WebSockets is the correct choice.
