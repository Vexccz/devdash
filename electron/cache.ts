import Database from 'better-sqlite3';
import { cacheDbPath } from './config';
import type { DeployItem } from './deploys';

let db: Database.Database | null = null;

export function initCacheDb(): void {
  const p = cacheDbPath();
  db = new Database(p);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS deploys (
      id TEXT NOT NULL,
      projectId TEXT NOT NULL,
      projectName TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      rawStatus TEXT NOT NULL,
      target TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      finishedAt INTEGER,
      durationMs INTEGER,
      commitSha TEXT,
      commitMessage TEXT,
      commitAuthor TEXT,
      url TEXT,
      dashboardUrl TEXT,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (provider, id)
    );
    CREATE INDEX IF NOT EXISTS idx_deploys_project ON deploys(projectId);
    CREATE INDEX IF NOT EXISTS idx_deploys_created ON deploys(createdAt DESC);

    CREATE TABLE IF NOT EXISTS uptime_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER NOT NULL,
      ok INTEGER NOT NULL,
      latencyMs INTEGER NOT NULL,
      checkedAt INTEGER NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_uptime_project ON uptime_checks(projectId, checkedAt DESC);

    CREATE TABLE IF NOT EXISTS time_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      durationMs INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_time_project ON time_sessions(projectId, startedAt DESC);

    CREATE TABLE IF NOT EXISTS bundle_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      fileCount INTEGER NOT NULL,
      recordedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bundle_project ON bundle_sizes(projectId, recordedAt DESC);

    CREATE TABLE IF NOT EXISTS dep_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      runAt INTEGER NOT NULL,
      majorCount INTEGER NOT NULL,
      minorCount INTEGER NOT NULL,
      patchCount INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dep_project ON dep_reports(projectId, runAt DESC);

    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      filePath TEXT NOT NULL,
      url TEXT NOT NULL,
      capturedAt INTEGER NOT NULL,
      width INTEGER,
      height INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_screenshot_project ON screenshots(projectId, capturedAt DESC);

    CREATE TABLE IF NOT EXISTS errors_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL,
      source TEXT NOT NULL,
      UNIQUE (projectId, day, source)
    );
    CREATE INDEX IF NOT EXISTS idx_errors_project ON errors_daily(projectId, day DESC);
  `);
}

function getDb(): Database.Database {
  if (!db) throw new Error('cache db not initialised');
  return db;
}

export function raw(): Database.Database {
  return getDb();
}

export interface CachedDeployRow extends DeployItem {
  updatedAt: number;
}

export function upsertDeploys(items: DeployItem[]): void {
  if (!items.length) return;
  const stmt = getDb().prepare(`
    INSERT INTO deploys (id, projectId, projectName, provider, status, rawStatus, target, createdAt, finishedAt, durationMs, commitSha, commitMessage, commitAuthor, url, dashboardUrl, updatedAt)
    VALUES (@id, @projectId, @projectName, @provider, @status, @rawStatus, @target, @createdAt, @finishedAt, @durationMs, @commitSha, @commitMessage, @commitAuthor, @url, @dashboardUrl, @updatedAt)
    ON CONFLICT(provider, id) DO UPDATE SET
      projectName = excluded.projectName,
      status = excluded.status,
      rawStatus = excluded.rawStatus,
      target = excluded.target,
      finishedAt = excluded.finishedAt,
      durationMs = excluded.durationMs,
      commitSha = excluded.commitSha,
      commitMessage = excluded.commitMessage,
      commitAuthor = excluded.commitAuthor,
      url = excluded.url,
      dashboardUrl = excluded.dashboardUrl,
      updatedAt = excluded.updatedAt
  `);
  const tx = getDb().transaction((rows: DeployItem[]) => {
    const now = Date.now();
    for (const r of rows) {
      stmt.run({
        id: r.id,
        projectId: r.projectId,
        projectName: r.projectName,
        provider: r.provider,
        status: r.status,
        rawStatus: r.rawStatus,
        target: r.target,
        createdAt: r.createdAt,
        finishedAt: r.finishedAt ?? null,
        durationMs: r.durationMs ?? null,
        commitSha: r.commitSha ?? null,
        commitMessage: r.commitMessage ?? null,
        commitAuthor: r.commitAuthor ?? null,
        url: r.url ?? null,
        dashboardUrl: r.dashboardUrl ?? null,
        updatedAt: now,
      });
    }
  });
  tx(items);
}

export function readAllDeploys(limit = 100): CachedDeployRow[] {
  return getDb()
    .prepare(`SELECT * FROM deploys ORDER BY createdAt DESC LIMIT ?`)
    .all(limit) as CachedDeployRow[];
}

export function getDeployStatusById(provider: string, id: string): string | null {
  const row = getDb()
    .prepare(`SELECT status FROM deploys WHERE provider = ? AND id = ?`)
    .get(provider, id) as { status: string } | undefined;
  return row?.status ?? null;
}

export function closeCacheDb(): void {
  db?.close();
  db = null;
}

// ---------- Uptime ----------
export interface UptimeRow {
  id: number;
  projectId: string;
  url: string;
  status: number;
  ok: number;
  latencyMs: number;
  checkedAt: number;
  error: string | null;
}

export function insertUptime(row: Omit<UptimeRow, 'id'>): void {
  getDb()
    .prepare(
      `INSERT INTO uptime_checks (projectId, url, status, ok, latencyMs, checkedAt, error)
       VALUES (@projectId, @url, @status, @ok, @latencyMs, @checkedAt, @error)`
    )
    .run({
      projectId: row.projectId,
      url: row.url,
      status: row.status,
      ok: row.ok,
      latencyMs: row.latencyMs,
      checkedAt: row.checkedAt,
      error: row.error ?? null,
    });
}

export function readUptime(projectId: string, sinceMs: number): UptimeRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM uptime_checks WHERE projectId = ? AND checkedAt >= ? ORDER BY checkedAt ASC`
    )
    .all(projectId, sinceMs) as UptimeRow[];
}

