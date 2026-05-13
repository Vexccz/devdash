import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface PortEntry {
  port: number;
  pid: number;
  processName: string;
  processPath?: string;
  protocol: 'TCP' | 'UDP';
  localAddress: string;
  state?: string;
  // DevDash-enriched fields
  projectId?: string;
  projectName?: string;
  isDevDashManaged?: boolean; // DevDash started this process
}

export interface PortsResult {
  ok: boolean;
  entries: PortEntry[];
  error?: string;
}

export interface KillResult {
  ok: boolean;
  pid: number;
  error?: string;
}

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

/**
 * Run netstat -ano on Windows to list listening ports + PIDs.
 */
async function listWindowsPorts(): Promise<PortEntry[]> {
  const res = await execFileP('netstat', ['-ano']);
  if (!res.stdout) return [];
  const out: PortEntry[] = [];
  const lines = res.stdout.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Example: "  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       12345"
    const m = line.match(/^(TCP|UDP)\s+(\S+)\s+(\S+)\s+(\S+)?\s*(\d+)?$/);
    if (!m) continue;
    const protocol = m[1] as 'TCP' | 'UDP';
    const localAddress = m[2];
    const state = m[4];
    const pid = parseInt(m[5] ?? '0', 10);
    if (protocol === 'TCP' && state !== 'LISTENING') continue;
    if (!pid) continue;
    const portMatch = localAddress.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);
    if (!port) continue;
    out.push({
      port,
      pid,
      processName: '',
      protocol,
      localAddress,
      state,
    });
  }
  // Dedupe by port+pid (IPv4 + IPv6 pairs)
  const seen = new Set<string>();
  return out.filter((e) => {
    const k = `${e.port}:${e.pid}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Map PIDs to process names via tasklist /FO CSV.
 */
async function enrichWithTaskNames(entries: PortEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const res = await execFileP('tasklist', ['/FO', 'CSV', '/NH']);
  if (!res.stdout) return;
  const map = new Map<number, string>();
  const lines = res.stdout.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw.trim()) continue;
    // "chrome.exe","12345","Console","1","234,567 K"
    const parts = raw.match(/"([^"]*)","(\d+)"/);
    if (!parts) continue;
    const name = parts[1];
    const pid = parseInt(parts[2], 10);
    if (pid) map.set(pid, name);
  }
  for (const e of entries) {
    if (map.has(e.pid)) e.processName = map.get(e.pid)!;
  }
}

/**
 * Unix: lsof -i -P -n +c 0 | grep LISTEN
 */
async function listUnixPorts(): Promise<PortEntry[]> {
  const res = await execFileP('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n', '+c', '0']);
  if (!res.stdout) return [];
  const out: PortEntry[] = [];
  const lines = res.stdout.split(/\r?\n/).slice(1);
  for (const raw of lines) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const processName = parts[0];
    const pid = parseInt(parts[1], 10);
    const addr = parts[8];
    const portMatch = addr.match(/:(\d+)$/);
    if (!portMatch || !pid) continue;
    out.push({
      port: parseInt(portMatch[1], 10),
      pid,
      processName,
      protocol: 'TCP',
      localAddress: addr,
      state: 'LISTENING',
    });
  }
  return out;
}

export async function listPorts(): Promise<PortsResult> {
  try {
    if (process.platform === 'win32') {
      const entries = await listWindowsPorts();
      await enrichWithTaskNames(entries);
      entries.sort((a, b) => a.port - b.port);
      return { ok: true, entries };
    }
    const entries = await listUnixPorts();
    entries.sort((a, b) => a.port - b.port);
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, entries: [], error: (err as Error).message };
  }
}

/**
 * Kill a process by PID. On Windows uses `taskkill /F /PID <pid>`. On Unix uses `kill -9`.
 */
export async function killPid(pid: number): Promise<KillResult> {
  if (!pid || pid < 2) return { ok: false, pid, error: 'Invalid PID' };
  try {
    if (process.platform === 'win32') {
      const res = await execFileP('taskkill', ['/F', '/PID', String(pid)]);
      if (res.code !== 0) {
        return { ok: false, pid, error: res.stderr || res.stdout || `taskkill exited ${res.code}` };
      }
      return { ok: true, pid };
    }
    try {
      process.kill(pid, 'SIGKILL');
      return { ok: true, pid };
    } catch (err) {
      return { ok: false, pid, error: (err as Error).message };
    }
  } catch (err) {
    return { ok: false, pid, error: (err as Error).message };
  }
}

/**
 * Detect the dev-server port a project would use, based on package.json + vite/next config.
 * Mirrors detectDevServer in git.ts but kept local so we don't import a cycle.
 */
export function detectProjectPort(projectPath: string): number | null {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    const devScript = scripts.dev ?? scripts.start ?? '';

    for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']) {
      const p = path.join(projectPath, f);
      if (fs.existsSync(p)) {
        try {
          const txt = fs.readFileSync(p, 'utf-8');
          const m = txt.match(/port\s*:\s*(\d{2,5})/);
          if (m) return Number(m[1]);
        } catch {
          /* ignore */
        }
      }
    }

    if (devScript) {
      const m = devScript.match(/--?port[=\s]+(\d{2,5})|-p\s+(\d{2,5})/);
      if (m) return Number(m[1] ?? m[2]);
    }

    if (devScript.includes('vite')) return 5173;
    if (devScript.includes('next')) return 3000;
    if (devScript.includes('expo')) return 8081;
    if (devScript.includes('uvicorn')) return 8000;
    return null;
  } catch {
    return null;
  }
}
