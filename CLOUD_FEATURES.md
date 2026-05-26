# FocusTrail local/cloud account upgrade

## What changed

- Local mode stays the default. The app still works with only Vite and localStorage/server JSON.
- PostgreSQL is optional. The server only connects when `DATABASE_URL` is set.
- If `DATABASE_URL` is missing or connection fails, account/social APIs fall back to `server/data/cloud-local.json`.
- Added account creation/login using email or phone + password.
- Each user receives a unique 8-digit public ID.
- Email and phone are unique per account.
- Users can change username, choose `local` or `cloud` storage, and opt in/out of leaderboard.
- Users can search friends by 8-digit ID.
- Users can create study groups.
- Leaderboard only includes users who opt in.
- Completing a task now triggers a high-intensity Duolingo-style celebration overlay.

## Run locally without PostgreSQL

```bash
npm install
npm run server
npm run dev
```

This will use:

- Frontend task data: browser `localStorage`
- Server stats: `server/data/stats.json`
- Account/social fallback data: `server/data/cloud-local.json`

## Run with PostgreSQL cloud mode

Create `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
JWT_SECRET=change-this-to-a-long-random-secret
# Use this only if your managed Postgres requires SSL:
PGSSL=true
```

Then run:

```bash
npm install
npm run server
npm run dev
```

The server auto-creates these tables:

- `users`
- `friendships`
- `study_groups`
- `study_group_members`
- `task_snapshots`

## Main files changed / added

- `server/cloudStore.js`: account auth, optional PostgreSQL, local-json fallback, friends, groups, leaderboard, cloud snapshot.
- `server/index.js`: routes for `/api/auth/*`, `/api/social/*`, `/api/cloud/*`, `/api/cloud/status`.
- `src/services/authApi.js`: frontend API wrapper for login/register/social/cloud save.
- `src/components/panels/AccountPanel.jsx`: Account tab UI.
- `src/components/common/CompletionCelebration.jsx`: task-complete reward animation.
- `src/App.jsx`: Account nav item, celebration trigger after mark complete, passes task setter into panel.
- `src/components/panels/LeftPanels.jsx`: renders AccountPanel.
- `src/utils/storage.js`: adds default `storageMode` and `rankingOptIn` settings.
- `src/index.css`: confetti/pop animations.
- `package.json`: adds `pg` and `jsonwebtoken`.
