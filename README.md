<div align="center">

# FocusTrail

**AI-powered focus companion for deep work.**

Break any task into steps → monitor your real-time activity → see exactly where your time goes.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white&style=flat-square)
![macOS](https://img.shields.io/badge/Monitor-macOS-000000?logo=apple&logoColor=white&style=flat-square)
![Gemini](https://img.shields.io/badge/AI-Gemini-4285F4?logo=google&logoColor=white&style=flat-square)

</div>

---

## What it does

| Feature | Description |
|---|---|
| **AI Task Breakdown** | Type a goal or upload a file — Gemini breaks it into 3 subtasks, each drill-downable into 3 more |
| **Real-time Activity Monitor** | macOS agent reads the active window every 15s and classifies it as focus or distraction |
| **Live Stats** | Focus minutes, distraction time, streaks, and peak hours — updated instantly via SSE |
| **Classification Rules** | Edit which apps and domains count as focus or distraction from the Settings panel |
| **Privacy Filter** | Sensitive apps (Messages, 1Password, etc.) are never reported to the backend |
| **Quick Notes** | Persistent scratchpad beside the task canvas |
| **Calendar View** | Schedule tasks and browse history by date |

---

## Getting started

### Prerequisites

- Node.js 18+
- macOS (for the activity monitor agent; the rest works on any OS)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### Install

```bash
git clone https://github.com/PST-Protocol/Flow-Crusade.git
cd FocusTrail
npm install
```

### Configure

```bash
cp .env.example .env
# Add your Gemini API key to .env:
# GEMINI_API_KEY=your_key_here
```

### Run

Open two terminals:

```bash
# Terminal 1 — backend (port 8787)
npm run server

# Terminal 2 — frontend (port 5173)
npm run dev
```

Then open `http://localhost:5173`.

---

## Activity monitor (macOS)

The Monitor panel in the sidebar controls everything. Toggle **Active Monitor** on to:

1. Start a backend session
2. Automatically launch the desktop agent (`scripts/desktop-monitor.js`)
3. Stream classified events to the timeline in real time

The agent uses native `osascript` — no extra npm packages. It detects the active app, window title, and browser domain (Chrome and Safari supported). A window is only reported after the user has stayed for at least 10 seconds; idle time is capped at 5 minutes so stepping away doesn't inflate focus scores.

**Status indicators in the Monitor panel:**

| Status | Meaning |
|---|---|
| `Tracking` | Session active, desktop agent running |
| `Session active · agent offline` | Session exists, agent not detected |
| `Needs permission` | macOS blocked Accessibility access |
| `Off` | No active session |

> If macOS asks for Accessibility permission, grant it to the terminal or IDE that started the backend (Terminal, VS Code, Cursor, etc.).

The standalone agent is also available for debugging without the UI:

```bash
npm run monitor-agent
```

> Do not run both the UI-managed and standalone agents simultaneously — events will be duplicated.

---

## Classification rules

Activity is matched by app name and domain:

- **Focus** — VS Code, Cursor, Xcode, Terminal, Word, Excel, Notion, Figma, GitHub, StackOverflow, …
- **Distraction** — Reddit, Instagram, TikTok, Twitter/X, Netflix, Twitch, YouTube (unless task context matches), …

Rules are editable in **Settings → Monitor Classification** and persisted in `server/data/classification.json`.

---

## API reference

The backend runs on `http://localhost:8787`.

<details>
<summary>Expand full API list</summary>

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/breakdown` | AI task breakdown (Gemini) |
| `GET` | `/api/stats` | Daily focus stats |
| `POST` | `/api/stats/focus-session` | Record a focus session |
| `POST` | `/api/stats/completed-task` | Record a completed task |
| `POST` | `/api/stats/distraction` | Record a distraction event |
| `GET` | `/api/monitor/stream` | SSE stream for real-time events |
| `POST` | `/api/monitor/session/start` | Start a monitor session |
| `POST` | `/api/monitor/session/end` | End a monitor session |
| `GET` | `/api/monitor/session/active` | Get the active session |
| `POST` | `/api/monitor/event` | Receive a classified activity event |
| `GET` | `/api/monitor/events/:sessionId` | List events for a session |
| `GET` | `/api/monitor/agent/status` | Desktop agent status |
| `POST` | `/api/monitor/agent/start` | Start the desktop agent |
| `POST` | `/api/monitor/agent/stop` | Stop the desktop agent |
| `GET` | `/api/monitor/privacy/config` | Get privacy filter config |
| `POST` | `/api/monitor/privacy/config` | Update privacy filter config |
| `GET` | `/api/monitor/classification/config` | Get focus/distraction rules |
| `POST` | `/api/monitor/classification/config` | Update focus/distraction rules |
| `POST` | `/api/monitor/classification/config/reset` | Reset rules to defaults |

</details>

---

## Project structure

```
Flow-Crusade/
├── scripts/
│   └── desktop-monitor.js          # macOS window monitor agent
├── server/
│   ├── index.js                    # Express entry point
│   ├── statsStore.js               # Stats helpers and computeStats()
│   └── monitor/
│       ├── routes.js               # /api/monitor endpoints
│       ├── agent.js                # Agent process lifecycle
│       ├── store.js                # Session/event persistence + crash recovery
│       ├── stream.js               # SSE broadcast
│       ├── classifier.js           # Rule-based focus/distraction classifier
│       ├── classificationConfig.js # Editable classification rules
│       ├── privacy.js              # Privacy filter
│       └── statsBridge.js          # Writes events to stats, broadcasts stats.updated
└── src/
    ├── App.jsx                     # Global state, layout, SSE stats listener
    ├── services/
    │   ├── statsApi.js             # /api/stats fetch wrappers
    │   └── monitorApi.js           # /api/monitor fetch wrappers + SSE
    ├── components/
    │   ├── panels/                 # Monitor, Stats, Calendar, Settings, Notes
    │   ├── views/                  # ViewA (home), ViewB (task), ViewCE (tree), FocusDetail
    │   └── common/                 # Shared UI primitives
    └── utils/
        ├── taskTree.js             # Tree traversal helpers
        └── storage.js              # localStorage loaders
```

---

## Known limits

- Firefox browser domain detection is not supported (no AppleScript access).
- Classification is rule-based, not semantic — unusual app names may not be recognized.
- Designed for single-user, single-machine, local use only.
- The 10-second reporting threshold is intentionally low for testing; consider 60s+ for production use.

---

## Tech stack

- **Frontend** — React 19, Vite 7, Tailwind CSS, Lucide icons
- **Backend** — Node.js, Express, Server-Sent Events
- **AI** — Google Gemini (task breakdown)
- **Monitor** — macOS `osascript` / `ioreg` (no native addons)
- **Storage** — localStorage (tasks/notes), JSON files (stats/sessions)
