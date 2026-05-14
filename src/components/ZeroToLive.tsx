import { useEffect, useRef, useState } from 'react';

interface StepStatus {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export default function ZeroToLive({ onProjectCreated }: { onProjectCreated: () => void }) {
  const [step, setStep] = useState(0); // wizard step
  const [templates, setTemplates] = useState<Array<{ id: string; label: string; description: string }>>([]);
  const [settings, setSettings] = useState<any>({});

  // Step 1: Configure
  const [name, setName] = useState('my-app');
  const [displayName, setDisplayName] = useState('My App');
  const [parent, setParent] = useState('');
  const [template, setTemplate] = useState('react-express-mongo');
  const [useStripe, setUseStripe] = useState(false);
  const [uiKit, setUiKit] = useState<'tailwind' | 'shadcn' | 'material' | 'chakra'>('tailwind');

  // Step 2: Deploy targets
  const [deployVercel, setDeployVercel] = useState(true);
  const [deployRender, setDeployRender] = useState(true);

  // Step 3: Env
  const [envFromSettings, setEnvFromSettings] = useState(true);
  const [envPreset, setEnvPreset] = useState<'dev' | 'production' | 'indie-saas'>('dev');

  // Step 4: Launch
  const [launching, setLaunching] = useState(false);
  const [pipeline, setPipeline] = useState<StepStatus[]>([]);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<Array<{ stream: string; line: string; ts: number }>>([]);
  const logsEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const t = await window.devdash.scaffold.templates();
      setTemplates(t);
      if (t[0]) setTemplate(t[0].id);
      const s = await window.devdash.settings.get();
      setSettings(s);
    })();
    const off = window.devdash.scaffold.onLog((e) => {
      setLogs((cur) => [...cur.slice(-499), e]);
    });
    return off;
  }, []);

  useEffect(() => {
    logsEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  const pickParent = async () => {
    const res = await window.devdash.scaffold.pickParent();
    if (res.ok && res.path) setParent(res.path);
  };

  const launch = async () => {
    if (!name.trim() || !parent) return;
    setLaunching(true);
    setLogs([]);
    setResult(null);

    const steps: StepStatus[] = [
      { label: 'Scaffold project', status: 'pending' },
      { label: 'Initialize git', status: 'pending' },
      { label: 'Push to GitHub', status: 'pending' },
    ];
    if (deployVercel) steps.push({ label: 'Deploy to Vercel', status: 'pending' });
    if (deployRender) steps.push({ label: 'Deploy to Render', status: 'pending' });
    setPipeline(steps);

    const res = await window.devdash.scaffold.run({
      projectName: name,
      targetParentDir: parent,
      template,
      displayName,
      useStripe,
      install: true,
      gitInit: true,
      envFromSettings,
      gitHubPush: true,
      gitHubPrivate: true,
      deployToVercel: deployVercel,
      deployToRender: deployRender,
      uiKit,
      envPreset,
    });

    // Update pipeline based on result
    const updated = steps.map((s, i) => {
      if (res.ok) return { ...s, status: 'done' as const };
      if (i < steps.length - 1) return { ...s, status: 'done' as const };
      return { ...s, status: 'error' as const, detail: res.error };
    });
    setPipeline(updated);
    setResult(res);
    setLaunching(false);
    if (res.ok) onProjectCreated();
  };

  const stepTitles = ['Configure', 'Deploy Targets', 'Environment', 'Review & Launch'];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">Zero to Live</h2>
        <div className="flex gap-1">
          {stepTitles.map((t, i) => (
            <span
              key={i}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                i === step ? 'bg-dash-indigo/20 text-dash-indigoBright' : 'text-dash-mute'
              }`}
            >
              {i + 1}. {t}
            </span>
          ))}
        </div>
      </div>

      {/* Step 1: Configure */}
      {step === 0 && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-dash-mute">Project name (slug)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^a-z0-9-]/g, ''))}
                className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-dash-mute">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-dash-mute">Parent folder</label>
            <div className="flex gap-2">
              <input
                value={parent}
                readOnly
                placeholder="Pick a folder..."
                className="flex-1 rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none"
              />
              <button onClick={pickParent} className="rounded border border-dash-line px-3 py-2 text-xs text-dash-mute hover:text-dash-text">
                Browse
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-dash-mute">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-dash-mute">UI Kit</label>
            <select
              value={uiKit}
              onChange={(e) => setUiKit(e.target.value as any)}
              className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
            >
              <option value="tailwind">Tailwind CSS</option>
              <option value="shadcn">shadcn/ui</option>
              <option value="material">Material UI</option>
              <option value="chakra">Chakra UI</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-dash-mute">
            <input type="checkbox" checked={useStripe} onChange={(e) => setUseStripe(e.target.checked)} className="accent-dash-indigo" />
            Include Stripe integration
          </label>
        </div>
      )}

      {/* Step 2: Deploy targets */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-dash-mute">Choose where to deploy your project.</p>
          <label className="flex items-center gap-2 text-xs text-dash-text">
            <input type="checkbox" checked={deployVercel} onChange={(e) => setDeployVercel(e.target.checked)} className="accent-dash-indigo" />
            Vercel (Frontend)
            {!settings.vercelToken && <span className="text-[10px] text-yellow-400 ml-1">No token set</span>}
          </label>
          <label className="flex items-center gap-2 text-xs text-dash-text">
            <input type="checkbox" checked={deployRender} onChange={(e) => setDeployRender(e.target.checked)} className="accent-dash-indigo" />
            Render (Backend)
            {!settings.renderToken && <span className="text-[10px] text-yellow-400 ml-1">No token set</span>}
          </label>
          {!settings.githubToken && (
            <p className="text-[10px] text-yellow-400">GitHub token not set — push to GitHub will be skipped.</p>
          )}
        </div>
      )}

      {/* Step 3: Environment */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-dash-text">
            <input type="checkbox" checked={envFromSettings} onChange={(e) => setEnvFromSettings(e.target.checked)} className="accent-dash-indigo" />
            Auto-fill .env from DevDash settings
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-dash-mute">Env preset</label>
            <select
              value={envPreset}
              onChange={(e) => setEnvPreset(e.target.value as any)}
              className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
            >
              <option value="dev">Development</option>
              <option value="production">Production</option>
              <option value="indie-saas">Indie SaaS</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 4: Review & Launch */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="rounded border border-dash-line bg-dash-panel/40 p-3 text-xs">
            <p className="text-dash-text font-medium mb-2">Summary</p>
            <div className="grid grid-cols-2 gap-1 text-dash-mute">
              <span>Project:</span><span className="text-dash-text">{displayName} ({name})</span>
              <span>Template:</span><span className="text-dash-text">{template}</span>
              <span>UI Kit:</span><span className="text-dash-text">{uiKit}</span>
              <span>Deploy:</span>
              <span className="text-dash-text">
                {[deployVercel && 'Vercel', deployRender && 'Render'].filter(Boolean).join(' + ') || 'None'}
              </span>
              <span>Env preset:</span><span className="text-dash-text">{envPreset}</span>
            </div>
          </div>

          {!launching && !result && (
            <button
              onClick={launch}
              disabled={!parent || !name.trim()}
              className="rounded bg-dash-indigo/20 border border-dash-indigo/40 px-4 py-2 text-xs text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-40"
            >
              🚀 Launch
            </button>
          )}

          {/* Pipeline progress */}
          {pipeline.length > 0 && (
            <div className="flex flex-col gap-1">
              {pipeline.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${
                    p.status === 'done' ? 'bg-green-400' :
                    p.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                    p.status === 'error' ? 'bg-red-400' : 'bg-dash-mute/30'
                  }`} />
                  <span className={p.status === 'done' ? 'text-dash-text' : 'text-dash-mute'}>{p.label}</span>
                  {p.detail && <span className="text-[10px] text-red-400 ml-1">{p.detail}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded border p-3 text-xs ${result.ok ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              {result.ok ? (
                <div className="flex flex-col gap-1">
                  <p className="text-green-400 font-medium">Project launched successfully!</p>
                  {result.targetDir && <p className="text-dash-mute">Path: {result.targetDir}</p>}
                  {result.githubUrl && (
                    <button onClick={() => window.devdash.shell.openExternal(result.githubUrl)} className="text-dash-indigoBright hover:underline text-left">
                      GitHub: {result.githubUrl}
                    </button>
                  )}
                  {result.vercelUrl && (
                    <button onClick={() => window.devdash.shell.openExternal(result.vercelUrl)} className="text-dash-indigoBright hover:underline text-left">
                      Vercel: {result.vercelUrl}
                    </button>
                  )}
                  {result.renderUrl && (
                    <button onClick={() => window.devdash.shell.openExternal(result.renderUrl)} className="text-dash-indigoBright hover:underline text-left">
                      Render: {result.renderUrl}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-red-400">{result.error || 'Launch failed'}</p>
              )}
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="rounded border border-dash-line bg-black/30 p-2 max-h-40 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className={`text-[10px] font-mono ${l.stream === 'stderr' ? 'text-red-400' : l.stream === 'system' ? 'text-dash-mute' : 'text-green-400'}`}>
                  {l.line}
                </div>
              ))}
              <div ref={logsEnd} />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-auto flex justify-between pt-3 border-t border-dash-line">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || launching}
          className="rounded border border-dash-line px-3 py-1.5 text-xs text-dash-mute hover:text-dash-text disabled:opacity-30"
        >
          ← Back
        </button>
        {step < 3 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 0 && !parent}
            className="rounded bg-dash-indigo/20 border border-dash-indigo/40 px-3 py-1.5 text-xs text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-40"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
