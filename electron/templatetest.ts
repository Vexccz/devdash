import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { listTemplates } from './scaffold';

export interface TemplateTestResult {
  templateId: string;
  installOk: boolean;
  buildOk: boolean;
  installDurationMs: number;
  buildDurationMs: number;
  totalDurationMs: number;
  error?: string;
}

export type TemplateTestLogEvent = {
  templateId: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  ts: number;
};

const emitter = new EventEmitter();
let running = false;

export function bindBroadcast(window: () => BrowserWindow | null): void {
  emitter.on('log', (e: TemplateTestLogEvent) => {
    const w = window();
    if (!w || w.isDestroyed()) return;
    w.webContents.send('template:testLog', e);
  });
}

function emit(templateId: string, stream: TemplateTestLogEvent['stream'], line: string) {
  emitter.emit('log', { templateId, stream, line, ts: Date.now() } as TemplateTestLogEvent);
}

function templatesRoot(): string {
  const { app } = require('electron');
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

function copyDir(src: string, dest: string) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runCmd(cmd: string, args: string[], cwd: string, templateId: string, timeoutMs: number): Promise<{ ok: boolean; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    emit(templateId, 'system', `$ ${cmd} ${args.join(' ')}`);

    if (!fs.existsSync(cwd)) {
      emit(templateId, 'stderr', `Directory not found: ${cwd}`);
      resolve({ ok: false, durationMs: Date.now() - start });
      return;
    }

    const child = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    const to = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      emit(templateId, 'system', '[timeout]');
      resolve({ ok: false, durationMs: Date.now() - start });
    }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emit(templateId, 'stdout', line);
      }
    });
    child.stderr.on('data', (d: Buffer) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emit(templateId, 'stderr', line);
      }
    });
    child.on('close', (code: number | null) => {
      clearTimeout(to);
      resolve({ ok: code === 0, durationMs: Date.now() - start });
    });
    child.on('error', (err: Error) => {
      clearTimeout(to);
      emit(templateId, 'stderr', `[error] ${err.message}`);
      resolve({ ok: false, durationMs: Date.now() - start });
    });
  });
}

function hasPkgJson(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'package.json'));
}

function hasBuildScript(dir: string): boolean {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return !!pkg.scripts?.build;
  } catch {
    return false;
  }
}

export async function testTemplate(templateId: string): Promise<TemplateTestResult> {
  const totalStart = Date.now();
  const tplRoot = templatesRoot();
  const tplDir = path.join(tplRoot, templateId);

  if (!fs.existsSync(tplDir)) {
    return {
      templateId,
      installOk: false,
      buildOk: false,
      installDurationMs: 0,
      buildDurationMs: 0,
      totalDurationMs: 0,
      error: `Template "${templateId}" not found.`,
    };
  }

  const tmpDir = path.join(os.tmpdir(), `devdash-tpltest-${templateId}-${Date.now()}`);
  emit(templateId, 'system', `Scaffolding to temp dir: ${tmpDir}`);

  try {
    copyDir(tplDir, tmpDir);

    let installOk = true;
    let buildOk = true;
    let installDurationMs = 0;
    let buildDurationMs = 0;

    // Check frontend and backend subdirs, or root
    const subDirs: string[] = [];
    const frontendDir = path.join(tmpDir, 'frontend');
    const backendDir = path.join(tmpDir, 'backend');

    if (fs.existsSync(frontendDir) && hasPkgJson(frontendDir)) subDirs.push(frontendDir);
    if (fs.existsSync(backendDir) && hasPkgJson(backendDir)) subDirs.push(backendDir);
    if (subDirs.length === 0 && hasPkgJson(tmpDir)) subDirs.push(tmpDir);

    for (const dir of subDirs) {
      const dirLabel = path.basename(dir) === path.basename(tmpDir) ? 'root' : path.basename(dir);

      // Install
      emit(templateId, 'system', `Installing deps in ${dirLabel}...`);
      const installResult = await runCmd('npm', ['install', '--no-fund', '--no-audit'], dir, templateId, 5 * 60 * 1000);
      installDurationMs += installResult.durationMs;
      if (!installResult.ok) {
        installOk = false;
        emit(templateId, 'system', `Install FAILED in ${dirLabel}`);
      } else {
        emit(templateId, 'system', `Install OK in ${dirLabel}`);
      }

      // Build (only if install succeeded and build script exists)
      if (installResult.ok && hasBuildScript(dir)) {
        emit(templateId, 'system', `Building ${dirLabel}...`);
        const buildResult = await runCmd('npm', ['run', 'build'], dir, templateId, 5 * 60 * 1000);
        buildDurationMs += buildResult.durationMs;
        if (!buildResult.ok) {
          buildOk = false;
          emit(templateId, 'system', `Build FAILED in ${dirLabel}`);
        } else {
          emit(templateId, 'system', `Build OK in ${dirLabel}`);
        }
      }
    }

    if (subDirs.length === 0) {
      emit(templateId, 'system', 'No package.json found, skipping npm steps.');
    }

    const totalDurationMs = Date.now() - totalStart;
    emit(templateId, 'system', `Test complete. Total: ${totalDurationMs}ms`);

    return { templateId, installOk, buildOk, installDurationMs, buildDurationMs, totalDurationMs };
  } catch (err) {
    return {
      templateId,
      installOk: false,
      buildOk: false,
      installDurationMs: 0,
      buildDurationMs: 0,
      totalDurationMs: Date.now() - totalStart,
      error: (err as Error).message,
    };
  } finally {
    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export async function testAllTemplates(): Promise<TemplateTestResult[]> {
  if (running) return [];
  running = true;
  try {
    const templates = listTemplates();
    const results: TemplateTestResult[] = [];
    for (const tpl of templates) {
      const result = await testTemplate(tpl.id);
      results.push(result);
    }
    return results;
  } finally {
    running = false;
  }
}

export function isRunning(): boolean {
  return running;
}
