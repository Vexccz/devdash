import { useEffect, useRef, useState } from 'react';

interface Props {
  onProjectCreated: () => void;
}

export default function BuildCodeView({ onProjectCreated }: Props) {
  const [templates, setTemplates] = useState<Array<{ id: string; label: string; description: string }>>([]);
  const [name, setName] = useState('my-saas');
  const [displayName, setDisplayName] = useState('My SaaS');
  const [parent, setParent] = useState('');
  const [template, setTemplate] = useState('react-express-mongo');
  const [useStripe, setUseStripe] = useState(true);
  const [install, setInstall] = useState(true);
  const [gitInit, setGitInit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Array<{ stream: string; line: string; ts: number }>>([]);
  const [result, setResult] = useState<{ ok: boolean; targetDir?: string; error?: string } | null>(null);
  const logsEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const t = await window.devdash.scaffold.templates();
      setTemplates(t);
      if (t[0]) setTemplate(t[0].id);
    })();
    const off = window.devdash.scaffold.onLog((e) => {
      setLogs((cur) => [...cur.slice(-499), { stream: e.stream, line: e.line, ts: e.ts }]);
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

  const generate = async () => {
    if (!name.trim()) return;
    if (!parent) {
      setResult({ ok: false, error: 'Pick a parent folder first.' });
      return;
    }
    setBusy(true);
    setResult(null);
    setLogs([{ stream: 'system', line: `Starting ${template} scaffold for ${name}…`, ts: Date.now() }]);
    const res = await window.devdash.scaffold.run({
      projectName: name.trim(),
      displayName: displayName.trim() || name.trim(),
      targetParentDir: parent,
      template,
      useStripe,
      install,
      gitInit,
    });
    setBusy(false);
    setResult(res);
    if (res.ok) onProjectCreated();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Build code</h1>
          <p className="text-xs text-dash-mute">
            Scaffold a production-ready SaaS in one click. Auth, payments, admin, emails wired up.
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <section className="card flex flex-col gap-3 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">Configure</h3>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-dash-mute">Project name (folder)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-saas"
              className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text"
            />
            <p className="mt-1 text-[10px] text-dash-mute">Letters, numbers, dashes, underscores.</p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-dash-mute">Display name (shown in UI)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My SaaS"
              className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-dash-mute">Parent folder</label>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={parent}
                placeholder="Click Choose…"
                className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              />
              <button onClick={pickParent} className="btn-soft">Choose…</button>
            </div>
            {parent && name && (
              <p className="mt-1 text-[10px] text-dash-mute font-mono">→ {parent}\{name}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-dash-mute">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-dash-mute">
              {templates.find((t) => t.id === template)?.description}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-dash-text">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useStripe} onChange={(e) => setUseStripe(e.target.checked)} />
              Include Stripe payment scaffolding
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={install} onChange={(e) => setInstall(e.target.checked)} />
              Run npm install (frontend + backend)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gitInit} onChange={(e) => setGitInit(e.target.checked)} />
              Initialize git + first commit
            </label>
          </div>

          <button
            className="btn-primary disabled:opacity-40"
            disabled={busy || !name.trim() || !parent}
            onClick={generate}
          >
            {busy ? 'Building…' : 'Generate project'}
          </button>

          {result && (
            <div
              className={`rounded-md px-3 py-2 text-[11px] ${
                result.ok
                  ? 'border border-dash-ok/30 bg-dash-ok/10 text-dash-ok'
                  : 'border border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {result.ok ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>✅ Generated at {result.targetDir}</span>
                  <button
                    className="btn-soft text-[10px]"
                    onClick={() => result.targetDir && window.devdash.projects.openFolder(result.targetDir)}
                  >
                    Open folder
                  </button>
                  <button
                    className="btn-soft text-[10px]"
                    onClick={() => result.targetDir && window.devdash.projects.openInVSCode(result.targetDir)}
                  >
                    Open in VS Code
                  </button>
                </div>
              ) : (
                <span>❌ {result.error}</span>
              )}
            </div>
          )}
        </section>

        <section className="card flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-dash-line px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">Build log</h3>
            <button
              className="text-[10px] text-dash-mute hover:text-dash-text"
              onClick={() => setLogs([])}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px]">
            {logs.length === 0 ? (
              <p className="px-2 py-1 text-dash-mute">Logs appear here once you click Generate.</p>
            ) : (
              <>
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.stream === 'stderr'
                        ? 'text-red-400'
                        : l.stream === 'system'
                        ? 'text-dash-indigoBright'
                        : 'text-dash-text'
                    }
                  >
                    {l.line}
                  </div>
                ))}
                <div ref={logsEnd} />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
