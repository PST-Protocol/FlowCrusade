# FlowCrusade

FlowCrusade is a React/Vite productivity app that turns a high-level task into smaller focus steps, tracks real-time focus and distraction activity via a macOS desktop monitor agent, and keeps quick notes beside the working canvas.

## What this app does

- Creates tasks manually or from an AI breakdown request (powered by Gemini).
- Displays task trees with root tasks, subtasks, and deeper child steps.
- Supports task drill-down and focused subtask views.
- Monitors the active macOS window in real time and classifies activity as focus or distraction.
- Tracks focus minutes, distraction events, streaks, and peak focus hours — updated live via SSE.
- Stores tasks and notes in `localStorage`; stats and monitor sessions are persisted server-side.
- Uses a local Express server for AI task breakdowns and the activity monitor API.

## Project structure

```txt
.
├── scripts/
│   └── desktop-monitor.js        # macOS desktop activity monitor agent (osascript-based)
├── server/
│   ├── index.js                  # Express server: AI breakdown + stats APIs
│   ├── statsStore.js             # Stats storage helpers and computeStats()
│   ├── data/                     # Runtime JSON stores (git-ignored, auto-created)
│   │   ├── stats.json
│   │   ├── monitor.json
│   │   └── privacy.json
│   └── monitor/
│       ├── routes.js             # /api/monitor REST endpoints
│       ├── store.js              # Session + event persistence, crash recovery
│       ├── stream.js             # SSE broadcast to frontend
│       ├── classifier.js         # Rule-based focus/distraction classifier
│       ├── privacy.js            # Privacy filter (blockedApps / domains / keywords)
│       └── statsBridge.js        # Writes classified events to stats, broadcasts stats.updated
├── src/
│   ├── App.jsx                   # App-level orchestration, state, and layout wiring
│   ├── main.jsx                  # React entry point
│   ├── index.css                 # Tailwind/global CSS
│   ├── data/
│   │   ├── initialData.js        # Demo tasks and initial state
│   │   ├── rewards.js            # Reward/level math helpers and milestone config
│   │   └── themes.js             # Light/dark theme token map
│   ├── services/
│   │   ├── statsApi.js           # Fetch wrappers for /api/stats endpoints
│   │   └── monitorApi.js         # Fetch wrappers + SSE for /api/monitor endpoints
│   ├── utils/
│   │   ├── file.js               # File/base64 helpers
│   │   ├── storage.js            # localStorage loaders
│   │   └── taskTree.js           # Tree search/update helpers
│   ├── components/
│   │   ├── common/               # Small reusable UI pieces
│   │   ├── views/                # Main task workflow screens
│   │   └── panels/               # Calendar/stats/monitor/settings/notes panels
│   └── styles/
│       └── runtimeAnimations.js  # Runtime animation and scrollbar style injection
└── package.json
```

## Component map

### Main views

- `ViewA.jsx` — empty/home state where the user enters a task or uploads a file.
- `ViewB.jsx` — active root task overview before drilling into subtasks.
- `ViewCE.jsx` — task breakdown tree and subtask drill-down experience.
- `FocusDetailView.jsx` — focused view for a selected leaf-level subtask.

### Panels

- `LeftPanels.jsx` — chooses which left overlay panel is visible.
- `CalendarPanel.jsx` — task calendar and manual task creation.
- `StatsPanel.jsx` — focus score, rewards, leaderboard, and analytics.
- `MonitorPanel.jsx` — real-time activity timeline connected to backend via SSE.
- `SettingsPanel.jsx` — theme and monitor settings.
- `QuickNotesPanel.jsx` — local quick notes.

### Common components

- `ChatInput.jsx` — shared text/file input box.
- `CollapsibleText.jsx` — expandable description text.
- `NavItem.jsx` — sidebar navigation item.
- `ProgressRing.jsx` — circular reward progress display.
- `RewardProgressModal.jsx` — reward milestone modal.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

## Run the backend

In a separate terminal:

```bash
npm run server
```

The server runs on `http://localhost:8787` and exposes:

- `POST /api/breakdown` — AI task breakdown (Gemini)
- `GET  /api/stats` — daily focus stats
- `POST /api/stats/focus-session` — record a focus session
- `POST /api/stats/completed-task` — record a completed task
- `POST /api/stats/distraction` — record a distraction event
- `GET  /api/monitor/stream` — SSE stream for real-time events
- `POST /api/monitor/session/start` — start a monitor session
- `POST /api/monitor/session/end` — end a monitor session
- `POST /api/monitor/event` — receive a classified activity event
- `GET  /api/monitor/privacy/config` — get privacy filter config
- `POST /api/monitor/privacy/config` — update privacy filter config

If the backend or API key is unavailable, the frontend will still load, but AI breakdown and monitor features may not function.

## Run the desktop monitor agent (macOS only)

The monitor agent polls the active macOS window every 15 seconds and reports activity to the backend. It requires an active monitor session (toggle the Monitor panel on first).

```bash
npm run monitor-agent
```

The agent uses `osascript` — no extra npm packages required. It detects the active app, window title, and browser domain (Chrome and Safari). It will not report a window until the user has stayed for at least 60 seconds, and it caps idle time at 5 minutes to avoid counting time away from the desk as focus.

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Then fill in the required API keys:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI task breakdown |

## Suggested testing strategy

Good first test targets:

1. `src/utils/taskTree.js` — `findNodeById`, `findPathToNode`, `updateNodeById`
2. `src/data/rewards.js` — `getLevelForMinutes`, `getRewardBounds`, `clamp01`, `formatMins`
3. `src/utils/storage.js` — localStorage fallback and corrupted JSON handling
4. `server/monitor/classifier.js` — classification rules for known apps and domains
5. `server/statsStore.js` — `computeStats`, `computeStreak`, `computePeakFocusTime`

A future test setup can use Vitest + React Testing Library:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then add scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```
