import axios from 'axios';
import { ProjectConfig } from './config';

export type DeployStatus = 'queued' | 'building' | 'ready' | 'error' | 'canceled' | 'unknown';

export interface DeployItem {
  projectId: string;
  projectName: string;
  provider: 'vercel' | 'render';
  id: string;
  status: DeployStatus;
  rawStatus: string;
  target: 'production' | 'preview' | 'unknown';
  createdAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  url?: string;
  dashboardUrl?: string;
}

function mapVercelStatus(state?: string): DeployStatus {
  const s = (state ?? '').toUpperCase();
  if (s === 'READY') return 'ready';
  if (s === 'ERROR') return 'error';
  if (s === 'BUILDING' || s === 'INITIALIZING') return 'building';
  if (s === 'QUEUED') return 'queued';
  if (s === 'CANCELED') return 'canceled';
  return 'unknown';
}

function mapRenderStatus(status?: string): DeployStatus {
  const s = (status ?? '').toLowerCase();
  if (s === 'live') return 'ready';
  if (s === 'build_failed' || s === 'update_failed' || s === 'deactivated') return 'error';
  if (s === 'build_in_progress' || s === 'update_in_progress') return 'building';
  if (s === 'created' || s === 'queued') return 'queued';
  if (s === 'canceled') return 'canceled';
  return 'unknown';
}

export async function fetchVercelDeploys(token: string, project: ProjectConfig): Promise<DeployItem[]> {
  if (!token || !project.deployId) return [];
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(project.deployId)}&limit=10`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
  const deployments = (res.data?.deployments ?? []) as any[];
  return deployments.map((d) => {
    const created = Number(d.created ?? d.createdAt ?? 0);
    const ready = d.ready ? Number(d.ready) : null;
    const status = mapVercelStatus(d.state ?? d.readyState);
    const duration = ready && created ? ready - created : null;
    const meta = d.meta ?? {};
    return {
      projectId: project.id,
      projectName: project.name,
      provider: 'vercel',
      id: String(d.uid ?? d.id ?? ''),
      status,
      rawStatus: String(d.state ?? d.readyState ?? 'unknown'),
      target: d.target === 'production' ? 'production' : d.target ? 'preview' : 'unknown',
      createdAt: created,
      finishedAt: ready,
      durationMs: duration,
      commitSha: meta.githubCommitSha ?? meta.gitlabCommitSha ?? meta.bitbucketCommitSha,
      commitMessage: meta.githubCommitMessage ?? meta.gitlabCommitMessage ?? meta.bitbucketCommitMessage,
      commitAuthor: meta.githubCommitAuthorName ?? meta.githubCommitAuthorLogin,
      url: d.url ? `https://${d.url}` : undefined,
      dashboardUrl: d.inspectorUrl ?? `https://vercel.com/dashboard`,
    } as DeployItem;
  });
}

export async function fetchRenderDeploys(token: string, project: ProjectConfig): Promise<DeployItem[]> {
  if (!token || !project.deployId) return [];
  const url = `https://api.render.com/v1/services/${encodeURIComponent(project.deployId)}/deploys?limit=10`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000,
  });
  const items = (res.data ?? []) as any[];
  return items.map((entry) => {
    const d = entry.deploy ?? entry;
    const createdAt = d.createdAt ? new Date(d.createdAt).getTime() : 0;
    const finishedAt = d.finishedAt ? new Date(d.finishedAt).getTime() : null;
    const status = mapRenderStatus(d.status);
    const duration = finishedAt && createdAt ? finishedAt - createdAt : null;
    return {
      projectId: project.id,
      projectName: project.name,
      provider: 'render',
      id: String(d.id ?? ''),
      status,
      rawStatus: String(d.status ?? 'unknown'),
      target: 'production',
      createdAt,
      finishedAt,
      durationMs: duration,
      commitSha: d.commit?.id,
      commitMessage: d.commit?.message,
      url: undefined,
      dashboardUrl: `https://dashboard.render.com/web/${project.deployId}`,
    } as DeployItem;
  });
}

export async function fetchAllDeploys(
  projects: ProjectConfig[],
  tokens: { vercel: string; render: string }
): Promise<{ items: DeployItem[]; errors: { projectId: string; error: string }[] }> {
  const items: DeployItem[] = [];
  const errors: { projectId: string; error: string }[] = [];

  const vercelProjects = projects.filter((p) => p.deployProvider === 'vercel' && p.deployId);
  const renderProjects = projects.filter((p) => p.deployProvider === 'render' && p.deployId);

  const tasks: Promise<void>[] = [];
  for (const p of vercelProjects) {
    tasks.push(
      fetchVercelDeploys(tokens.vercel, p)
        .then((list) => {
          items.push(...list);
        })
        .catch((err) => {
          errors.push({ projectId: p.id, error: (err as Error).message });
        })
    );
  }
  for (const p of renderProjects) {
    tasks.push(
      fetchRenderDeploys(tokens.render, p)
        .then((list) => {
          items.push(...list);
        })
        .catch((err) => {
          errors.push({ projectId: p.id, error: (err as Error).message });
        })
    );
  }

  await Promise.all(tasks);
  items.sort((a, b) => b.createdAt - a.createdAt);
  return { items, errors };
}
