import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import axios from 'axios';
import {
  insertScreenshot,
  readScreenshots,
  deleteScreenshot,
  deleteScreenshotsBefore,
  ScreenshotRow,
  upsertErrorDaily,
  readErrorDaily,
} from './cache';
import { loadConfig, screenshotsDir } from './config';

export async function captureForProject(
  projectId: string,
  url: string
): Promise<ScreenshotRow | null> {
  if (!url) return null;
  const dir = path.join(screenshotsDir(), projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${projectId}-${Date.now()}.png`;
  const filePath = path.join(dir, filename);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await win.loadURL(url, { userAgent: 'DevDash/0.2.0 screenshot' });
    // Let client render
    await new Promise((r) => setTimeout(r, 3500));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(filePath, img.toPNG());
    const size = img.getSize();
    const id = insertScreenshot({
      projectId,
      filePath,
      url,
      capturedAt: Date.now(),
      width: size.width,
      height: size.height,
    });
    return {
      id,
      projectId,
      filePath,
      url,
      capturedAt: Date.now(),
      width: size.width,
      height: size.height,
    };
  } catch (err) {
    console.warn('[screenshots] capture failed', projectId, (err as Error).message);
    return null;
  } finally {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  }
}

export function list(projectId: string, limit = 120): ScreenshotRow[] {
  return readScreenshots(projectId, limit);
}

export function remove(id: number): boolean {
  const row = deleteScreenshot(id);
  if (row?.filePath && fs.existsSync(row.filePath)) {
    try {
      fs.unlinkSync(row.filePath);
    } catch {
      /* ignore */
    }
  }
  return !!row;
}

export function removeOlderThan(projectId: string, days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = deleteScreenshotsBefore(projectId, cutoff);
  for (const r of rows) {
    if (r.filePath && fs.existsSync(r.filePath)) {
      try {
        fs.unlinkSync(r.filePath);
      } catch {
        /* ignore */
      }
    }
  }
  return rows.length;
}

export async function captureAllEnabled(): Promise<ScreenshotRow[]> {
  const cfg = loadConfig();
  const out: ScreenshotRow[] = [];
  if (!cfg.settings.screenshotsEnabled) return out;
  for (const p of cfg.projects) {
    if (!p.liveUrl) continue;
    const row = await captureForProject(p.id, p.liveUrl);
    if (row) out.push(row);
  }
  return out;
}

// ---------- Error budget (local logs + Sentry optional) ----------

export async function gatherErrorsForProject(projectId: string): Promise<{ source: string; days: { day: string; count: number }[] }> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  if (!project) return { source: 'none', days: [] };

  // Try Sentry first if DSN + auth token present
  if (project.sentryDsn && cfg.settings.sentryAuthToken) {
    try {
      const days = await fetchSentryEvents(project.sentryDsn, cfg.settings.sentryAuthToken);
      for (const d of days) {
        upsertErrorDaily({ projectId, day: d.day, count: d.count, source: 'sentry' });
      }
      return { source: 'sentry', days };
    } catch (err) {
      console.warn('[errors] sentry fetch failed', (err as Error).message);
    }
  }

  // Fallback: local logs folder
  const logsDir = project.logsFolder ?? path.join(project.path, 'logs');
  if (fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory()) {
    const days = scanLogsForErrors(logsDir, 7);
    for (const d of days) {
      upsertErrorDaily({ projectId, day: d.day, count: d.count, source: 'logs' });
    }
    return { source: 'logs', days };
  }

  // Return whatever we have in cache, if any
  const cached = readErrorDaily(projectId, 7).map((r) => ({ day: r.day, count: r.count }));
  return { source: 'cache', days: cached };
}

function scanLogsForErrors(logsDir: string, days: number): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const ERR = /\bERROR\b/;

  const files: string[] = [];
  const stack = [logsDir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && /\.log$|\.txt$/i.test(e.name)) {
        try {
          const stat = fs.statSync(p);
          if (stat.mtimeMs >= cutoff) files.push(p);
        } catch {
          /* ignore */
        }
      }
    }
  }

  for (const f of files) {
    try {
      const stat = fs.statSync(f);
      const day = new Date(stat.mtimeMs).toISOString().slice(0, 10);
      const txt = fs.readFileSync(f, 'utf-8');
      let count = 0;
      for (const line of txt.split(/\r?\n/)) if (ERR.test(line)) count++;
      counts.set(day, (counts.get(day) ?? 0) + count);
    } catch {
      /* ignore */
    }
  }

  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

async function fetchSentryEvents(dsn: string, authToken: string): Promise<{ day: string; count: number }[]> {
  // Parse DSN to get project identifier; Sentry API needs org + project slug which we cannot derive purely from DSN.
  // We call the generic events-stats endpoint with token and trust token scoping for one project, if configured.
  // If that fails, return empty.
  try {
    const url = 'https://sentry.io/api/0/organizations/sentry/stats_v2/?field=sum(quantity)&interval=1d&statsPeriod=7d&category=error';
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${authToken}` },
      timeout: 15000,
    });
    const intervals: string[] = res.data?.intervals ?? [];
    const groups = res.data?.groups ?? [];
    const row = groups[0]?.series?.['sum(quantity)'] ?? [];
    const out: { day: string; count: number }[] = [];
    for (let i = 0; i < intervals.length; i++) {
      out.push({ day: intervals[i].slice(0, 10), count: Number(row[i] ?? 0) });
    }
    return out;
  } catch {
    return [];
  }
}

export { readErrorDaily };