export function readLatestUptime(projectId: string): UptimeRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT * FROM uptime_checks WHERE projectId = ? ORDER BY checkedAt DESC LIMIT 1`
      )
      .get(projectId) as UptimeRow | undefined) ?? null
  );
}

export function pruneUptime(olderThanMs: number): number {
  const r = getDb()
    .prepare(`DELETE FROM uptime_checks WHERE checkedAt < ?`)
    .run(olderThanMs);
  return r.changes;
}

// ---------- Time sessions ----------
export interface TimeSessionRow {
  id: number;
  projectId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
}

export function startTimeSession(projectId: string, startedAt: number): number {
  const r = getDb()
    .prepare(`INSERT INTO time_sessions (projectId, startedAt) VALUES (?, ?)`)
    .run(projectId, startedAt);
  return Number(r.lastInsertRowid);
}

export function endTimeSession(id: number, endedAt: number): void {
  getDb()
    .prepare(
      `UPDATE time_sessions SET endedAt = ?, durationMs = ? - startedAt WHERE id = ? AND endedAt IS NULL`
    )
    .run(endedAt, endedAt, id);
}

export function readTimeSessions(projectId: string | null, sinceMs: number): TimeSessionRow[] {
  if (projectId) {
    return getDb()
      .prepare(
        `SELECT * FROM time_sessions WHERE projectId = ? AND startedAt >= ? ORDER BY startedAt DESC`
      )
      .all(projectId, sinceMs) as TimeSessionRow[];
  }
  return getDb()
    .prepare(`SELECT * FROM time_sessions WHERE startedAt >= ? ORDER BY startedAt DESC`)
    .all(sinceMs) as TimeSessionRow[];
}

// ---------- Bundle sizes ----------
export interface BundleSizeRow {
  id: number;
  projectId: string;
  sizeBytes: number;
  fileCount: number;
  recordedAt: number;
}

export function insertBundleSize(row: Omit<BundleSizeRow, 'id'>): void {
  getDb()
    .prepare(
      `INSERT INTO bundle_sizes (projectId, sizeBytes, fileCount, recordedAt) VALUES (?, ?, ?, ?)`
    )
    .run(row.projectId, row.sizeBytes, row.fileCount, row.recordedAt);
}

export function readBundleSizes(projectId: string, limit = 30): BundleSizeRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM bundle_sizes WHERE projectId = ? ORDER BY recordedAt DESC LIMIT ?`
    )
    .all(projectId, limit) as BundleSizeRow[];
}

