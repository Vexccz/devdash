import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
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
import { getErrorStats, resolveSentryProject } from './sentry';

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
      const resolved = await resolveSentryProject(project.sentryDsn, cfg.settings.sentryAuthToken, {
        orgSlug: project.sentryOrgSlug,
        projectSlug: project.sentryProjectSlug,
      });
      if (resolved.orgSlug && resolved.projectSlug) {
        const days = await getErrorStats(
          cfg.settings.sentryAuthToken,
          resolved.orgSlug,
          resolved.projectSlug
        );
        for (const d of days) {
          upsertErrorDaily({ projectId, day: d.day, count: d.count, source: 'sentry' });
        }
        return { source: 'sentry', days };
      }
      if (resolved.error) {
        console.warn('[errors] sentry resolve failed:', resolved.error);
      }
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

export { readErrorDaily };
