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
import * as chatCache from './cache';
import { listModels as ollamaListModels, streamChat as ollamaStreamChat } from './ollama';
import { exportConfig, importConfig } from './configbackup';
import * as backup from './backup';
import * as collab from './collaborators';
import * as ports from './ports';
import * as capacitor from './capacitor';
import * as scaffold from './scaffold';
import * as childprocs from './childprocs';
import * as envman from './envman';
import * as timer from './timer';
import * as uptime from './uptime';
import * as scheduler from './scheduler';
import * as depcheck from './depcheck';
import * as bundlesize from './bundlesize';
import * as heatmap from './heatmap';
import * as screenshots from './screenshots';
import * as sentrymod from './sentry';
import * as automations from './automations';
import * as dbhealth from './dbhealth';
import { inspectPath, scanParentFolder } from './inspect';
import { createDeployment } from './createdeploy';
import { fetchRenderMetrics } from './rendermetrics';
import { fetchVercelAnalytics } from './vercelanalytics';
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
  capacitor.bindBroadcast(() => mainWindow);
  scaffold.bindBroadcast(() => mainWindow);
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
  const fw = detectFramework(project.path);
  if (fw.id === 'unknown') {
    return { ok: false, error: 'No runnable framework detected (no dev/start script in root or common subfolders)' };
  }
  // Use the framework's resolved cwd (could be a subfolder for monorepos)
  const cwd = fw.cwd;
  const command = `${fw.command} ${fw.args.join(' ')}`;
  try {
    spawn(
      'powershell.exe',
      [
        '-NoExit',
        '-Command',
        `Set-Location -LiteralPath '${cwd.replace(/'/g, "''")}'; ${command}`,
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

  ipcMain.handle('projects:inspect', (_e, targetPath: string) => inspectPath(targetPath));

  ipcMain.handle('projects:scanParent', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Pick parent folder to scan',
    });
    if (res.canceled || res.filePaths.length === 0) return { parent: null, projects: [] };
    const parent = res.filePaths[0];
    const projects = await scanParentFolder(parent);
    return { parent, projects };
  });

  ipcMain.handle('projects:importMany', (_e, inputs: any[]) => {
    const cfg = loadConfig();
    const existingPaths = new Set(cfg.projects.map((p) => p.path.toLowerCase()));
    let added = 0;
    for (const input of inputs) {
      if (!input?.path || existingPaths.has(String(input.path).toLowerCase())) continue;
      addProject(input);
      added++;
    }
    return { added, total: inputs.length };
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

  ipcMain.handle('projects:quickCommit', async (_e, args: { id: string; message: string; stageAll: boolean; push: boolean }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.id);
    if (!project) return { ok: false, error: 'Project not found' };
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(project.path);
      if (args.stageAll) {
        await git.add(['.']);
      }
      const status = await git.status();
      if (status.staged.length === 0) {
        return { ok: false, error: 'Nothing to commit (no staged changes)' };
      }
      const commit = await git.commit(args.message);
      let pushResult = null;
      if (args.push) {
        const { gitPush } = await import('./gitsafe');
        pushResult = await gitPush(project.path);
      }
      return {
        ok: true,
        commit: commit.commit,
        pushed: !!args.push,
        pushError: pushResult && !pushResult.ok ? pushResult.error ?? pushResult.stderr ?? null : null,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Commit failed' };
    }
  });

  ipcMain.handle('projects:gitDiff', async (_e, args: { id: string; staged: boolean }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.id);
    if (!project) return { ok: false, error: 'Project not found' };
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(project.path);
      const flags = args.staged ? ['--cached'] : [];
      const diff = await git.diff(flags);
      return { ok: true, diff: diff || '(no changes)', staged: args.staged };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Diff failed' };
    }
  });

  ipcMain.handle('projects:prList', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    if (!fs.existsSync(project.path)) return { ok: false, error: 'Path missing' };
    return new Promise((resolve) => {
      const proc = spawn('gh', ['pr', 'list', '--json', 'number,title,author,state,isDraft,mergeable,url,headRefName,updatedAt', '--limit', '20'], {
        cwd: project.path,
        windowsHide: true,
        shell: true,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({ ok: false, error: stderr.trim() || `gh exited with code ${code}` });
          return;
        }
        try {
          const prs = JSON.parse(stdout);
          resolve({ ok: true, prs });
        } catch {
          resolve({ ok: false, error: 'Failed to parse gh output' });
        }
      });
      proc.on('error', (err) => {
        resolve({ ok: false, error: err.message || 'gh CLI not found' });
      });
    });
  });

  ipcMain.handle('projects:gitStatusShort', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(project.path);
      const status = await git.status();
      const lines: string[] = [];
      for (const f of status.staged) lines.push(`A  ${f}`);
      for (const f of status.modified) lines.push(` M ${f}`);
      for (const f of status.deleted) lines.push(` D ${f}`);
      for (const f of status.renamed) lines.push(`R  ${f.to || f.from || f}`);
      for (const f of status.not_added) lines.push(`?? ${f}`);
      return { ok: true, output: lines.join('\n') || 'Working tree clean.', lineCount: lines.length };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Status failed' };
    }
  });

  ipcMain.handle('deploys:trigger', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found' };
    if (!project.deployProvider || project.deployProvider === 'none') {
      return { ok: false, error: 'No deploy provider configured' };
    }
    if (!project.deployId) return { ok: false, error: 'No deploy ID set' };
    const { vercelToken, renderToken } = cfg.settings;

    try {
      if (project.deployProvider === 'vercel') {
        if (!vercelToken) return { ok: false, error: 'Vercel token not set' };
        const axios = (await import('axios')).default;
        const res = await axios.post(
          'https://api.vercel.com/v13/deployments',
          {
            name: project.name,
            project: project.deployId,
            target: 'production',
            gitSource: { type: 'github', ref: 'main' },
          },
          { headers: { Authorization: `Bearer ${vercelToken}` }, timeout: 15000 }
        );
        return { ok: true, url: res.data?.url || null, provider: 'vercel' };
      }
      if (project.deployProvider === 'render') {
        if (!renderToken) return { ok: false, error: 'Render token not set' };
        const axios = (await import('axios')).default;
        const res = await axios.post(
          `https://api.render.com/v1/services/${project.deployId}/deploys`,
          {},
          { headers: { Authorization: `Bearer ${renderToken}` }, timeout: 15000 }
        );
        return { ok: true, id: res.data?.id || null, provider: 'render' };
      }
      return { ok: false, error: 'Unknown provider' };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Trigger failed';
      return { ok: false, error: msg };
    }
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

  // Sentry
  ipcMain.handle('sentry:validate', (_e, dsn: string) => sentrymod.validateDsn(dsn ?? ''));
  ipcMain.handle('sentry:resolve', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { orgSlug: null, projectSlug: null, projectIdNumeric: '', error: 'Project not found' };
    if (!project.sentryDsn) {
      return { orgSlug: null, projectSlug: null, projectIdNumeric: '', error: 'No DSN configured' };
    }
    return sentrymod.resolveSentryProject(project.sentryDsn, cfg.settings.sentryAuthToken, {
      orgSlug: project.sentryOrgSlug,
      projectSlug: project.sentryProjectSlug,
    });
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

  ipcMain.handle('env:syncCompare', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, provider: 'none', items: [], error: 'Project not found' };
    return envman.compareWithProvider(project, {
      vercelToken: cfg.settings.vercelToken,
      renderToken: cfg.settings.renderToken,
    });
  });

  ipcMain.handle('env:syncPush', async (_e, args: { id: string; keys: string[] }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.id);
    if (!project) return { ok: false, pushed: [], failed: [], error: 'Project not found' };
    return envman.pushToProvider(project, {
      vercelToken: cfg.settings.vercelToken,
      renderToken: cfg.settings.renderToken,
    }, args.keys || []);
  });

  // Backup / restore
  ipcMain.handle('backup:export', async (_e, opts: { includeCache?: boolean } = {}) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export DevDash backup',
      defaultPath: path.join(backup.defaultBackupDir(), backup.defaultBackupName()),
      filters: [{ name: 'DevDash Backup', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, error: 'Cancelled' };
    return backup.createBackup(res.filePath, opts.includeCache !== false);
  });

  ipcMain.handle('backup:import', async (_e, opts: { restoreCache?: boolean } = {}) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Restore DevDash backup',
      filters: [{ name: 'DevDash Backup', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths.length) return { ok: false, error: 'Cancelled' };
    return backup.restoreBackup(res.filePaths[0], { restoreCache: opts.restoreCache === true });
  });

  // Collaborators (GitHub)
  ipcMain.handle('collab:list', async (_e, projectId: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === projectId);
    if (!project) return { ok: false, collaborators: [], invitations: [], error: 'Project not found' };
    if (!project.githubUrl) return { ok: false, collaborators: [], invitations: [], error: 'Project has no GitHub URL.' };
    return collab.listCollaborators(cfg.settings.githubToken ?? '', project.githubUrl);
  });

  ipcMain.handle('collab:invite', async (_e, args: { projectId: string; username: string; permission: collab.CollabRole }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.projectId);
    if (!project?.githubUrl) return { ok: false, error: 'Project missing GitHub URL.' };
    return collab.inviteCollaborator(cfg.settings.githubToken ?? '', project.githubUrl, args.username, args.permission);
  });

  ipcMain.handle('collab:remove', async (_e, args: { projectId: string; username: string }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.projectId);
    if (!project?.githubUrl) return { ok: false, error: 'Project missing GitHub URL.' };
    return collab.removeCollaborator(cfg.settings.githubToken ?? '', project.githubUrl, args.username);
  });

  ipcMain.handle('collab:cancelInvite', async (_e, args: { projectId: string; invitationId: number }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.projectId);
    if (!project?.githubUrl) return { ok: false, error: 'Project missing GitHub URL.' };
    return collab.cancelInvitation(cfg.settings.githubToken ?? '', project.githubUrl, args.invitationId);
  });

  ipcMain.handle('collab:checkToken', async () => {
    const cfg = loadConfig();
    return collab.checkTokenScopes(cfg.settings.githubToken ?? '');
  });

  // Ports
  ipcMain.handle('ports:list', async () => {
    const res = await ports.listPorts();
    if (!res.ok) return res;
    const cfg = loadConfig();
    const managedPids = childprocs.getManagedPids();
    const projectByPort = new Map<number, { id: string; name: string }>();
    for (const p of cfg.projects) {
      const port = ports.detectProjectPort(p.path);
      if (port) projectByPort.set(port, { id: p.id, name: p.name });
    }
    for (const e of res.entries) {
      if (managedPids.has(e.pid)) {
        const pid = managedPids.get(e.pid)!;
        const proj = cfg.projects.find((p) => p.id === pid);
        e.projectId = pid;
        e.projectName = proj?.name;
        e.isDevDashManaged = true;
      } else if (projectByPort.has(e.port)) {
        const hint = projectByPort.get(e.port)!;
        e.projectId = hint.id;
        e.projectName = hint.name;
        e.isDevDashManaged = false;
      }
    }
    return res;
  });

  ipcMain.handle('ports:kill', async (_e, pid: number) => {
    return ports.killPid(pid);
  });

  ipcMain.handle('ports:killByProject', async (_e, projectId: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === projectId);
    if (!project) return { ok: false, error: 'Project not found' };
    const port = ports.detectProjectPort(project.path);
    if (!port) return { ok: false, error: 'Could not detect project dev port' };
    const list = await ports.listPorts();
    if (!list.ok) return { ok: false, error: list.error || 'Ports list failed' };
    const managedPids = childprocs.getManagedPids();
    const target = list.entries.find((e) => e.port === port && !managedPids.has(e.pid));
    if (!target) return { ok: false, error: `No foreign process on port ${port}` };
    const killed = await ports.killPid(target.pid);
    return { ...killed, port, processName: target.processName };
  });

  // Capacitor / APK builder
  ipcMain.handle('capacitor:detect', (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, isCapacitor: false, androidFolder: false, error: 'Project not found' };
    return capacitor.detectCapacitor(project.path);
  });

  ipcMain.handle('capacitor:detectJava', (_e, capVersion: string | undefined) => {
    return capacitor.detectJava(capVersion);
  });

  ipcMain.handle('capacitor:isBuilding', (_e, id: string) => {
    return capacitor.isBuilding(id);
  });

  ipcMain.handle('capacitor:buildApk', async (_e, args: { id: string; flavor: 'debug' | 'release'; runWebBuild: boolean; runSync: boolean; outputToDownloads?: boolean }) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === args.id);
    if (!project) return { ok: false, error: 'Project not found' };
    let outputDir: string | undefined;
    if (args.outputToDownloads) {
      try {
        outputDir = app.getPath('downloads');
      } catch {
        outputDir = undefined;
      }
    }
    return capacitor.buildApk({
      projectId: project.id,
      projectPath: project.path,
      projectName: project.name,
      flavor: args.flavor || 'debug',
      runWebBuild: args.runWebBuild !== false,
      runSync: args.runSync !== false,
      outputDir,
    });
  });

  ipcMain.handle('capacitor:openApkFolder', async (_e, apkPath: string) => {
    if (!apkPath) return { ok: false, error: 'No path' };
    try {
      shell.showItemInFolder(apkPath);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Build code (scaffold from templates)
  ipcMain.handle('scaffold:templates', () => scaffold.listTemplates());
  ipcMain.handle('scaffold:isActive', () => scaffold.isActive());
  ipcMain.handle('scaffold:pickParent', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose parent folder for the new project',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths.length) return { ok: false };
    return { ok: true, path: res.filePaths[0] };
  });
  ipcMain.handle('scaffold:run', async (_e, opts: scaffold.ScaffoldOptions) => {
    const result = await scaffold.scaffold(opts);
    if (result.ok && result.targetDir) {
      try {
        addProject({
          name: opts.displayName || opts.projectName,
          path: result.targetDir,
          githubUrl: result.githubUrl,
          liveUrl: undefined,
          deployProvider: 'none',
        });
      } catch (err) {
        // not fatal; just log
        console.error('auto-add scaffold project failed:', err);
      }
    }
    return result;
  });

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
  ipcMain.handle('deps:safeUpdate', async (_e, id: string) => {
    const cfg = loadConfig();
    const project = cfg.projects.find((p) => p.id === id);
    if (!project) return { ok: false, error: 'Project not found', steps: [] };
    return depcheck.safeUpdate(project.path);
  });

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

  // Automations (cron: auto-pull / auto-deploy)
  ipcMain.handle('automation:list', () => automations.listJobs());
  ipcMain.handle('automation:save', (_e, input: any) => automations.saveJob(input));
  ipcMain.handle('automation:delete', (_e, id: string) => {
    automations.deleteJob(id);
    return { ok: true };
  });
  ipcMain.handle('automation:toggle', (_e, args: { id: string; enabled: boolean }) => {
    return automations.setEnabled(args.id, args.enabled);
  });
  ipcMain.handle('automation:runNow', (_e, id: string) => automations.runNow(id));
  ipcMain.handle('automation:runs', (_e, args: { jobId: string; limit?: number }) =>
    automations.recentRuns(args.jobId, args.limit ?? 20)
  );
  ipcMain.handle('automation:validateCron', (_e, expr: string) => automations.validateCron(expr));

  // DB health check
  ipcMain.handle('dbhealth:list', () => dbhealth.listTargets());
  ipcMain.handle('dbhealth:save', (_e, input: any) => dbhealth.saveTarget(input));
  ipcMain.handle('dbhealth:delete', (_e, id: string) => {
    dbhealth.deleteTarget(id);
    return { ok: true };
  });
  ipcMain.handle('dbhealth:ping', (_e, id: string) => dbhealth.ping(id));
  ipcMain.handle('dbhealth:pingProject', (_e, projectId: string) =>
    dbhealth.pingAllForProject(projectId)
  );
  ipcMain.handle('dbhealth:autoDetect', (_e, projectId: string) =>
    dbhealth.autoDetectFromProject(projectId)
  );

  // Render metrics
  ipcMain.handle('metrics:render', (_e, args: { projectId: string; hours?: number }) =>
    fetchRenderMetrics(args.projectId, args.hours ?? 6)
  );

  // Vercel analytics
  ipcMain.handle('analytics:vercel', (_e, args: { projectId: string; days?: number }) =>
    fetchVercelAnalytics(args.projectId, args.days ?? 7)
  );

  ipcMain.handle('deploys:createNew', (_e, input: any) => createDeployment(input));

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

  // Ollama chat
  const activeStreams = new Map<string, AbortController>();

  ipcMain.handle('ollama:listModels', async () => {
    return ollamaListModels();
  });

  ipcMain.handle('chats:list', () => {
    return chatCache.listChats();
  });

  ipcMain.handle('chats:create', (_e, args: { id: string; title: string; model: string; systemPrompt: string }) => {
    chatCache.createChat(args.id, args.title || 'New chat', args.model, args.systemPrompt);
    return chatCache.getChat(args.id);
  });

  ipcMain.handle('chats:update', (_e, args: { id: string; patch: { title?: string; model?: string; systemPrompt?: string } }) => {
    chatCache.updateChat(args.id, args.patch);
    return chatCache.getChat(args.id);
  });

  ipcMain.handle('chats:delete', (_e, id: string) => {
    chatCache.deleteChat(id);
    return { ok: true };
  });

  ipcMain.handle('chats:messages', (_e, chatId: string) => {
    return chatCache.listMessages(chatId);
  });

  ipcMain.handle('chats:addMessage', (_e, args: { chatId: string; role: 'user' | 'assistant' | 'system'; content: string }) => {
    const id = chatCache.addMessage(args.chatId, args.role, args.content);
    return { id };
  });

  ipcMain.handle('ollama:chat', async (_e, args: {
    streamId: string;
    chatId: string;
    model: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    temperature?: number;
    systemPrompt?: string;
  }) => {
    const controller = new AbortController();
    activeStreams.set(args.streamId, controller);

    return new Promise<{ ok: boolean; content?: string; error?: string }>((resolve) => {
      let responseText = '';
      ollamaStreamChat({
        model: args.model,
        messages: args.messages,
        temperature: args.temperature,
        systemPrompt: args.systemPrompt,
        signal: controller.signal,
        onChunk: (chunk) => {
          responseText += chunk;
          mainWindow?.webContents.send('ollama:chunk', { streamId: args.streamId, chunk });
        },
        onDone: (full) => {
          activeStreams.delete(args.streamId);
          const finalText = full || responseText;
          if (finalText.trim()) {
            chatCache.addMessage(args.chatId, 'assistant', finalText);
          }
          mainWindow?.webContents.send('ollama:done', { streamId: args.streamId, content: finalText });
          resolve({ ok: true, content: finalText });
        },
        onError: (error) => {
          activeStreams.delete(args.streamId);
          mainWindow?.webContents.send('ollama:error', { streamId: args.streamId, error });
          resolve({ ok: false, error });
        },
      });
    });
  });

  ipcMain.handle('ollama:stop', (_e, streamId: string) => {
    const ctrl = activeStreams.get(streamId);
    if (ctrl) {
      ctrl.abort();
      activeStreams.delete(streamId);
      return { ok: true };
    }
    return { ok: false, error: 'No active stream' };
  });

  ipcMain.handle('config:export', async (_e, passphrase: string) => {
    if (!mainWindow) return { ok: false, error: 'No window' };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export DevDash config',
      defaultPath: `devdash-config-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };
    return exportConfig(result.filePath, passphrase);
  });

  ipcMain.handle('config:import', async (_e, passphrase: string) => {
    if (!mainWindow) return { ok: false, error: 'No window' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import DevDash config',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'cancelled' };
    return importConfig(result.filePaths[0], passphrase, true);
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
    try {
      automations.start(broadcast);
    } catch (err) {
      console.error('[automations] start failed:', err);
    }
  });
}

app.on('before-quit', () => {
  quittingForReal = true;
  stopPolling();
  scheduler.stopScheduler();
  automations.stop();
  timer.stopAll();
  childprocs.killAll();
  closeCacheDb();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