// ---------- Dep reports ----------
export interface DepReportRow {
  id: number;
  projectId: string;
  runAt: number;
  majorCount: number;
  minorCount: number;
  patchCount: number;
  payload: string;
}

export function insertDepReport(row: Omit<DepReportRow, 'id'>): void {
  getDb()
    .prepare(
      `INSERT INTO dep_reports (projectId, runAt, majorCount, minorCount, patchCount, payload)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.projectId,
      row.runAt,
      row.majorCount,
      row.minorCount,
      row.patchCount,
      row.payload
    );
}

export function readLatestDepReport(projectId: string): DepReportRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT * FROM dep_reports WHERE projectId = ? ORDER BY runAt DESC LIMIT 1`
      )
      .get(projectId) as DepReportRow | undefined) ?? null
  );
}

// ---------- Screenshots ----------
export interface ScreenshotRow {
  id: number;
  projectId: string;
  filePath: string;
  url: string;
  capturedAt: number;
  width: number | null;
  height: number | null;
}

export function insertScreenshot(row: Omit<ScreenshotRow, 'id'>): number {
  const r = getDb()
    .prepare(
      `INSERT INTO screenshots (projectId, filePath, url, capturedAt, width, height)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.projectId,
      row.filePath,
      row.url,
      row.capturedAt,
      row.width ?? null,
      row.height ?? null
    );
  return Number(r.lastInsertRowid);
}

export function readScreenshots(projectId: string, limit = 120): ScreenshotRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM screenshots WHERE projectId = ? ORDER BY capturedAt DESC LIMIT ?`
    )
    .all(projectId, limit) as ScreenshotRow[];
}

export function deleteScreenshot(id: number): ScreenshotRow | null {
  const row =
    (getDb()
      .prepare(`SELECT * FROM screenshots WHERE id = ?`)
      .get(id) as ScreenshotRow | undefined) ?? null;
  if (row) {
    getDb().prepare(`DELETE FROM screenshots WHERE id = ?`).run(id);
  }
  return row;
}

export function deleteScreenshotsBefore(projectId: string, beforeMs: number): ScreenshotRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM screenshots WHERE projectId = ? AND capturedAt < ?`)
    .all(projectId, beforeMs) as ScreenshotRow[];
  getDb()
    .prepare(`DELETE FROM screenshots WHERE projectId = ? AND capturedAt < ?`)
    .run(projectId, beforeMs);
  return rows;
}

// ---------- Errors daily ----------
export interface ErrorDailyRow {
  id: number;
  projectId: string;
  day: string;
  count: number;
  source: string;
}

export function upsertErrorDaily(row: Omit<ErrorDailyRow, 'id'>): void {
  getDb()
    .prepare(
      `INSERT INTO errors_daily (projectId, day, count, source)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(projectId, day, source) DO UPDATE SET count = excluded.count`
    )
    .run(row.projectId, row.day, row.count, row.source);
}

export function readErrorDaily(projectId: string, days: number): ErrorDailyRow[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return getDb()
    .prepare(
      `SELECT * FROM errors_daily WHERE projectId = ? AND day >= ? ORDER BY day ASC`
    )
    .all(projectId, cutoff) as ErrorDailyRow[];
}
