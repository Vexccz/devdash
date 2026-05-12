import cron from 'node-cron';
import { loadConfig } from './config';
import { runAllChecks } from './uptime';
import * as bundle from './bundlesize';
import * as deps from './depcheck';
import * as shots from './screenshots';

type BroadcastFn = (channel: string, payload: unknown) => void;

interface ScheduledJob {
  name: string;
  task: cron.ScheduledTask | null;
  interval: NodeJS.Timeout | null;
  lastRunAt: number | null;
  lastError: string | null;
}

const jobs = new Map<string, ScheduledJob>();
let broadcast: BroadcastFn | null = null;

function register(name: string, job: Omit<ScheduledJob, 'name'>) {
  jobs.set(name, { name, ...job });
}

function setErr(name: string, err: unknown) {
  const j = jobs.get(name);
  if (!j) return;
  j.lastError = (err as Error).message;
}
function markRun(name: string) {
  const j = jobs.get(name);
  if (!j) return;
  j.lastRunAt = Date.now();
  j.lastError = null;
}

async function jobUptime() {
  try {
    const results = await runAllChecks();
    markRun('uptime');
    broadcast?.('uptime:update', { count: results.length });
    for (const r of results) {
      if (r.previousOk === true && r.currentOk === false) {
        broadcast?.('deploys:toast', {
          type: 'error',
          title: `${r.projectId} went down (${r.row.status || 'no response'})`,
          projectId: r.projectId,
        });
      }
    }
  } catch (err) {
    setErr('uptime', err);
  }
}

async function jobBundle() {
  try {
    const cfg = loadConfig();
    for (const p of cfg.projects) {
      const sample = bundle.recordIfChanged(p.id, p.path);
      if (sample) broadcast?.('bundle:update', sample);
    }
    markRun('bundle');
  } catch (err) {
    setErr('bundle', err);
  }
}

async function jobDeps() {
  try {
    const cfg = loadConfig();
    for (const p of cfg.projects) {
      const out = await deps.runForProject(p.id, p.path);
      if (out) broadcast?.('deps:update', { projectId: p.id, majorCount: out.majorCount });
    }
    markRun('deps');
  } catch (err) {
    setErr('deps', err);
  }
}

async function jobScreenshots() {
  try {
    const rows = await shots.captureAllEnabled();
    markRun('screenshots');
    if (rows.length) broadcast?.('screenshots:update', { count: rows.length });
  } catch (err) {
    setErr('screenshots', err);
  }
}

export function startScheduler(b: BroadcastFn): void {
  broadcast = b;
  stopScheduler();
  const cfg = loadConfig();

  // Uptime: every N minutes
  if (cfg.settings.uptimeEnabled !== false) {
    const min = Math.max(1, cfg.settings.uptimeIntervalMinutes || 5);
    const handle = setInterval(() => void jobUptime(), min * 60 * 1000);
    register('uptime', { task: null, interval: handle, lastRunAt: null, lastError: null });
    console.log(`[scheduler] uptime job started (every ${min}m)`);
    // run once on start
    setTimeout(() => void jobUptime(), 5000);
  }

  // Bundle watch: every 10min
  if (cfg.settings.bundleWatchEnabled !== false) {
    const handle = setInterval(() => void jobBundle(), 10 * 60 * 1000);
    register('bundle', { task: null, interval: handle, lastRunAt: null, lastError: null });
    console.log(`[scheduler] bundle job started (every 10m)`);
    setTimeout(() => void jobBundle(), 8000);
  }

  // Deps check: weekly on Monday 09:00
  if (cfg.settings.depsCheckEnabled !== false) {
    const task = cron.schedule('0 9 * * 1', () => void jobDeps(), { timezone: 'Asia/Kuala_Lumpur' });
    task.start();
    register('deps', { task, interval: null, lastRunAt: null, lastError: null });
    console.log(`[scheduler] deps job started (weekly Mon 09:00)`);
  }

  // Screenshots: daily at configured hour
  if (cfg.settings.screenshotsEnabled) {
    const hour = Math.max(0, Math.min(23, cfg.settings.screenshotHour ?? 9));
    const task = cron.schedule(`0 ${hour} * * *`, () => void jobScreenshots(), {
      timezone: 'Asia/Kuala_Lumpur',
    });
    task.start();
    register('screenshots', { task, interval: null, lastRunAt: null, lastError: null });
    console.log(`[scheduler] screenshots job started (daily ${hour}:00)`);
  }
}

export function stopScheduler(): void {
  for (const [, j] of jobs) {
    if (j.interval) clearInterval(j.interval);
    if (j.task) {
      try {
        j.task.stop();
      } catch {
        /* ignore */
      }
    }
  }
  jobs.clear();
}

export function status(): Array<{
  name: string;
  lastRunAt: number | null;
  lastError: string | null;
}> {
  return Array.from(jobs.values()).map((j) => ({
    name: j.name,
    lastRunAt: j.lastRunAt,
    lastError: j.lastError,
  }));
}

export async function runNow(name: string): Promise<void> {
  switch (name) {
    case 'uptime':
      return jobUptime();
    case 'bundle':
      return jobBundle();
    case 'deps':
      return jobDeps();
    case 'screenshots':
      return jobScreenshots();
    default:
      return;
  }
}
