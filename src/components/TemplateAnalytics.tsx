import { useState, useEffect } from 'react';

interface TemplateStats {
  totalScaffolds: number;
  mostUsedTemplate: { id: string; count: number } | null;
  avgScaffoldTimeMs: number;
  perTemplate: Array<{
    templateId: string;
    count: number;
    successRate: number;
    avgDurationMs: number;
  }>;
  usageOverTime: Array<{ day: string; count: number }>;
}

export default function TemplateAnalytics() {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await window.devdash.templateAnalytics.scaffoldStats();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-xs text-dash-mute">Loading analytics...</div>;
  }

  if (!stats || stats.totalScaffolds === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-dash-text">Template Analytics</h3>
        <p className="py-8 text-center text-xs text-dash-mute">
          No scaffold data yet. Create a project to see analytics.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...stats.perTemplate.map((t) => t.count), 1);
  const maxDayCount = Math.max(...stats.usageOverTime.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dash-text">Template Analytics</h3>
        <button
          onClick={loadStats}
          className="rounded bg-white/5 px-2 py-1 text-[10px] text-dash-mute hover:bg-white/10 hover:text-dash-text"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-dash-line bg-dash-panel/40 p-3">
          <div className="text-[10px] text-dash-mute">Total Scaffolds</div>
          <div className="mt-1 text-lg font-semibold text-dash-text">{stats.totalScaffolds}</div>
        </div>
        <div className="rounded-md border border-dash-line bg-dash-panel/40 p-3">
          <div className="text-[10px] text-dash-mute">Avg Time</div>
          <div className="mt-1 text-lg font-semibold text-dash-text">
            {(stats.avgScaffoldTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="rounded-md border border-dash-line bg-dash-panel/40 p-3">
          <div className="text-[10px] text-dash-mute">Most Used</div>
          <div className="mt-1 truncate text-sm font-semibold text-dash-indigoBright">
            {stats.mostUsedTemplate?.id || '-'}
          </div>
          {stats.mostUsedTemplate && (
            <div className="text-[10px] text-dash-mute">{stats.mostUsedTemplate.count} uses</div>
          )}
        </div>
      </div>

      {/* Per-template stats */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-dash-mute">Usage by Template</div>
        {stats.perTemplate.map((t) => (
          <div key={t.templateId} className="rounded-md border border-dash-line bg-dash-panel/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-dash-text">{t.templateId}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-dash-mute">{t.count} uses</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    t.successRate >= 80
                      ? 'bg-green-500/20 text-green-400'
                      : t.successRate >= 50
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {t.successRate}%
                </span>
                <span className="text-[10px] text-dash-mute">
                  {(t.avgDurationMs / 1000).toFixed(1)}s avg
                </span>
              </div>
            </div>
            {/* Bar */}
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-dash-indigo/60"
                style={{ width: `${(t.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Usage over time (last 30 days) */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-dash-mute">Last 30 Days</div>
        <div className="flex h-20 items-end gap-px rounded-md border border-dash-line bg-dash-panel/40 p-2">
          {stats.usageOverTime.map((d) => (
            <div
              key={d.day}
              className="group relative flex-1"
              title={`${d.day}: ${d.count} scaffold${d.count !== 1 ? 's' : ''}`}
            >
              <div
                className="w-full rounded-t bg-dash-indigo/50 transition-colors hover:bg-dash-indigo/80"
                style={{
                  height: d.count > 0 ? `${Math.max((d.count / maxDayCount) * 100, 8)}%` : '0%',
                  minHeight: d.count > 0 ? '3px' : '0',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-dash-mute">
          <span>{stats.usageOverTime[0]?.day.slice(5) || ''}</span>
          <span>{stats.usageOverTime[stats.usageOverTime.length - 1]?.day.slice(5) || ''}</span>
        </div>
      </div>
    </div>
  );
}
