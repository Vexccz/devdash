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

export interface DepSummary {
  projectId: string;
  runAt: number;
  packages: OutdatedPackage[];
  majorCount: number;
  minorCount: number;
  patchCount: number;
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

function runNpmOutdated(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn('npm', ['outdated', '--json', '--long'], {
      cwd,
      shell: true,
      windowsHide: true,
    });
    p.stdout.on('data', (d) => (out += d.toString('utf-8')));
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
  });
}

export async function runForProject(projectId: string, projectPath: string): Promise<DepSummary | null> {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const raw = await runNpmOutdated(projectPath);
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
  const runAt = Date.now();
  insertDepReport({
    projectId,
    runAt,
    majorCount: major,
    minorCount: minor,
    patchCount: patch,
    payload: JSON.stringify(packages),
  });
  return { projectId, runAt, packages, majorCount: major, minorCount: minor, patchCount: patch };
}

export function latest(projectId: string): DepSummary | null {
  const row: DepReportRow | null = readLatestDepReport(projectId);
  if (!row) return null;
  let packages: OutdatedPackage[] = [];
  try {
    packages = JSON.parse(row.payload);
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
  };
}
