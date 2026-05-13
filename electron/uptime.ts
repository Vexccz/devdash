import axios from 'axios';
import { insertUptime, readUptime, readLatestUptime, UptimeRow } from './cache';
import { loadConfig, ProjectConfig } from './config';

export async function checkOne(project: ProjectConfig): Promise<UptimeRow | null> {
  if (!project.liveUrl) return null;
  const started = Date.now();
  try {
    const res = await axios.get(project.liveUrl, {
      timeout: 10000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'DevDash/0.8.1 uptime-check' },
    });
    const row: Omit<UptimeRow, 'id'> = {
      projectId: project.id,
      url: project.liveUrl,
      status: res.status,
      ok: res.status >= 200 && res.status < 400 ? 1 : 0,
      latencyMs: Date.now() - started,
      checkedAt: Date.now(),
      error: null,
    };
    insertUptime(row);
    return { id: 0, ...row };
  } catch (err) {
    const row: Omit<UptimeRow, 'id'> = {
      projectId: project.id,
      url: project.liveUrl,
      status: 0,
      ok: 0,
      latencyMs: Date.now() - started,
      checkedAt: Date.now(),
      error: (err as Error).message.slice(0, 300),
    };
    insertUptime(row);
    return { id: 0, ...row };
  }
}

export interface UptimeCheckResult {
  projectId: string;
  previousOk: boolean | null;
  currentOk: boolean;
  row: UptimeRow;
}

export async function runAllChecks(): Promise<UptimeCheckResult[]> {
  const cfg = loadConfig();
  const results: UptimeCheckResult[] = [];
  for (const p of cfg.projects) {
    if (!p.liveUrl) continue;
    const prev = readLatestUptime(p.id);
    const row = await checkOne(p);
    if (!row) continue;
    results.push({
      projectId: p.id,
      previousOk: prev ? !!prev.ok : null,
      currentOk: !!row.ok,
      row,
    });
  }
  return results;
}

export interface UptimeSummary {
  projectId: string;
  url: string | null;
  latestOk: boolean | null;
  latestStatus: number | null;
  latestCheckedAt: number | null;
  uptimePct24h: number;
  avgLatencyMs: number | null;
  samples: { checkedAt: number; latencyMs: number; ok: number; status: number }[];
}

export function summaryFor(projectId: string, hours = 24): UptimeSummary {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const rows = readUptime(projectId, since);
  const latest = readLatestUptime(projectId);
  const oks = rows.filter((r) => r.ok === 1).length;
  const pct = rows.length ? (oks / rows.length) * 100 : 0;
  const avg = rows.length ? rows.reduce((a, r) => a + r.latencyMs, 0) / rows.length : null;
  return {
    projectId,
    url: latest?.url ?? null,
    latestOk: latest ? !!latest.ok : null,
    latestStatus: latest?.status ?? null,
    latestCheckedAt: latest?.checkedAt ?? null,
    uptimePct24h: Math.round(pct * 10) / 10,
    avgLatencyMs: avg ? Math.round(avg) : null,
    samples: rows.map((r) => ({
      checkedAt: r.checkedAt,
      latencyMs: r.latencyMs,
      ok: r.ok,
      status: r.status,
    })),
  };
}

export function allSummaries(): UptimeSummary[] {
  const cfg = loadConfig();
  return cfg.projects.filter((p) => p.liveUrl).map((p) => summaryFor(p.id));
}
