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
  `);
}

function getDb(): Database.Database {
  if (!db) throw new Error('cache db not initialised');
  return db;
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
    .prepare(
      `SELECT * FROM deploys ORDER BY createdAt DESC LIMIT ?`
    )
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
