# Thought Process Sheet — Queue Cure '26

**Participant:** Lohitha | Raghu Engineering College, Visakhapatnam  
**Hackathon:** Queue Cure '26 (Wooble)  
**Stack:** React + Vite + Express + Socket.IO

---

## 1. Problem Understanding

76% of India's 1.5M clinics use paper token slips. Patients have zero visibility into wait time. Receptionists manage everything by memory. The core pain:

- **Patient**: "How long will I wait? Should I step out for tea?"
- **Receptionist**: "Who's next? What number did I call last?"
- **Clinic**: No data, no efficiency, frustrated patients

**Root cause**: No real-time shared state between the desk and the waiting area.

---

## 2. Solution Design Decisions

### Why WebSockets (not polling)?
A patient checking their phone every 30 seconds creates stale data and wasted requests. With Socket.IO, the moment the receptionist clicks "Call Next", every patient's screen updates in ~50ms. This is the entire UX difference.

### Why in-memory state (not a database)?
For a hackathon MVP with a single-clinic scope, in-memory is faster to build, has zero latency, and is sufficient. The trade-off is state loss on server restart. In production, Redis with persistence would replace this.

### Why computed wait times (not hardcoded)?
Wait time is a function of: how long the current patient has already been seen + how many patients are ahead × average consult time. If I hardcode "5 minutes per patient", a doctor who is taking 12 minutes breaks the entire estimate. By tracking `calledAt` timestamp, the remaining time for the current patient shrinks in real-time.

**Formula:**
```
remaining = max(0, avgConsultTime − (now − calledAt) in minutes)
waitForPositionN = remaining + (N × avgConsultTime)
```

---

## 3. Architecture Choices

### Two screens, one source of truth
Both screens (Receptionist, Waiting Room) are React clients connected to the same Socket.IO server. The server holds the queue state. No client stores authoritative state — they only render what the server broadcasts.

This prevents: "Receptionist's screen shows token 5 but waiting room still shows 4."

### Single broadcast event
Instead of separate events per action, every mutation (add, call, reset, config) triggers one `queue:update` broadcast with the full computed state. This is simpler and means every client is always in sync regardless of which events they may have missed.

### Socket singleton pattern
`socket.js` exports one shared socket instance. If each component created its own `io()` connection, the app would have multiple connections per browser tab — wasteful and confusing.

---

## 4. Edge Cases Addressed

| Edge Case | How I handled it |
|-----------|-----------------|
| Empty queue, Call Next clicked | Server checks `waiting.length === 0`, clears `currentToken`, no crash |
| Call Next when no current patient | Server skips the "remove current" step cleanly |
| Invalid patient name (empty, too long) | Server trims + validates; client disables button if input empty |
| Invalid consult time (0, negative, >120) | Server rejects with `isNaN` and range check |
| Browser tab refresh | Socket reconnects, server emits current state on `connection` event |
| Two receptionists simultaneously | Node.js single-threaded event loop serialises socket events — no race condition |
| Network drop mid-session | Socket.IO auto-reconnect with exponential backoff; state restored on reconnect |
| Patient not in queue types their token | WaitingRoom shows "Token not found" gracefully |

---

## 5. Concurrency Analysis

Node.js processes Socket.IO events on a single thread. This means:
- `receptionist:add_patient` from User A and `receptionist:call_next` from User B cannot interleave mid-execution
- The event loop guarantees that each handler runs to completion before the next one starts
- This gives us **free mutual exclusion** without needing locks or semaphores

If scaled to multiple Node.js instances (e.g., with a load balancer), we would need:
- **Redis Adapter** for Socket.IO (so all instances share the same room/broadcast)
- **Redis** as the shared queue store (replacing in-memory `state`)

---

## 6. Wait Time Accuracy

Average consult time is set by the receptionist based on the doctor. It's not a guess — it's real clinic data. The estimate improves further because:

- The current patient's remaining time shrinks in real-time (not stuck at 5 min)
- Every "Call Next" resets the countdown
- The server re-broadcasts every 30 seconds even without events, so wait times stay fresh

This is meaningfully better than "you're #4 in queue" with no time estimate.

---

## 7. What I Would Add with More Time

1. **Patient SMS/WhatsApp notification** when they're 2 positions away (Twilio API)
2. **Doctor dashboard** to see patient history and consultation notes
3. **Redis persistence** so queue survives server restarts
4. **PWA support** — patients scan QR code, queue opens as an installable app
5. **Analytics** — avg wait per day, peak hours, doctor efficiency metrics
6. **Multi-doctor** — each doctor has their own queue, receptionist routes patients

---

## 8. Key Learning

The hardest part was not the WebSocket code — it was designing the state correctly. Having `calledAt` as a timestamp (not a countdown) means wait time is always computed from reality, not from a ticking variable that drifts. This is the difference between an accurate estimate and a broken one.
