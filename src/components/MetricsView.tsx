import { useEffect, useMemo, useState } from 'react';
import type {
  ProjectConfig,
  RenderMetricsResult,
  VercelAnalyticsResult,
} from '../types';

function formatBytes(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return '-';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function SparkLine({
  points,
  color,
  height = 40,
}: {
  points: Array<{ ts: number; value: number }>;
  color: string;
  height?: number;
}) {
  if (points.length < 2) {
    return <div className="text-[11px] text-dash-mute">(not enough data)</div>;
  }
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;
  const w = 300;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = height - ((p.value - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={height} className="block">
      <path d={path} stroke={color} fill="none" strokeWidth={1.5} />
    </svg>
  );
}

export default function MetricsView() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [renderData, setRenderData] = useState<RenderMetricsResult | null>(null);
  const [vercelData, setVercelData] = useState<VercelAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(6);
  const [days, setDays] = useState(7);

  useEffect(() => {
    void (async () => {
      const list = await window.devdash.projects.list();
      setProjects(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    })();
  }, []);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId),
    [projects, selectedId]
  );

  const isRender = selected?.deployProvider === 'render' && !!selected.deployId;
  const isVercel = selected?.deployProvider === 'vercel' && !!selected.deployId;

  const load = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      if (isRender) {
        const r = await window.devdash.metrics.render(selected.id, hours);
        setRenderData(r);
        setVercelData(null);
      } else if (isVercel) {
        const a = await window.devdash.analytics.vercel(selected.id, days);
        setVercelData(a);
        setRenderData(null);
      } else {
        setRenderData(null);
        setVercelData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedId]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metrics</h2>
          <p className="text-xs text-dash-mute">
            Render CPU/memory or Vercel Web Analytics per project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-dash-line bg-dash-panel px-2 py-1 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.deployProvider !== 'none' ? ` (${p.deployProvider})` : ''}
              </option>
            ))}
          </select>
          {isRender && (
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="rounded border border-dash-line bg-dash-panel px-2 py-1 text-sm"
            >
              <option value={1}>1h</option>
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>3d</option>
            </select>
          )}
          {isVercel && (
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-dash-line bg-dash-panel px-2 py-1 text-sm"
            >
              <option value={1}>1d</option>
              <option value={7}>7d</option>
              <option value={30}>30d</option>
            </select>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded border border-dash-line px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!selected && (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-dash-line text-sm text-dash-mute">
            Select a project.
          </div>
        )}

        {selected && !isRender && !isVercel && (
          <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4 text-sm text-dash-mute">
            Metrics available for projects deployed on Vercel or Render. This project has no deploy
            provider configured.
          </div>
        )}

        {isRender && renderData && (
          <div className="space-y-4">
            {renderData.error && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {renderData.error}
              </div>
            )}
            <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">CPU</h3>
                <span className="text-xs text-dash-mute">
                  {renderData.cpu.length} points
                  {renderData.cpu.length > 0 &&
                    ` · latest ${renderData.cpu[renderData.cpu.length - 1].cpu?.toFixed(2)}%`}
                </span>
              </div>
              <SparkLine
                points={renderData.cpu.map((p) => ({ ts: p.ts, value: p.cpu ?? 0 }))}
                color="#6366f1"
                height={60}
              />
            </div>
            <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Memory</h3>
                <span className="text-xs text-dash-mute">
                  {renderData.memory.length} points
                  {renderData.memory.length > 0 &&
                    ` · latest ${formatBytes(renderData.memory[renderData.memory.length - 1].memory)}`}
                </span>
              </div>
              <SparkLine
                points={renderData.memory.map((p) => ({ ts: p.ts, value: p.memory ?? 0 }))}
                color="#10b981"
                height={60}
              />
            </div>
          </div>
        )}

        {isVercel && vercelData && (
          <div className="space-y-4">
            {vercelData.error && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                <p className="font-semibold">{vercelData.error}</p>
                {vercelData.note && <p className="mt-1 text-amber-200/80">{vercelData.note}</p>}
              </div>
            )}
            {vercelData.ok && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
                    <div className="text-xs text-dash-mute">Visitors ({vercelData.periodDays}d)</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {vercelData.totalVisitors?.toLocaleString() ?? '-'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
                    <div className="text-xs text-dash-mute">
                      Pageviews ({vercelData.periodDays}d)
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {vercelData.totalPageviews?.toLocaleString() ?? '-'}
                    </div>
                  </div>
                </div>
                {vercelData.recent.length > 0 && (
                  <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
                    <h3 className="mb-2 text-sm font-semibold">Daily</h3>
                    <SparkLine
                      points={vercelData.recent.map((r, i) => ({
                        ts: i,
                        value: r.visitors,
                      }))}
                      color="#6366f1"
                      height={60}
                    />
                  </div>
                )}
                {vercelData.topPaths.length > 0 && (
                  <div className="rounded-lg border border-dash-line bg-dash-panel/40 p-4">
                    <h3 className="mb-2 text-sm font-semibold">Top pages</h3>
                    <table className="w-full text-xs">
                      <thead className="text-left text-dash-mute">
                        <tr>
                          <th className="py-1">Path</th>
                          <th className="py-1 text-right">Visitors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vercelData.topPaths.map((p) => (
                          <tr key={p.path} className="border-t border-dash-line/50">
                            <td className="py-1 font-mono">{p.path}</td>
                            <td className="py-1 text-right">{p.visitors.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
