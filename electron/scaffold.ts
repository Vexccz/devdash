import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { loadConfig } from './config';

export interface ScaffoldOptions {
  projectName: string;
  targetParentDir: string;
  template: 'react-express-mongo' | 'react-express-postgres' | 'nextjs-prisma';
  displayName: string;
  useStripe: boolean;
  install: boolean;
  gitInit: boolean;
  envFromSettings?: boolean;
  gitHubPush?: boolean;
  gitHubPrivate?: boolean;
  customTemplateRepo?: string; // GitHub URL or owner/repo for custom template
}

export interface ScaffoldResult {
  ok: boolean;
  targetDir?: string;
  error?: string;
  githubUrl?: string;
}

export type ScaffoldLogEvent = {
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  ts: number;
};

const emitter = new EventEmitter();
let active = false;

export function bindBroadcast(window: () => BrowserWindow | null): void {
  emitter.on('log', (e: ScaffoldLogEvent) => {
    const w = window();
    if (!w || w.isDestroyed()) return;
    w.webContents.send('scaffold:log', e);
  });
}

export function onLog(cb: (e: ScaffoldLogEvent) => void): () => void {
  emitter.on('log', cb);
  return () => emitter.off('log', cb);
}

function emit(stream: ScaffoldLogEvent['stream'], line: string) {
  emitter.emit('log', { stream, line, ts: Date.now() } as ScaffoldLogEvent);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function templatesRoot(): string {
  // In production: resources/templates (extraResources). In dev: repo/templates.
  const candidates = [
    path.join(process.resourcesPath ?? '', 'templates'),
    path.join(app.getAppPath(), 'templates'),
    path.resolve(__dirname, '..', 'templates'),
    path.resolve(process.cwd(), 'templates'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return candidates[candidates.length - 1];
}

function copyDir(src: string, dest: string, replacements: Record<string, string>) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const targetName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(dest, targetName);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, replacements);
    } else {
      const buf = fs.readFileSync(srcPath);
      const isBinary = buf.includes(0);
      if (isBinary) {
        fs.writeFileSync(destPath, buf);
      } else {
        let txt = buf.toString('utf-8');
        for (const [k, v] of Object.entries(replacements)) {
          txt = txt.split(`{{${k}}}`).join(v);
        }
        fs.writeFileSync(destPath, txt, 'utf-8');
      }
    }
  }
}

