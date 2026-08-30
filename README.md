# VIRA — 1-to-1 Browser Voice Calling

A minimal, strongly-typed, TypeScript-first real-time voice calling system.
Two browser clients connect peer-to-peer over WebRTC; a Node/Express/Socket.IO
server handles only signaling and call state, never the audio itself.

This is an original implementation. It was built after studying two existing
repositories for architectural ideas (a simple WebRTC foundation from one, a
larger calling-experience structure from the other) — no source code from
either was copied or merged.

## 1. Final Project Structure

```
VIRA/
├── package.json              # root: npm workspaces, one `npm install` for both
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── App.tsx / App.css / index.css
│       ├── vite-env.d.ts
│       ├── types/
│       │   ├── user.ts            # UserDTO, PresenceStatus
│       │   ├── call.ts            # CallState union, CallError, ActiveCallInfo
│       │   └── socket-events.ts   # Client<->Server event contract
│       ├── services/
│       │   ├── socket.ts          # typed Socket.IO client singleton
│       │   └── webrtcPeer.ts      # RTCPeerConnection lifecycle wrapper
│       ├── hooks/
│       │   ├── useWebRTC.ts       # reactive wrapper around WebRTCPeer
│       │   ├── useCallTimer.ts    # call duration counter
│       │   └── useCallManager.ts  # orchestrates sockets + call state + WebRTC
│       ├── components/
│       │   ├── UserList.tsx
│       │   ├── IncomingCallModal.tsx
│       │   ├── ActiveCallScreen.tsx
│       │   └── ErrorBanner.tsx
│       └── pages/
│           └── Home.tsx
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── server.ts               # Express + Socket.IO entry point
        ├── types/
        │   ├── user.ts
        │   ├── call.ts
        │   └── socket-events.ts    # mirrors client's contract exactly
        ├── services/
        │   ├── presence.service.ts # in-memory Map of connected users
        │   └── call.service.ts     # in-memory Map of active call sessions
        ├── sockets/
        │   ├── index.ts            # registers all handlers on connection
        │   ├── presence.socket.ts
        │   ├── call.socket.ts      # request/accept/reject/end + disconnect cleanup
        │   └── webrtc.socket.ts    # pure SDP/ICE relay, never touches audio
        ├── controllers/
        │   └── health.controller.ts
        └── utils/
            └── logger.ts
```

No Redis. No Docker. Everything runs with plain `npm` commands on a normal
machine (Windows, Mac, or Linux).

## 2. Installation

From the `VIRA/` root:

```bash
npm install
```

This uses npm workspaces to install both `client/` and `server/` dependencies
in a single step.

Then copy the environment examples (defaults work as-is for local testing):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

(On Windows PowerShell: `copy server\.env.example server\.env` and
`copy client\.env.example client\.env`.)

## 3. Development Commands

Open two terminals from the `VIRA/` root:

```bash
# Terminal 1 — server (http://localhost:4000)
npm run dev:server

# Terminal 2 — client (http://localhost:5173)
npm run dev:client
```

Or, without workspaces, from inside each folder directly:

```bash
cd server && npm run dev
cd client && npm run dev
```

Type-check everything without emitting files:

```bash
npm run typecheck
```

## 4. Testing Two Users Locally

1. Open `http://localhost:5173` in one browser tab/window.
2. Enter a username (e.g. "Alice") and click Join.
3. Open a second tab in **incognito/private mode** (important — a normal
   second tab shares the same Socket.IO connection context in some
   browsers) or use a completely different browser, and go to the same URL.
4. Enter a different username (e.g. "Bob") and click Join.
5. Alice should now see Bob in her user list (and vice versa).
6. Click "Call" next to Bob's name from Alice's window.
7. Bob's window shows an incoming call modal — click Accept.
8. Both browsers will prompt for microphone permission — allow it on both.
9. Once WebRTC negotiation completes, both sides show "Connected" with a
   running call timer, and you should hear each other's mic audio.
10. Try Mute/Unmute, then End Call from either side, and confirm the other
    side's screen returns to the user list.

To test across two separate devices on the same Wi-Fi instead of two tabs:
find your machine's LAN IP (`ipconfig` / `ifconfig`), set `VITE_SERVER_URL`
in `client/.env` to `http://<your-lan-ip>:4000`, and open
`http://<your-lan-ip>:5173` on the second device.

## 5. Signaling Flow (Socket.IO)

```
Client A                     Server                      Client B
   │ presence:register  ───────▶ │                            │
   │ ◀─────── presence:self      │                            │
   │ ◀─────── presence:users     │ ────── presence:users ────▶ │
   │                              │                            │
   │ call:request(toUserId=B) ──▶ │                            │
   │ ◀────── call:ringing         │ ──────── call:incoming ───▶ │
   │                              │ ◀────────  call:accept      │
   │ ◀────── call:accepted        │                            │
   │  (caller now creates the WebRTC offer — see §6)            │
```

The server's only job here is bookkeeping: who is calling whom, translating
a `toUserId` into the right socket to deliver events to, tracking each
call's status, and freeing both users up again on end/reject/disconnect.
It never inspects or stores audio.

## 6. WebRTC Flow

