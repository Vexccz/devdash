import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';

export interface CapacitorInfo {
  ok: boolean;
  isCapacitor: boolean;
  capacitorVersion?: string;
  androidFolder: boolean;
  appId?: string;
  appName?: string;
  webDir?: string;
  buildScript?: string;
  error?: string;
}

export interface JavaInfo {
  ok: boolean;
  installed?: string;   // e.g. "17.0.8"
  major?: number;       // 17
  javaHome?: string;
  required?: number;    // inferred from Capacitor version: 6→17, 7→17, 8→21
  compatible?: boolean;
  hint?: string;
  error?: string;
}

export interface ApkBuildResult {
  ok: boolean;
  apkPath?: string;
  copiedTo?: string;
  durationMs?: number;
  error?: string;
  logs?: string[];
}

export type BuildLogEvent = {
  projectId: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  ts: number;
};

const emitter = new EventEmitter();
const activeBuilds = new Set<string>();

function execFileP(cmd: string, args: string[], timeoutMs = 10000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const p = execFile(cmd, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, so, se) => {
      stdout = so ?? '';
      stderr = se ?? '';
      resolve({ code: err ? (err as any).code ?? -1 : 0, stdout, stderr });
    });
    setTimeout(() => {
      try {
        p.kill();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
  });
}

export function detectCapacitor(projectPath: string): CapacitorInfo {
  try {
    if (!fs.existsSync(projectPath)) {
      return { ok: false, isCapacitor: false, androidFolder: false, error: 'Path missing' };
    }
    const pkgPath = path.join(projectPath, 'package.json');
    const configTsPath = path.join(projectPath, 'capacitor.config.ts');
    const configJsonPath = path.join(projectPath, 'capacitor.config.json');
    const configJsPath = path.join(projectPath, 'capacitor.config.js');
    const androidDir = path.join(projectPath, 'android');

    let capVersion: string | undefined;
    let buildScript: string | undefined;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as any;
        capVersion =
          pkg?.dependencies?.['@capacitor/core'] ??
          pkg?.devDependencies?.['@capacitor/core'] ??
          pkg?.dependencies?.['@capacitor/cli'];
        if (typeof capVersion === 'string') capVersion = capVersion.replace(/^[\^~]/, '');
        buildScript = pkg?.scripts?.build ?? pkg?.scripts?.['build:app'];
      } catch {
        /* ignore */
      }
    }

    const hasConfig = fs.existsSync(configTsPath) || fs.existsSync(configJsonPath) || fs.existsSync(configJsPath);
    const isCap = !!capVersion || hasConfig;

    let appId: string | undefined;
    let appName: string | undefined;
    let webDir: string | undefined;
    const readConfig = (p: string) => {
      try {
        const txt = fs.readFileSync(p, 'utf-8');
        const idMatch = txt.match(/appId\s*:\s*['"]([^'"]+)['"]/);
        const nameMatch = txt.match(/appName\s*:\s*['"]([^'"]+)['"]/);
        const webMatch = txt.match(/webDir\s*:\s*['"]([^'"]+)['"]/);
        if (idMatch) appId = idMatch[1];
        if (nameMatch) appName = nameMatch[1];
        if (webMatch) webDir = webMatch[1];
      } catch {
        /* ignore */
      }
    };
    if (fs.existsSync(configJsonPath)) {
      try {
        const j = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'));
        appId = j.appId;
        appName = j.appName;
        webDir = j.webDir;
      } catch {
        /* ignore */
      }
    } else if (fs.existsSync(configTsPath)) {
      readConfig(configTsPath);
    } else if (fs.existsSync(configJsPath)) {
      readConfig(configJsPath);
    }

    return {
      ok: true,
      isCapacitor: isCap,
      capacitorVersion: capVersion,
      androidFolder: fs.existsSync(androidDir),
      appId,
      appName,
      webDir,
      buildScript,
    };
  } catch (err) {
    return { ok: false, isCapacitor: false, androidFolder: false, error: (err as Error).message };
  }
}

