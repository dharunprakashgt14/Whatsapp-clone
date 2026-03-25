LOGIN/SIGN UP
<img width="1920" height="1080" alt="Screenshot 2026-03-25 174358" src="https://github.com/user-attachments/assets/59506dc2-e564-4ed6-b155-0ea3e6f26322" />

USER CREATION AND LIVE UPDATE OF USER
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172242" src="https://github.com/user-attachments/assets/35de495a-9b6c-407c-9488-97683ead690e" />
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172409" src="https://github.com/user-attachments/assets/29f217b6-b3c6-4cec-b025-06204929f824" />

Sending message from USER 2 ➡️ USER 1
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172718" src="https://github.com/user-attachments/assets/b89990d1-8569-4c34-9665-378f907c291a" />

PROFILE IMAGE ADDING
<img width="555" height="441" alt="Screenshot 2026-03-25 172803" src="https://github.com/user-attachments/assets/0ff468ba-2900-4e36-9d49-3ee33f0e15b9" />

USER PROFILE UPDATE AND EDIT
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172827" src="https://github.com/user-attachments/assets/bae1aa67-d119-4709-bcb1-92916d5f9220" />

UPDATED PROFILE REFLECTED IN USER 2
<img width="551" height="372" alt="Screenshot 2026-03-25 172858" src="https://github.com/user-attachments/assets/9bcd8fc2-ad8f-44cb-866b-cea2a5a7672c" />

VOICE MESSAGE TO USER 1
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172931" src="https://github.com/user-attachments/assets/089e9cb2-2d24-450e-9a0e-aea0f8f831ed" />

IMAGE TO USER 1(Document option)
<img width="1920" height="1080" alt="Screenshot 2026-03-25 172957" src="https://github.com/user-attachments/assets/84773338-715a-4cee-8f26-62f5cdb4f2a2" />

VOICE CALLING
<img width="1920" height="1080" alt="Screenshot 2026-03-25 173015" src="https://github.com/user-attachments/assets/c116c508-55fa-4bf1-bf86-8f04cb21a28d" />
<img width="1920" height="1080" alt="Screenshot 2026-03-25 173023" src="https://github.com/user-attachments/assets/6a3f16e3-c18b-49b8-b1b3-c47f00512591" />

VIDEO CALLING
<img width="1920" height="1080" alt="Screenshot 2026-03-25 173135" src="https://github.com/user-attachments/assets/25935317-3b65-46f6-acf1-3cfdb3fd12fc" />

3 dots
<img width="1364" height="521" alt="Screenshot 2026-03-25 173213" src="https://github.com/user-attachments/assets/50e44c25-f561-4842-b0fc-84e26c29e566" />

UPDATED CONTACT INFO
<img width="1920" height="1080" alt="Screenshot 2026-03-25 173232" src="https://github.com/user-attachments/assets/195a505c-f7b6-42b4-b21f-d0988a6d5fb9" />

GROUP CREATION
<img width="553" height="315" alt="Screenshot 2026-03-25 173418" src="https://github.com/user-attachments/assets/cc316d8a-0df3-4f13-8d8e-6f04da35ad69" />
<img width="535" height="297" alt="Screenshot 2026-03-25 173428" src="https://github.com/user-attachments/assets/725a740d-0936-40ec-81d8-99a8b3fe0c29" />
<img width="558" height="385" alt="Screenshot 2026-03-25 173524" src="https://github.com/user-attachments/assets/1d06abc8-5bdf-4f34-b3f3-82d6a44c63dc" />
<img width="1377" height="444" alt="Screenshot 2026-03-25 173556" src="https://github.com/user-attachments/assets/1449034f-300b-4d73-a60e-69bf23ba2759" />

TYPING /ONLINE/LAST SEEN
<img width="1910" height="1079" alt="Screenshot 2026-03-25 173627" src="https://github.com/user-attachments/assets/f7b9e844-6acc-49f5-acfc-0935697d1838" />
<img width="1919" height="72" alt="Screenshot 2026-03-25 173708" src="https://github.com/user-attachments/assets/c5c57d65-6107-4ac3-88b7-9f45f3012e9e" />







