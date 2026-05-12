import fs from 'node:fs';
import path from 'node:path';
import { insertBundleSize, readBundleSizes } from './cache';

function dirSize(dir: string): { sizeBytes: number; fileCount: number; mtime: number } {
  let size = 0;
  let count = 0;
  let mtime = 0;
  const stack: string[] = [dir];
  while (stack.length) {
    const p = stack.pop()!;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(p);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      let entries: string[];
      try {
        entries = fs.readdirSync(p);
      } catch {
        continue;
      }
      for (const e of entries) stack.push(path.join(p, e));
    } else if (stat.isFile()) {
      size += stat.size;
      count += 1;
      if (stat.mtimeMs > mtime) mtime = stat.mtimeMs;
    }
  }
  return { sizeBytes: size, fileCount: count, mtime };
}

const lastMtime = new Map<string, number>();

export interface BundleSample {
  projectId: string;
  sizeBytes: number;
  fileCount: number;
  recordedAt: number;
  deltaBytes: number | null;
  deltaPct: number | null;
  sevenDayAvg: number | null;
  growthPct: number | null;
}

export function recordIfChanged(projectId: string, projectPath: string, force = false): BundleSample | null {
  const distDir = path.join(projectPath, 'dist');
  const releaseDir = path.join(projectPath, 'release');
  const target = fs.existsSync(distDir) ? distDir : fs.existsSync(releaseDir) ? releaseDir : null;
  if (!target) return null;
  const cur = dirSize(target);
  if (cur.fileCount === 0) return null;
  const last = lastMtime.get(projectId) ?? 0;
  if (!force && cur.mtime <= last) return null;
  lastMtime.set(projectId, cur.mtime);

  const history = readBundleSizes(projectId, 10);
  const prev = history[0]?.sizeBytes ?? null;
  const deltaBytes = prev !== null ? cur.sizeBytes - prev : null;
  const deltaPct = prev ? ((cur.sizeBytes - prev) / prev) * 100 : null;

  const weekHistory = readBundleSizes(projectId, 14);
  const weekAvg =
    weekHistory.length > 0
      ? weekHistory.reduce((a, r) => a + r.sizeBytes, 0) / weekHistory.length
      : null;
  const growthPct = weekAvg ? ((cur.sizeBytes - weekAvg) / weekAvg) * 100 : null;

  insertBundleSize({
    projectId,
    sizeBytes: cur.sizeBytes,
    fileCount: cur.fileCount,
    recordedAt: Date.now(),
  });

  return {
    projectId,
    sizeBytes: cur.sizeBytes,
    fileCount: cur.fileCount,
    recordedAt: Date.now(),
    deltaBytes,
    deltaPct,
    sevenDayAvg: weekAvg ? Math.round(weekAvg) : null,
    growthPct: growthPct ? Math.round(growthPct * 10) / 10 : null,
  };
}

export function history(projectId: string, limit = 30) {
  return readBundleSizes(projectId, limit);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
