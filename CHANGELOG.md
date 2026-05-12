# Changelog

All notable changes to DevDash are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/), dates in `YYYY-MM-DD`.

## [0.5.1] - 2026-05-13

### Added
- **Ollama cloud support** — the Settings tab now exposes a dedicated Ollama section with editable Base URL and a password-style API Key field. When a key is present, it is sent as `Authorization: Bearer <key>` on every request to `/api/tags` and `/api/chat`. Leave the key blank for a local Ollama server.

### Fixed
- Chat failed to load models when only an Ollama cloud endpoint was available because requests were made without an `Authorization` header.

## [0.5.0] - 2026-05-13

Polish release focused on chat UX and theming.

### Added
- **Markdown rendering in chat** — assistant responses render with full markdown support (headings, lists, links, tables, blockquotes, inline code, code fences). Powered by `marked` 18 with `DOMPurify` sanitization. Code blocks include a Copy button. External links open in the default browser.
- **Keyboard shortcuts overlay** — press `?` anywhere (outside input fields) to open a modal listing all shortcuts, grouped by category. Press Esc to close.
- **Light mode** — Settings now exposes a three-way theme selector (Dark, Light, System). The System option tracks the OS `prefers-color-scheme` preference and updates live when the OS theme changes.

### Changed
- Settings `Appearance & startup` replaces the previous placeholder Dark-mode toggle with the new theme selector.
- User messages in chat retain plain-text rendering; only assistant and system roles render through the markdown path.

### Known issues
- Syntax highlighting inside code fences is not included; code blocks render in a monospace font without language-based coloring.
- Light mode overrides are applied through CSS attribute selectors; a handful of deep panel-tint variations may still appear dark in niche surfaces and will be tuned in a follow-up.
- Remaining v0.4.0/v0.5.0 backlog (encrypted config export/import, scheduled automations, PR status, diff viewer, database health, Render metrics, Vercel analytics, project detail breadcrumb, Electron major-version upgrade) is still deferred.

## [0.4.0] - 2026-05-13

Adds a first-class Ollama chat panel directly in the app. Chat without leaving DevDash.

### Added
- **Chat tab** — a new sidebar entry next to Deps. Connects to a local Ollama server (default `http://localhost:11434`, configurable in Settings via `ollamaBaseUrl`).
- **Model picker** — dropdown populated from `GET /api/tags`, with a refresh button.
- **Streaming responses** — assistant output streams token by token via NDJSON parsing of `POST /api/chat`. A Stop button cancels the active stream.
- **Chat history** — conversations persist in SQLite (`chats`, `chat_messages` tables). Sidebar shows title, model, and relative updated time. Delete per chat.
- **Per-chat settings** — temperature slider (0.0–1.5) and system prompt field in the composer row.
- **Settings fields** — `ollamaBaseUrl`, `ollamaDefaultModel`, `ollamaSystemPrompt`, `ollamaTemperature` added to `AppConfig.settings` with safe defaults.
- **IPC surface** — new `window.devdash.ollama.{listModels,chat,stop,onChunk,onDone,onError}` and `window.devdash.chats.{list,create,update,delete,messages,addMessage}`.

### Changed
- Sidebar order now reads: Projects, Deploys, Uptime, Time, Deps, Chat, Settings.
- Command palette tab union expanded to include `chat`.

### Known issues
- Assistant responses render as monospaced plain text; markdown rendering and code-block syntax highlighting are planned for a follow-up.
- If Ollama is not running, the Chat tab displays an `Ollama unreachable` hint but does not currently probe automatically on reconnect — use the refresh button.
- The deferred v0.4.0 scope (keyboard shortcuts overlay, config export/import, light mode, cron automations, PR status, diff viewer, DB health, Render metrics, Vercel analytics, project detail breadcrumb, Electron 32→42) remains deferred.

## [0.3.0] - 2026-05-13

Ships the full v0.3.0 scope: critical fixes plus three high-impact feature additions.

### Added
- **Project tags** — projects accept free-form tags in the Add/Edit modal (pill-style input, Enter to add, Backspace to remove). A filter row above the project grid allows multi-select filtering by tag. Tags persist in `config.json` under `ProjectConfig.tags`.
- **Quick commit** — new `✓ Commit` action on each project card opens a modal showing `git status --short`, a commit-message textarea, and optional stage-all / push-after-commit checkboxes. Executes through `simple-git` for stage/commit and the new `gitsafe` wrapper for push.
- **Manual redeploy** — projects configured with a Vercel project ID or Render service ID gain a `🚀 Redeploy` action that triggers a fresh production deployment via the provider API. Vercel uses `POST /v13/deployments` with `target: production`; Render uses `POST /v1/services/{id}/deploys`.
- New preload APIs: `projects.quickCommit`, `projects.gitStatusShort`, `deploys.trigger`.

