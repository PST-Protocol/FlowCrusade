<div align="center">

# FlowCrusade

**Local-first Gemma learning coach for deep work.**

Break any task into steps → monitor your real-time activity → see exactly where your time goes.

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white&style=flat-square)
![macOS](https://img.shields.io/badge/Monitor-macOS-000000?logo=apple&logoColor=white&style=flat-square)
![Gemma](https://img.shields.io/badge/AI-Gemma_4_E2B-4285F4?logo=google&logoColor=white&style=flat-square)
![Local](https://img.shields.io/badge/Inference-Local_First-16A34A?style=flat-square)

</div>

---

## What it does

| Feature | Description |
|---|---|
| **Local Gemma Task Breakdown** | Type a goal or upload a file; local Gemma 4 E2B breaks it into 3 subtasks, each drill-downable into 3 more |
| **Real-time Activity Monitor** | macOS agent reads the active window every 15s and classifies it as focus or distraction |
| **Live Stats** | Focus minutes, distraction time, streaks, and peak hours — updated instantly via SSE |
| **Classification Rules** | Edit which apps and domains count as focus or distraction from the Settings panel |
| **Privacy Filter** | Sensitive apps (Messages, 1Password, etc.) are never reported to the backend |
| **Quick Notes** | Persistent scratchpad beside the task canvas |
| **Calendar View** | Schedule tasks and browse history by date |

### Screenshots

**Home**
<p align="center">
  <img src="public/screenshots/home.png" width="760" alt="Home — enter a task or upload a file"/>
  <br/><sub>Enter a task or upload a file to get started</sub>
</p>

**Local Gemma Task Breakdown**
<p align="center">
  <img src="public/screenshots/breakdown.png" width="760" alt="Local Gemma task breakdown tree"/>
  <br/><sub>Local Gemma breaks any goal into 3 subtasks, each drill-downable into 3 more</sub>
</p>

**Focus Mode**
<p align="center">
  <img src="public/screenshots/focus.png" width="760" alt="Focus mode for a single subtask"/>
  <br/><sub>Isolated single-task execution view with timer and progress</sub>
</p>

**Activity Monitor & Stats**
<p align="center">
  <img src="public/screenshots/monitor.png" width="374" alt="Real-time activity monitor panel"/>
  <img src="public/screenshots/stats.png" width="374" alt="Focus stats and rewards"/>
  <br/><sub>Real-time window classification (left) · Daily focus score, streak, and peak hours (right)</sub>
</p>

**Rewards**
<p align="center">
  <img src="public/screenshots/rewards.png" width="760" alt="Reward milestones"/>
  <br/><sub>Game-style level progression tied to cumulative focus minutes</sub>
</p>

---

## Quick start

### Prerequisites

- Node.js 18+
- macOS (for the activity monitor; the rest works on any OS)
- Python 3.10+ for local Gemma inference
- Python packages: `pip install -U torch torchvision accelerate pillow mistral-common` plus source Transformers for Gemma 4 support
- A local `google/gemma-4-E2B-it` model checkout in `models/gemma-4-E2B-it`
- Optional: a Hugging Face token with access to the Gemma weights, used only for `npm run download:gemma`

### 1. Clone and install

```bash
git clone https://github.com/PST-Protocol/FlowCrusade.git
cd FlowCrusade
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and point it at the local model:

```env
PORT=8787
GEMMA_MODEL_ID=google/gemma-4-E2B-it
GEMMA_MODEL_DIR=./models/gemma-4-E2B-it
GEMMA_DEVICE_MAP=auto
GEMMA_GPU_MEMORY_FRACTION=0.58
GEMMA_PERSISTENT_WORKER=true
```

The server never calls Gemini or any cloud fallback. If the local model is not present, task breakdown falls back to deterministic local rules. The default local runner keeps one Gemma worker warm, caps GPU placement so 12GB cards have room for generation, and offloads the rest to CPU for lower-end machines.

To download the model into the repo-local directory after setting `HF_TOKEN`:

```bash
npm run download:gemma
```

### 3. Start the backend

```bash
npm run server
```

### 4. Start the frontend

In a second terminal:

```bash
npm run dev
```

### 5. Open the app

Go to `http://localhost:5173`, open the **Monitor** panel, and toggle **Active Monitor** on. The desktop agent starts automatically.

---

## Activity monitor (macOS)

Toggling **Active Monitor** on in the sidebar:

1. Creates a backend session
2. Automatically launches `scripts/desktop-monitor.js`
3. Streams classified events to the timeline in real time

The agent uses native `osascript` — no extra npm packages. It detects the active app, window title, and browser domain (Chrome and Safari). A window is only reported after 10 seconds of continuous stay; idle time is capped at 5 minutes so stepping away doesn't inflate focus scores.

**Status indicators:**

| Status | Meaning |
|---|---|
| `Tracking` | Session active, desktop agent running |
| `Session active · agent offline` | Session exists, agent not detected |
| `Needs permission` | macOS blocked Accessibility access |
| `Off` | No active session |

> If macOS asks for Accessibility permission, grant it to the app that launched the backend — Terminal, VS Code, Cursor, etc.

**Known monitor limits:**
- Firefox domain detection is not supported (no AppleScript access)
- Classification is rule-based — unusual app names may not be recognized
- Single-user, single-machine, local use only
- The 10-second reporting threshold is low by design for testing; consider 60s+ for production

The standalone agent is also available for debugging:

```bash
npm run monitor-agent
```

> Do not run both the UI-managed and standalone agents at the same time — events will be duplicated.

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
| `POST` | `/api/breakdown` | Local Gemma task breakdown with deterministic fallback |
| `GET` | `/api/provider/health` | Local Gemma provider status and cloud-call counter |
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
FlowCrusade/
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

## Tech stack

- **Frontend** — React 19, Vite 7, Tailwind CSS, Lucide icons
- **Backend** — Node.js, Express, Server-Sent Events
- **AI** - Local Gemma 4 E2B via Transformers, with deterministic local fallback
- **Monitor** — macOS `osascript` / `ioreg` (no native addons)
- **Storage** — localStorage (tasks/notes), JSON files (stats/sessions)

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a PR against `main`

---

## License

MIT © PST Protocol