```
1. Caller receives "call:accepted" from server
2. Caller creates an RTCPeerConnection
3. Caller calls getUserMedia() for microphone access
4. Caller adds the audio track(s) to the peer connection
5. Caller creates an SDP offer, sets it as local description
6. Offer is sent to the callee via "webrtc:offer" (relayed by the server)
7. Callee (who already created ITS OWN peer connection + acquired its
   own microphone the moment it clicked Accept) sets the offer as its
   remote description
8. Callee creates an SDP answer, sets it as local description
9. Answer is sent back via "webrtc:answer"
10. Caller sets the answer as its remote description
11. Both sides exchange ICE candidates as they're discovered
    (via "webrtc:ice-candidate", relayed by the server)
12. Once ICE negotiation succeeds, the RTCPeerConnection reaches the
    "connected" state and audio flows directly, peer-to-peer —
    the server is no longer involved in the media path at all
13. The remote audio track arrives via the connection's "ontrack" event
    and is played through an <audio> element
```

A note on ICE candidate timing: candidates can occasionally arrive at one
side before that side has even created its peer connection yet (a natural
race in any offer/answer flow). `useCallManager` queues any such early
candidates in `pendingCandidatesRef` and flushes them the moment the peer
connection exists, rather than dropping them.

## 7. Call State System

The client tracks a strict state union (`client/src/types/call.ts`):

```
IDLE → CALLING (caller) | RINGING (callee)
CALLING → ACCEPTED | REJECTED | ENDED
RINGING → ACCEPTED | REJECTED
ACCEPTED → CONNECTING
CONNECTING → CONNECTED | ENDED (on ICE/negotiation failure)
CONNECTED → ENDED
REJECTED → IDLE (auto, after a short display delay)
ENDED → IDLE (auto, after a short display delay)
```

This is intentionally richer than the server's own `ServerCallStatus`
(`ringing | accepted | rejected | ended`) — the client additionally tracks
WebRTC negotiation phases (`CONNECTING`/`CONNECTED`) that are pure local
detail the server has no reason to know about.

## 8. Dependencies and Why Each Is Needed

**Server:**
| Package | Why |
|---|---|
| `express` | Minimal HTTP server, just for a `/health` endpoint and to host the Socket.IO upgrade |
| `socket.io` | Real-time bidirectional events for signaling and call state |
| `cors` | Allows the client (different port) to connect during local dev |
| `dotenv` | Loads `PORT`/`CLIENT_ORIGIN` from `.env` |
| `tsx` (dev) | Runs TypeScript directly with hot reload, no manual compile step during development |
| `typescript` (dev) | Type checking + production build |

**Client:**
| Package | Why |
|---|---|
| `react` / `react-dom` | UI rendering |
| `socket.io-client` | Typed real-time connection to the server |
| `vite` / `@vitejs/plugin-react` (dev) | Fast dev server and build tooling |
| `typescript` (dev) | Type checking + production build |

No Redis, no state-management library, no UI framework beyond React itself,
no video — kept deliberately minimal per the project's scope.

## 9. Error Handling Covered

- Microphone permission denied → typed `MIC_PERMISSION_DENIED`, surfaced via `ErrorBanner`, call is cleanly aborted
- No microphone available → typed `NO_MICROPHONE`
- Calling a user who went offline → `USER_UNAVAILABLE`
- Calling yourself → `CANNOT_CALL_SELF`
- Calling/being called while already in a call → `USER_BUSY`
- Callee rejects → both sides return to `IDLE` after a brief "Call rejected" display
- Either side ends the call → the other side is notified and cleaned up
- Either side disconnects (closes tab, loses network) mid-call → server
  detects the socket disconnect, ends the call session server-side, and
  notifies the remaining party so they aren't left "in a call" forever
- WebRTC connection failure/ICE failure → typed `WEBRTC_CONNECTION_FAILED`,
  call is torn down on both sides
- Client's own socket disconnects → `SOCKET_DISCONNECTED`, local call state resets

## What's Deliberately NOT Included (by design, this stage)

Text chat, voice messages, reactions, screen/video sharing, file sharing,
authentication beyond a username, Redis, Docker requirement, VAD, ECAPA-TDNN,
anti-spoofing, transcription. The codebase is structured so an audio
processing layer could be inserted between microphone capture and the
peer connection later, but nothing from that future direction is
implemented yet.

## 10. Supabase Setup (Auth + Database)

VIRA uses Supabase for authentication (email/password + Google OAuth) and
as its Postgres database (profiles, contacts). It replaced an earlier
custom JWT/bcrypt implementation once real persistence was needed.

**Setup:**
1. Create a free project at supabase.com
2. Run `supabase/schema.sql` once in the Supabase SQL Editor (creates
   `profiles`, `contacts`, RLS policies, and an auto-profile-creation trigger)
3. Enable Google as an auth provider under **Authentication → Providers**
   (requires a Google Cloud OAuth Client ID/Secret)
4. Copy your Project URL and `anon public` key from **Project Settings → API**
5. Set them in `client/.env`:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

**Architecture note:** the client (`client/src/services/supabaseClient.ts`)
talks to Supabase directly for auth, profile reads/writes, and contacts —
protected entirely by the Row Level Security policies in `schema.sql`, not
by any custom Express endpoint. The Node/Express/Socket.IO server is used
purely for call signaling and does not currently touch Supabase at all.

**Known/unknown callers:** whether a caller is "known" is a pure
set-membership check — does the caller's unique account `id` exist in the
callee's `contacts` table? Never a comparison of username, display name,
bio, or photo. Those fields are freely editable and therefore meaningless
as a security signal; the unique id is not.

**Username:** set once, right after first login (a required step for
Google sign-ins specifically, since Google doesn't provide one). Enforced
unique at the database level (`profiles.username` has a `unique`
constraint). It is NOT the security mechanism for known/unknown — see
above — it exists purely so people have a human-friendly, unspoofable
handle to share instead of a raw UUID.
