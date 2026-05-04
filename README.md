# FlowCrusade

FlowCrusade is a React/Vite productivity app that turns a high-level task into smaller focus steps, tracks real-time focus and distraction activity via a macOS desktop monitor agent, and keeps quick notes beside the working canvas.

## What this app does

- Creates tasks manually or from an AI breakdown request (powered by Gemini).
- Displays task trees with root tasks, subtasks, and deeper child steps.
- Supports task drill-down and focused subtask views.
- Monitors the active macOS window in real time and classifies activity as focus or distraction.
- Starts the macOS monitor agent from the Monitor UI and reports agent status.
- Tracks focus minutes, distraction events, distract time, streaks, and peak focus hours — updated live via SSE.
- Lets users edit focus/distraction app and domain rules from Settings.
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
│   │   ├── privacy.json
│   │   └── classification.json
│   └── monitor/
│       ├── routes.js             # /api/monitor REST endpoints
│       ├── agent.js              # Starts/stops/status-checks the desktop monitor agent
│       ├── store.js              # Session + event persistence, crash recovery
│       ├── stream.js             # SSE broadcast to frontend
│       ├── classifier.js         # Rule-based focus/distraction classifier
│       ├── classificationConfig.js # Editable focus/distraction rules
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
- `MonitorPanel.jsx` — real-time activity timeline, Monitor session toggle, and agent status.
- `SettingsPanel.jsx` — theme, preferences, and monitor classification rules.
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

Open the Vite URL printed in the terminal, usually `http://localhost:5173`. If that port is occupied, Vite may use another port such as `http://localhost:5174`.

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
- `GET  /api/monitor/session/active` — get the active monitor session
- `POST /api/monitor/event` — receive a classified activity event
- `GET  /api/monitor/events/:sessionId` — list events for a session
- `GET  /api/monitor/agent/status` — get desktop monitor agent status
- `POST /api/monitor/agent/start` — start the desktop monitor agent
- `POST /api/monitor/agent/stop` — stop the desktop monitor agent
- `GET  /api/monitor/privacy/config` — get privacy filter config
- `POST /api/monitor/privacy/config` — update privacy filter config
- `GET  /api/monitor/classification/config` — get focus/distraction rules
- `POST /api/monitor/classification/config` — update focus/distraction rules
- `POST /api/monitor/classification/config/reset` — reset focus/distraction rules

If the backend or API key is unavailable, the frontend will still load, but AI breakdown and monitor features may not function.

## Monitor workflow (macOS only)

The Monitor panel controls both the backend session and the desktop agent:

1. Run the backend with `npm run server`.
2. Run the frontend with `npm run dev`.
3. Open the Vite URL.
4. Open the Monitor panel.
5. Turn on Active Monitor.

Turning on Active Monitor creates a backend session and starts `scripts/desktop-monitor.js` automatically. The agent polls the active macOS window every 15 seconds and reports activity to the backend.

The agent uses `osascript` — no extra npm packages required. It detects the active app, window title, and browser domain for Chrome and Safari. It reports a window after the user has stayed for at least 10 seconds, and it caps idle time at 5 minutes to avoid counting time away from the desk as focus.

The standalone script is still available for debugging:

```bash
npm run monitor-agent
```

Do not run the standalone agent at the same time as the UI-started agent, or events may be duplicated.

### Monitor status

The Monitor panel shows:

- `Tracking` — session is active and the desktop agent is running.
- `Agent Running` — the desktop collector is active.
- `Agent Offline` — session exists, but no desktop collector is running.
- `Needs Permission` — macOS blocked the agent from reading active-window data.

If macOS asks for Accessibility permission, grant it to the app that started the backend, such as Terminal, VS Code, Cursor, or Node.

### Classification rules

Activity is classified with rule-based app/domain matching:

- Focus examples: Code, Cursor, Word, Excel, Google Docs, Google Sheets, Canvas, Notion, GitHub.
- Distraction examples: Reddit, Instagram, TikTok, Twitter/X, Netflix, Twitch.

Rules can be edited in Settings under Monitor Classification. They are persisted in `server/data/classification.json`.

The Monitor timeline shows browser domains as readable web labels. For example, `discord.com` appears as `discord (web)` and the full domain is shown below the label.

### Known Monitor limits

- Firefox domain detection is not supported by the current AppleScript collector.
- Classification is rule-based, not semantic AI classification.
- The current app is designed for a local single-user, single-active-session workflow.
- Very frequent window-title changes can split activity into short segments that may be skipped.
- The 10-second reporting threshold is useful for MVP testing; a production build may want a longer threshold such as 60 seconds.

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
