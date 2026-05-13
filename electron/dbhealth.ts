import { loadConfig, saveConfig } from './config';
import { scanProject, readFileDetail } from './envman';
import path from 'node:path';
import fs from 'node:fs';

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

export function saveTarget(input: Omit<DbTarget, 'id' | 'createdAt'> & { id?: string }): DbTarget {
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

const MONGO_KEYS = ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL', 'MONGODB_URL', 'DATABASE_URL'];
const POSTGRES_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'PG_URL', 'PG_CONNECTION_STRING'];

function classifyUrl(value: string): DbKind | null {
  if (!value) return null;
  const v = value.trim();
  if (/^mongodb(\+srv)?:\/\//i.test(v)) return 'mongodb';
  if (/^postgres(ql)?:\/\//i.test(v)) return 'postgres';
  return null;
}

export interface AutoDetectResult {
  added: DbTarget[];
  skipped: Array<{ key: string; reason: string }>;
  scanned: string[];
}

export function autoDetectFromProject(projectId: string): AutoDetectResult {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  const out: AutoDetectResult = { added: [], skipped: [], scanned: [] };
  if (!project) return out;

  const existingUrls = new Set(list().filter((t) => t.projectId === projectId).map((t) => t.url));

  // Scan root + common subdirs (frontend/backend/server/api)
  const subdirs = ['', 'backend', 'server', 'api', 'frontend'];
  for (const sub of subdirs) {
    const dir = sub ? path.join(project.path, sub) : project.path;
    if (!fs.existsSync(dir)) continue;

    const summaries = scanProject(dir);
    for (const s of summaries) {
      if (!s.exists) continue;
      out.scanned.push(s.path);
      const detail = readFileDetail(dir, s.file);

      const seenInThisFile = new Set<string>();
      for (const entry of detail.entries) {
        const key = entry.key.toUpperCase();
        const value = entry.value;
        if (!value) continue;

        const kind = classifyUrl(value);
        if (!kind) continue;

        // Avoid same URL twice (e.g. .env + .env.local with same value)
        if (seenInThisFile.has(value)) continue;
        if (existingUrls.has(value)) {
          out.skipped.push({ key, reason: 'already configured' });
          continue;
        }
        seenInThisFile.add(value);
        existingUrls.add(value);

        const label = sub ? `${kind === 'mongodb' ? 'Mongo' : 'PG'} (${sub}/${s.file})` : `${kind === 'mongodb' ? 'Mongo' : 'PG'} (${s.file})`;
        const target = saveTarget({
          projectId,
          kind,
          label,
          url: value,
        });
        out.added.push(target);
      }
    }
  }

  return out;
}
