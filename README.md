# DevDash

A developer dashboard for Windows. Local project status, deploy radar, uptime monitoring, database health, automations, and first-deploy flows for Vercel and Render — one window, no tab-hopping.

![DevDash](build/icon.png)

## Highlights

- **Smart onboarding**: pick a parent folder, DevDash scans every repo, detects framework, matches to existing Vercel/Render deployments, imports what you select.
- **First-deploy flow**: create new Vercel projects and Render services from inside the app. Env vars auto-import from your local `.env`.
- **One-click redeploy**: per-project or bulk across every configured deployment.
- **Cron automations**: schedule auto-pull or auto-deploy jobs per project with preset intervals (30m, hourly, daily, weekly).
- **Database health**: ping MongoDB and Postgres connections. Auto-detect URLs from env files.
- **Render metrics & Vercel analytics**: CPU, memory, visitor, pageview sparklines when available.
- **Ollama chat**: streaming local LLM chat with per-project context (markdown, syntax highlighting, code block copy).

## Features by tab

### Projects
- Git status per card: branch, ahead/behind, dirty counts, last commit, dev-server port
- Auto-detect framework and matching deploy on add: Vite, Next.js, Expo, React Native, Electron, Flutter, FastAPI, Node
- **Quick actions** per card: open folder, VS Code, GitHub, live URL, run dev, git pull, quick commit (stage + commit + push), diff viewer, PR list, redeploy, **first deploy**, release wizard
- **Smart import** button: bulk-scan any parent folder for git repos and import with checkbox selection
- Tag support with multi-select filter bar

### Deploys
- Recent deployments from every Vercel/Render project, with status badges (Ready / Building / Error / Queued / Canceled)
- Auto-polls every 5 minutes (1-120 min configurable)
- Toast + OS notification on status transitions
- **Redeploy button per row** and **Redeploy all** for bulk-triggering across providers
- Result summary toast with per-project error breakdown

### Uptime
- HTTP checks against each project's `liveUrl` on a scheduled interval (default 5 min)
- Latency history, uptime % over 24h, latest status code
- Toast notification on `ok → down` transitions


## Install

### Grab the installer

1. Download `DevDash-Setup-<version>.exe` from the [Releases](https://github.com/Vexccz/devdash/releases) page.
2. Run the installer (NSIS, per-user, no admin needed).
3. Launch DevDash from the Start menu or desktop shortcut.

### From source

```powershell
git clone https://github.com/Vexccz/devdash.git
Set-Location devdash
npm install
npm run dev       # Vite + Electron with hot reload
npm run dist      # builds dist/DevDash-Setup-<version>.exe
```

Node 22+ recommended. The first `npm install` triggers `electron-builder install-app-deps` which rebuilds `better-sqlite3` for the Electron ABI.

## API token setup

Both tokens are optional. DevDash runs without them; you just lose live deploy status and auto-matching.

### Vercel

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens).
2. Create a token scoped to your projects.
3. Paste into Settings → Vercel API token (or in the onboarding wizard).
4. For existing projects: DevDash auto-matches by GitHub remote; no manual ID needed.

### Render

