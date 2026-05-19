# Structure Guide

FlowCrusade is organized by responsibility. Frontend UI lives in `src/`, local API and persistence code lives in `server/`, and the optional macOS/Windows activity collector lives in `scripts/`.

## Where to edit common changes

| Change needed | Start here |
|---|---|
| App-level state, persistence effects, active view routing, sidebar layout | `src/App.jsx` |
| React entry point | `src/main.jsx` |
| Global Tailwind styles and base CSS | `src/index.css` |
| Runtime-injected animations and scrollbar styles | `src/styles/runtimeAnimations.js` |
| Initial demo tasks, events, stats, and default notes | `src/data/initialData.js` |
| Theme tokens and theme class maps | `src/data/themes.js` |
| Reward levels, milestone math, progress formatting | `src/data/rewards.js` |
| Local Gemma task breakdown client request | `src/services/breakdownApi.js` |
| Focus stats client API calls | `src/services/statsApi.js` |
| Monitor client API calls and SSE helper | `src/services/monitorApi.js` |
| localStorage load/fallback behavior | `src/utils/storage.js` |
| Task tree traversal/update logic | `src/utils/taskTree.js` |
| Browser file upload and base64 conversion | `src/utils/file.js` |
| Home input screen and file/task composer | `src/components/views/ViewA.jsx` |
| Root task overview | `src/components/views/ViewB.jsx` |
| Breakdown tree and drill-down screen | `src/components/views/ViewCE.jsx` |
| Focus subtask detail/timer workflow | `src/components/views/FocusDetailView.jsx` |
| Calendar overlay | `src/components/panels/CalendarPanel.jsx` |
| Stats/rewards overlay | `src/components/panels/StatsPanel.jsx` |
| Monitor overlay and live activity timeline | `src/components/panels/MonitorPanel.jsx` |
| Settings overlay | `src/components/panels/SettingsPanel.jsx` |
| Quick notes sidebar/drawer | `src/components/panels/QuickNotesPanel.jsx` |
| Left overlay panel switcher | `src/components/panels/LeftPanels.jsx` |
| Shared input, nav, progress, text, and modal UI | `src/components/common/` |
| Express server, Gemma breakdown endpoint, stats endpoints, file preprocessing | `server/index.js` |
| Gemma inference provider routing (Ollama → Google API → Transformers) | `server/gemmaProvider.js` |
| Stats persistence and computed daily metrics | `server/statsStore.js` |
| Monitor REST routes | `server/monitor/routes.js` |
| Monitor desktop agent process management | `server/monitor/agent.js` |
| Monitor session/event persistence and crash recovery | `server/monitor/store.js` |
| Monitor SSE broadcasting | `server/monitor/stream.js` |
| Context-sensitive Gemma + rule-based focus/distraction classifier | `server/monitor/classifier.js` |
| Editable classification config defaults/storage | `server/monitor/classificationConfig.js` |
| Monitor privacy filters | `server/monitor/privacy.js` |
| Bridge from monitor events into stats | `server/monitor/statsBridge.js` |
| macOS/Windows active-window polling agent | `scripts/desktop-monitor.js` |
| Public screenshots and logo assets | `public/` |
| Test target notes | `tests/README.md` |
| Runtime local config example | `config.example.json` |
| Environment variable example | `.env.example` |

## Directory map

```txt
.
├── docs/
│   └── STRUCTURE.md             # This guide
├── public/
│   ├── logo.svg                 # Static app logo
│   └── screenshots/             # README/product screenshots
├── scripts/
│   └── desktop-monitor.js       # macOS/Windows active-window monitor agent
├── server/
│   ├── index.js                 # Express app: Gemma breakdown, stats API, file handling
│   ├── gemmaProvider.js         # Gemma inference router: Ollama → Google API → Transformers
│   ├── gemma_runner.py          # Local Transformers runner for Gemma (high-RAM path)
│   ├── statsStore.js            # Stats JSON store and metric calculation
│   ├── data/                    # Runtime JSON stores, auto-created and git-ignored
│   ├── logs/                    # Runtime request/error logs, auto-created and git-ignored
│   └── monitor/
│       ├── routes.js            # /api/monitor endpoints (includes /provider/health)
│       ├── agent.js             # Starts/stops/status-checks desktop-monitor.js
│       ├── store.js             # Monitor sessions/events persistence
│       ├── stream.js            # SSE clients and broadcasts
│       ├── classifier.js        # Gemma + rule-based context-sensitive classifier
│       ├── classificationConfig.js # Editable classifier rule storage
│       ├── privacy.js           # Privacy config and blacklist checks
│       └── statsBridge.js       # Writes monitor increments to stats
├── src/
│   ├── App.jsx                  # App orchestration and top-level state
│   ├── main.jsx                 # React/Vite entry point
│   ├── index.css                # Global CSS and Tailwind layers
│   ├── assets/                  # Bundled frontend assets
│   ├── components/
│   │   ├── common/              # Reusable UI components
│   │   ├── panels/              # Sidebar/overlay panels
│   │   └── views/               # Main task workflow screens
│   ├── data/                    # Static app data and pure config
│   ├── services/                # Browser-side API wrappers
│   ├── styles/                  # Runtime style helpers
│   └── utils/                   # Pure/shared frontend helpers
├── tests/
│   └── README.md                # Suggested first test targets
├── .env.example                 # Local Gemma environment variable template
├── config.example.json          # Local backend config template
├── package.json                 # npm scripts and dependencies
└── vite.config.js               # Vite config
```