function requiredJavaMajor(capVersion?: string): number {
  if (!capVersion) return 17;
  const m = capVersion.match(/^(\d+)/);
  if (!m) return 17;
  const major = parseInt(m[1], 10);
  if (major >= 7) return 21;
  return 17;
}

export async function detectJava(capVersion?: string): Promise<JavaInfo> {
  const required = requiredJavaMajor(capVersion);
  try {
    const res = await execFileP('java', ['-version']);
    // `java -version` writes to stderr on most JDKs
    const text = (res.stderr + res.stdout).trim();
    const m = text.match(/version "([^"]+)"/);
    if (!m) {
      return {
        ok: false,
        required,
        error: 'Could not parse java -version output',
        hint: 'Install JDK ' + required + ' and ensure `java` is in PATH.',
      };
    }
    const installed = m[1];
    const majorMatch = installed.match(/^(\d+)/);
    const major = majorMatch ? parseInt(majorMatch[1], 10) : undefined;
    const javaHome = process.env.JAVA_HOME || undefined;
    const compatible = major === required;
    let hint: string | undefined;
    if (!compatible) {
      if (major && major > required) {
        hint = `Installed Java ${major} is newer than required ${required}. Capacitor ${capVersion ?? '?'} expects JDK ${required}.`;
      } else {
        hint = `Capacitor ${capVersion ?? '?'} requires JDK ${required}. Install it and point JAVA_HOME there.`;
      }
    }
    return {
      ok: true,
      installed,
      major,
      javaHome,
      required,
      compatible,
      hint,
    };
  } catch (err) {
    return {
      ok: false,
      required,
      error: (err as Error).message,
      hint: 'Install JDK ' + required + ' and ensure `java` is in PATH.',
    };
  }
}

function findGradlew(projectPath: string): string | null {
  const androidDir = path.join(projectPath, 'android');
  if (!fs.existsSync(androidDir)) return null;
  const gradlewWin = path.join(androidDir, 'gradlew.bat');
  const gradlewUnix = path.join(androidDir, 'gradlew');
  if (process.platform === 'win32' && fs.existsSync(gradlewWin)) return gradlewWin;
  if (fs.existsSync(gradlewUnix)) return gradlewUnix;
  return null;
}

export function onBuildLog(cb: (e: BuildLogEvent) => void): () => void {
  emitter.on('log', cb);
  return () => emitter.off('log', cb);
}

export function bindBroadcast(window: () => BrowserWindow | null): void {
  emitter.on('log', (e: BuildLogEvent) => {
    const w = window();
    if (!w || w.isDestroyed()) return;
    w.webContents.send('capacitor:log', e);
  });
}

function emitLog(projectId: string, stream: BuildLogEvent['stream'], line: string) {
  const event: BuildLogEvent = { projectId, stream, line, ts: Date.now() };
  emitter.emit('log', event);
}

interface RunOpts {
  cwd: string;
  timeoutMs: number;
  projectId: string;
  env?: Record<string, string>;
}

