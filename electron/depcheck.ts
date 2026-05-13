import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { insertDepReport, readLatestDepReport, DepReportRow } from './cache';

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'major' | 'minor' | 'patch' | 'other';
}

export interface AuditCounts {
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

export interface EngineCheck {
  required: string | null;
  installed: string;
  ok: boolean;
}

export interface DepSummary {
  projectId: string;
  runAt: number;
  packages: OutdatedPackage[];
  majorCount: number;
  minorCount: number;
  patchCount: number;
  audit?: AuditCounts;
  engine?: EngineCheck;
}

export interface SafeUpdateResult {
  ok: boolean;
  error?: string;
  updated?: string[];
  auditFixed?: number;
  buildOk?: boolean;
  buildOutput?: string;
  rolledBack?: boolean;
  steps: string[];
}

function classify(pkg: { current?: string; wanted?: string; latest?: string }): OutdatedPackage['type'] {
  if (!pkg.current || !pkg.latest) return 'other';
  const cur = pkg.current.split('.');
  const lat = pkg.latest.split('.');
  if (cur.length < 3 || lat.length < 3) return 'other';
  if (cur[0] !== lat[0]) return 'major';
  if (cur[1] !== lat[1]) return 'minor';
  if (cur[2] !== lat[2]) return 'patch';
  return 'other';
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 120000
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const p = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    const to = setTimeout(() => {
      try {
        p.kill();
      } catch {
        /* ignore */
      }
      resolve({ code: -1, stdout, stderr: stderr + '\n[timeout]' });
    }, timeoutMs);
    p.stdout.on('data', (d) => (stdout += d.toString('utf-8')));
    p.stderr.on('data', (d) => (stderr += d.toString('utf-8')));
    p.on('close', (code) => {
      clearTimeout(to);
      resolve({ code: code ?? 0, stdout, stderr });
    });
    p.on('error', (err) => {
      clearTimeout(to);
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

async function runNpmOutdated(cwd: string): Promise<string> {
  const r = await runCmd('npm', ['outdated', '--json', '--long'], cwd, 90000);
  return r.stdout;
}

async function runNpmAudit(cwd: string): Promise<AuditCounts | undefined> {
  const r = await runCmd('npm', ['audit', '--json'], cwd, 90000);
  if (!r.stdout) return undefined;
  try {
    const j = JSON.parse(r.stdout);
    const v = j?.metadata?.vulnerabilities ?? {};
    return {
      low: Number(v.low ?? 0),
      moderate: Number(v.moderate ?? 0),
      high: Number(v.high ?? 0),
      critical: Number(v.critical ?? 0),
      total: Number(v.total ?? (Number(v.low ?? 0) + Number(v.moderate ?? 0) + Number(v.high ?? 0) + Number(v.critical ?? 0))),
    };
  } catch {
    return undefined;
  }
}

function satisfiesEngine(required: string, installed: string): boolean {
  // Very light semver range check. Supports: ">=X", ">=X.Y", ">=X.Y.Z", "^X", "~X", "X", ">X".
  const inst = installed.replace(/^v/, '').split('.').map((n) => parseInt(n, 10));
  const reqMatch = required.match(/(>=|>|<=|<|\^|~)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!reqMatch) return true;
  const [, op, maj, min, patch] = reqMatch;
  const rM = parseInt(maj, 10);
  const rm = min ? parseInt(min, 10) : 0;
  const rp = patch ? parseInt(patch, 10) : 0;
  const iM = inst[0] ?? 0;
  const im = inst[1] ?? 0;
  const ip = inst[2] ?? 0;
  const cmp = iM !== rM ? iM - rM : im !== rm ? im - rm : ip - rp;
  switch (op) {
    case '>=':
      return cmp >= 0;
    case '>':
      return cmp > 0;
    case '<=':
      return cmp <= 0;
    case '<':
      return cmp < 0;
    case '^':
      return iM === rM && cmp >= 0;
    case '~':
      return iM === rM && im === rm && ip >= rp;
    default:
      return iM === rM && im === rm;
  }
}

function checkEngine(pkg: any): EngineCheck | undefined {
  const req: string | undefined = pkg?.engines?.node;
  const installed = process.version; // e.g. "v24.14.1"
  if (!req) return { required: null, installed, ok: true };
  return {
    required: req,
    installed,
    ok: satisfiesEngine(req, installed),
  };
}

export async function runForProject(projectId: string, projectPath: string): Promise<DepSummary | null> {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  let pkgJson: any = {};
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    /* ignore */
  }

  const [raw, audit] = await Promise.all([runNpmOutdated(projectPath), runNpmAudit(projectPath)]);
  let parsed: Record<string, any> = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  const packages: OutdatedPackage[] = [];
  let major = 0;
  let minor = 0;
  let patch = 0;
  for (const [name, info] of Object.entries(parsed)) {
    const pkgInfo = info as { current?: string; wanted?: string; latest?: string };
    const type = classify(pkgInfo);
    if (type === 'major') major++;
    else if (type === 'minor') minor++;
    else if (type === 'patch') patch++;
    packages.push({
      name,
      current: pkgInfo.current ?? '-',
      wanted: pkgInfo.wanted ?? '-',
      latest: pkgInfo.latest ?? '-',
      type,
    });
  }
  packages.sort((a, b) => {
    const weight = (t: OutdatedPackage['type']) =>
      t === 'major' ? 0 : t === 'minor' ? 1 : t === 'patch' ? 2 : 3;
    return weight(a.type) - weight(b.type) || a.name.localeCompare(b.name);
  });

  const engine = checkEngine(pkgJson);
  const runAt = Date.now();
  insertDepReport({
    projectId,
    runAt,
    majorCount: major,
    minorCount: minor,
    patchCount: patch,
    payload: JSON.stringify({ packages, audit, engine }),
  });
  return {
    projectId,
    runAt,
    packages,
    majorCount: major,
    minorCount: minor,
    patchCount: patch,
    audit,
    engine,
  };
}

export function latest(projectId: string): DepSummary | null {
  const row: DepReportRow | null = readLatestDepReport(projectId);
  if (!row) return null;
  let packages: OutdatedPackage[] = [];
  let audit: AuditCounts | undefined;
  let engine: EngineCheck | undefined;
  try {
    const parsed = JSON.parse(row.payload);
    if (Array.isArray(parsed)) {
      // Legacy format (just array of packages)
      packages = parsed;
    } else {
      packages = parsed.packages ?? [];
      audit = parsed.audit;
      engine = parsed.engine;
    }
  } catch {
    packages = [];
  }
  return {
    projectId,
    runAt: row.runAt,
    packages,
    majorCount: row.majorCount,
    minorCount: row.minorCount,
    patchCount: row.patchCount,
    audit,
    engine,
  };
}

/**
 * Safe-update: back up manifest + lockfile, run `npm update` (stays in semver range)
 * and `npm audit fix` (non-breaking), verify with `npm run build` if script exists,
 * rollback on build failure.
 */
export async function safeUpdate(projectPath: string): Promise<SafeUpdateResult> {
  const steps: string[] = [];
  const pkgPath = path.join(projectPath, 'package.json');
  const lockPath = path.join(projectPath, 'package-lock.json');
  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: 'No package.json', steps };
  }

  // Snapshot before + package versions
  let before: any = {};
  try {
    before = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    /* ignore */
  }
  const pkgBackup = fs.readFileSync(pkgPath, 'utf-8');
  const lockBackup = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf-8') : null;
  steps.push('Backup taken.');

  // Read installed versions before (from lockfile or node_modules manifest)
  const beforeVersions: Record<string, string> = {};
  try {
    if (lockBackup) {
      const lj = JSON.parse(lockBackup);
      const pkgs = lj?.packages ?? {};
      for (const [p, meta] of Object.entries(pkgs)) {
        if (p && p.startsWith('node_modules/')) {
          const name = p.replace(/^node_modules\//, '');
          const v = (meta as any)?.version;
          if (v) beforeVersions[name] = v;
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Run npm update (patches + minors within semver range)
  steps.push('Running npm update\u2026');
  const upd = await runCmd('npm', ['update'], projectPath, 300000);
  if (upd.code !== 0) {
    steps.push(`npm update exited ${upd.code}`);
  }

  // Run npm audit fix (non-breaking)
  steps.push('Running npm audit fix\u2026');
  const fix = await runCmd('npm', ['audit', 'fix'], projectPath, 300000);
  if (fix.code !== 0) {
    steps.push(`npm audit fix exited ${fix.code}`);
  }
  const fixMatch = fix.stdout.match(/(\d+)\s+vulnerabilities?\s+fixed/i);
  const auditFixed = fixMatch ? parseInt(fixMatch[1], 10) : 0;

  // Compute list of packages that actually changed
  const updated: string[] = [];
  try {
    if (fs.existsSync(lockPath)) {
      const lj = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      const pkgs = lj?.packages ?? {};
      for (const [p, meta] of Object.entries(pkgs)) {
        if (p && p.startsWith('node_modules/')) {
          const name = p.replace(/^node_modules\//, '');
          const v = (meta as any)?.version;
          if (v && beforeVersions[name] && beforeVersions[name] !== v) {
            updated.push(`${name}: ${beforeVersions[name]} \u2192 ${v}`);
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  steps.push(`${updated.length} package(s) updated.`);

  // Verify with build if script exists
  const hasBuild = !!before?.scripts?.build;
  let buildOk: boolean | undefined;
  let buildOutput: string | undefined;
  if (hasBuild) {
    steps.push('Verifying with npm run build\u2026');
    const build = await runCmd('npm', ['run', 'build'], projectPath, 600000);
    buildOk = build.code === 0;
    buildOutput = (build.stdout + (build.stderr ? `\n${build.stderr}` : '')).slice(-2000);
    if (!buildOk) {
      steps.push('Build failed. Rolling back\u2026');
      fs.writeFileSync(pkgPath, pkgBackup, 'utf-8');
      if (lockBackup !== null) fs.writeFileSync(lockPath, lockBackup, 'utf-8');
      await runCmd('npm', ['install'], projectPath, 600000);
      steps.push('Rollback complete (npm install run).');
      return {
        ok: false,
        error: 'Build failed after updates',
        updated,
        auditFixed,
        buildOk,
        buildOutput,
        rolledBack: true,
        steps,
      };
    }
    steps.push('Build passed.');
  } else {
    steps.push('No build script. Skipping build verification.');
  }

  return {
    ok: true,
    updated,
    auditFixed,
    buildOk,
    buildOutput,
    rolledBack: false,
    steps,
  };
}
