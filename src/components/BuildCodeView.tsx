import { useEffect, useRef, useState } from 'react';
import TemplateMarketplace from './TemplateMarketplace';

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
  const [result, setResult] = useState<{
    ok: boolean;
    targetDir?: string;
    error?: string;
    githubUrl?: string;
    vercelUrl?: string;
    renderUrl?: string;
  } | null>(null);
  const [envFromSettings, setEnvFromSettings] = useState(true);
  const [gitHubPush, setGitHubPush] = useState(false);
  const [gitHubPrivate, setGitHubPrivate] = useState(true);
  const [deployToVercel, setDeployToVercel] = useState(false);
  const [deployToRender, setDeployToRender] = useState(false);
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [customTemplateRepo, setCustomTemplateRepo] = useState('');
  const [settings, setSettings] = useState<{ vercelToken?: string; renderToken?: string; githubToken?: string }>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ files: string[]; fileCount: number; lineCount: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [uiKit, setUiKit] = useState<'tailwind' | 'shadcn' | 'material' | 'chakra'>('tailwind');
  const [envPreset, setEnvPreset] = useState<'dev' | 'production' | 'indie-saas'>('dev');
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

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    const res = await window.devdash.scaffold.previewTemplate(template);
    if ('error' in res) {
      setPreviewData(null);
    } else {
      setPreviewData(res);
    }
    setPreviewLoading(false);
  };

  const generate = async () => {
    if (!name.trim()) return;
    if (!parent) {
      setResult({ ok: false, error: 'Pick a parent folder first.' });
      return;
    }
    setBusy(true);
    setResult(null);
    setLogs([{ stream: 'system', line: `Starting ${useCustomTemplate ? 'custom' : template} scaffold for ${name}…`, ts: Date.now() }]);
    const res = await window.devdash.scaffold.run({
      projectName: name.trim(),
      displayName: displayName.trim() || name.trim(),
      targetParentDir: parent,
      template,
      useStripe,
      install,
      gitInit,
      envFromSettings,
      gitHubPush,
      gitHubPrivate,
      customTemplateRepo: useCustomTemplate ? customTemplateRepo : undefined,
      deployToVercel,
      deployToRender,
      uiKit: template === 'flutter-firebase' ? undefined : uiKit,
      envPreset: template === 'flutter-firebase' ? undefined : envPreset,
    });
    setBusy(false);
    setResult(res);
    if (res.ok) onProjectCreated();
  };

  const hasVercelToken = !!settings.vercelToken;
  const hasRenderToken = !!settings.renderToken;

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
            <div className="mt-1 flex gap-2">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={useCustomTemplate}
                className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text disabled:opacity-50"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={handlePreview}
                disabled={useCustomTemplate}
                className="btn-soft text-[10px] disabled:opacity-40"
                title="Preview template file tree"
              >
                Preview
              </button>
            </div>
            <p className="mt-1 text-[10px] text-dash-mute">
              {templates.find((t) => t.id === template)?.description}
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-dash-text">
              <input
                type="checkbox"
                checked={useCustomTemplate}
                onChange={(e) => setUseCustomTemplate(e.target.checked)}
              />
              Use custom template (GitHub repo)
            </label>
            {useCustomTemplate && (
              <input
                value={customTemplateRepo}
                onChange={(e) => setCustomTemplateRepo(e.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="mt-2 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              />
            )}
          </div>

          {/* Template Marketplace */}
          <div>
            <button
              type="button"
              onClick={() => setMarketplaceOpen(!marketplaceOpen)}
              className="flex items-center gap-1.5 text-xs text-dash-accent hover:text-dash-text"
            >
              <span className="text-[10px]">{marketplaceOpen ? '▾' : '▸'}</span>
              Browse community templates
            </button>
            {marketplaceOpen && (
              <div className="mt-2 rounded-lg border border-dash-line bg-dash-card p-3">
                <TemplateMarketplace
                  onUse={(url) => {
                    setUseCustomTemplate(true);
                    setCustomTemplateRepo(url);
                    setMarketplaceOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* UI Kit Selection */}
          {template !== 'flutter-firebase' && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-dash-mute">UI Kit</label>
              <select
                value={uiKit}
                onChange={(e) => setUiKit(e.target.value as typeof uiKit)}
                className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
              >
                <option value="tailwind">Tailwind CSS (default)</option>
                <option value="shadcn">shadcn/ui (Radix + Tailwind)</option>
                <option value="material">Material UI (MUI)</option>
                <option value="chakra">Chakra UI</option>
              </select>
              <p className="mt-1 text-[10px] text-dash-mute">
                {uiKit === 'tailwind' && 'Already included in templates. No extra deps.'}
                {uiKit === 'shadcn' && 'Adds Radix primitives, CVA, tailwind-merge + base components (Button, Input, Card).'}
                {uiKit === 'material' && 'Adds @mui/material + Emotion styling engine.'}
                {uiKit === 'chakra' && 'Adds @chakra-ui/react + Emotion + Framer Motion.'}
              </p>
            </div>
          )}

          {/* Environment Preset */}
          {template !== 'flutter-firebase' && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-dash-mute">Environment Preset</label>
              <div className="mt-1 flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-dash-text">
                  <input
                    type="radio"
                    name="envPreset"
                    value="dev"
                    checked={envPreset === 'dev'}
                    onChange={() => setEnvPreset('dev')}
                  />
                  Dev (default, no extra packages)
                </label>
                <label className="flex items-center gap-2 text-xs text-dash-text">
                  <input
                    type="radio"
                    name="envPreset"
                    value="production"
                    checked={envPreset === 'production'}
                    onChange={() => setEnvPreset('production')}
                  />
                  Production
                  <span className="text-[10px] text-dash-mute">+Sentry, helmet, rate-limit, compression, cors</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-dash-text">
                  <input
                    type="radio"
                    name="envPreset"
                    value="indie-saas"
                    checked={envPreset === 'indie-saas'}
                    onChange={() => setEnvPreset('indie-saas')}
                  />
                  Indie SaaS
                  <span className="text-[10px] text-dash-mute">+Production + PostHog + Logtail</span>
                </label>
              </div>
            </div>
          )}

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
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={envFromSettings} onChange={(e) => setEnvFromSettings(e.target.checked)} />
              Pre-fill .env hints from DevDash settings (when available)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={gitHubPush}
                disabled={!gitInit}
                onChange={(e) => setGitHubPush(e.target.checked)}
              />
              Create GitHub repo &amp; push (uses Settings → GitHub token)
            </label>
            {gitHubPush && (
              <label className="ml-6 flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={gitHubPrivate} onChange={(e) => setGitHubPrivate(e.target.checked)} />
                Make repo private
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deployToVercel}
                disabled={!hasVercelToken || !gitHubPush}
                onChange={(e) => setDeployToVercel(e.target.checked)}
              />
              Deploy to Vercel
              {!hasVercelToken && <span className="text-[10px] text-dash-mute">(no token)</span>}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deployToRender}
                disabled={!hasRenderToken || !gitHubPush}
                onChange={(e) => setDeployToRender(e.target.checked)}
              />
              Deploy to Render
              {!hasRenderToken && <span className="text-[10px] text-dash-mute">(no token)</span>}
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
                  {result.githubUrl && (
                    <a
                      href={result.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-soft text-[10px]"
                    >
                      Open repo
                    </a>
                  )}
                  {result.vercelUrl && (
                    <a
                      href={result.vercelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-soft text-[10px]"
                    >
                      Vercel ↗
                    </a>
                  )}
                  {result.renderUrl && (
                    <a
                      href={result.renderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-soft text-[10px]"
                    >
                      Render ↗
                    </a>
                  )}
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

      {/* Template Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreviewOpen(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl border border-dash-line bg-dash-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
              <h3 className="text-sm font-semibold text-dash-text">Template Preview: {template}</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-dash-mute hover:text-dash-text text-lg leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(70vh - 60px)' }}>
              {previewLoading ? (
                <p className="text-xs text-dash-mute">Loading...</p>
              ) : previewData ? (
                <>
                  <div className="mb-3 flex gap-4 text-[11px] text-dash-mute">
                    <span>{previewData.fileCount} files</span>
                    <span>{previewData.lineCount.toLocaleString()} lines</span>
                  </div>
                  <div className="space-y-0.5 font-mono text-[10px] text-dash-text">
                    {previewData.files.map((f, i) => (
                      <div key={i} className="truncate">{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-red-400">Template not found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
