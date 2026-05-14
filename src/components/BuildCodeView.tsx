import { useEffect, useRef, useState, useMemo } from 'react';
import TemplateMarketplace from './TemplateMarketplace';
import TemplateCompare from './TemplateCompare';
import ScaffoldHistory from './ScaffoldHistory';
import TemplateEditor from './TemplateEditor';

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
  const [compareOpen, setCompareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [structure, setStructure] = useState<'monorepo' | 'polyrepo'>('monorepo');
  const [showPolyrepo, setShowPolyrepo] = useState(false);
  const [autoOpenVSCode, setAutoOpenVSCode] = useState(false);
  const [postHooks, setPostHooks] = useState<Array<{ label: string; command: string; cwd?: 'root' | 'backend' | 'frontend' }>>([]);
  const [customHookCmd, setCustomHookCmd] = useState('');
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunData, setDryRunData] = useState<{ files: Array<{ path: string; content: string }> } | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunSelectedFile, setDryRunSelectedFile] = useState('');
  const [readmeGenerating, setReadmeGenerating] = useState(false);
  const logsEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const t = await window.devdash.scaffold.templates();
      setTemplates(t);
      if (t[0]) setTemplate(t[0].id);
      const s = await window.devdash.settings.get();
      setSettings(s);
      setFavorites(s.favoriteTemplates || []);
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

  // Template search + favorites sorting
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      list = list.filter((t) =>
        t.id.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    // Pin favorites to top
    const favSet = new Set(favorites);
    const favs = list.filter((t) => favSet.has(t.id));
    const rest = list.filter((t) => !favSet.has(t.id));
    return [...favs, ...rest];
  }, [templates, templateSearch, favorites]);

  const toggleFavorite = async (templateId: string) => {
    const updated = await window.devdash.scaffold.toggleFavorite(templateId);
    setFavorites(updated || []);
  };

  // Check if template supports polyrepo
  useEffect(() => {
    if (template) {
      void (async () => {
        const has = await window.devdash.scaffold.hasMultipleFolders(template);
        setShowPolyrepo(!!has);
      })();
    }
  }, [template]);

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
      postHooks: postHooks.length > 0 ? postHooks : undefined,
      structure: showPolyrepo ? structure : undefined,
      autoOpenVSCode,
    });
    setBusy(false);
    setResult(res);
    if (res.ok) onProjectCreated();
  };

  const hasVercelToken = !!settings.vercelToken;
  const hasRenderToken = !!settings.renderToken;

  const handleDryRun = async () => {
    setDryRunLoading(true);
    setDryRunOpen(true);
    setDryRunData(null);
    setDryRunSelectedFile('');
    const res = await window.devdash.scaffold.dryRun({
      projectName: name.trim(),
      displayName: displayName.trim() || name.trim(),
      targetParentDir: parent || 'C:\\tmp',
      template,
      useStripe,
      install: false,
      gitInit: false,
      uiKit: template === 'flutter-firebase' ? undefined : uiKit,
      envPreset: template === 'flutter-firebase' ? undefined : envPreset,
    });
    if (res.ok) {
      setDryRunData({ files: res.files });
    }
    setDryRunLoading(false);
  };

  const handleGenerateReadme = async () => {
    if (!result?.targetDir) return;
    setReadmeGenerating(true);
    const res = await window.devdash.scaffold.generateReadme(result.targetDir, {
      projectName: name.trim(),
      displayName: displayName.trim() || name.trim(),
      targetParentDir: parent,
      template,
      useStripe,
      install,
      gitInit,
      uiKit,
      envPreset,
      deployToVercel,
      deployToRender,
    });
    setReadmeGenerating(false);
    if (res.ok) {
      setLogs((cur) => [...cur, { stream: 'system', line: 'README.md generated successfully.', ts: Date.now() }]);
    } else {
      setLogs((cur) => [...cur, { stream: 'stderr', line: `README generation failed: ${res.error}`, ts: Date.now() }]);
    }
  };

  const handleReScaffold = (entry: any) => {
    setName(entry.projectName);
    setTemplate(entry.template);
    if (entry.options) {
      setUseStripe(entry.options.useStripe ?? true);
      setInstall(entry.options.install ?? true);
      setGitInit(entry.options.gitInit ?? true);
      setGitHubPush(entry.options.gitHubPush ?? false);
      if (entry.options.uiKit) setUiKit(entry.options.uiKit);
      if (entry.options.envPreset) setEnvPreset(entry.options.envPreset);
      if (entry.options.structure) setStructure(entry.options.structure);
      setAutoOpenVSCode(entry.options.autoOpenVSCode ?? false);
    }
    setHistoryOpen(false);
  };

  const predefinedHooks = [
    { label: 'Run migrations', command: 'npx prisma migrate dev', cwd: 'backend' as const },
    { label: 'Seed database', command: 'npm run seed', cwd: 'backend' as const },
    { label: 'Setup Prisma', command: 'npx prisma generate', cwd: 'backend' as const },
    { label: 'Install Husky', command: 'npx husky install', cwd: 'root' as const },
  ];

  const toggleHook = (hook: { label: string; command: string; cwd?: 'root' | 'backend' | 'frontend' }) => {
    const exists = postHooks.find((h) => h.label === hook.label);
    if (exists) {
      setPostHooks(postHooks.filter((h) => h.label !== hook.label));
    } else {
      setPostHooks([...postHooks, hook]);
    }
  };

  const addCustomHook = () => {
    if (!customHookCmd.trim()) return;
    setPostHooks([...postHooks, { label: customHookCmd.trim(), command: customHookCmd.trim(), cwd: 'root' }]);
    setCustomHookCmd('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Build code</h1>
          <p className="text-xs text-[#666] mt-0.5">
            Scaffold a production-ready SaaS in one click. Auth, payments, admin, emails wired up.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCompareOpen(true)} className="btn-soft">Compare</button>
          <button onClick={() => setHistoryOpen(!historyOpen)} className="btn-soft">{historyOpen ? 'Hide History' : 'History'}</button>
          <button onClick={() => setEditorOpen(!editorOpen)} className="btn-soft">{editorOpen ? 'Hide Editor' : 'Editor'}</button>
        </div>
      </div>

      {/* History panel */}
      {historyOpen && (
        <div className="mb-4 rounded-lg border border-[#222] bg-[#111] p-4">
          <ScaffoldHistory onReScaffold={handleReScaffold} />
        </div>
      )}

      {/* Template Editor panel */}
      {editorOpen && (
        <div className="mb-4 rounded-lg border border-[#222] bg-[#111] p-4" style={{ height: '400px' }}>
          <TemplateEditor templates={templates} />
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <section className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-[#222] bg-[#111] p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#666]">Configure</h3>

          <div>
            <label className="text-[11px] text-[#888]">Project name (folder)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-saas"
              className="mt-1 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 font-mono text-sm text-white placeholder:text-[#444]"
            />
            <p className="mt-1 text-[10px] text-[#444]">Letters, numbers, dashes, underscores.</p>
          </div>

          <div>
            <label className="text-[11px] text-[#888]">Display name (shown in UI)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My SaaS"
              className="mt-1 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 text-sm text-white placeholder:text-[#444]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#888]">Parent folder</label>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={parent}
                placeholder="Click Choose…"
                className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-[#444]"
              />
              <button onClick={pickParent} className="btn-soft">Choose…</button>
            </div>
            {parent && name && (
              <p className="mt-1 text-[10px] text-[#444] font-mono">→ {parent}\{name}</p>
            )}
          </div>

          <div>
            <label className="text-[11px] text-[#888]">Template</label>
            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="mt-1 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 text-sm text-white placeholder:text-[#444]"
            />
            <div className="mt-1 flex gap-2">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={useCustomTemplate}
                className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{favorites.includes(t.id) ? '★ ' : ''}{t.label}</option>
                ))}
              </select>
              <button
                onClick={() => toggleFavorite(template)}
                disabled={useCustomTemplate}
                className="btn-soft disabled:opacity-40"
                title={favorites.includes(template) ? 'Unfavorite' : 'Favorite'}
              >
                {favorites.includes(template) ? '★' : '☆'}
              </button>
              <button
                onClick={handlePreview}
                disabled={useCustomTemplate}
                className="btn-soft disabled:opacity-40"
                title="Preview template file tree"
              >
                Preview
              </button>
              <button
                onClick={handleDryRun}
                disabled={useCustomTemplate || !name.trim()}
                className="btn-soft disabled:opacity-40"
                title="Dry run with replacements applied"
              >
                Dry Run
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[#444]">
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
                className="mt-2 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 font-mono text-[11px] text-white placeholder:text-[#444]"
              />
            )}
          </div>

          {/* Template Marketplace */}
          <div>
            <button
              type="button"
              onClick={() => setMarketplaceOpen(!marketplaceOpen)}
              className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors duration-150"
            >
              <span className="text-[10px]">{marketplaceOpen ? '▾' : '▸'}</span>
              Browse community templates
            </button>
            {marketplaceOpen && (
              <div className="mt-2 rounded-lg border border-[#222] bg-[#0A0A0A] p-3">
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
              <label className="text-[11px] text-[#888]">UI Kit</label>
              <select
                value={uiKit}
                onChange={(e) => setUiKit(e.target.value as typeof uiKit)}
                className="mt-1 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-1.5 text-sm text-white"
              >
                <option value="tailwind">Tailwind CSS (default)</option>
                <option value="shadcn">shadcn/ui (Radix + Tailwind)</option>
                <option value="material">Material UI (MUI)</option>
                <option value="chakra">Chakra UI</option>
              </select>
              <p className="mt-1 text-[10px] text-[#444]">
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
              <label className="text-[11px] text-[#888]">Environment Preset</label>
              <div className="mt-1 flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="radio"
                    name="envPreset"
                    value="dev"
                    checked={envPreset === 'dev'}
                    onChange={() => setEnvPreset('dev')}
                  />
                  Dev (default, no extra packages)
                </label>
                <label className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="radio"
                    name="envPreset"
                    value="production"
                    checked={envPreset === 'production'}
                    onChange={() => setEnvPreset('production')}
                  />
                  Production
                  <span className="text-[10px] text-[#666]">+Sentry, helmet, rate-limit, compression, cors</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="radio"
                    name="envPreset"
                    value="indie-saas"
                    checked={envPreset === 'indie-saas'}
                    onChange={() => setEnvPreset('indie-saas')}
                  />
                  Indie SaaS
                  <span className="text-[10px] text-[#666]">+Production + PostHog + Logtail</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 text-xs text-white">
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
              {!hasVercelToken && <span className="text-[10px] text-[#666]">(no token)</span>}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deployToRender}
                disabled={!hasRenderToken || !gitHubPush}
                onChange={(e) => setDeployToRender(e.target.checked)}
              />
              Deploy to Render
              {!hasRenderToken && <span className="text-[10px] text-[#666]">(no token)</span>}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoOpenVSCode} onChange={(e) => setAutoOpenVSCode(e.target.checked)} />
              Auto-open in VS Code after scaffold
            </label>
          </div>

          {/* Multi-project Structure */}
          {showPolyrepo && (
            <div>
              <label className="text-[11px] text-[#888]">Project Structure</label>
              <div className="mt-1 flex gap-3">
                <label className="flex items-center gap-2 text-xs text-white">
                  <input type="radio" name="structure" value="monorepo" checked={structure === 'monorepo'} onChange={() => setStructure('monorepo')} />
                  Monorepo (single folder)
                </label>
                <label className="flex items-center gap-2 text-xs text-white">
                  <input type="radio" name="structure" value="polyrepo" checked={structure === 'polyrepo'} onChange={() => setStructure('polyrepo')} />
                  Polyrepo (separate repos)
                </label>
              </div>
              {structure === 'polyrepo' && (
                <p className="mt-1 text-[10px] text-[#444]">Creates {name}-frontend and {name}-backend as separate folders with own git init.</p>
              )}
            </div>
          )}

          {/* Post-scaffold Hooks */}
          <div>
            <label className="text-[11px] text-[#888]">Post-scaffold Hooks</label>
            <div className="mt-1 flex flex-col gap-1">
              {predefinedHooks.map((hook) => (
                <label key={hook.label} className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="checkbox"
                    checked={postHooks.some((h) => h.label === hook.label)}
                    onChange={() => toggleHook(hook)}
                  />
                  {hook.label}
                  <span className="text-[10px] text-[#666] font-mono">{hook.command}</span>
                </label>
              ))}
              <div className="flex gap-1 mt-1">
                <input
                  value={customHookCmd}
                  onChange={(e) => setCustomHookCmd(e.target.value)}
                  placeholder="Custom command..."
                  className="flex-1 rounded-md border border-[#333] bg-[#0A0A0A] px-2 py-1 font-mono text-[10px] text-white placeholder:text-[#444]"
                  onKeyDown={(e) => e.key === 'Enter' && addCustomHook()}
                />
                <button onClick={addCustomHook} className="btn-soft">Add</button>
              </div>
              {postHooks.filter((h) => !predefinedHooks.some((p) => p.label === h.label)).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-white ml-4">
                  <span className="font-mono">{h.command}</span>
                  <button onClick={() => setPostHooks(postHooks.filter((ph) => ph !== h))} className="text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
            </div>
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
                  ? 'border border-[#00C853]/20 bg-[#00C853]/5 text-[#00C853]'
                  : 'border border-[#EE0000]/20 bg-[#EE0000]/5 text-[#EE0000]'
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
                      className="btn-soft"
                    >
                      Open repo
                    </a>
                  )}
                  {result.vercelUrl && (
                    <a
                      href={result.vercelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-soft"
                    >
                      Vercel ↗
                    </a>
                  )}
                  {result.renderUrl && (
                    <a
                      href={result.renderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-soft"
                    >
                      Render ↗
                    </a>
                  )}
                  <button
                    className="btn-soft"
                    onClick={() => result.targetDir && window.devdash.projects.openFolder(result.targetDir)}
                  >
                    Open folder
                  </button>
                  <button
                    className="btn-soft"
                    onClick={() => result.targetDir && window.devdash.projects.openInVSCode(result.targetDir)}
                  >
                    Open in VS Code
                  </button>
                  <button
                    className="btn-soft"
                    disabled={readmeGenerating}
                    onClick={handleGenerateReadme}
                  >
                    {readmeGenerating ? 'Generating...' : '📝 Generate README'}
                  </button>
                </div>
              ) : (
                <span>❌ {result.error}</span>
              )}
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#222] bg-[#111] p-0">
          <div className="flex items-center justify-between border-b border-[#222] px-3 py-2">
            <h3 className="text-xs font-medium text-[#888]">Build log</h3>
            <button
              className="text-[10px] text-[#666] hover:text-white transition-colors duration-150"
              onClick={() => setLogs([])}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px]">
            {logs.length === 0 ? (
              <p className="px-2 py-1 text-[#444]">Logs appear here once you click Generate.</p>
            ) : (
              <>
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.stream === 'stderr'
                        ? 'text-[#EE0000]'
                        : l.stream === 'system'
                        ? 'text-[#0070F3]'
                        : 'text-[#ccc]'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewOpen(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-lg border border-[#222] bg-[#111] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-3">
              <h3 className="text-sm font-medium text-white">Template Preview: {template}</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-[#666] hover:text-white text-lg leading-none transition-colors duration-150">&times;</button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(70vh - 60px)' }}>
              {previewLoading ? (
                <p className="text-xs text-[#666]">Loading...</p>
              ) : previewData ? (
                <>
                  <div className="mb-3 flex gap-4 text-[11px] text-[#888]">
                    <span>{previewData.fileCount} files</span>
                    <span>{previewData.lineCount.toLocaleString()} lines</span>
                  </div>
                  <div className="space-y-0.5 font-mono text-[10px] text-[#ccc]">
                    {previewData.files.map((f, i) => (
                      <div key={i} className="truncate">{f}</div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#EE0000]">Template not found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Compare Modal */}
      {compareOpen && (
        <TemplateCompare templates={templates} onClose={() => setCompareOpen(false)} />
      )}

      {/* Dry Run Modal */}
      {dryRunOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setDryRunOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-[#222] bg-[#111] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-3">
              <h3 className="text-sm font-medium text-white">Dry Run Preview</h3>
              <button onClick={() => setDryRunOpen(false)} className="text-[#666] hover:text-white text-lg leading-none transition-colors duration-150">&times;</button>
            </div>
            <div className="flex" style={{ height: 'calc(80vh - 60px)' }}>
              {dryRunLoading ? (
                <div className="flex items-center justify-center w-full">
                  <p className="text-xs text-[#666]">Running dry run...</p>
                </div>
              ) : dryRunData ? (
                <>
                  {/* File tree */}
                  <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-[#222] p-2">
                    <p className="text-[10px] text-[#666] mb-2">{dryRunData.files.length} files</p>
                    {dryRunData.files.map((f, i) => (
                      <div
                        key={i}
                        onClick={() => setDryRunSelectedFile(f.path)}
                        className={`cursor-pointer truncate rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors duration-150 ${
                          dryRunSelectedFile === f.path ? 'bg-[#0070F3]/10 text-[#0070F3]' : 'text-[#ccc] hover:bg-white/[0.04]'
                        }`}
                        title={f.path}
                      >
                        {f.path}
                      </div>
                    ))}
                  </div>
                  {/* File content */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {dryRunSelectedFile ? (
                      <>
                        <p className="text-[10px] font-mono text-[#888] mb-2">{dryRunSelectedFile}</p>
                        <pre className="whitespace-pre-wrap font-mono text-[10px] text-[#ccc]">
                          {dryRunData.files.find((f) => f.path === dryRunSelectedFile)?.content || ''}
                        </pre>
                      </>
                    ) : (
                      <p className="text-xs text-[#666]">Click a file to view its content with all replacements applied.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <p className="text-xs text-[#EE0000]">Dry run failed or not supported for this template.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
