import { useState, useEffect } from 'react';
import type { ProjectConfig, DeployProvider } from '../types';

interface Props {
  initial?: ProjectConfig;
  onClose: () => void;
  onSaved: () => void;
}

interface DsnParsed {
  ok: boolean;
  orgId: string | null;
  projectId: string | null;
  error?: string;
}

export default function AddProjectModal({ initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [projectPath, setProjectPath] = useState(initial?.path ?? '');
  const [githubUrl, setGithubUrl] = useState(initial?.githubUrl ?? '');
  const [liveUrl, setLiveUrl] = useState(initial?.liveUrl ?? '');
  const [deployProvider, setDeployProvider] = useState<DeployProvider>(initial?.deployProvider ?? 'none');
  const [deployId, setDeployId] = useState(initial?.deployId ?? '');
  const [sentryDsn, setSentryDsn] = useState(initial?.sentryDsn ?? '');
  const [sentryOrgSlug, setSentryOrgSlug] = useState(initial?.sentryOrgSlug ?? '');
  const [sentryProjectSlug, setSentryProjectSlug] = useState(initial?.sentryProjectSlug ?? '');
  const [dsnParsed, setDsnParsed] = useState<DsnParsed | null>(null);
  const [logsFolder, setLogsFolder] = useState(initial?.logsFolder ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Live-validate the DSN as the user types.
  useEffect(() => {
    let cancelled = false;
    const dsn = sentryDsn.trim();
    if (!dsn) {
      setDsnParsed(null);
      return;
    }
    (async () => {
      try {
        const res = await (window as any).devdash?.sentry?.validate(dsn);
        if (!cancelled) setDsnParsed(res ?? null);
      } catch {
        if (!cancelled) setDsnParsed({ ok: false, orgId: null, projectId: null, error: 'validation failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sentryDsn]);

  const pickFolder = async () => {
    const p = await window.devdash.projects.pickFolder();
    if (p) setProjectPath(p);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectPath.trim()) {
      setError('Name and path are required.');
      return;
    }
    const dsn = sentryDsn.trim();
    if (dsn && dsnParsed && !dsnParsed.ok) {
      setError(`Sentry DSN looks invalid${dsnParsed.error ? `: ${dsnParsed.error}` : ''}.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        path: projectPath.trim(),
        githubUrl: githubUrl.trim() || undefined,
        liveUrl: liveUrl.trim() || undefined,
        deployProvider,
        deployId: deployId.trim() || undefined,
        sentryDsn: dsn || undefined,
        sentryOrgSlug: sentryOrgSlug.trim() || undefined,
        sentryProjectSlug: sentryProjectSlug.trim() || undefined,
        logsFolder: logsFolder.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
      let savedId: string | undefined;
      if (initial) {
        await window.devdash.projects.update(initial.id, payload);
        savedId = initial.id;
      } else {
        await window.devdash.projects.add(payload);
      }
      // If we have a DSN + a token wired up and slugs are missing, auto-resolve.
      if (savedId && dsn && (!sentryOrgSlug.trim() || !sentryProjectSlug.trim())) {
        try {
          const resolved = await (window as any).devdash?.sentry?.resolve(savedId);
          if (resolved?.orgSlug && resolved?.projectSlug) {
            await window.devdash.projects.update(savedId, {
              sentryOrgSlug: resolved.orgSlug,
              sentryProjectSlug: resolved.projectSlug,
            });
          }
        } catch {
          /* non-fatal */
        }
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-[440px] rounded-lg border border-dash-line bg-dash-panel p-5 shadow-glow"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dash-text">
            {initial ? 'Edit project' : 'Add project'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-sm text-dash-text"
              placeholder="My App"
              autoFocus
            />
          </Field>

          <Field label="Local path">
            <div className="flex gap-2">
              <input
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text"
                placeholder="C:\\Users\\...\\project"
              />
              <button
                type="button"
                onClick={pickFolder}
                className="rounded-md border border-dash-line bg-dash-panel2 px-3 py-1.5 text-xs text-dash-text hover:border-dash-indigo/60"
              >
                Browse
              </button>
            </div>
          </Field>

          <Field label="GitHub URL (optional)">
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-sm text-dash-text"
              placeholder="https://github.com/user/repo"
            />
          </Field>

          <Field label="Live URL (optional)">
            <input
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-sm text-dash-text"
              placeholder="https://myapp.vercel.app"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Deploy provider">
              <select
                value={deployProvider}
                onChange={(e) => setDeployProvider(e.target.value as DeployProvider)}
                className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-sm text-dash-text"
              >
                <option value="none">None</option>
                <option value="vercel">Vercel</option>
                <option value="render">Render</option>
              </select>
            </Field>

            <Field label={deployProvider === 'render' ? 'Service ID' : 'Project ID'}>
              <input
                value={deployId}
                onChange={(e) => setDeployId(e.target.value)}
                disabled={deployProvider === 'none'}
                className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text disabled:opacity-40"
                placeholder={deployProvider === 'render' ? 'srv_xxx' : 'prj_xxx'}
              />
            </Field>
          </div>

          <Field label="Sentry DSN (optional)">
            <textarea
              value={sentryDsn}
              onChange={(e) => setSentryDsn(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              placeholder="https://<key>@o<orgId>.ingest.sentry.io/<projectId>"
            />
            {sentryDsn.trim() && dsnParsed && (
              <div
                className={
                  'mt-1 text-[10px] ' + (dsnParsed.ok ? 'text-dash-mute' : 'text-dash-err')
                }
              >
                {dsnParsed.ok
                  ? `orgId=${dsnParsed.orgId ?? '—'} · projectId=${dsnParsed.projectId ?? '—'}`
                  : `Invalid DSN${dsnParsed.error ? `: ${dsnParsed.error}` : ''}`}
              </div>
            )}
          </Field>

          {initial && sentryDsn.trim() && dsnParsed?.ok && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sentry org slug (auto-resolved)">
                <input
                  value={sentryOrgSlug}
                  onChange={(e) => setSentryOrgSlug(e.target.value)}
                  className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
                  placeholder="leave blank to auto-resolve"
                />
              </Field>
              <Field label="Sentry project slug">
                <input
                  value={sentryProjectSlug}
                  onChange={(e) => setSentryProjectSlug(e.target.value)}
                  className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
                  placeholder="leave blank to auto-resolve"
                />
              </Field>
            </div>
          )}

          <Field label="Logs folder (optional; falls back to <path>/logs)">
            <input
              value={logsFolder}
              onChange={(e) => setLogsFolder(e.target.value)}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              placeholder="C:\\Users\\...\\project\\logs"
            />
          </Field>

          <Field label="Tags (optional)">
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-dash-indigo/20 px-2 py-0.5 text-[10px] text-dash-indigoBright"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="ml-0.5 text-dash-indigoBright hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim().replace(/,$/, '');
                    if (t && !tags.includes(t)) setTags([...tags, t]);
                    setTagInput('');
                  }
                  if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                className="flex-1 bg-transparent text-xs text-dash-text outline-none"
                placeholder={tags.length === 0 ? 'FYP, Commercial, Learning... (Enter to add)' : ''}
              />
            </div>
          </Field>
        </div>

        {error && <div className="mt-3 text-[11px] text-dash-err">{error}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-dash-line bg-dash-panel2 px-3 py-1.5 text-xs text-dash-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-dash-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add project'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</span>
      {children}
    </label>
  );
}