1. Go to [dashboard.render.com/u/settings#api-keys](https://dashboard.render.com/u/settings#api-keys).
2. Create an API key.
3. Paste into Settings → Render API token.
4. For existing services: auto-matched by GitHub remote URL substring.

## Storage locations

- Config (projects + settings + automations + db targets): `%APPDATA%\devdash\config.json`
- Deploy + uptime + time + screenshots + automation runs cache: `%APPDATA%\devdash\cache.db`
- Logs: `%APPDATA%\devdash\logs\`
- Screenshots: `%APPDATA%\devdash\screenshots\<projectId>\`

## Keyboard shortcuts

- `Ctrl+K`: command palette (fuzzy jump to any tab or project)
- `?`: shortcuts overlay
- `Esc`: close any modal

## Tech stack

- Electron 32 + TypeScript
- React 18 + Vite 5
- Tailwind CSS 3
- `simple-git` for git operations
- `better-sqlite3` for deploy + uptime + chat history cache
- `axios` for Vercel, Render, MongoDB, Postgres, Ollama APIs
- `node-cron` for scheduled jobs (uptime, automations, deps check)
- `mongodb` + `pg` for DB health pings
- `marked` + `DOMPurify` + `highlight.js` for chat rendering
- `electron-builder` NSIS installer

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + Electron with hot TS compile |
| `npm run build` | TS compile main + Vite build renderer |
| `npm run dist` | Full NSIS installer at `dist/DevDash-Setup-<version>.exe` |
| `npm run typecheck` | Strict type check main + renderer |
| `npm run rebuild` | Force rebuild native modules for Electron |

## File structure

```
devdash/
├─ electron/
│  ├─ main.ts               # IPC, windows, tray, polling
│  ├─ preload.ts            # contextBridge (window.devdash)
│  ├─ config.ts             # AppConfig, persistence, seed
│  ├─ git.ts + gitsafe.ts   # git wrappers with stderr suppression
│  ├─ deploys.ts            # Vercel / Render API clients
│  ├─ createdeploy.ts       # first-deploy flow (v0.10.0)
│  ├─ inspect.ts            # folder scan + framework + deploy match (v0.9.0)
│  ├─ automations.ts        # cron jobs (v0.8.0)
│  ├─ dbhealth.ts           # MongoDB + Postgres ping (v0.8.0)
│  ├─ rendermetrics.ts      # Render CPU/memory (v0.8.0)
│  ├─ vercelanalytics.ts    # Vercel Web Analytics (v0.8.0)
│  ├─ ollama.ts             # streaming chat client
│  ├─ uptime.ts             # HTTP uptime checks
│  ├─ scheduler.ts          # cron scheduler for all jobs
│  ├─ cache.ts              # better-sqlite3 tables
│  └─ ...
├─ src/
│  ├─ App.tsx
│  ├─ components/
│  │  ├─ OnboardingWizard.tsx    (v0.9.1)
│  │  ├─ NewDeploymentModal.tsx  (v0.10.0)
│  │  ├─ SmartImportModal.tsx    (v0.9.0)
│  │  ├─ AutomationsView.tsx     (v0.8.0)
│  │  ├─ DbHealthView.tsx        (v0.8.0)
│  │  ├─ MetricsView.tsx         (v0.8.0)
│  │  ├─ ProjectsView.tsx + ProjectDetail.tsx
│  │  ├─ DeploysView.tsx
│  │  ├─ ChatView.tsx + MarkdownMessage.tsx
│  │  ├─ UptimeView.tsx + TimeView.tsx + DepsView.tsx
│  │  └─ SettingsView.tsx + CommandPalette.tsx + ShortcutsOverlay.tsx
│  ├─ types.ts
│  └─ styles.css
├─ scripts/make-icons.cjs
└─ build/icon.png
```

## Release history

- **v0.10.0** — First-deploy flow: create new Vercel projects and Render services from DevDash
- **v0.9.2** — Per-row + bulk redeploy in Deploys tab
- **v0.9.1** — Onboarding wizard with auto-scan
- **v0.9.0** — Auto-detect project metadata on Add; Smart import for bulk scanning
- **v0.8.2** — Config persistence fix, monorepo run-dev, stale UA strings
- **v0.8.1** — Monorepo `run dev`; DB auto-detect from env files
- **v0.8.0** — Automations, DB Health, Render metrics, Vercel analytics, breadcrumbs
- **v0.7.0** — Diff viewer, PR status per project
- **v0.6.0** — Syntax highlighting, encrypted config backup
- **v0.5.1** — Ollama Cloud support
- **v0.5.0** — Markdown in chat, shortcuts overlay, light mode
- **v0.4.0** — Ollama chat tab with streaming + history
- **v0.3.0** — Tags, quick commit, redeploy button
- **v0.2.0** — 13 features: logs, devservers, uptime, env, time, deps, release, heatmap, screenshots, command palette
- **v0.1.0** — Projects dashboard + deploy radar

## License

MIT © Vexccz
