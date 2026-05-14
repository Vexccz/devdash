import { useState, useEffect } from 'react';

interface Snippet {
  id: string;
  title: string;
  language: string;
  code: string;
  tags: string[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

const LANGUAGES = [
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'c', 'cpp',
  'csharp', 'ruby', 'php', 'swift', 'kotlin', 'dart', 'sql', 'html', 'css',
  'bash', 'yaml', 'json', 'toml', 'markdown', 'text',
];

export default function SnippetLibrary() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState('');
  const [filterLang, setFilterLang] = useState('');
  const [selected, setSelected] = useState<Snippet | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formLang, setFormLang] = useState('typescript');
  const [formCode, setFormCode] = useState('');
  const [formTags, setFormTags] = useState('');
  const [insertPath, setInsertPath] = useState('');

  const load = async () => {
    const filter: { search?: string; language?: string } = {};
    if (search) filter.search = search;
    if (filterLang) filter.language = filterLang;
    const list = await window.devdash.snippets.list(Object.keys(filter).length > 0 ? filter : undefined);
    setSnippets(list);
  };

  useEffect(() => { void load(); }, [search, filterLang]);

  const openCreate = () => {
    setCreating(true);
    setEditing(false);
    setSelected(null);
    setFormTitle('');
    setFormLang('typescript');
    setFormCode('');
    setFormTags('');
  };

  const openEdit = (s: Snippet) => {
    setSelected(s);
    setEditing(true);
    setCreating(false);
    setFormTitle(s.title);
    setFormLang(s.language);
    setFormCode(s.code);
    setFormTags(s.tags.join(', '));
  };

  const handleSave = async () => {
    const input: any = {
      title: formTitle,
      language: formLang,
      code: formCode,
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    if (editing && selected) input.id = selected.id;
    await window.devdash.snippets.save(input);
    setCreating(false);
    setEditing(false);
    setSelected(null);
    void load();
  };

  const handleDelete = async (id: string) => {
    await window.devdash.snippets.delete(id);
    if (selected?.id === id) { setSelected(null); setEditing(false); }
    void load();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleInsert = async () => {
    if (!selected || !insertPath.trim()) return;
    const result = await window.devdash.snippets.insertIntoProject(selected.id, insertPath.trim());
    if (result.ok) {
      setInsertPath('');
    }
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const result = await window.devdash.snippets.generate(genPrompt);
      if (result.ok && result.snippet) {
        setFormTitle(result.snippet.title || '');
        setFormLang(result.snippet.language || 'typescript');
        setFormCode(result.snippet.code || '');
        setFormTags((result.snippet.tags || []).join(', '));
        setCreating(true);
        setGenPrompt('');
      } else {
        setGenError(result.error || 'Generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">Snippets</h2>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="rounded bg-dash-indigo/20 px-3 py-1.5 text-xs font-medium text-dash-indigoBright hover:bg-dash-indigo/30"
          >
            + New
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search snippets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border border-dash-line bg-dash-panel/60 px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-mute focus:border-dash-indigo focus:outline-none"
        />
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="rounded border border-dash-line bg-dash-panel/60 px-2 py-1.5 text-xs text-dash-text focus:border-dash-indigo focus:outline-none"
        >
          <option value="">All languages</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* AI Generate */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Describe a snippet to generate with AI..."
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          className="flex-1 rounded border border-dash-line bg-dash-panel/60 px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-mute focus:border-dash-indigo focus:outline-none"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !genPrompt.trim()}
          className="rounded bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {genError && <p className="text-[10px] text-red-400">{genError}</p>}

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* List */}
        <div className="flex w-1/3 flex-col gap-1 overflow-y-auto">
          {snippets.length === 0 && (
            <p className="py-8 text-center text-xs text-dash-mute">No snippets yet</p>
          )}
          {snippets.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelected(s); setEditing(false); setCreating(false); }}
              className={`rounded-md border px-3 py-2 text-left transition ${
                selected?.id === s.id
                  ? 'border-dash-indigo bg-dash-indigo/10'
                  : 'border-dash-line bg-dash-panel/40 hover:bg-white/5'
              }`}
            >
              <div className="text-xs font-medium text-dash-text">{s.title}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-dash-mute">{s.language}</span>
                {s.tags.slice(0, 2).map((t) => (
                  <span key={t} className="text-[10px] text-dash-mute">#{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Detail / Form */}
        <div className="flex flex-1 flex-col overflow-y-auto rounded-md border border-dash-line bg-dash-panel/40 p-3">
          {(creating || editing) ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="rounded border border-dash-line bg-black/20 px-3 py-1.5 text-xs text-dash-text focus:border-dash-indigo focus:outline-none"
              />
              <select
                value={formLang}
                onChange={(e) => setFormLang(e.target.value)}
                className="rounded border border-dash-line bg-black/20 px-2 py-1.5 text-xs text-dash-text focus:border-dash-indigo focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <textarea
                placeholder="Code..."
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                rows={12}
                className="resize-none rounded border border-dash-line bg-black/20 px-3 py-2 font-mono text-xs text-dash-text focus:border-dash-indigo focus:outline-none"
              />
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="rounded border border-dash-line bg-black/20 px-3 py-1.5 text-xs text-dash-text focus:border-dash-indigo focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!formTitle.trim() || !formCode.trim()}
                  className="rounded bg-dash-indigo/20 px-3 py-1.5 text-xs font-medium text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-50"
                >
                  {editing ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={() => { setCreating(false); setEditing(false); }}
                  className="rounded bg-white/5 px-3 py-1.5 text-xs text-dash-mute hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-dash-text">{selected.title}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(selected)}
                    className="rounded bg-white/5 px-2 py-1 text-[10px] text-dash-mute hover:bg-white/10 hover:text-dash-text"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCopy(selected.code)}
                    className="rounded bg-white/5 px-2 py-1 text-[10px] text-dash-mute hover:bg-white/10 hover:text-dash-text"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-dash-mute">{selected.language}</span>
                {selected.tags.map((t) => (
                  <span key={t} className="rounded bg-dash-indigo/10 px-1.5 py-0.5 text-[10px] text-dash-indigoBright">#{t}</span>
                ))}
              </div>
              <pre className="flex-1 overflow-auto rounded bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-dash-text">
                {selected.code}
              </pre>
              {/* Insert into project */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="File path to insert into..."
                  value={insertPath}
                  onChange={(e) => setInsertPath(e.target.value)}
                  className="flex-1 rounded border border-dash-line bg-black/20 px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-mute focus:border-dash-indigo focus:outline-none"
                />
                <button
                  onClick={handleInsert}
                  disabled={!insertPath.trim()}
                  className="rounded bg-white/5 px-3 py-1.5 text-xs text-dash-mute hover:bg-white/10 hover:text-dash-text disabled:opacity-50"
                >
                  Insert
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-xs text-dash-mute">Select a snippet or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
