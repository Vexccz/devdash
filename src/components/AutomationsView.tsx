import { useEffect, useState } from 'react';
import type { AutomationJob, AutomationRun, ProjectConfig } from '../types';

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: 'Every 30 min', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 4 hours', value: '0 */4 * * *' },
  { label: 'Daily 09:00', value: '0 9 * * *' },
  { label: 'Daily 21:00', value: '0 21 * * *' },
  { label: 'Weekly Mon 09:00', value: '0 9 * * 1' },
];

function formatTime(ts: number | null): string {
  if (!ts) return 'never';
  return new Date(ts).toLocaleString();
}

export default function AutomationsView() {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [editing, setEditing] = useState<Partial<AutomationJob> | null>(null);
  const [runsFor, setRunsFor] = useState<{ jobId: string; runs: AutomationRun[] } | null>(null);

  const loadAll = async () => {
    const [list, projs] = await Promise.all([
      window.devdash.automations.list(),
      window.devdash.projects.list(),
    ]);
    setJobs(list);
    setProjects(projs);
  };

  useEffect(() => {
    void loadAll();
    const off = window.devdash.automations.onRun(() => {
      void loadAll();
    });
    return off;
  }, []);

  const openNew = () => {
    setEditing({
      projectId: projects[0]?.id ?? '',
      kind: 'pull',
      schedule: '0 9 * * *',
      enabled: true,
    });
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  const handleSave = async () => {
    if (!editing?.projectId || !editing.schedule) return;
    const valid = await window.devdash.automations.validateCron(editing.schedule);
    if (!valid.valid) {
      alert('Invalid cron: ' + (valid.error || 'unknown'));
      return;
    }
    await window.devdash.automations.save({
      id: editing.id,
      projectId: editing.projectId!,
      kind: (editing.kind as any) || 'pull',
      schedule: editing.schedule!,
      enabled: !!editing.enabled,
    });
    setEditing(null);
    await loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await window.devdash.automations.delete(id);
    await loadAll();
  };

  const handleToggle = async (j: AutomationJob) => {
    await window.devdash.automations.toggle(j.id, !j.enabled);
    await loadAll();
  };

  const handleRunNow = async (j: AutomationJob) => {
    await window.devdash.automations.runNow(j.id);
    await loadAll();
  };

  const openRuns = async (jobId: string) => {
    const runs = await window.devdash.automations.runs(jobId, 20);
    setRunsFor({ jobId, runs });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automations</h2>
          <p className="text-xs text-dash-mute">Scheduled git pulls & deploy triggers per project.</p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-dash-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright"
        >
          + New automation
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {jobs.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-dash-line text-sm text-dash-mute">
            No automations yet. Create one to auto-pull or auto-deploy on a cron.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <div
                key={j.id}
                className={`rounded-lg border border-dash-line bg-dash-panel/40 p-3 ${j.enabled ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-dash-indigo/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dash-indigoBright">
                        {j.kind}
                      </span>
                      <span className="truncate text-sm font-medium">{projectName(j.projectId)}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-dash-mute">{j.schedule}</div>
                    <div className="mt-1 text-[11px] text-dash-mute">
                      Last run: {formatTime(j.lastRunAt)}
                      {j.lastError && (
                        <span className="ml-2 text-red-400">err: {j.lastError.slice(0, 120)}</span>
                      )}
                      {j.lastResult && !j.lastError && (
                        <span className="ml-2 text-emerald-400">{j.lastResult.slice(0, 120)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleRunNow(j)}
                      className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5"
                    >
                      Run now
                    </button>
                    <button
                      onClick={() => openRuns(j.id)}
                      className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5"
                    >
                      History
                    </button>
                    <button
                      onClick={() => handleToggle(j)}
                      className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5"
                    >
                      {j.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setEditing({ ...j })}
                      className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(j.id)}
                      className="rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-dash-line bg-dash-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {editing.id ? 'Edit automation' : 'New automation'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-dash-mute">Project</label>
                <select
                  value={editing.projectId || ''}
                  onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-dash-mute">Action</label>
                <select
                  value={editing.kind || 'pull'}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as any })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                >
                  <option value="pull">Git pull</option>
                  <option value="deploy">Trigger deploy</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-dash-mute">Schedule (cron)</label>
                <input
                  value={editing.schedule || ''}
                  onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-sm"
                  placeholder="0 9 * * *"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {SCHEDULE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setEditing({ ...editing, schedule: p.value })}
                      className="rounded border border-dash-line px-2 py-0.5 text-[10px] text-dash-mute hover:bg-white/5"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded border border-dash-line px-3 py-1 text-xs hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded bg-dash-indigo px-3 py-1 text-xs text-white hover:bg-dash-indigoBright"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {runsFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-dash-line bg-dash-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent runs</h3>
              <button
                onClick={() => setRunsFor(null)}
                className="text-xs text-dash-mute hover:text-dash-text"
              >
                Close
              </button>
            </div>
            {runsFor.runs.length === 0 ? (
              <div className="text-xs text-dash-mute">No runs yet.</div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-dash-mute">
                    <tr>
                      <th className="py-1">When</th>
                      <th className="py-1">Kind</th>
                      <th className="py-1">Status</th>
                      <th className="py-1">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsFor.runs.map((r) => (
                      <tr key={r.id} className="border-t border-dash-line/50">
                        <td className="py-1 text-dash-mute">{formatTime(r.runAt)}</td>
                        <td className="py-1">{r.kind}</td>
                        <td className={`py-1 ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.ok ? 'ok' : 'fail'}
                        </td>
                        <td className="py-1 text-dash-mute">{(r.message || '').slice(0, 140)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
