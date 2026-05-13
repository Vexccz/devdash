import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { configPath, cacheDbPath, loadConfig, saveConfig, AppConfig } from './config';

export interface BackupResult {
  ok: boolean;
  path?: string;
  bytes?: number;
  error?: string;
}

export interface RestoreResult {
  ok: boolean;
  projectsRestored?: number;
  hadCache?: boolean;
  error?: string;
}

export interface BackupBundle {
  version: 1;
  exportedAt: number;
  appVersion: string;
  config: AppConfig;
  cacheBase64?: string;
  cacheBytes?: number;
}

export function createBackup(targetPath: string, includeCache = true): BackupResult {
  try {
    const cfg = loadConfig();
    let cacheBase64: string | undefined;
    let cacheBytes: number | undefined;
    if (includeCache) {
      const cp = cacheDbPath();
      if (fs.existsSync(cp)) {
        const buf = fs.readFileSync(cp);
        cacheBase64 = buf.toString('base64');
        cacheBytes = buf.length;
      }
    }
    const bundle: BackupBundle = {
      version: 1,
      exportedAt: Date.now(),
      appVersion: app?.getVersion?.() ?? '0.0.0',
      config: cfg,
      cacheBase64,
      cacheBytes,
    };
    const json = JSON.stringify(bundle, null, 2);
    fs.writeFileSync(targetPath, json, 'utf-8');
    return { ok: true, path: targetPath, bytes: Buffer.byteLength(json) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function restoreBackup(sourcePath: string, opts: { restoreCache?: boolean } = {}): RestoreResult {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { ok: false, error: 'Backup file missing' };
    }
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    let bundle: BackupBundle;
    try {
      bundle = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Invalid backup JSON' };
    }
    if (!bundle || bundle.version !== 1 || !bundle.config) {
      return { ok: false, error: 'Unsupported backup format' };
    }

    // Snapshot current config alongside before overwriting
    const cp = configPath();
    if (fs.existsSync(cp)) {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(cp, `${cp}.before-restore-${ts}.bak`);
      } catch {
        /* non-fatal */
      }
    }

    saveConfig(bundle.config);

    let restoredCache = false;
    if (opts.restoreCache && bundle.cacheBase64) {
      const cachePath = cacheDbPath();
      if (fs.existsSync(cachePath)) {
        try {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          fs.copyFileSync(cachePath, `${cachePath}.before-restore-${ts}.bak`);
        } catch {
          /* non-fatal */
        }
      }
      try {
        fs.writeFileSync(cachePath, Buffer.from(bundle.cacheBase64, 'base64'));
        restoredCache = true;
      } catch (err) {
        return {
          ok: false,
          error: `Cache restore failed: ${(err as Error).message}`,
        };
      }
    }

    return {
      ok: true,
      projectsRestored: bundle.config.projects?.length ?? 0,
      hadCache: restoredCache,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function defaultBackupName(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `devdash-backup-${ts}.json`;
}

export function defaultBackupDir(): string {
  return path.join(app?.getPath?.('downloads') ?? process.cwd());
}
