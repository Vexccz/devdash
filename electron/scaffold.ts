import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { loadConfig, addProject } from './config';
import os from 'node:os';

export interface ScaffoldOptions {
  projectName: string;
  targetParentDir: string;
  template: string;
  displayName: string;
  useStripe: boolean;
  install: boolean;
  gitInit: boolean;
  envFromSettings?: boolean;
  gitHubPush?: boolean;
  gitHubPrivate?: boolean;
  customTemplateRepo?: string; // GitHub URL or owner/repo for custom template
  deployToVercel?: boolean;
  deployToRender?: boolean;
  uiKit?: 'tailwind' | 'shadcn' | 'material' | 'chakra';
  envPreset?: 'dev' | 'production' | 'indie-saas';
}

export interface ScaffoldResult {
  ok: boolean;
  targetDir?: string;
  error?: string;
  githubUrl?: string;
  vercelUrl?: string;
  renderUrl?: string;
  deployId?: string;
  deployProvider?: 'vercel' | 'render' | 'none';
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
    {
      id: 'nextjs-app-router',
      label: 'Next.js 15 App Router + Auth.js + Stripe',
      description: 'Next.js 15 App Router, Tailwind 4, Auth.js v5, Prisma, Stripe Checkout. Deploy-ready for Vercel.',
    },
    {
      id: 'flutter-firebase',
      label: 'Flutter + Firebase',
      description: 'Flutter mobile app with Firebase Auth (email + Google), Cloud Firestore, Firebase Storage, Provider state.',
    },
    {
      id: 'fastapi-react',
      label: 'FastAPI + React (Vite)',
      description: 'Python FastAPI backend + React Vite frontend, SQLAlchemy + Alembic, JWT auth, Tailwind CSS.',
    },
  ];
}

export interface TemplatePreview {
  files: string[];
  fileCount: number;
  lineCount: number;
}

export function previewTemplate(templateId: string): TemplatePreview | { error: string } {
  const tplRoot = templatesRoot();
  const tplDir = path.join(tplRoot, templateId);
  if (!fs.existsSync(tplDir)) {
    return { error: `Template "${templateId}" not found.` };
  }
  const files: string[] = [];
  let lineCount = 0;

  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else {
        files.push(rel);
        try {
          const buf = fs.readFileSync(path.join(dir, entry.name));
          if (!buf.includes(0)) {
            lineCount += buf.toString('utf-8').split('\n').length;
          }
        } catch { /* skip unreadable */ }
      }
    }
  }
  walk(tplDir, '');
  return { files, fileCount: files.length, lineCount };
}

export interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  stars: number;
  downloads: number;
  githubUrl: string;
  tags: string[];
}

