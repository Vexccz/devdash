import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
  Notification,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import {
  loadConfig,
  addProject,
  updateProject,
  removeProject,
  updateSettings,
  configPath,
  logsPath,
  AppConfig,
  ProjectConfig,
} from './config';
import { getGitInfo, gitPull, detectDevServer } from './git';
import { fetchAllDeploys } from './deploys';
import {
  initCacheDb,
  upsertDeploys,
  readAllDeploys,
  closeCacheDb,
} from './cache';
import * as childprocs from './childprocs';
import * as envman from './envman';
import * as timer from './timer';
import * as uptime from './uptime';
import * as scheduler from './scheduler';
import * as depcheck from './depcheck';
import * as bundlesize from './bundlesize';
import * as heatmap from './heatmap';
import * as screenshots from './screenshots';
import { detectFramework } from './frameworks';
import { generateChangelog, writeChangelogToProject } from './changelog';
import { performRelease } from './release';

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let quittingForReal = false;

function resolveAssetPath(rel: string): string | null {
  const candidates = [
    path.join(__dirname, '..', rel),
    path.join(process.resourcesPath ?? '', rel),
    path.join(app.getAppPath(), rel),
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function createTrayImage(): Electron.NativeImage {
  const candidates = [
    resolveAssetPath('src/assets/tray.png'),
    resolveAssetPath('build/icon.png'),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
    } catch {
      /* ignore */
    }
  }
  const indigoPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mP8z8BQz0AEYBxVSF2FxFVIXIXEVUhchcRVSFwFAMJRAv+nYfszAAAAAElFTkSuQmCC',
    'base64'
  );
  return nativeImage.createFromBuffer(indigoPng);
}

function broadcast(channel: string, payload: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createMainWindow() {
  const cfg = loadConfig();
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 580,
    frame: false,
    backgroundColor: '#0b0b14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!quittingForReal) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    app.setLoginItemSettings({ openAtLogin: !!cfg.settings.autoLaunch });
  } catch {
    /* ignore */
  }

  childprocs.bindBroadcast(() => mainWindow);
}

function setupTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip('DevDash');
  const menu = Menu.buildFromTemplate([
    { label: 'Show DevDash', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Refresh deploys',
      click: () => {
        void refreshDeploys(true);
      },
    },
    {
      label: 'Run uptime check now',
      click: () => {
        void scheduler.runNow('uptime');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quittingForReal = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => toggleWindow());
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
  else showWindow();
}

function notify(title: string, body: string) {
  try {
    new Notification({ title, body, silent: false }).show();
  } catch (err) {
    console.error('notify failed:', err);
  }
}

async function refreshDeploys(manual = false): Promise<void> {
  const cfg = loadConfig();
  const { vercelToken, renderToken } = cfg.settings;
  if (!vercelToken && !renderToken) {
    broadcast('deploys:update', { items: readAllDeploys(), errors: [], manual });
    return;
  }

  const previous = new Map<string, string>();
  for (const row of readAllDeploys(200)) {
    previous.set(`${row.provider}:${row.id}`, row.status);
  }

  const { items, errors } = await fetchAllDeploys(cfg.projects, {
    vercel: vercelToken,
    render: renderToken,
  });

  upsertDeploys(items);

  for (const item of items) {
    const key = `${item.provider}:${item.id}`;
    const prev = previous.get(key);
    if (prev && prev !== item.status) {
      if (item.status === 'error') {
        const msg = `${item.projectName} deploy failed`;
        notify('Deploy failed', msg);
        broadcast('deploys:toast', { type: 'error', title: msg, projectId: item.projectId });
      } else if (item.status === 'ready' && prev === 'building') {
        const msg = `${item.projectName} deployed successfully`;
        notify('Deploy ready', msg);
        broadcast('deploys:toast', { type: 'success', title: msg, projectId: item.projectId });
      }
    }
  }

  broadcast('deploys:update', { items: readAllDeploys(), errors, manual });
}

function startPolling() {
  stopPolling();
  const cfg = loadConfig();
  const minutes = Math.max(1, cfg.settings.pollIntervalMinutes || 5);
  const intervalMs = minutes * 60 * 1000;
  pollTimer = setInterval(() => {
    void refreshDeploys(false);
  }, intervalMs);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function runDevServerDetached(project: ProjectConfig): { ok: boolean; error?: string } {
  if (!fs.existsSync(project.path)) return { ok: false, error: 'Project path missing' };
  const info = detectDevServer(project.path);
  const script = info.script ? (info.script === 'start' ? 'start' : 'dev') : 'dev';
  const command = `npm run ${script}`;
  try {
    spawn(
      'powershell.exe',
      [
        '-NoExit',
        '-Command',
        `Set-Location -LiteralPath '${project.path.replace(/'/g, "''")}'; ${command}`,
      ],
      {
        detached: true,
        stdio: 'ignore',
        shell: false,
      }
    ).unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function registerIpc() {
  ipcMain.handle('projects:list', () => loadConfig().projects);

  ipcMain.handle('projects:status', async (_e, { id, fetchRemote }: { id: string; fetchRemote: boolean }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { error: 'Project not found' };
    const info = await getGitInfo(project.path, { fetch: !!fetchRemote });
    return { ...info, project };
  });

  ipcMain.handle('projects:statusAll', async (_e, { fetchRemote }: { fetchRemote: boolean }) => {
    const cfg = loadConfig();
    const results = await Promise.all(
      cfg.projects.map(async (p) => ({
        project: p,
        git: await getGitInfo(p.path, { fetch: !!fetchRemote }),
        framework: detectFramework(p.path),
        devserver: childprocs.getStatus(p.id),
      }))
    );
    return results;
  });

  ipcMain.handle('projects:add', (_e, input: Omit<ProjectConfig, 'id'>) => {
    const cfg = addProject(input);
    return cfg.projects;
  });

  ipcMain.handle('projects:update', (_e, { id, patch }: { id: string; patch: Partial<ProjectConfig> }) => {
    const cfg = updateProject(id, patch);
    return cfg.projects;
  });

  ipcMain.handle('projects:remove', (_e, id: string) => {
    const cfg = removeProject(id);
    return cfg.projects;
  });

  ipcMain.handle('projects:pickFolder', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Pick project folder',
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('projects:openFolder', async (_e, p: string) => {
    if (!p) return { ok: false, error: 'Missing path' };
    const err = await shell.openPath(p);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle('projects:openInVSCode', (_e, p: string) => {
    if (!p) return { ok: false, error: 'Missing path' };
    try {
      spawn('code', [p], { shell: true, detached: true, stdio: 'ignore' }).unref();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('projects:runDev', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return runDevServerDetached(project);
  });

  ipcMain.handle('projects:pull', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return gitPull(project.path);
  });

  ipcMain.handle('projects:framework', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return null;
    return detectFramework(project.path);
  });

  // Devserver managed process
  ipcMain.handle('devserver:start', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return childprocs.startDev(id, project.path);
  });
  ipcMain.handle('devserver:stop', (_e, id: string) => childprocs.stopDev(id));
  ipcMain.handle('devserver:status', (_e, id: string) => childprocs.getStatus(id));
  ipcMain.handle('devserver:statusAll', () => childprocs.getAllStatuses());
  ipcMain.handle('devserver:logs', (_e, { id, limit }: { id: string; limit?: number }) =>
    childprocs.getBuffer(id, limit)
  );

  // Deploys
  ipcMain.handle('deploys:list', () => ({ items: readAllDeploys(), errors: [] }));
  ipcMain.handle('deploys:refresh', async () => {
    await refreshDeploys(true);
    return { items: readAllDeploys(), errors: [] };
  });

  // Uptime
  ipcMain.handle('uptime:all', () => uptime.allSummaries());
  ipcMain.handle('uptime:project', (_e, { id, hours }: { id: string; hours?: number }) =>
    uptime.summaryFor(id, hours ?? 24)
  );
  ipcMain.handle('uptime:runNow', async () => {
    await scheduler.runNow('uptime');
    return uptime.allSummaries();
  });
  ipcMain.handle('uptime:errors', async (_e, id: string) => {
    return screenshots.gatherErrorsForProject(id);
  });

  // Env manager
  ipcMain.handle('env:scan', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return [];
    return envman.scanProject(project.path);
  });
  ipcMain.handle('env:read', (_e, { id, file }: { id: string; file: string }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { file, path: '', exists: false, entries: [] };
    return envman.readFileDetail(project.path, file);
  });
  ipcMain.handle('env:write', (_e, { id, file, entries }: { id: string; file: string; entries: any }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return envman.writeFileDetail(project.path, file, entries);
  });
  ipcMain.handle('env:clone', (_e, args: { sourceId: string; sourceFile: string; targetId: string; targetFile: string; overwrite: boolean }) => {
    const cfg = loadConfig();
    const src = cfg.projects.find((p) => p.id === args.sourceId);
    const tgt = cfg.projects.find((p) => p.id === args.targetId);
    if (!src || !tgt) return { ok: false, error: 'Source or target not found' };
    return envman.cloneEnv(src.path, args.sourceFile, tgt.path, args.targetFile, args.overwrite);
  });
  ipcMain.handle('env:files', () => envman.listSupportedFiles());

  // Time
  ipcMain.handle('time:enter', (_e, id: string) => timer.enter(id));
  ipcMain.handle('time:leave', (_e, id: string) => timer.leave(id));
  ipcMain.handle('time:touch', (_e, id: string) => timer.touch(id));
  ipcMain.handle('time:summary', (_e, { id, days }: { id: string | null; days: number }) =>
    timer.summaryFor(id, days)
  );
  ipcMain.handle('time:active', () => timer.getActive());

  // Changelog
  ipcMain.handle('changelog:generate', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { error: 'Project not found' };
    return generateChangelog(project.path);
  });
  ipcMain.handle('changelog:write', (_e, { id, markdown }: { id: string; markdown: string }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return writeChangelogToProject(project.path, markdown);
  });

  // Release
  ipcMain.handle('release:start', async (_e, { id, opts }: { id: string; opts: any }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { error: 'Project not found' };
    return performRelease(
      {
        projectPath: project.path,
        bump: opts?.bump ?? 'patch',
        writeChangelog: !!opts?.writeChangelog,
        releaseNotes: opts?.releaseNotes ?? '',
        pushTags: opts?.pushTags !== false,
        createGithubRelease: opts?.createGithubRelease !== false,
      },
      () => mainWindow
    );
  });

  // Bundle
  ipcMain.handle('bundle:history', (_e, id: string) => bundlesize.history(id));
  ipcMain.handle('bundle:checkNow', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return null;
    return bundlesize.recordIfChanged(id, project.path, true);
  });

  // Deps
  ipcMain.handle('deps:runNow', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return null;
    return depcheck.runForProject(id, project.path);
  });
  ipcMain.handle('deps:latest', (_e, id: string) => depcheck.latest(id));

  // Heatmap
  ipcMain.handle('heatmap:build', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return null;
    return heatmap.build(project.path);
  });

  // Screenshots
  ipcMain.handle('screenshots:list', (_e, id: string) => screenshots.list(id));
  ipcMain.handle('screenshots:captureNow', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project || !project.liveUrl) return { ok: false, error: 'No live URL' };
    const row = await screenshots.captureForProject(id, project.liveUrl);
    return row ? { ok: true, row } : { ok: false, error: 'Capture failed' };
  });
  ipcMain.handle('screenshots:remove', (_e, shotId: number) => screenshots.remove(shotId));
  ipcMain.handle('screenshots:removeOlderThan', (_e, { id, days }: { id: string; days: number }) =>
    screenshots.removeOlderThan(id, days)
  );

  // Scheduler
  ipcMain.handle('scheduler:status', () => scheduler.status());
  ipcMain.handle('scheduler:runNow', async (_e, name: string) => {
    await scheduler.runNow(name);
    return { ok: true };
  });

  // Settings
  ipcMain.handle('settings:get', () => loadConfig().settings);
  ipcMain.handle('settings:update', (_e, patch: Partial<AppConfig['settings']>) => {
    const cfg = updateSettings(patch);
    if (typeof patch.pollIntervalMinutes === 'number') startPolling();
    if (typeof patch.idleTimeoutMinutes === 'number') timer.setIdleTimeout(patch.idleTimeoutMinutes);
    if (
      typeof patch.uptimeIntervalMinutes === 'number' ||
      typeof patch.uptimeEnabled === 'boolean' ||
      typeof patch.bundleWatchEnabled === 'boolean' ||
      typeof patch.depsCheckEnabled === 'boolean' ||
      typeof patch.screenshotsEnabled === 'boolean' ||
      typeof patch.screenshotHour === 'number'
    ) {
      scheduler.startScheduler(broadcast);
    }
    if (typeof patch.autoLaunch === 'boolean') {
      try {
        app.setLoginItemSettings({ openAtLogin: patch.autoLaunch });
      } catch {
        /* ignore */
      }
    }
    return cfg.settings;
  });

  ipcMain.handle('settings:testToken', async (_e, provider: 'vercel' | 'render') => {
    const settings = loadConfig().settings;
    try {
      if (provider === 'vercel') {
        const token = settings.vercelToken?.trim();
        if (!token) return { ok: false, message: 'No token set' };
        const res = await fetch('https://api.vercel.com/v2/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };
        const data = (await res.json()) as { user?: { username?: string; email?: string } };
        const who = data.user?.username || data.user?.email || 'authenticated';
        return { ok: true, message: `Connected as ${who}` };
      }
      if (provider === 'render') {
        const token = settings.renderToken?.trim();
        if (!token) return { ok: false, message: 'No token set' };
        const res = await fetch('https://api.render.com/v1/owners?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };
        const data = (await res.json()) as Array<{ owner?: { name?: string; email?: string } }>;
        const who = data?.[0]?.owner?.name || data?.[0]?.owner?.email || 'authenticated';
        return { ok: true, message: `Connected as ${who}` };
      }
      return { ok: false, message: 'Unknown provider' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  });

  // App
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:configPath', () => configPath());
  ipcMain.handle('app:openLogs', async () => {
    const dir = logsPath();
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return dir;
  });

  // Shell
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (!url) return;
    return shell.openExternal(url);
  });
  ipcMain.handle('shell:openPath', async (_e, p: string) => {
    if (!p) return { ok: false, error: 'Missing path' };
    const err = await shell.openPath(p);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });
  ipcMain.handle('shell:readFileAsDataUrl', (_e, p: string) => {
    try {
      const buf = fs.readFileSync(p);
      const ext = path.extname(p).replace('.', '').toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // Window
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => {
    quittingForReal = true;
    app.quit();
  });
}

// Single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    loadConfig();
    try {
      initCacheDb();
    } catch (err) {
      console.error('[cache] init failed:', err);
    }
    try {
      const cfg = loadConfig();
      timer.setIdleTimeout(cfg.settings.idleTimeoutMinutes ?? 2);
    } catch {
      /* ignore */
    }
    registerIpc();
    createMainWindow();
    setupTray();
    void refreshDeploys(false);
    startPolling();
    try {
      scheduler.startScheduler(broadcast);
    } catch (err) {
      console.error('[scheduler] start failed:', err);
    }
  });
}

app.on('before-quit', () => {
  quittingForReal = true;
  stopPolling();
  scheduler.stopScheduler();
  timer.stopAll();
  childprocs.killAll();
  closeCacheDb();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
