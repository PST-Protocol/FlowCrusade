# Structure Guide

This project is organized by responsibility rather than by file size alone.

## Where to edit common changes

| Change needed | Start here |
|---|---|
| Initial demo tasks/stats/events | `src/data/initialData.js` |
| Theme colors/classes | `src/data/themes.js` |
| Reward levels or milestones | `src/data/rewards.js` |
| AI breakdown request URL or error handling | `src/services/breakdownApi.js` |
| Task-tree traversal/update logic | `src/utils/taskTree.js` |
| File upload conversion | `src/utils/file.js` |
| Home input screen | `src/components/views/ViewA.jsx` |
| Root task overview | `src/components/views/ViewB.jsx` |
| Breakdown tree screen | `src/components/views/ViewCE.jsx` |
| Focus subtask details | `src/components/views/FocusDetailView.jsx` |
| Calendar overlay | `src/components/panels/CalendarPanel.jsx` |
| Stats/rewards overlay | `src/components/panels/StatsPanel.jsx` |
| Monitor overlay | `src/components/panels/MonitorPanel.jsx` |
| Settings overlay | `src/components/panels/SettingsPanel.jsx` |
| Quick notes | `src/components/panels/QuickNotesPanel.jsx` |

## Design rule

`App.jsx` should stay focused on app orchestration:

- global state
- persistence effects
- AI/task handlers
- deciding which major view is visible
- wiring layout components together

Reusable UI should live under `components/common/`.
Feature-level screens should live under `components/views/` or `components/panels/`.
Pure logic should live under `utils/`, `data/`, or `services/`.
