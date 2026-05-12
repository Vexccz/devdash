import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Thin wrappers around `git push`, `git pull`, `git fetch` that:
 *   - pass `--quiet` (valid flag) to suppress non-essential progress output,
 *   - pipe stderr alongside stdout so PowerShell doesn't turn progress lines
 *     into ErrorRecord objects,
 *   - hide the child console window (`windowsHide`),
 *   - resolve to a plain { ok, stdout, stderr, code } shape even on non-zero
 *     exits so callers can decide what's actually an error.
 *
 * NOTE: do not add progress=false; that flag is not valid for git. Use
 * `--quiet` to silence output instead.
 */

export interface GitResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
// 10 MB buffer is plenty for typical git output.
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

function isGitRepo(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

function runGit(
  cwd: string,
  args: string[],
  opts: { timeoutMs?: number } = {}
): Promise<GitResult> {
  return new Promise((resolve) => {
    if (!isGitRepo(cwd)) {
      resolve({ ok: false, code: -1, stdout: '', stderr: '', error: 'Not a git repo' });
      return;
    }

    execFile(
      'git',
      args,
      {
        cwd,
        windowsHide: true,
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: DEFAULT_MAX_BUFFER,
        // Force C locale + disable pagers so output is predictable and
        // doesn't block waiting for a pager.
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_PAGER: 'cat',
          LC_ALL: 'C',
        },
      },
      (err, stdout, stderr) => {
        const outStr =
          typeof stdout === 'string' ? stdout : stdout ? String(stdout) : '';
        const errStr =
          typeof stderr === 'string' ? stderr : stderr ? String(stderr) : '';
        if (err) {
          const rawCode = (err as NodeJS.ErrnoException & { code?: number | string }).code;
          const code = typeof rawCode === 'number' ? rawCode : 1;
          resolve({
            ok: false,
            code,
            stdout: outStr,
            stderr: errStr,
            error: errStr.trim() || err.message,
          });
          return;
        }
        resolve({ ok: true, code: 0, stdout: outStr, stderr: errStr });
      }
    );
  });
}

/** Ensure `--quiet` is present (only if the user didn't pass it or `--verbose`). */
function ensureQuiet(args: string[]): string[] {
  if (args.some((a) => a === '--quiet' || a === '-q' || a === '--verbose' || a === '-v')) {
    return args;
  }
  return [...args, '--quiet'];
}

export async function gitFetch(repoPath: string, args: string[] = []): Promise<GitResult> {
  return runGit(repoPath, ['fetch', ...ensureQuiet(args)]);
}

export async function gitPull(repoPath: string, args: string[] = []): Promise<GitResult> {
  return runGit(repoPath, ['pull', ...ensureQuiet(args)]);
}

export async function gitPush(repoPath: string, args: string[] = []): Promise<GitResult> {
  return runGit(repoPath, ['push', ...ensureQuiet(args)]);
}

export async function gitPushTags(repoPath: string, args: string[] = []): Promise<GitResult> {
  return runGit(repoPath, ['push', '--tags', ...ensureQuiet(args)]);
}
