import fs from 'node:fs';
import path from 'node:path';

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
