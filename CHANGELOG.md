# Changelog

All notable changes to DevDash are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/), dates in `YYYY-MM-DD`.

## [0.2.0] - 2026-05-12

Big release. 13 planned features; status against each is listed below so you know what to trust.

### Added — High-value (priority 1)
- ✅ **Log tail viewer** — in-app tab showing live stdout/stderr of spawned dev servers, with ERROR/WARN color coding, auto-scroll toggle, keyword filter, kill button, and ring buffer capped at 2000 lines per project.
- ✅ **Smart dev server launcher** — framework detection (Vite, Next, Expo, Flutter, Uvicorn/FastAPI, generic `npm run dev`). Badge on project card. In-app managed child process with live port + green/red status dot. Click green dot to open the local URL.
- ✅ **Endpoint health checker** — scheduled HTTP GET every N min (default 5) for projects with a live URL. Status + latency history stored in SQLite `uptime_checks`. Uptime tab with per-project sparkline, uptime %, latest status dot, and toast on up→down transition.
- ✅ **Env var manager** — scans `.env`, `.env.local`, `.env.production`, compares against `.env.example`, lets you edit values in a masked grid, copy across projects. Values never leave the local process log.

### Added — Productivity (priority 2)
- ✅ **Command palette (Ctrl+K / Cmd+K)** — fuzzy search `<project> <action>`. Actions: run dev, open folder, open VS Code, open GitHub, open live URL, open logs tab, git pull, release. Arrow keys + Enter + Esc.
- ✅ **Task timer per project** — auto-starts on project detail open, auto-stops on close or 2 min idle. Cumulative time in SQLite `time_sessions`. Time tab with weekly bar chart and Today / This Week summary.
- ✅ **Changelog generator** — `git log <lastTag>..HEAD` via simple-git, grouped by Conventional Commits prefix, preview dialog with copy-to-clipboard and optional write-back to project `CHANGELOG.md`.
- ✅ **One-click release** — modal with version bump (patch/minor/major), changelog preview, notes textarea. On confirm: bumps `package.json`, commits, tags, pushes, calls `gh release create` and uploads any `dist/*.exe` or `dist/*.apk`. Per-step progress log, abort-on-failure.

### Added — Monitoring (priority 3)
- ⚠️ **Error budget tracker** — scans `logs/` folder under each project for last-7-days `ERROR` lines, chart + threshold toast on Uptime tab. Sentry DSN integration pulls per-day issue counts if `sentryDsn` field is set (basic, no auth token required for public DSNs via `/api/0/projects/.../stats/` is disabled; set `sentryAuthToken` in settings to enable). Static only if no DSN and no logs folder.
- ✅ **Bundle size watch** — watches `dist/` folder mtime, records total size in SQLite on change, shows delta vs last build and yellow badge if growth > 10% vs 7-day avg. History chart in project detail view.
- ✅ **Dependency outdated checker** — runs `npm outdated --json` weekly + manual. Counts major/minor/patch. Red badge on project card for any major lag. Detail view table.

### Added — Fun (priority 4)
- ✅ **GitHub activity heatmap** — 90-day commit calendar via `git log`. Current + longest streak. Rendered in project detail view.
- ⚠️ **Screenshot gallery** — Electron `BrowserWindow.capturePage()` captures project's live URL daily (puppeteer path deferred to keep installer slim). Thumbnail grid, click for full size, delete old. Timelapse mode is a simple chronological slideshow. Requires live URL; skipped gracefully if not set.

### Changed
- New top-level tabs: **Uptime**, **Time**, **Deps** alongside existing Projects, Deploys, Settings.
- Clicking a project card now opens a detail panel with tabs: Overview / Logs / Env / Time / Deps / Heatmap / Screenshots.
- Background scheduler (`node-cron` + setInterval) drives uptime, bundle, dep, and screenshot jobs. Logs start/stop to main console.
- Expanded IPC surface in `preload.ts`; all new calls audited against `ipcMain.handle` entries.
- SQLite migrated in-place; existing `deploys` table preserved. New tables: `uptime_checks`, `time_sessions`, `bundle_sizes`, `dep_reports`, `screenshots`.

