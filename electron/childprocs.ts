import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { detectFramework, FrameworkInfo } from './frameworks';

export interface LogLine {
  ts: number;
  stream: 'stdout' | 'stderr' | 'system';
  level: 'info' | 'warn' | 'error';
  line: string;
}

interface ManagedProc {
  projectId: string;
  framework: FrameworkInfo;
  proc: ChildProcess;
  startedAt: number;
  buffer: LogLine[];
  exitCode: number | null;
  running: boolean;
}

const MAX_BUFFER = 2000;
const procs = new Map<string, ManagedProc>();
const emitter = new EventEmitter();

function classify(line: string): 'info' | 'warn' | 'error' {
  const lc = line.toLowerCase();
  if (/\b(error|err|fatal|exception|failed|✗|panic)\b/.test(lc)) return 'error';
  if (/\b(warn|warning|deprecated|⚠)\b/.test(lc)) return 'warn';
  return 'info';
}

function pushLine(m: ManagedProc, stream: LogLine['stream'], raw: string) {
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  for (const l of lines) {
    const entry: LogLine = {
      ts: Date.now(),
      stream,
      level: stream === 'stderr' ? 'error' : classify(l),
      line: stripAnsi(l).slice(0, 2000),
    };
    m.buffer.push(entry);
    if (m.buffer.length > MAX_BUFFER) m.buffer.splice(0, m.buffer.length - MAX_BUFFER);
    emitter.emit('log', m.projectId, entry);
  }
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

export function startDev(projectId: string, projectPath: string): { ok: boolean; error?: string; framework?: FrameworkInfo } {
  const existing = procs.get(projectId);
  if (existing && existing.running) {
    return { ok: true, framework: existing.framework };
  }
  const fw = detectFramework(projectPath);
  if (fw.id === 'unknown') {
    return { ok: false, error: 'No runnable framework detected' };
  }

  try {
    const proc = spawn(fw.command, fw.args, {
      cwd: fw.cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    const managed: ManagedProc = {
      projectId,
      framework: fw,
      proc,
      startedAt: Date.now(),
      buffer: [],
      exitCode: null,
      running: true,
    };
    pushLine(managed, 'system', `[devdash] spawned: ${fw.command} ${fw.args.join(' ')} (cwd: ${fw.cwd})`);

    proc.stdout?.on('data', (data) => pushLine(managed, 'stdout', data.toString('utf-8')));
    proc.stderr?.on('data', (data) => pushLine(managed, 'stderr', data.toString('utf-8')));
    proc.on('error', (err) => pushLine(managed, 'system', `[devdash] error: ${err.message}`));
    proc.on('exit', (code) => {
      managed.running = false;
      managed.exitCode = code ?? null;
      pushLine(managed, 'system', `[devdash] exited with code ${code}`);
      emitter.emit('status', projectId, { running: false, exitCode: code ?? null });
    });

    procs.set(projectId, managed);
    emitter.emit('status', projectId, { running: true, framework: fw });
    return { ok: true, framework: fw };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function stopDev(projectId: string): { ok: boolean; error?: string } {
  const m = procs.get(projectId);
  if (!m || !m.running) return { ok: false, error: 'Not running' };
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(m.proc.pid), '/f', '/t'], { windowsHide: true });
    } else {
      m.proc.kill('SIGTERM');
    }
    pushLine(m, 'system', `[devdash] kill requested`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function getStatus(projectId: string): {
  running: boolean;
  framework: FrameworkInfo | null;
  startedAt: number | null;
  exitCode: number | null;
} {
  const m = procs.get(projectId);
  if (!m) return { running: false, framework: null, startedAt: null, exitCode: null };
  return {
    running: m.running,
    framework: m.framework,
    startedAt: m.startedAt,
    exitCode: m.exitCode,
  };
}

export function getAllStatuses(): Record<string, ReturnType<typeof getStatus>> {
  const out: Record<string, ReturnType<typeof getStatus>> = {};
  for (const id of procs.keys()) out[id] = getStatus(id);
  return out;
}

export function getManagedPids(): Map<number, string> {
  // Map of PID -> projectId for DevDash-managed dev servers.
  const out = new Map<number, string>();
  for (const [id, m] of procs.entries()) {
    if (m.running && m.proc.pid) out.set(m.proc.pid, id);
  }
  return out;
}

export function getBuffer(projectId: string, limit = MAX_BUFFER): LogLine[] {
  const m = procs.get(projectId);
  if (!m) return [];
  return m.buffer.slice(-limit);
}

export function onLog(cb: (projectId: string, line: LogLine) => void): () => void {
  emitter.on('log', cb);
  return () => emitter.off('log', cb);
}

export function onStatus(cb: (projectId: string, payload: any) => void): () => void {
  emitter.on('status', cb);
  return () => emitter.off('status', cb);
}

export function bindBroadcast(window: () => BrowserWindow | null): void {
  emitter.on('log', (projectId: string, line: LogLine) => {
    const w = window();
    if (w && !w.isDestroyed()) w.webContents.send('logs:line', { projectId, line });
  });
  emitter.on('status', (projectId: string, payload: any) => {
    const w = window();
    if (w && !w.isDestroyed()) w.webContents.send('devserver:status', { projectId, ...payload });
  });
}

export function killAll(): void {
  for (const [id] of procs) {
    try {
      stopDev(id);
    } catch {
      /* ignore */
    }
  }
}
