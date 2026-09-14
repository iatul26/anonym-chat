# AnonymChat — Ephemeral, Zero-Trace Group Messaging

AnonymChat is a lightweight, privacy-first real-time chat web application built with Node.js, Express, WebSockets (`ws`), and React (Vite). It operates on a strict **zero-persistence architecture**: no databases, no authentication systems, no tracking cookies, and no disk logs. All chat data lives exclusively in volatile server RAM and is permanently purged once a session ends.

---

## Key Features

* **Strict Anonymity & Zero Persistence:** No logins, emails, phone numbers, or passwords. Data is stored solely in volatile memory (`Map()`) and permanently deallocated by garbage collection when a room closes.
* **Pre-Assigned Ephemeral Identity:** Each browser session generates an anonymous device identifier (`anon_uid`) and animal handle stored only in client `sessionStorage`.
* **Knocking Queue & Access Control:** Guests request access to join private rooms. Owners receive real-time approval prompts with a strict limit of 3 join attempts per unique ID.
* **Owner Grace Period & Reconnection:** If the owner leaves or refreshes, a 1-minute countdown begins instead of immediately killing the room. Rejoining restores ownership and cancels the destruction timer.
* **Capability-Based Ownership:** Room owners receive a cryptographically generated 256-bit token (`ownerToken`) granting room-destruction capabilities without requiring account credentials.
* **Memory Protection & FIFO Trimming:** Server bounds room size by byte limits (configurable up to 256 KB). When memory limits are reached, the oldest messages are automatically discarded (FIFO).
* **Anti-Abuse Rate Limiting:** Sliding-window rate limiters across HTTP and WebSocket layers prevent denial-of-service bursts and rapid-fire spam.

---

## Tech Stack

* **Frontend:** React 18, Vite, Bootstrap 5, Custom React Hooks (`useChatSocket`)
* **Backend:** Node.js (ES Modules), Express.js
* **Real-Time Protocol:** Native WebSockets (`ws`)
* **Storage:** In-memory volatile heap (`Map`) — zero disk writes

---

## Project Architecture

```text
anonym-chat/
├── package.json               # Root build and deployment orchestration
├── server/
│   ├── config/
│   │   └── constants.js       # Configurable limits, TTLs, and handle generators
│   ├── services/
│   │   ├── roomManager.js     # Ephemeral in-memory state, FIFO purge, timers
│   │   └── rateLimiter.js     # Sliding-window rate limiter
│   ├── controllers/
│   │   ├── roomController.js   # HTTP validation and creation endpoints
│   │   └── socketController.js # WebSocket event routing and frame handling
│   ├── routes/
│   │   └── roomRoutes.js      # Express REST routes
│   └── server.js              # HTTP server, WS server, and SPA static hosting
└── client/
    ├── index.html
    ├── vite.config.js         # Proxy configuration for local /api and /ws
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── hooks/
        │   └── useChatSocket.js # WebSocket lifecycle and event state management
        └── components/
            ├── Lobby.jsx
            ├── ChatHeader.jsx
            ├── MessageList.jsx
            └── MessageInput.jsx

```

---

## Configuration Variables

Configure limits through environment variables or modify `server/config/constants.js`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | Port for the backend Express/WS server. |
| `OWNER_GRACE_PERIOD_MS` | `60000` (1 min) | Time given to an owner to rejoin before room destruction. |
| `MAX_MESSAGE_BYTES` | `2048` (2 KB) | Maximum allowed payload size for a single message. |
| `MAX_ROOM_BYTES` | `262144` (256 KB) | Memory pool budget per room before FIFO purging begins. |
| `ROOM_TTL_MS` | `7200000` (2 hrs) | Maximum idle lifespan before the background reaper deletes a room. |
| `WS_MAX_MESSAGES_PER_WINDOW` | `10` | Maximum messages allowed in a 5-second window per IP. |

---

## Local Development Setup

### Prerequisites

* Node.js v18+
* npm v9+

### Installation & Run

1. **Clone the repository:**
```bash
git clone https://github.com/<YOUR_USERNAME>/anonym-chat.git
cd anonym-chat

```


2. **Install root dependencies:**
```bash
npm install

```


3. **Install client dependencies:**
```bash
cd client
npm install
cd ..

```


4. **Start the backend server (Terminal 1):**
```bash
node server/server.js

```


5. **Start the frontend development server (Terminal 2):**
```bash
cd client
npm run dev

```



Open `http://localhost:5173` in your browser.

---

## Production Deployment (Render, Railway, or VPS)

AnonymChat is configured as a unified single-service full-stack application. The root build script automatically builds the React SPA and serves it from Express alongside the WebSocket server.

### Build and Start Commands

* **Build Command:** `npm run build`
* **Start Command:** `npm start`

### Deployment Steps (e.g., Render)

1. Push your repository to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Connect your repository and select the **Node** runtime.
4. Set **Build Command** to `npm run build`.
5. Set **Start Command** to `npm start`.
6. Select the **Free** instance tier and click **Deploy Web Service**.

SSL/TLS is automatically configured on platforms like Render, seamlessly upgrading connections to `https://` and secure WebSockets (`wss://`).

---

## Privacy & Threat Model

* **Application Level:** Chat content, usernames, and cryptographic capability tokens exist only in memory buffers while participants are connected.
* **Hard Deallocation:** Once a room is destroyed (or its timer elapses), all references are deleted from the server `Map`, ensuring node garbage collection releases the data.
* **Network Level Note:** Like all internet communications, connection-level metadata (such as client IP addresses) exists transiently in network sockets at the infrastructure level, but is not written to application databases or persistent log storage.
