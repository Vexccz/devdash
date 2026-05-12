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
import { initCacheDb, upsertDeploys, readAllDeploys, getDeployStatusById, closeCacheDb } from './cache';

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
  // Fallback: tiny 16x16 indigo square
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
    width: 960,
    height: 640,
    minWidth: 820,
    minHeight: 560,
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

  // Apply auto-launch if configured
  try {
    app.setLoginItemSettings({ openAtLogin: !!cfg.settings.autoLaunch });
  } catch {
    /* ignore */
  }
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

  // Capture previous statuses to detect transitions
  const previous = new Map<string, string>();
  for (const row of readAllDeploys(200)) {
    previous.set(`${row.provider}:${row.id}`, row.status);
  }

  const { items, errors } = await fetchAllDeploys(cfg.projects, {
    vercel: vercelToken,
    render: renderToken,
  });

  upsertDeploys(items);

  // Detect transitions
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

function runDevServer(project: ProjectConfig): { ok: boolean; error?: string } {
  if (!fs.existsSync(project.path)) return { ok: false, error: 'Project path missing' };
  const info = detectDevServer(project.path);
  const script = info.script ?? 'dev';
  const command = `npm run ${script === info.script ? 'dev' : 'dev'}`;
  // On Windows, launch a new PowerShell window so user can see output
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
    return runDevServer(project);
  });

  ipcMain.handle('projects:pull', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    return gitPull(project.path);
  });

  ipcMain.handle('deploys:list', () => ({ items: readAllDeploys(), errors: [] }));
  ipcMain.handle('deploys:refresh', async () => {
    await refreshDeploys(true);
    return { items: readAllDeploys(), errors: [] };
  });

  ipcMain.handle('settings:get', () => loadConfig().settings);
  ipcMain.handle('settings:update', (_e, patch: Partial<AppConfig['settings']>) => {
    const cfg = updateSettings(patch);
    if (typeof patch.pollIntervalMinutes === 'number') startPolling();
    if (typeof patch.autoLaunch === 'boolean') {
      try {
        app.setLoginItemSettings({ openAtLogin: patch.autoLaunch });
      } catch {
        /* ignore */
      }
    }
    return cfg.settings;
  });

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:configPath', () => configPath());
  ipcMain.handle('app:openLogs', async () => {
    const dir = logsPath();
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return dir;
  });

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (!url) return;
    return shell.openExternal(url);
  });

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
    // Ensure config exists (seeds on first run)
    loadConfig();
    try {
      initCacheDb();
    } catch (err) {
      console.error('[cache] init failed:', err);
    }
    registerIpc();
    createMainWindow();
    setupTray();
    // Initial deploy refresh + start polling
    void refreshDeploys(false);
    startPolling();
  });
}

app.on('before-quit', () => {
  quittingForReal = true;
  stopPolling();
  closeCacheDb();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
