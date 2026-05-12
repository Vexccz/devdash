import { useState, useEffect } from 'react';
import type { ProjectConfig, DeployProvider } from '../types';

interface Props {
  initial?: ProjectConfig;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddProjectModal({ initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [projectPath, setProjectPath] = useState(initial?.path ?? '');
  const [githubUrl, setGithubUrl] = useState(initial?.githubUrl ?? '');
  const [liveUrl, setLiveUrl] = useState(initial?.liveUrl ?? '');
  const [deployProvider, setDeployProvider] = useState<DeployProvider>(initial?.deployProvider ?? 'none');
  const [deployId, setDeployId] = useState(initial?.deployId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

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
      };
      if (initial) {
        await window.devdash.projects.update(initial.id, payload);
      } else {
        await window.devdash.projects.add(payload);
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