# WhatsApp Web Clone (Full Stack)

A **WhatsApp-inspired** real-time chat application: **React (Vite)** frontend, **Node.js + Express** backend, **MongoDB** for data, and **Socket.IO** for live updates. Built as a full-stack demonstration project (e.g. CartRabbit take-home / portfolio).

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Repository structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Install MongoDB](#install-mongodb)
6. [Backend setup (step by step)](#backend-setup-step-by-step)
7. [Frontend setup (step by step)](#frontend-setup-step-by-step)
8. [Run the full app locally](#run-the-full-app-locally)
9. [Environment variables](#environment-variables)
10. [REST API overview](#rest-api-overview)
11. [Real-time (Socket.IO)](#real-time-socketio)
12. [Default ports](#default-ports)
13. [Production build (optional)](#production-build-optional)
14. [Deploy: Render (backend) + Vercel (frontend)](#deploy-render-backend--vercel-frontend)
15. [Troubleshooting](#troubleshooting)

---

## Features

### Core (assignment-aligned)

- **Users** — Registration / login with **email or phone OTP**, JWT sessions, profile (name, about, phone, avatar).
- **Chat UI** — Sidebar (conversations + search) + main **chat window**; **active chat** highlighted; **sent vs received** bubbles; **auto-scroll** to latest messages.
- **Messaging** — Text messages stored in **MongoDB**, loaded per conversation, **chronological** order, **persist** after refresh; metadata: **sender**, **timestamp**, conversation context.
- **REST APIs** — Users, conversations, messages, uploads; validation and HTTP status codes on routes.
- **Real-time** — **Socket.IO**: new messages, typing, online status, read receipts, conversation updates, **WebRTC signaling** for voice/video calls.

### Additional (beyond minimal clone)

- **Groups** — Create groups, group chats, participant lists.
- **Media** — Images (incl. multi-image grid), documents, voice notes; file uploads via Multer under `/uploads`.
- **Messaging extras** — Reply, edit, delete (for me / everyone), reactions, forward, search in chat.
- **Calls** — 1:1 **voice & video** (WebRTC + Socket.IO); incoming call UI when user is in another chat.
- **UX** — WhatsApp-style dark theme, mobile-friendly layout, contact info, profile editing.

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| **Frontend** | React 19, Vite, React Router, Axios, Socket.IO client, CSS |
| **Backend** | Node.js, Express, Socket.IO, Mongoose, Multer, JWT, bcrypt |
| **Database** | MongoDB |
| **Auth** | JWT (Bearer token); OTP via **Brevo** (email) / **Fast2SMS** (SMS) when configured |

---

## Repository structure

```
cartrabbit-2/                    # project root (rename as you like)
├── README.md                    # this file
├── client/                      # React (Vite) SPA
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx              # routes: /login, /register, /
│       ├── main.jsx
│       ├── index.css
│       ├── context/             # AuthContext
│       ├── pages/               # Login, Register, Chat
│       ├── components/          # Sidebar, ChatWindow, MessageBubble, etc.
│       └── services/            # api.js (Axios), socket.js
│
└── server/                      # Express API + Socket.IO
    ├── package.json
    ├── index.js                 # HTTP server, MongoDB, CORS, routes, Socket.IO
    ├── .env                     # local secrets (create from .env.example — do not commit real secrets)
    ├── middleware/
    ├── models/                  # User, Conversation, Message
    ├── routes/                  # auth, users, conversations, messages, uploads
    ├── socket/                  # socketHandler.js
    └── uploads/                 # created at runtime for uploaded files
```

---

## Prerequisites

Install **before** running the app:

| Tool | Version (typical) | Purpose |
|------|-------------------|---------|
| **Node.js** | 18+ or 20 LTS | Run client & server |
| **npm** | Comes with Node | Install dependencies |
| **MongoDB** | 6+ / 7+ | Database (local install **or** MongoDB Atlas) |
| **Git** | Any | Clone / push repository |

---

## Install MongoDB

### Option A — Local MongoDB (development)

1. Install MongoDB Community Server for your OS:  
   [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Start the MongoDB service:
   - **Windows:** Service “MongoDB” or `net start MongoDB` (if installed as service).
   - **macOS (Homebrew):** `brew services start mongodb-community`
   - **Linux:** `sudo systemctl start mongod`
3. Default connection string (no auth):  
   `mongodb://localhost:27017/whatsapp-clone`  
   (The server uses this by default if `MONGODB_URI` is unset.)

### Option B — MongoDB Atlas (cloud)

1. Create a free cluster at [https://www.mongodb.com/Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and allow your IP (or `0.0.0.0/0` for dev only).
3. Get the **connection string** (SRV URI) and set it as `MONGODB_URI` in `server/.env` (see [Environment variables](#environment-variables)).

---

## Backend setup (step by step)

1. **Open a terminal** and go to the server folder:

   ```bash
   cd server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create environment file:**

   - Copy the example file:

     ```bash
     # Windows (PowerShell)
     copy .env.example .env

     # macOS / Linux
     cp .env.example .env
     ```

   - Edit **`server/.env`** with your values (see [Environment variables](#environment-variables)).

4. **Ensure MongoDB is running** (local or Atlas).

5. **Start the API** (development with auto-restart):

   ```bash
   npm run dev
   ```

   Or production-style (no file watcher):

   ```bash
   npm start
   ```

6. **Verify** — Open in browser or use curl:

   ```text
   http://localhost:5000/api/health
   ```

   You should see JSON like `{"status":"ok","timestamp":"..."}`.

7. **Uploads folder** — On first run, ensure the app can create/write under `server/uploads` (default).

---

## Frontend setup (step by step)

1. **Open a second terminal** and go to the client folder:

   ```bash
   cd client
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **API URL (optional)** — Default backend is `http://localhost:5000`. To override locally, add **`client/.env`** (see `client/.env.example`):

   ```env
   VITE_SERVER_URL=http://localhost:5000
   ```

   One variable drives **REST**, **Socket.IO**, and **media URLs** in `client/src/services/api.js`. For production, set **`VITE_SERVER_URL`** on Vercel (see [Deploy](#deploy-render-backend--vercel-frontend)).

4. **Start the dev server:**

   ```bash
   npm run dev
   ```

5. **Open the app** — Vite prints a URL (default):

   ```text
   http://localhost:5173
   ```

6. **Register** two users (two browsers or incognito) to test chat.

---

## Run the full app locally

1. Start **MongoDB** (if local).
2. Terminal 1 — **server:**

   ```bash
   cd server
   npm run dev
   ```

3. Terminal 2 — **client:**

   ```bash
   cd client
   npm run dev
   ```

4. Visit **`http://localhost:5173`**, register/login, then start a chat.

---

## Environment variables

All backend variables are read from **`server/.env`** (via `dotenv`).

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Recommended | MongoDB connection string. Default: `mongodb://localhost:27017/whatsapp-clone` |
| `PORT` | No | HTTP server port. Default: `5000` |
| `CLIENT_URL` | No | Allowed origin for CORS + Socket.IO. Default: `http://localhost:5173` |
| `JWT_SECRET` | Recommended | Secret for signing JWTs. Default in code is a dev fallback — **change in production** |
| `OTP_DEMO_MODE` | No | Set to `true` to return OTP in API responses for **local testing without SMS/email** |
| `FAST2SMS_API_KEY` | For SMS OTP | Fast2SMS API key (India SMS) |
| `BREVO_API_KEY` | For email OTP | Brevo (Sendinblue) API key |
| `BREVO_SENDER_EMAIL` | For email OTP | Verified sender email in Brevo |
| `BREVO_SENDER_NAME` | No | Display name for emails. Default: `WhatsApp Clone` |

**Minimum local run without OTP providers:**

- Set `MONGODB_URI` if not using default.
- Set `OTP_DEMO_MODE=true` so OTP flows still work for testing (OTP may appear in API response — **disable in production**).

---

## REST API overview

Base URL: **`http://localhost:5000/api`** (adjust host/port if needed).

### Auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/send-otp` | Send OTP (email/phone) |
| POST | `/verify-otp` | Verify OTP / login |
| POST | `/register` | Register user |
| POST | `/login` | Login (legacy / password if used) |
| POST | `/logout/:userId` | Logout |

### Users (`/api/users`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/?exclude=<userId>` | List users (exclude self) |
| GET | `/:id` | Get user by ID |
| PUT | `/:id` | Update profile |

### Conversations (`/api/conversations`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create 1:1 conversation |
| GET | `/:userId` | List conversations for user |
| PUT | `/:conversationId/read` | Mark read |
| POST | `/group` | Create group |
| PUT | `/:conversationId/group` | Update group |

### Messages (`/api/messages`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Send message |
| GET | `/:conversationId` | Paginated messages |
| PUT | `/:messageId` | Edit message |
| POST | `/:messageId/delete` | Delete |
| POST | `/:messageId/react` | Reaction |
| POST | `/forward` | Forward message |
| GET | `/search/:conversationId?q=` | Search |

### Uploads (`/api/uploads`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Multipart file upload (`file` field) |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |

Protected routes expect header: **`Authorization: Bearer <token>`** (stored client-side after login).

---

## Real-time (Socket.IO)

After the client connects, it emits **`userOnline`** with `userId`. The server joins a per-user room for notifications.

Typical events include (non-exhaustive):

- **Messages:** `chat message` / new message handling, delivery updates, **conversationUpdated**
- **Presence:** `onlineUsers`, `userStatusChanged`
- **Typing:** `typing`, `stopTyping` → `userTyping`, `userStoppedTyping`
- **Calls:** `call:offer`, `call:answer`, `call:ice-candidate`, `call:reject`, `call:end`

See `server/socket/socketHandler.js` and `client/src/services/socket.js` for details.

---

## Default ports

| Service | Port |
|---------|------|
| **Vite dev** (React) | `5173` |
| **Express + Socket.IO** | `5000` |

If you change the public API **host** (not only `PORT` on Render), update **`VITE_SERVER_URL`** for the client rebuild (Vercel env or `client/.env`).

---

## Production build (optional)

### Frontend

```bash
cd client
npm run build
```

Output: `client/dist/`. Serve with any static host or `npm run preview` (Vite preview).

### Backend

```bash
cd server
npm start
```

Set `NODE_ENV=production`, secure `JWT_SECRET`, real `MONGODB_URI`, and **CORS** `CLIENT_URL` to your deployed frontend URL.

---

## Deploy: Render (backend) + Vercel (frontend)

Typical setup: **API + Socket.IO on [Render](https://render.com)** (Node Web Service), **React static app on [Vercel](https://vercel.com)**. Use **MongoDB Atlas** in the cloud (Render does not host MongoDB for you).

### Order of operations

1. Create a **MongoDB Atlas** cluster and get your `MONGODB_URI` (see [Install MongoDB](#install-mongodb) — Option B).
2. Deploy the **backend on Render** and copy the public URL (e.g. `https://your-api.onrender.com`).
3. Deploy the **frontend on Vercel** with `VITE_SERVER_URL` set to that Render URL.
4. Go back to Render and set **`CLIENT_URL`** to your **Vercel** URL (exact `https://…vercel.app`), then **restart** the Render service so CORS and Socket.IO accept the browser origin.

---

### A. Backend on Render

1. Push your code to **GitHub** (if not already).
2. In Render: **New +** → **Web Service** → connect the repository.
3. Configure:

   | Field | Value |
   |--------|--------|
   | **Root Directory** | `server` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance type** | Free (cold starts possible; first request may be slow) |

4. **Environment** (Render → Environment):

   | Key | Example / notes |
   |-----|-----------------|
   | `MONGODB_URI` | Your Atlas connection string |
   | `JWT_SECRET` | Long random string |
   | `CLIENT_URL` | `https://your-app.vercel.app` (set **after** Vercel gives you a URL) |
   | `PORT` | **Leave unset** — Render sets `PORT` automatically |
   | `OTP_DEMO_MODE` | `true` only for demos without Brevo/Fast2SMS |
   | `BREVO_*` / `FAST2SMS_*` | If you use real OTP in production |

5. **Deploy** and wait until the service is **Live**.
6. Open `https://<your-service>.onrender.com/api/health` — you should see `{"status":"ok",...}`.

**Notes**

- Render’s free tier **spins down** after idle; the first request may take ~30–60s.
- **Uploads:** Files saved under `server/uploads` on Render’s **ephemeral** disk can be **lost on redeploy**. For production media, use **S3**, **Cloudinary**, or similar later.
- **WebSockets:** Socket.IO works on Render Web Services; ensure the client uses **`https://`** for `VITE_SERVER_URL` in production.

---

### B. Frontend on Vercel

1. In Vercel: **Add New** → **Project** → import the same GitHub repo.
2. Configure:

   | Field | Value |
   |--------|--------|
   | **Framework Preset** | Vite |
   | **Root Directory** | `client` |
   | **Build Command** | `npm run build` (default) |
   | **Output Directory** | `dist` (default for Vite) |

3. **Environment Variables** (Vercel → Settings → Environment Variables):

   | Name | Value | Environments |
   |------|--------|----------------|
   | `VITE_SERVER_URL` | `https://your-api.onrender.com` | Production (and Preview if you use a preview API URL) |

   **No trailing slash.** Must match your Render HTTPS URL exactly.

4. **Deploy**. Copy the production URL (e.g. `https://your-app.vercel.app`).
5. Update **Render** `CLIENT_URL` to that Vercel URL and **restart** the Render service.

---

### C. Checklist after deploy

- [ ] `https://<render>/api/health` returns OK.
- [ ] Vercel site loads login/register.
- [ ] Browser **Network** tab: API calls go to Render, not `localhost`.
- [ ] If chat or live updates fail: confirm `CLIENT_URL` on Render matches Vercel **exactly** (scheme + host, no wrong slash).

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| **MongoDB connection error** | Check MongoDB is running; verify `MONGODB_URI`; Atlas: IP allowlist + user/password. |
| **CORS / Socket.IO blocked** | Set `CLIENT_URL` to exact frontend origin (e.g. `http://localhost:5173`). |
| **401 on API** | Log in again; token may be expired; check `Authorization` header. |
| **OTP not received** | Use `OTP_DEMO_MODE=true` for dev; configure Brevo/Fast2SMS for real delivery. |
| **Chat shows empty / wrong data** | Confirm both terminals running; same API URL (`localhost:5000`). |
| **Uploads 404** | Ensure `server/uploads` exists and server serves `/uploads` static. |

---

## Submission checklist (e.g. CartRabbit)

- [ ] **Public GitHub repository** created and code pushed.
- [ ] This **README** is in the **root** of the repo.
- [ ] **`server/.env` is not committed** — copy from `server/.env.example` locally; the root **`.gitignore`** ignores `server/.env` and `node_modules`.
- [ ] Reviewers can run **MongoDB + `npm install` + `npm run dev`** in `server` and `client` with steps above.

---

## License

This project is provided for **educational / assessment** purposes. Adjust the license as needed for your submission.

---

## Author

Submitted as part of **CartRabbit** (or your institution) full-stack assessment — **deadline March 25, 2026** (per original brief).  

Contact (per brief): `angel@cartrabbit.in`, `shreedharshini@cartrabbit.in`.
