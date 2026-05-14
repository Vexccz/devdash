import { useEffect, useState } from 'react';
import type { ProjectConfig, EnvEntry } from '../types';

interface Props {
  project: ProjectConfig;
  onClose: () => void;
  onSuccess: () => void;
}

type Provider = 'vercel' | 'render';

export default function NewDeploymentModal({ project, onClose, onSuccess }: Props) {
  const [provider, setProvider] = useState<Provider>('vercel');
  const [framework, setFramework] = useState<string>('');
  const [buildCommand, setBuildCommand] = useState<string>('');
  const [outputDirectory, setOutputDirectory] = useState<string>('');
  const [rootDirectory, setRootDirectory] = useState<string>('');
  const [branch, setBranch] = useState<string>('main');
  const [serviceType, setServiceType] = useState<'web_service' | 'static_site'>('static_site');
  const [region, setRegion] = useState('singapore');
  const [plan, setPlan] = useState<'free' | 'starter' | 'standard'>('free');
  const [envVars, setEnvVars] = useState<EnvEntry[]>([]);
  const [cloneEnv, setCloneEnv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    liveUrl?: string;
    deployUrl?: string;
    dashboardUrl?: string;
    error?: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [busy, onClose]);

  // Load defaults: detect framework + import local .env
  useEffect(() => {
    void (async () => {
      // Framework inspection via inspect API
      try {
        const info = await window.devdash.projects.inspect(project.path);
        if (info.framework) {
          setFramework(info.framework);
          applyFrameworkDefaults(info.framework);
        }
        // Auto-pick serviceType based on framework for Render
        const fw = (info.framework || '').toLowerCase();
        if (fw.includes('node') || fw.includes('fastapi') || fw.includes('uvicorn')) {
          setServiceType('web_service');
        } else {
          setServiceType('static_site');
        }
      } catch {
        /* ignore */
      }

      // Load .env for import
      try {
        const summaries = await window.devdash.env.scan(project.id);
        const envFile = summaries.find((s) => s.file === '.env' && s.exists);
        if (envFile && cloneEnv) {
          const detail = await window.devdash.env.read(project.id, '.env');
          setEnvVars(detail.entries.map((e) => ({ key: e.key, value: e.value })));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [project.id]);

  const applyFrameworkDefaults = (fw: string) => {
    const lc = fw.toLowerCase();
    if (lc.includes('next')) {
      setBuildCommand('npm run build');
      setOutputDirectory('.next');
    } else if (lc.includes('vite') || lc.includes('react')) {
      setBuildCommand('npm run build');
      setOutputDirectory('dist');
    } else if (lc.includes('flutter')) {
      setBuildCommand('flutter build web --release');
      setOutputDirectory('build/web');
    } else if (lc.includes('node') || lc.includes('fastapi')) {
      setBuildCommand('npm install');
      setOutputDirectory('');
    } else {
      setBuildCommand('npm run build');
      setOutputDirectory('dist');
    }

    // Auto-set rootDirectory for monorepos
    if (lc.includes('monorepo')) {
      const match = fw.match(/has\s+(\w+)\//);
      if (match) setRootDirectory(match[1]);
    }
  };

  const deploy = async () => {
    if (!project.githubUrl) {
      setError('Project needs a GitHub URL first. Add it in project settings.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await window.devdash.deploys.createNew({
        projectId: project.id,
        provider,
        framework,
        buildCommand: buildCommand.trim() || undefined,
        outputDirectory: outputDirectory.trim() || undefined,
        rootDirectory: rootDirectory.trim() || undefined,
        branch: branch.trim() || 'main',
        serviceType: provider === 'render' ? serviceType : undefined,
        region: provider === 'render' ? region : undefined,
        plan: provider === 'render' && serviceType === 'web_service' ? plan : undefined,
        envVars: envVars.filter((e) => e.key && e.value),
      });
      setResult(res);
      if (res.ok) {
        setTimeout(() => onSuccess(), 2500);
      }
    } catch (err: any) {
      setError(err?.message || 'Deployment failed');
    } finally {
      setBusy(false);
    }
  };

  const updateEnv = (i: number, patch: Partial<EnvEntry>) => {
    setEnvVars((arr) => arr.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const removeEnv = (i: number) => {
    setEnvVars((arr) => arr.filter((_, idx) => idx !== i));
  };
  const addEnv = () => setEnvVars((arr) => [...arr, { key: '', value: '' }]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-dash-line bg-dash-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-dash-line px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Deploy {project.name}</h2>
            <p className="text-[11px] text-dash-mute">
              Create a new project on Vercel or Render and trigger the first deploy.
            </p>
          </div>
          <button onClick={onClose} className="text-dash-mute hover:text-dash-text" disabled={busy}>
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {result ? (
            <div className="space-y-4">
              {result.ok ? (
                <>
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <div className="text-2xl">✓</div>
                    <h3 className="mt-2 font-semibold text-emerald-300">
                      Deployment created
                    </h3>
                    <p className="mt-1 text-xs text-dash-mute">
                      Project linked. First build is running on {provider}.
                    </p>
                  </div>
                  {result.liveUrl && (
                    <div>
                      <label className="text-[11px] text-dash-mute">Live URL (will be available in ~2 min)</label>
                      <div className="mt-1 break-all rounded border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs">
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            void window.devdash.shell.openExternal(result.liveUrl!);
                          }}
                          className="text-dash-indigoBright hover:underline"
                        >
                          {result.liveUrl}
                        </a>
                      </div>
                    </div>
                  )}
                  {result.dashboardUrl && (
                    <button
                      onClick={() => window.devdash.shell.openExternal(result.dashboardUrl!)}
                      className="rounded border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5"
                    >
                      Open dashboard
                    </button>
                  )}
                  <p className="text-[11px] text-dash-mute">
                    Closing automatically... Project config updated with deploy ID.
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
                  <h3 className="font-semibold text-red-300">Deployment failed</h3>
                  <p className="mt-1 text-xs text-red-200">{result.error}</p>
                  {result.details && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/30 p-2 text-[10px] text-red-200">
                      {result.details}
                    </pre>
                  )}
                  <button
                    onClick={() => setResult(null)}
                    className="mt-3 rounded border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-dash-mute">Provider</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <ProviderCard
                    active={provider === 'vercel'}
                    onClick={() => setProvider('vercel')}
                    name="Vercel"
                    subtitle="Static sites & edge functions"
                  />
                  <ProviderCard
                    active={provider === 'render'}
                    onClick={() => setProvider('render')}
                    name="Render"
                    subtitle="Web services, static sites"
                  />
                </div>
              </div>

              {!project.githubUrl && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  This project has no GitHub URL. Add one in project settings before deploying.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-dash-mute">Framework</label>
                  <input
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                    placeholder="e.g. Vite, Next.js"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-dash-mute">Branch</label>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-sm"
                    placeholder="main"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-dash-mute">Build command</label>
                  <input
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs"
                    placeholder="npm run build"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-dash-mute">Output directory</label>
                  <input
                    value={outputDirectory}
                    onChange={(e) => setOutputDirectory(e.target.value)}
                    className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs"
                    placeholder="dist"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-dash-mute">
                  Root directory (monorepo only)
                </label>
                <input
                  value={rootDirectory}
                  onChange={(e) => setRootDirectory(e.target.value)}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs"
                  placeholder="frontend, apps/web, etc. (leave empty for root)"
                />
              </div>

              {provider === 'render' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-dash-mute">Service type</label>
                      <select
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value as any)}
                        className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                      >
                        <option value="static_site">Static site</option>
                        <option value="web_service">Web service</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-dash-mute">Region</label>
                      <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                      >
                        <option value="singapore">Singapore</option>
                        <option value="oregon">Oregon</option>
                        <option value="frankfurt">Frankfurt</option>
                        <option value="ohio">Ohio</option>
                      </select>
                    </div>
                    {serviceType === 'web_service' && (
                      <div>
                        <label className="block text-[11px] text-dash-mute">Plan</label>
                        <select
                          value={plan}
                          onChange={(e) => setPlan(e.target.value as any)}
                          className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                        >
                          <option value="free">Free</option>
                          <option value="starter">Starter ($7)</option>
                          <option value="standard">Standard ($25)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] text-dash-mute">
                    Environment variables ({envVars.length})
                  </label>
                  <button
                    onClick={addEnv}
                    className="text-[11px] text-dash-indigoBright hover:underline"
                  >
                    + Add
                  </button>
                </div>
                {envVars.length === 0 ? (
                  <div className="mt-1 rounded border border-dashed border-dash-line p-2 text-center text-[11px] text-dash-mute">
                    No env vars. Import from local .env or click + Add.
                  </div>
                ) : (
                  <div className="mt-1 max-h-48 space-y-1 overflow-auto">
                    {envVars.map((e, i) => (
                      <div key={i} className="flex gap-1">
                        <input
                          value={e.key}
                          onChange={(ev) => updateEnv(i, { key: ev.target.value })}
                          className="w-1/3 rounded border border-dash-line bg-dash-bg px-1.5 py-0.5 font-mono text-[11px]"
                          placeholder="KEY"
                        />
                        <input
                          value={e.value}
                          onChange={(ev) => updateEnv(i, { value: ev.target.value })}
                          className="flex-1 rounded border border-dash-line bg-dash-bg px-1.5 py-0.5 font-mono text-[11px]"
                          placeholder="value"
                          type="password"
                        />
                        <button
                          onClick={() => removeEnv(i)}
                          className="rounded px-1 text-[11px] text-dash-mute hover:text-red-400"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {!result && (
          <footer className="flex items-center justify-end gap-2 border-t border-dash-line px-5 py-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={deploy}
              disabled={busy || !project.githubUrl}
              className="rounded bg-dash-indigo px-4 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright disabled:opacity-50"
            >
              {busy ? 'Deploying...' : `Deploy to ${provider === 'vercel' ? 'Vercel' : 'Render'}`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  active,
  onClick,
  name,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-dash-indigo bg-dash-indigo/10'
          : 'border-dash-line hover:border-dash-indigo/40'
      }`}
    >
      <div className={`text-sm font-semibold ${active ? 'text-dash-indigoBright' : ''}`}>
        {name}
      </div>
      <div className="mt-0.5 text-[11px] text-dash-mute">{subtitle}</div>
    </button>
  );
}