function runStreamed(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve) => {
    emit('system', `$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    const to = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      emit('system', '[timeout] step killed');
      resolve(-1);
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emit('stdout', line);
      }
    });
    child.stderr.on('data', (d: Buffer) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emit('stderr', line);
      }
    });
    child.on('close', (code: number | null) => {
      clearTimeout(to);
      resolve(code ?? 0);
    });
    child.on('error', (err: Error) => {
      clearTimeout(to);
      emit('stderr', `[error] ${err.message}`);
      resolve(-1);
    });
  });
}

export function listTemplates(): Array<{ id: string; label: string; description: string }> {
  return [
    {
      id: 'react-express-mongo',
      label: 'React + Express + MongoDB',
      description: 'Vite + Tailwind frontend, Express + Mongoose backend, JWT auth, Stripe, admin panel, emails',
    },
    {
      id: 'react-express-postgres',
      label: 'React + Express + Postgres (Prisma)',
      description: 'Same as above but Postgres + Prisma. Needs `npm run prisma:migrate` after setup.',
    },
    {
      id: 'nextjs-prisma',
      label: 'Next.js 14 + Postgres (Prisma)',
      description: 'Full-stack Next.js App Router with Postgres + Prisma, cookie-based JWT auth, Stripe, admin panel, emails.',
    },
  ];
}

export function isActive(): boolean {
  return active;
}

export async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  if (active) return { ok: false, error: 'Another scaffold is already running.' };
  active = true;
  try {
    const safeName = opts.projectName.trim();
    if (!safeName || !/^[a-zA-Z0-9-_]+$/.test(safeName)) {
      return { ok: false, error: 'Project name must be letters, numbers, dashes, underscores.' };
    }
    if (!opts.targetParentDir || !fs.existsSync(opts.targetParentDir)) {
      return { ok: false, error: 'Parent directory does not exist.' };
    }

    const targetDir = path.join(opts.targetParentDir, safeName);
    if (fs.existsSync(targetDir)) {
      const entries = fs.readdirSync(targetDir);
      if (entries.length > 0) {
        return { ok: false, error: `${targetDir} already exists and is not empty.` };
      }
    }

    const tplRoot = templatesRoot();
    const tplDir = path.join(tplRoot, opts.template);
    if (!fs.existsSync(tplDir)) {
      return { ok: false, error: `Template "${opts.template}" not found at ${tplDir}` };
    }

    const replacements = {
      PROJECT_NAME: safeName,
      PROJECT_SLUG: slugify(safeName),
      DISPLAY_NAME: opts.displayName || safeName,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      STRIPE_KEY_HINT: opts.useStripe ? 'sk_test_replace_me' : 'disabled',
    };

    emit('system', `Scaffolding into ${targetDir}...`);
    copyDir(tplDir, targetDir, replacements);

    // Detect if template uses a nested backend folder (for payments.js location)
    const hasBackendFolder = fs.existsSync(path.join(targetDir, 'backend'));

    // If user opted out of Stripe, neutralize the payments route.
    if (!opts.useStripe) {
      const paymentsRoute = hasBackendFolder
        ? path.join(targetDir, 'backend', 'src', 'routes', 'payments.js')
        : null;
      if (paymentsRoute && fs.existsSync(paymentsRoute)) {
        fs.writeFileSync(
          paymentsRoute,
          `import { Router } from 'express';\nconst router = Router();\nrouter.get('/status', (_req, res) => res.json({ enabled: false }));\nexport default router;\n`,
          'utf-8'
        );
      }
    }

    // Env from settings: merge DevDash-stored tokens into .env.example
    if (opts.envFromSettings) {
      try {
        const cfg = loadConfig();
        const envFiles = [
          path.join(targetDir, 'backend', '.env.example'),
          path.join(targetDir, '.env.example'),
        ].filter((p) => fs.existsSync(p));
        for (const envPath of envFiles) {
          let txt = fs.readFileSync(envPath, 'utf-8');
          const replacements2: Record<string, string> = {};
          // Only inject if tokens are set in DevDash settings.
          // No write-through of actual Stripe secret (never stored in DevDash); just leave placeholders.
          if (cfg.settings.githubToken) {
            // Not injected to the project env, just emit info
            emit('system', 'Using DevDash GitHub token for repo creation.');
          }
          for (const [k, v] of Object.entries(replacements2)) {
            txt = txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`);
          }
          if (Object.keys(replacements2).length > 0) {
            fs.writeFileSync(envPath, txt, 'utf-8');
          }
        }
      } catch (err) {
        emit('stderr', `envFromSettings failed: ${(err as Error).message}`);
      }
    }

    if (opts.install) {
      emit('system', 'Installing backend deps...');
      const beCode = await runStreamed('npm', ['install', '--no-fund', '--no-audit'], path.join(targetDir, 'backend'), 10 * 60 * 1000);
      if (beCode !== 0) emit('system', `Backend install exited with code ${beCode}. Continuing.`);

      emit('system', 'Installing frontend deps...');
      const feCode = await runStreamed('npm', ['install', '--no-fund', '--no-audit'], path.join(targetDir, 'frontend'), 10 * 60 * 1000);
      if (feCode !== 0) emit('system', `Frontend install exited with code ${feCode}. Continuing.`);
    }

    if (opts.gitInit) {
      emit('system', 'Initializing git...');
      await runStreamed('git', ['init'], targetDir, 30000);
      await runStreamed('git', ['add', '-A'], targetDir, 60000);
      await runStreamed('git', ['commit', '-m', 'chore: initial commit from DevDash Build Code'], targetDir, 60000);
    }

    let githubUrl: string | undefined;
    if (opts.gitHubPush && opts.gitInit) {
      const cfg = loadConfig();
      const token = cfg.settings.githubToken;
      if (!token) {
        emit('stderr', 'GitHub token not set in DevDash settings. Skipping push.');
      } else {
        try {
          // Fetch authenticated user
          const meRes = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          });
          if (!meRes.ok) {
            emit('stderr', `GitHub auth failed: ${meRes.status} ${meRes.statusText}`);
          } else {
            const me = (await meRes.json()) as { login: string };
            emit('system', `Creating GitHub repo as ${me.login}...`);
            const createRes = await fetch('https://api.github.com/user/repos', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: safeName,
                description: `Created with DevDash Build Code (${opts.template})`,
                private: opts.gitHubPrivate ?? false,
                auto_init: false,
              }),
            });
            if (!createRes.ok) {
              const errBody = await createRes.text();
              emit('stderr', `GitHub repo create failed: ${createRes.status} ${errBody}`);
            } else {
              const repo = (await createRes.json()) as { clone_url: string; html_url: string };
              githubUrl = repo.html_url;
              emit('system', `Repo created: ${repo.html_url}`);
              const authedUrl = repo.clone_url.replace('https://', `https://${token}@`);
              await runStreamed('git', ['remote', 'add', 'origin', authedUrl], targetDir, 30000);
              await runStreamed('git', ['branch', '-M', 'main'], targetDir, 30000);
              await runStreamed('git', ['push', '-u', 'origin', 'main'], targetDir, 120000);
              emit('system', 'Pushed to GitHub.');
            }
          }
        } catch (err) {
          emit('stderr', `GitHub push error: ${(err as Error).message}`);
        }
      }
    } else if (opts.gitHubPush && !opts.gitInit) {
      emit('stderr', 'GitHub push requires git init. Skipping.');
    }

    emit('system', `Done. Project at ${targetDir}`);
    return { ok: true, targetDir, githubUrl };
  } catch (err) {
    emit('stderr', `Scaffold failed: ${(err as Error).message}`);
    return { ok: false, error: (err as Error).message };
  } finally {
    active = false;
  }
}
