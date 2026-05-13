import { loadConfig } from './config';

export interface MetricPoint {
  ts: number;
  cpu: number | null; // percent
  memory: number | null; // bytes
}

export interface RenderMetrics {
  ok: boolean;
  serviceId: string;
  cpu: MetricPoint[];
  memory: MetricPoint[];
  error?: string;
}

export async function fetchRenderMetrics(projectId: string, hours = 6): Promise<RenderMetrics> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  if (!project) return { ok: false, serviceId: '', cpu: [], memory: [], error: 'Project not found' };
  if (project.deployProvider !== 'render' || !project.deployId) {
    return { ok: false, serviceId: project.deployId || '', cpu: [], memory: [], error: 'Not a Render service' };
  }
  const token = cfg.settings.renderToken?.trim();
  if (!token) return { ok: false, serviceId: project.deployId, cpu: [], memory: [], error: 'No Render token' };

  const axios = (await import('axios')).default;
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  try {
    const [cpuRes, memRes] = await Promise.allSettled([
      axios.get(
        `https://api.render.com/v1/metrics/cpu?resource=${project.deployId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&resolutionSeconds=300`,
        { headers, timeout: 10000 }
      ),
      axios.get(
        `https://api.render.com/v1/metrics/memory?resource=${project.deployId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&resolutionSeconds=300`,
        { headers, timeout: 10000 }
      ),
    ]);

    const cpu: MetricPoint[] = [];
    const memory: MetricPoint[] = [];

    if (cpuRes.status === 'fulfilled') {
      const series = extractSeries(cpuRes.value.data);
      for (const pt of series) cpu.push({ ts: pt.ts, cpu: pt.value, memory: null });
    }
    if (memRes.status === 'fulfilled') {
      const series = extractSeries(memRes.value.data);
      for (const pt of series) memory.push({ ts: pt.ts, cpu: null, memory: pt.value });
    }

    return { ok: true, serviceId: project.deployId, cpu, memory };
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || 'Fetch failed';
    return { ok: false, serviceId: project.deployId, cpu: [], memory: [], error: msg };
  }
}

function extractSeries(data: any): Array<{ ts: number; value: number }> {
  // Render returns array of series objects, each with values: [{timestamp, value}]
  // Some endpoints return {values: [...]}, others return [{values: [...]}, ...]
  const arr = Array.isArray(data) ? data : data?.values ? [data] : [];
  const out: Array<{ ts: number; value: number }> = [];
  for (const series of arr) {
    const values = series?.values || [];
    for (const v of values) {
      const ts = typeof v.timestamp === 'string' ? Date.parse(v.timestamp) : Number(v.timestamp);
      const value = typeof v.value === 'number' ? v.value : Number(v.value);
      if (!Number.isFinite(ts) || !Number.isFinite(value)) continue;
      out.push({ ts, value });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}
