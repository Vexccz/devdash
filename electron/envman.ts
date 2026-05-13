import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import type { ProjectConfig } from './config';

const ENV_FILENAMES = ['.env', '.env.local', '.env.production', '.env.development', '.env.example'];

export interface EnvFileSummary {
  file: string;
  path: string;
  exists: boolean;
  varCount: number;
  missingKeys: string[];
}

export interface EnvEntry {
  key: string;
  value: string;
  lineComment?: string;
}

export interface EnvFileDetail {
  file: string;
  path: string;
  exists: boolean;
  entries: EnvEntry[];
}

export function parseEnv(text: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    // Strip wrapping quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key: m[1], value });
  }
  return entries;
}

export function serializeEnv(entries: EnvEntry[]): string {
  return (
    entries
      .map((e) => {
        const needsQuote = /\s|#|"/.test(e.value) || e.value.length === 0;
        const v = needsQuote ? `"${e.value.replace(/"/g, '\\"')}"` : e.value;
        return `${e.key}=${v}`;
      })
      .join('\n') + '\n'
  );
}

export function scanProject(projectPath: string): EnvFileSummary[] {
  const results: EnvFileSummary[] = [];
  if (!fs.existsSync(projectPath)) return results;
  let exampleKeys: Set<string> = new Set();
  const examplePath = path.join(projectPath, '.env.example');
  if (fs.existsSync(examplePath)) {
    try {
      exampleKeys = new Set(parseEnv(fs.readFileSync(examplePath, 'utf-8')).map((e) => e.key));
    } catch {
      /* ignore */
    }
  }
  for (const f of ENV_FILENAMES) {
    const p = path.join(projectPath, f);
    const exists = fs.existsSync(p);
    let entries: EnvEntry[] = [];
    if (exists) {
      try {
        entries = parseEnv(fs.readFileSync(p, 'utf-8'));
      } catch {
        entries = [];
      }
    }
    const haveKeys = new Set(entries.map((e) => e.key));
    const missing: string[] = [];
    if (exampleKeys.size && f !== '.env.example') {
      for (const k of exampleKeys) if (!haveKeys.has(k)) missing.push(k);
    }
    results.push({
      file: f,
      path: p,
      exists,
      varCount: entries.length,
      missingKeys: missing,
    });
  }
  return results;
}

export function readFileDetail(projectPath: string, fileName: string): EnvFileDetail {
  const file = ENV_FILENAMES.includes(fileName) ? fileName : '.env';
  const p = path.join(projectPath, file);
  if (!fs.existsSync(p)) return { file, path: p, exists: false, entries: [] };
  try {
    return { file, path: p, exists: true, entries: parseEnv(fs.readFileSync(p, 'utf-8')) };
  } catch (err) {
    return { file, path: p, exists: false, entries: [] };
  }
}