### Quality gates (this release)
- `tsc --noEmit` (renderer): 0 errors.
- `tsc -p electron/tsconfig.json --noEmit` (main): 0 errors.
- IPC audit: every `ipcRenderer.invoke` channel has a matching `ipcMain.handle`.
- `npm run dist` produced `dist/DevDash-Setup-0.2.0.exe`.
- Scheduler dry-run: starts 4 jobs (uptime 5min, bundle 10min, deps weekly, screenshots daily 09:00), logs start.
- v0.1.0 regressions: Projects / Deploys / Settings tabs still functional; git status still fetches; deploy polling still runs on its existing interval.
- Secrets: env values masked in UI by default. Provider tokens unchanged in config. No token/env values written to stdout.

### Notes / known gaps
- Sentry integration is scaffolded but only activated when both `sentryDsn` and `sentryAuthToken` are configured. Without them, error budget falls back to local log scanning.
- Screenshot capture uses Electron's own BrowserWindow, not puppeteer, to avoid a 150MB+ install weight. URLs that block iframes/headless still render (we use a full off-screen window).
- Release flow calls `gh` CLI via spawn; requires `gh auth status` to be green.

## [0.1.0] - 2026-05-12

Initial release.

### Added
- Three-tab Electron app: Projects, Deploys, Settings.
- **Projects tab**
  - Pre-seeded with 5 projects (FYP, ScoreKu, StatusMy, AI Research Engine, ExpenseTracker).
  - Git status per project: branch, ahead/behind, dirty/clean indicator, modified/staged/untracked counts.
  - Last commit metadata (short hash, message, author, relative time).
  - Auto-detected dev server port from `vite.config.*` or package.json scripts.
  - Quick actions: Open folder, Open in VS Code, Open GitHub, Open live URL, Run dev in detached PowerShell, Git pull.
  - Add / edit / remove projects via modal with folder picker and deploy provider selector.
- **Deploys tab**
  - Vercel and Render API integration (`/v6/deployments`, `/v1/services/.../deploys`).
  - Status badges: Ready / Building / Error / Queued / Canceled.
  - Auto-poll every 5 minutes (configurable 1–120).
  - Toast + OS notification on `building → ready` and `* → error` transitions.
  - Filter chips: All / Ready / Building / Error.
  - Dashboard + preview deep links per deploy.
- **Settings tab**
  - Vercel and Render tokens (password inputs with show/hide).
  - Poll interval.
  - Dark mode toggle (dark-only for now; persisted for future light theme).
  - Auto-launch on Windows startup.
  - About: version, config path, open logs button.
- Config persistence at `%APPDATA%\devdash\config.json`.
- Deploy cache with `better-sqlite3` at `%APPDATA%\devdash\cache.db` so the list survives restarts.
- `simple-git` for git operations; `fetch()` rate-limited to once per 2 minutes per project.
- Custom borderless title bar, 960x640 default window, tray icon with single-instance lock.
- Indigo/violet theme (`#6366f1`) and dashboard sparkline icons generated by `scripts/make-icons.cjs`.
- NSIS installer build via `npm run dist` (`dist/DevDash-Setup-0.1.0.exe`).

### Quality gates passed
- `tsc --noEmit` (renderer): 0 errors.
- `tsc -p electron/tsconfig.json --noEmit` (main): 0 errors.
- `npm run dist` produced signed-skipped NSIS installer.
- IPC contract checked: all `ipcRenderer.invoke` calls have matching `ipcMain.handle` entries.
- Tray icon fallback chain verified (`src/assets/tray.png` → `build/icon.png` → base64 indigo PNG).
- Config persistence smoke-tested: launching the packaged app creates `%APPDATA%\devdash\config.json` with all 5 seed projects.