function runStreamed(cmd: string, args: string[], opts: RunOpts): Promise<number> {
  return new Promise((resolve) => {
    emitLog(opts.projectId, 'system', `$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    const to = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      emitLog(opts.projectId, 'system', '[timeout] build step killed');
      resolve(-1);
    }, opts.timeoutMs);
    child.stdout.on('data', (d) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emitLog(opts.projectId, 'stdout', line);
      }
    });
    child.stderr.on('data', (d) => {
      for (const line of d.toString('utf-8').split(/\r?\n/)) {
        if (line) emitLog(opts.projectId, 'stderr', line);
      }
    });
    child.on('close', (code) => {
      clearTimeout(to);
      resolve(code ?? 0);
    });
    child.on('error', (err) => {
      clearTimeout(to);
      emitLog(opts.projectId, 'stderr', `[error] ${err.message}`);
      resolve(-1);
    });
  });
}

export function isBuilding(projectId: string): boolean {
  return activeBuilds.has(projectId);
}

export interface BuildApkOptions {
  projectId: string;
  projectPath: string;
  projectName: string;
  flavor: 'debug' | 'release';
  runWebBuild: boolean;
  runSync: boolean;
  outputDir?: string;
}

export async function buildApk(opts: BuildApkOptions): Promise<ApkBuildResult> {
  if (activeBuilds.has(opts.projectId)) {
    return { ok: false, error: 'A build is already running for this project.' };
  }
  activeBuilds.add(opts.projectId);
  const started = Date.now();
  try {
    const detect = detectCapacitor(opts.projectPath);
    if (!detect.isCapacitor) {
      return { ok: false, error: 'Not a Capacitor project.' };
    }
    if (!detect.androidFolder) {
      return { ok: false, error: 'No android/ folder. Run `npx cap add android` first.' };
    }

    const javaInfo = await detectJava(detect.capacitorVersion);
    if (!javaInfo.compatible) {
      emitLog(opts.projectId, 'system', `[warn] ${javaInfo.hint ?? 'Java version mismatch'}`);
    } else {
      emitLog(opts.projectId, 'system', `Java ${javaInfo.installed} \u2713 (required ${javaInfo.required})`);
    }

    if (opts.runWebBuild) {
      emitLog(opts.projectId, 'system', `Running web build\u2026`);
      const code = await runStreamed('npm', ['run', 'build'], {
        cwd: opts.projectPath,
        timeoutMs: 600000,
        projectId: opts.projectId,
      });
      if (code !== 0) {
        return { ok: false, error: `Web build failed (exit ${code}).` };
      }
    }

    if (opts.runSync) {
      emitLog(opts.projectId, 'system', `Running npx cap sync android\u2026`);
      const code = await runStreamed('npx', ['cap', 'sync', 'android'], {
        cwd: opts.projectPath,
        timeoutMs: 600000,
        projectId: opts.projectId,
      });
      if (code !== 0) {
        return { ok: false, error: `cap sync failed (exit ${code}).` };
      }
    }

    const gradlew = findGradlew(opts.projectPath);
    if (!gradlew) {
      return { ok: false, error: 'gradlew not found in android/. Run `npx cap add android`.' };
    }
    const gradleTask = opts.flavor === 'release' ? 'assembleRelease' : 'assembleDebug';
    const androidDir = path.join(opts.projectPath, 'android');
    emitLog(opts.projectId, 'system', `Running ${path.basename(gradlew)} ${gradleTask}\u2026`);
    const gradleCode = await runStreamed(gradlew, [gradleTask, '--no-daemon'], {
      cwd: androidDir,
      timeoutMs: 30 * 60 * 1000,
      projectId: opts.projectId,
    });
    if (gradleCode !== 0) {
      if (javaInfo.compatible === false && javaInfo.hint) {
        return { ok: false, error: `Gradle build failed (exit ${gradleCode}). ${javaInfo.hint}` };
      }
      return { ok: false, error: `Gradle build failed (exit ${gradleCode}).` };
    }

    const apkDir = path.join(
      androidDir,
      'app',
      'build',
      'outputs',
      'apk',
      opts.flavor
    );
    let apkPath: string | undefined;
    if (fs.existsSync(apkDir)) {
      const files = fs.readdirSync(apkDir).filter((f) => f.endsWith('.apk'));
      if (files.length > 0) apkPath = path.join(apkDir, files[0]);
    }
    if (!apkPath) {
      return { ok: false, error: 'Build succeeded but no APK found in outputs.' };
    }

    let copiedTo: string | undefined;
    if (opts.outputDir && fs.existsSync(opts.outputDir)) {
      const base = path.basename(apkPath);
      const stem = path.basename(base, '.apk');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outName = `${opts.projectName.replace(/\s+/g, '-')}-${opts.flavor}-${stamp}.apk`;
      void stem;
      copiedTo = path.join(opts.outputDir, outName);
      try {
        fs.copyFileSync(apkPath, copiedTo);
        emitLog(opts.projectId, 'system', `Copied to ${copiedTo}`);
      } catch (err) {
        emitLog(opts.projectId, 'system', `[warn] Copy failed: ${(err as Error).message}`);
        copiedTo = undefined;
      }
    }

    return {
      ok: true,
      apkPath,
      copiedTo,
      durationMs: Date.now() - started,
    };
  } finally {
    activeBuilds.delete(opts.projectId);
  }
}
