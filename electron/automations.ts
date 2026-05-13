import cron from 'node-cron';
import { loadConfig, saveConfig } from './config';
import { gitPull } from './git';
import { raw as rawDb } from './cache';

export type AutomationKind = 'pull' | 'deploy';

export interface AutomationJob {
  id: string;
  projectId: string;
  kind: AutomationKind;
  schedule: string; // cron expression
  enabled: boolean;
  lastRunAt: number | null;
  lastError: string | null;
  lastResult: string | null;
  createdAt: number;
}

type BroadcastFn = (channel: string, payload: unknown) => void;

const tasks = new Map<string, cron.ScheduledTask>();
let broadcast: BroadcastFn | null = null;

export function initAutomationTable(): void {
  try {
    rawDb().exec(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        kind TEXT NOT NULL,
        runAt INTEGER NOT NULL,
        ok INTEGER NOT NULL,
        message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_automation_job ON automation_runs(jobId, runAt DESC);
    `);
  } catch {
    /* ignore */
  }
}

function persistJobs(jobs: AutomationJob[]): void {
  const cfg = loadConfig();
  (cfg as any).automations = jobs;
  saveConfig(cfg);
}

export function listJobs(): AutomationJob[] {
  const cfg = loadConfig();
  const list = ((cfg as any).automations as AutomationJob[] | undefined) ?? [];
  return list;
}

export function saveJob(input: Omit<AutomationJob, 'lastRunAt' | 'lastError' | 'lastResult' | 'createdAt'> & { id?: string }): AutomationJob {
  const jobs = listJobs();
  const id = input.id || `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = jobs.find((j) => j.id === id);
  const next: AutomationJob = existing
    ? { ...existing, ...input, id }
    : {
        id,
        projectId: input.projectId,
        kind: input.kind,
        schedule: input.schedule,
        enabled: input.enabled,
        lastRunAt: null,
        lastError: null,
        lastResult: null,
        createdAt: Date.now(),
      };
  const next_list = existing ? jobs.map((j) => (j.id === id ? next : j)) : [...jobs, next];
  persistJobs(next_list);
  reload();
  return next;
}

export function deleteJob(id: string): void {
  const jobs = listJobs().filter((j) => j.id !== id);
  persistJobs(jobs);
  const t = tasks.get(id);
  if (t) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
    tasks.delete(id);
  }
}

export function setEnabled(id: string, enabled: boolean): AutomationJob | null {
  const jobs = listJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  job.enabled = enabled;
  persistJobs(jobs);
  reload();
  return job;
}

async function runJob(job: AutomationJob): Promise<void> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === job.projectId);
  let ok = false;
  let message = '';

  try {
    if (!project) {
      throw new Error('Project not found');
    }
    if (job.kind === 'pull') {
      const res = await gitPull(project.path);
      if (!res.ok) throw new Error(res.error || 'pull failed');
      message = (res.output || '').split('\n').slice(0, 3).join(' | ').slice(0, 400) || 'pulled';
      ok = true;
    } else if (job.kind === 'deploy') {
      if (!project.deployProvider || project.deployProvider === 'none') {
        throw new Error('No deploy provider');
      }
      if (!project.deployId) throw new Error('No deploy ID');
      const { vercelToken, renderToken } = cfg.settings;
      const axios = (await import('axios')).default;
      if (project.deployProvider === 'vercel') {
        if (!vercelToken) throw new Error('No Vercel token');
        const res = await axios.post(
          'https://api.vercel.com/v13/deployments',
          {
            name: project.name,
            project: project.deployId,
            target: 'production',
            gitSource: { type: 'github', ref: 'main' },
          },
          { headers: { Authorization: `Bearer ${vercelToken}` }, timeout: 15000 }
        );
        message = `vercel: ${res.data?.url || 'queued'}`;
        ok = true;
      } else if (project.deployProvider === 'render') {
        if (!renderToken) throw new Error('No Render token');
        const res = await axios.post(
          `https://api.render.com/v1/services/${project.deployId}/deploys`,
          {},
          { headers: { Authorization: `Bearer ${renderToken}` }, timeout: 15000 }
        );
        message = `render: ${res.data?.id || 'queued'}`;
        ok = true;
      } else {
        throw new Error('Unknown provider');
      }
    }
  } catch (err: any) {
    ok = false;
    message = err?.response?.data?.error?.message || err?.message || 'Run failed';
  }

  const jobs = listJobs();
  const updated = jobs.map((j) =>
    j.id === job.id
      ? { ...j, lastRunAt: Date.now(), lastError: ok ? null : message, lastResult: ok ? message : null }
      : j
  );
  persistJobs(updated);

  try {
    rawDb()
      .prepare(
        `INSERT INTO automation_runs (jobId, projectId, kind, runAt, ok, message) VALUES (?,?,?,?,?,?)`
      )
      .run(job.id, job.projectId, job.kind, Date.now(), ok ? 1 : 0, message.slice(0, 1000));
  } catch {
    /* ignore */
  }

  broadcast?.('automation:run', { jobId: job.id, ok, message });
}

export async function runNow(id: string): Promise<{ ok: boolean; message?: string }> {
  const job = listJobs().find((j) => j.id === id);
  if (!job) return { ok: false, message: 'Job not found' };
  await runJob(job);
  const after = listJobs().find((j) => j.id === id);
  return { ok: !after?.lastError, message: after?.lastResult ?? after?.lastError ?? undefined };
}

export function recentRuns(jobId: string, limit = 20): Array<{
  id: number;
  jobId: string;
  projectId: string;
  kind: string;
  runAt: number;
  ok: number;
  message: string | null;
}> {
  try {
    return rawDb()
      .prepare(
        `SELECT * FROM automation_runs WHERE jobId = ? ORDER BY runAt DESC LIMIT ?`
      )
      .all(jobId, limit) as any[];
  } catch {
    return [];
  }
}

export function reload(): void {
  for (const [, t] of tasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  tasks.clear();

  const jobs = listJobs();
  for (const job of jobs) {
    if (!job.enabled) continue;
    if (!cron.validate(job.schedule)) {
      console.warn(`[automations] invalid cron for ${job.id}: ${job.schedule}`);
      continue;
    }
    const task = cron.schedule(
      job.schedule,
      () => {
        void runJob(job);
      },
      { timezone: 'Asia/Kuala_Lumpur' }
    );
    task.start();
    tasks.set(job.id, task);
  }
}

export function start(b: BroadcastFn): void {
  broadcast = b;
  initAutomationTable();
  reload();
}

export function stop(): void {
  for (const [, t] of tasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  tasks.clear();
}

export function validateCron(expr: string): { valid: boolean; error?: string } {
  try {
    if (!cron.validate(expr)) return { valid: false, error: 'Invalid cron expression' };
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid' };
  }
}