export function loadMarketplace(): MarketplaceEntry[] {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'marketplace.json'),
    path.join(app.getAppPath(), 'electron', 'marketplace.json'),
    path.resolve(__dirname, 'marketplace.json'),
    path.resolve(__dirname, '..', 'electron', 'marketplace.json'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        return JSON.parse(fs.readFileSync(c, 'utf-8')) as MarketplaceEntry[];
      } catch {
        return [];
      }
    }
  }
  return [];
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

    const replacements = {
      PROJECT_NAME: safeName,
      PROJECT_SLUG: slugify(safeName),
      DISPLAY_NAME: opts.displayName || safeName,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      STRIPE_KEY_HINT: opts.useStripe ? 'sk_test_replace_me' : 'disabled',
    };

    // Custom template from GitHub repo
    if (opts.customTemplateRepo) {
      const repo = opts.customTemplateRepo.trim();
      const repoUrl = repo.startsWith('http') ? repo : `https://github.com/${repo}.git`;
      const tmpDir = path.join(os.tmpdir(), `devdash-tpl-${Date.now()}`);
      emit('system', `Cloning custom template from ${repoUrl}...`);
      const cloneCode = await runStreamed('git', ['clone', '--depth', '1', repoUrl, tmpDir], os.tmpdir(), 120000);
      if (cloneCode !== 0) {
        return { ok: false, error: `Failed to clone custom template from ${repoUrl}` };
      }
      // Remove .git from cloned template
      const clonedGit = path.join(tmpDir, '.git');
      if (fs.existsSync(clonedGit)) {
        fs.rmSync(clonedGit, { recursive: true, force: true });
      }
      emit('system', `Scaffolding into ${targetDir}...`);
      copyDir(tmpDir, targetDir, replacements);
      // Clean up temp dir
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    } else {
      const tplRoot = templatesRoot();
      const tplDir = path.join(tplRoot, opts.template);
      if (!fs.existsSync(tplDir)) {
        return { ok: false, error: `Template "${opts.template}" not found at ${tplDir}` };
      }
      emit('system', `Scaffolding into ${targetDir}...`);
      copyDir(tplDir, targetDir, replacements);
    }

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

    // UI Kit injection (skip flutter-firebase)
    const isFlutter = opts.template === 'flutter-firebase';
    if (opts.uiKit && opts.uiKit !== 'tailwind' && !isFlutter) {
      emit('system', `Applying UI kit: ${opts.uiKit}...`);
      // Find frontend package.json candidates
      const frontendPkgPaths = [
        path.join(targetDir, 'frontend', 'package.json'),
        path.join(targetDir, 'package.json'),
      ];
      for (const pkgPath of frontendPkgPaths) {
        if (!fs.existsSync(pkgPath)) continue;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (!pkg.dependencies) pkg.dependencies = {};
          if (opts.uiKit === 'shadcn') {
            pkg.dependencies['@radix-ui/react-slot'] = '^1.1.0';
            pkg.dependencies['class-variance-authority'] = '^0.7.0';
            pkg.dependencies['clsx'] = '^2.1.1';
            pkg.dependencies['tailwind-merge'] = '^2.5.0';
            pkg.dependencies['lucide-react'] = '^0.460.0';
            // Create components.json for shadcn
            const componentsJson = {
              '$schema': 'https://ui.shadcn.com/schema.json',
              style: 'default',
              rsc: false,
              tsx: true,
              tailwind: { config: 'tailwind.config.js', css: 'src/index.css', baseColor: 'neutral', cssVariables: true },
              aliases: { components: '@/components', utils: '@/lib/utils' },
            };
            const componentsJsonPath = path.join(path.dirname(pkgPath), 'components.json');
            fs.writeFileSync(componentsJsonPath, JSON.stringify(componentsJson, null, 2), 'utf-8');
            // Create utils file
            const libDir = path.join(path.dirname(pkgPath), 'src', 'lib');
            if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
            fs.writeFileSync(path.join(libDir, 'utils.ts'), `import { type ClassValue, clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`, 'utf-8');
            // Create base components
            const uiDir = path.join(path.dirname(pkgPath), 'src', 'components', 'ui');
            if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });
            fs.writeFileSync(path.join(uiDir, 'button.tsx'), `import * as React from 'react';\nimport { Slot } from '@radix-ui/react-slot';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { cn } from '@/lib/utils';\n\nconst buttonVariants = cva(\n  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50',\n  { variants: { variant: { default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90', outline: 'border border-input bg-background shadow-sm hover:bg-accent' }, size: { default: 'h-9 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', lg: 'h-10 rounded-md px-8' } }, defaultVariants: { variant: 'default', size: 'default' } }\n);\n\nexport interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; }\n\nconst Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {\n  const Comp = asChild ? Slot : 'button';\n  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;\n});\nButton.displayName = 'Button';\nexport { Button, buttonVariants };\n`, 'utf-8');
            fs.writeFileSync(path.join(uiDir, 'input.tsx'), `import * as React from 'react';\nimport { cn } from '@/lib/utils';\n\nexport interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}\n\nconst Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {\n  return <input type={type} className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50', className)} ref={ref} {...props} />;\n});\nInput.displayName = 'Input';\nexport { Input };\n`, 'utf-8');
            fs.writeFileSync(path.join(uiDir, 'card.tsx'), `import * as React from 'react';\nimport { cn } from '@/lib/utils';\n\nconst Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (\n  <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow', className)} {...props} />\n));\nCard.displayName = 'Card';\n\nconst CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (\n  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />\n));\nCardHeader.displayName = 'CardHeader';\n\nconst CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (\n  <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />\n));\nCardTitle.displayName = 'CardTitle';\n\nconst CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (\n  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />\n));\nCardContent.displayName = 'CardContent';\n\nexport { Card, CardHeader, CardTitle, CardContent };\n`, 'utf-8');
          } else if (opts.uiKit === 'material') {
            pkg.dependencies['@mui/material'] = '^6.1.0';
            pkg.dependencies['@emotion/react'] = '^11.13.0';
            pkg.dependencies['@emotion/styled'] = '^11.13.0';
            pkg.dependencies['@mui/icons-material'] = '^6.1.0';
          } else if (opts.uiKit === 'chakra') {
            pkg.dependencies['@chakra-ui/react'] = '^2.10.0';
            pkg.dependencies['@emotion/react'] = '^11.13.0';
            pkg.dependencies['@emotion/styled'] = '^11.13.0';
            pkg.dependencies['framer-motion'] = '^11.11.0';
          }
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
          emit('system', `UI kit deps added to ${path.basename(path.dirname(pkgPath))}/package.json`);
          break; // Only apply to first found frontend package.json
        } catch (err) {
          emit('stderr', `UI kit injection failed: ${(err as Error).message}`);
        }
      }
    }

    // Environment Preset injection (skip flutter-firebase)
    if (opts.envPreset && opts.envPreset !== 'dev' && !isFlutter) {
      emit('system', `Applying environment preset: ${opts.envPreset}...`);

      // Backend package.json: add production deps
      const backendPkgPaths = [
        path.join(targetDir, 'backend', 'package.json'),
        path.join(targetDir, 'package.json'),
      ];
      for (const pkgPath of backendPkgPaths) {
        if (!fs.existsSync(pkgPath)) continue;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (!pkg.dependencies) pkg.dependencies = {};
          // Production deps
          pkg.dependencies['@sentry/node'] = '^8.30.0';
          pkg.dependencies['helmet'] = '^8.0.0';
          pkg.dependencies['express-rate-limit'] = '^7.4.0';
          pkg.dependencies['compression'] = '^1.7.4';
          pkg.dependencies['cors'] = '^2.8.5';
          // Indie-SaaS extras
          if (opts.envPreset === 'indie-saas') {
            pkg.dependencies['posthog-node'] = '^4.2.0';
            pkg.dependencies['@logtail/node'] = '^0.5.0';
          }
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
          emit('system', `Env preset deps added to backend package.json`);
          break;
        } catch (err) {
          emit('stderr', `Env preset backend injection failed: ${(err as Error).message}`);
        }
      }

      // Frontend package.json: indie-saas adds posthog-js
      if (opts.envPreset === 'indie-saas') {
        const frontendPkgPaths = [
          path.join(targetDir, 'frontend', 'package.json'),
          path.join(targetDir, 'package.json'),
        ];
        for (const pkgPath of frontendPkgPaths) {
          if (!fs.existsSync(pkgPath)) continue;
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (!pkg.dependencies) pkg.dependencies = {};
            pkg.dependencies['posthog-js'] = '^1.170.0';
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
            emit('system', `posthog-js added to frontend package.json`);
            break;
          } catch (err) {
            emit('stderr', `Env preset frontend injection failed: ${(err as Error).message}`);
          }
        }
      }

      // Append to .env.example files
      const envFiles = [
        path.join(targetDir, 'backend', '.env.example'),
        path.join(targetDir, '.env.example'),
      ].filter((p) => fs.existsSync(p));
      const productionEnvLines = [
        '',
        '# Production (added by DevDash env preset)',
        'SENTRY_DSN=',
        'RATE_LIMIT_MAX=100',
        'RATE_LIMIT_WINDOW_MS=900000',
      ];
      const indieSaasEnvLines = [
        '# Indie SaaS (added by DevDash env preset)',
        'POSTHOG_KEY=',
        'LOGTAIL_TOKEN=',
      ];
      for (const envPath of envFiles) {
        try {
          let txt = fs.readFileSync(envPath, 'utf-8');
          txt += productionEnvLines.join('\n') + '\n';
          if (opts.envPreset === 'indie-saas') {
            txt += indieSaasEnvLines.join('\n') + '\n';
          }
          fs.writeFileSync(envPath, txt, 'utf-8');
          emit('system', `Env preset variables appended to ${path.basename(envPath)}`);
        } catch (err) {
          emit('stderr', `Env file update failed: ${(err as Error).message}`);
        }
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

    // Deploy to Vercel/Render if requested
    let vercelUrl: string | undefined;
    let renderUrl: string | undefined;
    let deployProvider: 'vercel' | 'render' | 'none' = 'none';
    let deployId: string | undefined;

    if (opts.deployToVercel || opts.deployToRender) {
      const cfg = loadConfig();
      if (opts.deployToVercel) {
        const vercelToken = cfg.settings.vercelToken?.trim();
        if (!vercelToken) {
          emit('stderr', 'Vercel token not set in settings. Skipping Vercel deploy.');
        } else if (!githubUrl) {
          emit('stderr', 'GitHub URL required for Vercel deploy. Push to GitHub first.');
        } else {
          emit('system', 'Creating Vercel project...');
          try {
            const projectSlug = slugify(safeName).slice(0, 100);
            const ghMatch = githubUrl.match(/github\.com[:/]+([^/]+)\/([^/.]+?)(?:\.git)?(?:\/|$)/i);
            const ghRepo = ghMatch ? `${ghMatch[1]}/${ghMatch[2]}` : null;
            if (!ghRepo) {
              emit('stderr', 'Could not parse GitHub URL for Vercel.');
            } else {
              const createRes = await fetch('https://api.vercel.com/v10/projects', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${vercelToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: projectSlug,
                  framework: null,
                  gitRepository: { type: 'github', repo: ghRepo },
                }),
              });
              if (!createRes.ok) {
                const errText = await createRes.text();
                emit('stderr', `Vercel project creation failed: ${createRes.status} ${errText}`);
              } else {
                const vercelProject = (await createRes.json()) as { id: string; name: string };
                deployId = vercelProject.id;
                vercelUrl = `https://${vercelProject.name}.vercel.app`;
                deployProvider = 'vercel';
                emit('system', `Vercel project created: ${vercelUrl}`);
                // Trigger first deploy
                try {
                  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${vercelToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      name: vercelProject.name,
                      project: vercelProject.id,
                      target: 'production',
                      gitSource: { type: 'github', ref: 'main' },
                    }),
                  });
                  if (deployRes.ok) {
                    const dep = (await deployRes.json()) as { url?: string };
                    if (dep.url) vercelUrl = `https://${dep.url}`;
                    emit('system', `Vercel deployment triggered: ${vercelUrl}`);
                  }
                } catch (depErr) {
                  emit('stderr', `Vercel deploy trigger failed: ${(depErr as Error).message}`);
                }
              }
            }
          } catch (err) {
            emit('stderr', `Vercel error: ${(err as Error).message}`);
          }
        }
      }

      if (opts.deployToRender) {
        const renderToken = cfg.settings.renderToken?.trim();
        if (!renderToken) {
          emit('stderr', 'Render token not set in settings. Skipping Render deploy.');
        } else if (!githubUrl) {
          emit('stderr', 'GitHub URL required for Render deploy. Push to GitHub first.');
        } else {
          emit('system', 'Creating Render service...');
          try {
            // Find owner
            const ownerRes = await fetch('https://api.render.com/v1/owners?limit=1', {
              headers: { Authorization: `Bearer ${renderToken}`, Accept: 'application/json' },
            });
            const owners = (await ownerRes.json()) as Array<{ owner?: { id: string }; id?: string }>;
            const ownerId = owners[0]?.owner?.id || owners[0]?.id;
            if (!ownerId) {
              emit('stderr', 'Could not resolve Render owner.');
            } else {
              const serviceName = slugify(safeName).slice(0, 50);
              const svcRes = await fetch('https://api.render.com/v1/services', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${renderToken}`,
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: 'web_service',
                  name: serviceName,
                  ownerId,
                  repo: githubUrl.replace(/\.git$/, ''),
                  branch: 'main',
                  autoDeploy: 'yes',
                  serviceDetails: {
                    env: 'node',
                    plan: 'free',
                    region: 'singapore',
                    buildCommand: 'npm install',
                    startCommand: 'npm start',
                  },
                }),
              });
              if (!svcRes.ok) {
                const errText = await svcRes.text();
                emit('stderr', `Render service creation failed: ${svcRes.status} ${errText}`);
              } else {
                const svc = (await svcRes.json()) as { service?: { id: string; serviceDetails?: { url?: string } }; id?: string };
                const svcData = svc.service || svc;
                const svcId = (svcData as any).id;
                renderUrl = (svcData as any).serviceDetails?.url;
                if (!deployProvider || deployProvider === 'none') {
                  deployProvider = 'render';
                  deployId = svcId;
                }
                emit('system', `Render service created${renderUrl ? `: ${renderUrl}` : ''}.`);
              }
            }
          } catch (err) {
            emit('stderr', `Render error: ${(err as Error).message}`);
          }
        }
      }
    }

    emit('system', `Done. Project at ${targetDir}`);
    return { ok: true, targetDir, githubUrl, vercelUrl, renderUrl, deployProvider, deployId };
  } catch (err) {
    emit('stderr', `Scaffold error: ${(err as Error).message}`);
    return { ok: false, error: (err as Error).message };
  } finally {
    active = false;
  }
}