### Fixed
- Carries the three critical fixes from the 0.3.0-batch1 preview (Sentry org resolution, PowerShell git stderr noise, non-breaking npm audit remediation).

### Known issues
- The 15 advisories requiring breaking bumps (Electron 32→42, Vite 5→8, @electron/rebuild 3→4) remain deferred.
- The larger v0.3.0 vision (Ollama chat panel, keyboard shortcuts overlay, config export/import, light mode, cron automations, PR status, diff viewer, DB health, Render metrics, Vercel analytics, project detail breadcrumb) is not in this release and is planned for v0.4.0.

## [0.3.0-batch1] - 2026-05-13

Partial v0.3.0 release. Batches 2 and 3 ship the remaining v0.3.0 scope; this batch is the three critical fixes.

### Fixed
- **Sentry integration** — the hardcoded `sentry` org slug in the error-budget fetch path is gone. DSNs are parsed into `{ key, host, orgId, projectId }`, the org slug is resolved by calling `GET /api/0/organizations/` with the saved auth token, and the resolved `{orgSlug, projectSlug}` are cached (15 min TTL, keyed by orgId + token hash). New `electron/sentry.ts` module; `screenshots.gatherErrorsForProject` now calls it instead of the broken hardcoded URL.
- **Git progress noise on PowerShell** — `git fetch`/`git pull`/`git push` no longer emit progress lines that PowerShell interprets as error objects. New `electron/gitsafe.ts` wraps `execFile('git', [...args, '--quiet'], { windowsHide: true, env: { GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', LC_ALL: 'C' } })` and returns a `{ ok, code, stdout, stderr }` shape instead of throwing. `electron/git.ts` (fetch/pull) and `electron/release.ts` (push + push tags) now use the wrapped version. Note: `--progress=false` is not a valid git flag, so the wrapper uses `--quiet` instead.

### Added
- `ProjectConfig.sentryOrgSlug` and `ProjectConfig.sentryProjectSlug` fields so the resolved slugs can be cached on disk and edited manually for self-hosted Sentry.
- `AddProjectModal` now has a DSN textarea with live regex validation and a small `orgId=… · projectId=…` preview. Saving a DSN (in edit mode) auto-resolves the org + project slug in the background when a Sentry auth token is configured.
- New preload API: `window.devdash.sentry.validate(dsn)` and `window.devdash.sentry.resolve(projectId)`.

### Security
- `npm audit` count dropped from **17 (1 critical, 11 high, 3 moderate, 2 low)** to **15 (0 critical, 10 high, 3 moderate, 2 low)** via non-breaking bumps:
  - `axios` 1.7.7 → 1.16.0 (fixes NO_PROXY SSRF advisory GHSA-3p68-rc4w-qgx5).
  - `simple-git` 3.27.0 → 3.36.0 (fixes RCE advisories GHSA-jcxm-m3jx-f287, GHSA-r275-fr43-pm7q, GHSA-hffm-xvc3-vprc — this was the lone critical).
  - `vite` 5.4.8 → 5.4.21, `postcss` 8.4.47 → 8.5.14 (patch bumps within 5.x/8.x).

### Known issues
The remaining 15 advisories all require breaking bumps and are deferred to a later batch:
- `electron` 32.x → 42.x (ASAR integrity bypass, GHSA-vmqv-hx8q-j7mg).
- `@electron/rebuild` 3.6.0 → 4.x (pulls vulnerable `tar`/`cacache`/`node-gyp`).
- `vite` 5.x → 8.x (bundled `esbuild` advisory GHSA-67mh-4wv8-2f99 on the dev server).

`npm audit fix --force` was deliberately not run for this batch.

## [0.2.1] - 2026-05-12

### Added
- Settings: "Saved" badge flashes when any field is edited to confirm auto-save worked.
- Settings: **Test** button next to Vercel and Render token fields. Validates the token against the provider's API and shows "Connected as <username>" on success or the HTTP error on failure.

### Changed
- Settings header subtitle clarified to "Changes save automatically as you type."

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