export function writeFileDetail(projectPath: string, fileName: string, entries: EnvEntry[]): {
  ok: boolean;
  error?: string;
  path?: string;
} {
  if (!ENV_FILENAMES.includes(fileName)) {
    return { ok: false, error: 'Unsupported env filename' };
  }
  if (!fs.existsSync(projectPath)) return { ok: false, error: 'Project path missing' };
  const p = path.join(projectPath, fileName);
  try {
    fs.writeFileSync(p, serializeEnv(entries), 'utf-8');
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function cloneEnv(
  sourcePath: string,
  sourceFile: string,
  targetPath: string,
  targetFile: string,
  overwrite: boolean
): { ok: boolean; error?: string; mergedCount?: number } {
  if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
    return { ok: false, error: 'Source or target path missing' };
  }
  const sourceDetail = readFileDetail(sourcePath, sourceFile);
  if (!sourceDetail.exists) return { ok: false, error: 'Source file not found' };
  const targetDetail = readFileDetail(targetPath, targetFile);
  const existingMap = new Map<string, EnvEntry>();
  for (const e of targetDetail.entries) existingMap.set(e.key, e);
  let merged = 0;
  for (const e of sourceDetail.entries) {
    if (!existingMap.has(e.key) || overwrite) {
      existingMap.set(e.key, e);
      merged++;
    }
  }
  const out = [...existingMap.values()];
  const write = writeFileDetail(targetPath, targetFile, out);
  if (!write.ok) return { ok: false, error: write.error };
  return { ok: true, mergedCount: merged };
}

export function listSupportedFiles(): string[] {
  return [...ENV_FILENAMES];
}

export interface SyncCompareItem {
  key: string;
  localValue: string | null;
  remoteValue: string | null;
  status: 'only-local' | 'only-remote' | 'match' | 'differ';
}

export interface SyncCompareResult {
  ok: boolean;
  provider: 'vercel' | 'render' | 'none';
  items: SyncCompareItem[];
  error?: string;
}

export interface SyncPushResult {
  ok: boolean;
  pushed: string[];
  failed: Array<{ key: string; error: string }>;
  error?: string;
}

async function fetchVercelEnv(token: string, projectId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env?decrypt=true`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
  const envs = (res.data?.envs ?? []) as any[];
  for (const e of envs) {
    const target: string[] = Array.isArray(e.target) ? e.target : [];
    if (target.includes('production') || target.length === 0) {
      out.set(String(e.key), typeof e.value === 'string' ? e.value : '');
    }
  }
  return out;
}

async function fetchRenderEnv(token: string, serviceId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const url = `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/env-vars`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000,
  });
  const items = (res.data ?? []) as any[];
  for (const entry of items) {
    const v = entry.envVar ?? entry;
    if (v?.key) out.set(String(v.key), String(v.value ?? ''));
  }
  return out;
}

export async function compareWithProvider(
  project: ProjectConfig,
  tokens: { vercelToken: string; renderToken: string }
): Promise<SyncCompareResult> {
  if (project.deployProvider !== 'vercel' && project.deployProvider !== 'render') {
    return { ok: false, provider: 'none', items: [], error: 'Project has no deploy provider configured.' };
  }
  if (!project.deployId) {
    return { ok: false, provider: project.deployProvider, items: [], error: 'No deployId on project.' };
  }
  const token = project.deployProvider === 'vercel' ? tokens.vercelToken : tokens.renderToken;
  if (!token) {
    return { ok: false, provider: project.deployProvider, items: [], error: `${project.deployProvider} token missing in Settings.` };
  }

  // Prefer .env.production, fall back to .env, fall back to .env.example
  const candidates = ['.env.production', '.env', '.env.example'];
  let local: EnvEntry[] = [];
  for (const f of candidates) {
    const p = path.join(project.path, f);
    if (fs.existsSync(p)) {
      try {
        local = parseEnv(fs.readFileSync(p, 'utf-8'));
        break;
      } catch {
        /* ignore */
      }
    }
  }
  const localMap = new Map<string, string>();
  for (const e of local) localMap.set(e.key, e.value);

  let remote: Map<string, string>;
  try {
    remote =
      project.deployProvider === 'vercel'
        ? await fetchVercelEnv(token, project.deployId)
        : await fetchRenderEnv(token, project.deployId);
  } catch (err) {
    return {
      ok: false,
      provider: project.deployProvider,
      items: [],
      error: `Fetch failed: ${(err as Error).message}`,
    };
  }

  const keys = new Set<string>([...localMap.keys(), ...remote.keys()]);
  const items: SyncCompareItem[] = [];
  for (const k of keys) {
    const lv = localMap.has(k) ? localMap.get(k)! : null;
    const rv = remote.has(k) ? remote.get(k)! : null;
    let status: SyncCompareItem['status'];
    if (lv === null) status = 'only-remote';
    else if (rv === null) status = 'only-local';
    else if (lv === rv) status = 'match';
    else status = 'differ';
    items.push({ key: k, localValue: lv, remoteValue: rv, status });
  }
  items.sort((a, b) => {
    const order = { 'only-local': 0, differ: 1, 'only-remote': 2, match: 3 };
    return order[a.status] - order[b.status] || a.key.localeCompare(b.key);
  });
  return { ok: true, provider: project.deployProvider, items };
}

async function pushVercelKey(token: string, projectId: string, key: string, value: string, existingId?: string) {
  if (existingId) {
    // Update (decrypt=true required to fetch id earlier). Vercel expects PATCH with body.
    await axios.patch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(existingId)}`,
      { value, target: ['production', 'preview', 'development'], type: 'encrypted' },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    return;
  }
  await axios.post(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
    { key, value, target: ['production', 'preview', 'development'], type: 'encrypted' },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
  );
}