## Frontend flow

`App.jsx` decides which major screen is visible:

- No active task: `ViewA`
- Root task selected with no drill-down path: `ViewB`
- Root task selected with a drill-down path: `ViewCE`
- A leaf subtask in active focus mode: `FocusDetailView`

Panel navigation is wired in `App.jsx`, while `LeftPanels.jsx` chooses the currently active overlay panel. Quick notes are handled separately because they can appear as a desktop sidebar or mobile/tablet drawer.

## Backend flow

The local server starts from `server/index.js`.

- Gemma breakdown requests are handled by `POST /api/breakdown`. The server tries inference in order: Ollama → Google AI Studio API → local Transformers subprocess → deterministic rules fallback.
- `server/gemmaProvider.js` owns this routing for both breakdown (`inferText`) and Focus Sentinel classification (`classifyActivityWithGemma`). It tracks `cloudCallCount` for the PrivacySurface audit.
- Provider health is exposed at `GET /api/provider/health` and `GET /api/monitor/provider/health`.
- Focus and completion stats use `/api/stats` endpoints and `server/statsStore.js`.
- Monitor endpoints are mounted from `server/monitor/routes.js`.
- Monitor agent lifecycle is managed by `server/monitor/agent.js`.
- Server-sent events are published through `server/monitor/stream.js`.
- Monitor events are classified by `server/monitor/classifier.js` using a privacy filter → fast rule path → Gemma semantic classification (FN-4) for ambiguous cases → keyword fallback. Results are persisted, broadcast to the UI, and bridged into stats.

Runtime data is stored under `server/data/`; runtime logs are stored under `server/logs/`. Both directories are generated locally and should not be treated as source files.

## Monitor flow

The Monitor MVP has two separate runtime concepts:

- Session: backend state that says tracking is active.
- Agent: the local macOS/Windows process that reads active-window data.

The UI starts both through the Monitor panel. The backend starts `scripts/desktop-monitor.js`, receives events at `POST /api/monitor/event`, classifies them with `server/monitor/classifier.js` (Gemma FN-4 for ambiguous cases), stores them in `server/data/monitor.json`, writes focus/distraction increments to stats, and broadcasts updates over SSE.

Classification is context-sensitive: the session's `linkedTaskTitle` is passed to Gemma so the same window title can be classified differently depending on what the user is working on. Sessions can be started in `standalone` or `task-linked` mode; the "Start Focus Session" button in the task overview view starts a task-linked session automatically.

The Settings panel edits focus/distraction app and domain rules through `src/services/monitorApi.js`; the server stores those rules in `server/data/classification.json`.

Known Monitor follow-ups:

- split test and production reporting thresholds
- improve browser domain detection precision on Windows and Firefox
- improve macOS Accessibility and Windows PowerShell troubleshooting guidance
- aggregate by app/domain when window titles change frequently
- add agent crash restart/degraded-session handling
- support multi-user or multi-device sessions if the app moves beyond local MVP use

## Design rule

`App.jsx` should stay focused on app orchestration:

- global state
- persistence effects
- Local Gemma/task handlers
- stats and monitor event wiring
- deciding which major view is visible
- wiring layout components together

Reusable UI should live under `src/components/common/`.
Feature-level screens should live under `src/components/views/` or `src/components/panels/`.
Browser API wrappers should live under `src/services/`.
Pure frontend logic should live under `src/utils/` or `src/data/`.
Backend route, persistence, and monitor logic should stay under `server/`.

## Run entry points

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend |
| `npm run server` | Start the local Express backend on port `8787` by default |
| `npm run monitor-agent` | Start the macOS/Windows desktop monitor agent |
| `npm run lint` | Run ESLint |
| `npm run build` | Build the frontend |

The frontend can still load without the backend, but local Gemma breakdown, persisted stats, and monitor features depend on `npm run server`. In normal MVP usage, the Monitor panel starts the desktop agent automatically; `npm run monitor-agent` is mainly useful for debugging.
