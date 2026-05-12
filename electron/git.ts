import fs from 'node:fs';
import path from 'node:path';
import { simpleGit, SimpleGit } from 'simple-git';

export interface GitInfo {
  ok: boolean;
  path: string;
  branch?: string;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  modifiedCount?: number;
  stagedCount?: number;
  untrackedCount?: number;
  lastCommit?: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  };
  devPort?: number | null;
  devScript?: string | null;
  error?: string;
}

const fetchTimestamps = new Map<string, number>();
const FETCH_COOLDOWN_MS = 2 * 60 * 1000;

function isGitRepo(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

export function detectDevServer(dir: string): { port: number | null; script: string | null } {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return { port: null, script: null };
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const devScript = scripts.dev ?? scripts.start ?? null;

    // Try vite.config.*
    const viteCandidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs'];
    for (const c of viteCandidates) {
      const p = path.join(dir, c);
      if (fs.existsSync(p)) {
        try {
          const txt = fs.readFileSync(p, 'utf-8');
          const m = txt.match(/port\s*:\s*(\d{2,5})/);
          if (m) return { port: Number(m[1]), script: devScript };
        } catch {
          /* ignore */
        }
      }
    }

    // Try next.config / port from scripts
    if (devScript) {
      const m = devScript.match(/--?port[=\s]+(\d{2,5})|-p\s+(\d{2,5})/);
      if (m) return { port: Number(m[1] ?? m[2]), script: devScript };
    }

    // Heuristic defaults
    if (devScript?.includes('vite')) return { port: 5173, script: devScript };
    if (devScript?.includes('next')) return { port: 3000, script: devScript };

    return { port: null, script: devScript };
  } catch {
    return { port: null, script: null };
  }
}

export async function getGitInfo(projectPath: string, opts: { fetch?: boolean } = {}): Promise<GitInfo> {
  const devInfo = detectDevServer(projectPath);
  if (!fs.existsSync(projectPath)) {
    return { ok: false, path: projectPath, error: 'Path does not exist', devPort: devInfo.port, devScript: devInfo.script };
  }
  if (!isGitRepo(projectPath)) {
    return { ok: false, path: projectPath, error: 'Not a git repo', devPort: devInfo.port, devScript: devInfo.script };
  }

  const git: SimpleGit = simpleGit(projectPath);

  try {
    if (opts.fetch) {
      const last = fetchTimestamps.get(projectPath) ?? 0;
      if (Date.now() - last > FETCH_COOLDOWN_MS) {
        try {
          await git.fetch();
          fetchTimestamps.set(projectPath, Date.now());
        } catch (err) {
          // fetch failures shouldn't break the whole call
          console.warn('[git] fetch failed for', projectPath, (err as Error).message);
        }
      }
    }

    const status = await git.status();
    const log = await git.log({ maxCount: 1 });
    const last = log.latest;

    return {
      ok: true,
      path: projectPath,
      branch: status.current ?? undefined,
      ahead: status.ahead,
      behind: status.behind,
      dirty: !status.isClean(),
      modifiedCount: status.modified.length + status.renamed.length + status.deleted.length,
      stagedCount: status.staged.length,
      untrackedCount: status.not_added.length,
      lastCommit: last
        ? {
            hash: last.hash,
            shortHash: last.hash.slice(0, 7),
            message: last.message,
            author: last.author_name,
            date: last.date,
          }
        : undefined,
      devPort: devInfo.port,
      devScript: devInfo.script,
    };
  } catch (err) {
    return {
      ok: false,
      path: projectPath,
      error: (err as Error).message,
      devPort: devInfo.port,
      devScript: devInfo.script,
    };
  }
}

export async function gitPull(projectPath: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  try {
    if (!isGitRepo(projectPath)) return { ok: false, error: 'Not a git repo' };
    const git = simpleGit(projectPath);
    const result = await git.pull();
    return { ok: true, output: `${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
