import { loadConfig } from './config';

export interface VercelAnalyticsSummary {
  ok: boolean;
  projectId: string;
  totalVisitors: number | null;
  totalPageviews: number | null;
  periodDays: number;
  recent: Array<{ day: string; visitors: number; pageviews: number }>;
  topPaths: Array<{ path: string; visitors: number }>;
  error?: string;
  note?: string;
}

/**
 * Vercel Web Analytics is only queryable via the Web Analytics API which requires
 * the project to have analytics enabled + a dedicated token. The official public
 * API remains unstable; we attempt the documented endpoints and fall back to a
 * "not enabled" result so the UI can show graceful guidance.
 */
export async function fetchVercelAnalytics(projectId: string, days = 7): Promise<VercelAnalyticsSummary> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  const empty: VercelAnalyticsSummary = {
    ok: false,
    projectId,
    totalVisitors: null,
    totalPageviews: null,
    periodDays: days,
    recent: [],
    topPaths: [],
  };

  if (!project) return { ...empty, error: 'Project not found' };
  if (project.deployProvider !== 'vercel' || !project.deployId) {
    return { ...empty, error: 'Not a Vercel project' };
  }
  const token = cfg.settings.vercelToken?.trim();
  if (!token) return { ...empty, error: 'No Vercel token' };

  const axios = (await import('axios')).default;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const until = Date.now();
  const headers = { Authorization: `Bearer ${token}` };

  try {
    // Web Analytics totals endpoint (v1). If the project doesn't have analytics
    // enabled this returns 404 / 403, which we surface gracefully.
    const totalsUrl = `https://vercel.com/api/web/insights/view?projectId=${encodeURIComponent(
      project.deployId
    )}&from=${since}&to=${until}`;
    const topUrl = `https://vercel.com/api/web/insights/pages?projectId=${encodeURIComponent(
      project.deployId
    )}&from=${since}&to=${until}&limit=5`;

    const [totalsRes, topRes] = await Promise.allSettled([
      axios.get(totalsUrl, { headers, timeout: 10000 }),
      axios.get(topUrl, { headers, timeout: 10000 }),
    ]);

    let totalVisitors: number | null = null;
    let totalPageviews: number | null = null;
    let recent: VercelAnalyticsSummary['recent'] = [];

    if (totalsRes.status === 'fulfilled') {
      const data = totalsRes.value.data as any;
      const series = data?.data || data?.timeseries || [];
      for (const row of series) {
        const day = row?.key || row?.date || '';
        const visitors = Number(row?.visitors ?? row?.uniqueVisitors ?? 0) || 0;
        const pageviews = Number(row?.total ?? row?.pageviews ?? 0) || 0;
        if (day) recent.push({ day, visitors, pageviews });
      }
      totalVisitors = Number(data?.totals?.visitors ?? data?.uniqueVisitors ?? null);
      totalPageviews = Number(data?.totals?.total ?? data?.pageviews ?? null);
      if (!Number.isFinite(totalVisitors as number)) totalVisitors = null;
      if (!Number.isFinite(totalPageviews as number)) totalPageviews = null;
    }

    let topPaths: VercelAnalyticsSummary['topPaths'] = [];
    if (topRes.status === 'fulfilled') {
      const data = topRes.value.data as any;
      const rows = data?.data || data?.rows || [];
      for (const row of rows) {
        const p = row?.page || row?.path || row?.key || '';
        const visitors = Number(row?.visitors ?? row?.uniqueVisitors ?? row?.total ?? 0) || 0;
        if (p) topPaths.push({ path: p, visitors });
      }
    }

    // Neither call returned real data → analytics almost certainly disabled
    if (!totalVisitors && !totalPageviews && recent.length === 0 && topPaths.length === 0) {
      const reason =
        (totalsRes.status === 'rejected' && (totalsRes.reason?.response?.status ?? 0)) ||
        (topRes.status === 'rejected' && (topRes.reason?.response?.status ?? 0)) ||
        0;
      return {
        ...empty,
        ok: false,
        error:
          reason === 403
            ? 'Web Analytics not enabled for this project'
            : reason === 404
            ? 'Analytics endpoint not found (project may need analytics enabled)'
            : 'No analytics data returned',
        note: 'Enable Web Analytics in the Vercel dashboard for this project to see traffic data here.',
      };
    }

    return {
      ok: true,
      projectId,
      totalVisitors,
      totalPageviews,
      periodDays: days,
      recent,
      topPaths,
    };
  } catch (err: any) {
    return {
      ...empty,
      error: err?.response?.data?.error?.message || err?.message || 'Fetch failed',
      note: 'Web Analytics API can reject tokens without team scope. Try a team-scoped token.',
    };
  }
}
