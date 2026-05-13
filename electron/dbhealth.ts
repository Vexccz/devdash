import { loadConfig, saveConfig } from './config';

export type DbKind = 'mongodb' | 'postgres';

export interface DbTarget {
  id: string;
  projectId: string;
  label: string;
  kind: DbKind;
  url: string; // connection string
  createdAt: number;
}

export interface DbHealthResult {
  id: string;
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
  checkedAt: number;
}

function list(): DbTarget[] {
  const cfg = loadConfig() as any;
  return (cfg.dbTargets as DbTarget[] | undefined) ?? [];
}

function persist(targets: DbTarget[]): void {
  const cfg = loadConfig() as any;
  cfg.dbTargets = targets;
  saveConfig(cfg);
}

export function listTargets(): DbTarget[] {
  return list();
}

export function saveTarget(input: Omit<DbTarget, 'createdAt'> & { id?: string }): DbTarget {
  const targets = list();
  const id = input.id || `db-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = targets.find((t) => t.id === id);
  const next: DbTarget = existing
    ? { ...existing, ...input, id }
    : { id, projectId: input.projectId, label: input.label, kind: input.kind, url: input.url, createdAt: Date.now() };
  const nextList = existing ? targets.map((t) => (t.id === id ? next : t)) : [...targets, next];
  persist(nextList);
  return next;
}

export function deleteTarget(id: string): void {
  persist(list().filter((t) => t.id !== id));
}

export async function ping(id: string): Promise<DbHealthResult> {
  const target = list().find((t) => t.id === id);
  const checkedAt = Date.now();
  if (!target) return { id, ok: false, latencyMs: 0, error: 'Target not found', checkedAt };

  const started = Date.now();
  try {
    if (target.kind === 'mongodb') {
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(target.url, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      try {
        await client.connect();
        const admin = client.db().admin();
        const info = await admin.serverStatus();
        const latencyMs = Date.now() - started;
        return { id, ok: true, latencyMs, version: info.version || undefined, checkedAt };
      } finally {
        try {
          await client.close(true);
        } catch {
          /* ignore */
        }
      }
    }

    if (target.kind === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: target.url, connectionTimeoutMillis: 5000 });
      try {
        await client.connect();
        const res = await client.query('SELECT version() AS version');
        const latencyMs = Date.now() - started;
        const version = res.rows?.[0]?.version as string | undefined;
        return { id, ok: true, latencyMs, version, checkedAt };
      } finally {
        try {
          await client.end();
        } catch {
          /* ignore */
        }
      }
    }

    return { id, ok: false, latencyMs: Date.now() - started, error: 'Unknown kind', checkedAt };
  } catch (err: any) {
    return {
      id,
      ok: false,
      latencyMs: Date.now() - started,
      error: err?.message || 'Connection failed',
      checkedAt,
    };
  }
}

export async function pingAllForProject(projectId: string): Promise<DbHealthResult[]> {
  const targets = list().filter((t) => t.projectId === projectId);
  return Promise.all(targets.map((t) => ping(t.id)));
}
