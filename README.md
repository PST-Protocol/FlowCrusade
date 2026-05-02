# FlowCrusade

FlowCrusade is a React/Vite productivity app that turns a high-level task into smaller focus steps, tracks focus/distraction activity, and keeps quick notes beside the working canvas.

## What this app does

- Creates tasks manually or from an AI breakdown request.
- Displays task trees with root tasks, subtasks, and deeper child steps.
- Supports task drill-down and focused subtask views.
- Tracks focus minutes, reward milestones, distraction events, and quick notes.
- Stores local demo state in `localStorage` so refreshes preserve tasks, notes, and monitor events.
- Uses a local Express API endpoint for AI task breakdowns.

## Project structure

```txt
.
├── server/
│   └── index.js                  # Local backend API for AI task breakdown requests
├── src/
│   ├── App.jsx                   # App-level orchestration, state, handlers, and layout wiring
│   ├── main.jsx                  # React entry point
│   ├── index.css                 # Tailwind/global CSS
│   ├── data/
│   │   ├── initialData.js        # Demo tasks, stats, events, and notes
│   │   ├── rewards.js            # Reward/level math helpers and milestone config
│   │   └── themes.js             # Light/dark theme token map
│   ├── services/
│   │   └── breakdownApi.js       # Fetch wrapper for `/api/breakdown`
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
- `MonitorPanel.jsx` — distraction/focus event timeline.
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

## Run the backend API

In a separate terminal:

```bash
npm run server
```

The frontend expects the task breakdown API at:

```txt
http://localhost:8787/api/breakdown
```

If the backend or API key is unavailable, the frontend will still load, but AI breakdown requests may fail.

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Then fill in the provider API keys required by `server/index.js`.

## Suggested testing strategy

This refactor separates testable logic from UI files. Good first test targets:

1. `src/utils/taskTree.js`
   - `findNodeById`
   - `findPathToNode`
   - `updateNodeById`

2. `src/data/rewards.js`
   - `getLevelForMinutes`
   - `getRewardBounds`
   - `clamp01`
   - `formatMins`

3. `src/utils/storage.js`
   - localStorage fallback behavior
   - corrupted JSON fallback behavior

4. `src/services/breakdownApi.js`
   - successful response parsing
   - failed response error formatting

A future test setup can use Vitest + React Testing Library:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then add scripts like:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

## Refactor notes

The original `App.jsx` mixed mock data, theme config, utility functions, API calls, global state, and many UI components in a single 2600+ line file. The current structure separates those responsibilities so both humans and AI assistants can quickly locate the correct area to modify.