async function getVercelEnvIndex(token: string, projectId: string): Promise<Map<string, string>> {
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
  const map = new Map<string, string>();
  const envs = (res.data?.envs ?? []) as any[];
  for (const e of envs) {
    if (e?.key && e?.id) map.set(String(e.key), String(e.id));
  }
  return map;
}

async function pushRenderEnv(token: string, serviceId: string, allPairs: Array<{ key: string; value: string }>) {
  // Render API replaces entire env-vars set via PUT.
  await axios.put(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/env-vars`,
    allPairs.map((p) => ({ key: p.key, value: p.value })),
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, timeout: 20000 }
  );
}

export async function pushToProvider(
  project: ProjectConfig,
  tokens: { vercelToken: string; renderToken: string },
  keys: string[]
): Promise<SyncPushResult> {
  if (project.deployProvider !== 'vercel' && project.deployProvider !== 'render') {
    return { ok: false, pushed: [], failed: [], error: 'Project has no deploy provider configured.' };
  }
  if (!project.deployId) {
    return { ok: false, pushed: [], failed: [], error: 'No deployId on project.' };
  }
  const token = project.deployProvider === 'vercel' ? tokens.vercelToken : tokens.renderToken;
  if (!token) {
    return { ok: false, pushed: [], failed: [], error: `${project.deployProvider} token missing in Settings.` };
  }
  // Read local values (prefer .env.production, then .env)
  const candidates = ['.env.production', '.env'];
  let local: EnvEntry[] = [];
  for (const f of candidates) {
    const p = path.join(project.path, f);
    if (fs.existsSync(p)) {
      try {
        local = parseEnv(fs.readFileSync(p, 'utf-8'));
        break;
      } catch {
        /* ignore */
      }
    }
  }
  const localMap = new Map<string, string>();
  for (const e of local) localMap.set(e.key, e.value);

  const pushed: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  if (project.deployProvider === 'vercel') {
    let index: Map<string, string> = new Map();
    try {
      index = await getVercelEnvIndex(token, project.deployId);
    } catch {
      /* ignore, will create new */
    }
    for (const k of keys) {
      const v = localMap.get(k);
      if (v === undefined) {
        failed.push({ key: k, error: 'Not in local .env' });
        continue;
      }
      try {
        await pushVercelKey(token, project.deployId, k, v, index.get(k));
        pushed.push(k);
      } catch (err) {
        failed.push({ key: k, error: (err as Error).message });
      }
    }
    return { ok: failed.length === 0, pushed, failed };
  }

  // Render: PUT-replace model. Merge remote + local-selected, then PUT.
  try {
    const remote = await fetchRenderEnv(token, project.deployId);
    for (const k of keys) {
      const v = localMap.get(k);
      if (v === undefined) {
        failed.push({ key: k, error: 'Not in local .env' });
        continue;
      }
      remote.set(k, v);
      pushed.push(k);
    }
    const pairs = Array.from(remote.entries()).map(([key, value]) => ({ key, value }));
    await pushRenderEnv(token, project.deployId, pairs);
    return { ok: failed.length === 0, pushed, failed };
  } catch (err) {
    return {
      ok: false,
      pushed,
      failed,
      error: `Render push failed: ${(err as Error).message}`,
    };
  }
}
