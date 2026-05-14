import { useEffect, useState } from 'react';

interface Props {
  templates: Array<{ id: string; label: string; description: string }>;
}

export default function TemplateEditor({ templates }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id || '');
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [duplicateFrom, setDuplicateFrom] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [newFileName, setNewFileName] = useState('');

  useEffect(() => {
    if (selectedTemplate) void loadFiles(selectedTemplate);
  }, [selectedTemplate]);

  const loadFiles = async (tplId: string) => {
    const res = await window.devdash.template.listFiles(tplId);
    if ('error' in res) {
      setFiles([]);
      setMessage(res.error);
    } else {
      setFiles(res.files);
      setMessage('');
    }
    setSelectedFile('');
    setContent('');
    setDirty(false);
  };

  const openFile = async (filePath: string) => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    const res = await window.devdash.template.readFile(selectedTemplate, filePath);
    if (res.error) {
      setMessage(res.error);
    } else {
      setContent(res.content || '');
      setSelectedFile(filePath);
      setDirty(false);
      setMessage('');
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    const res = await window.devdash.template.writeFile(selectedTemplate, selectedFile, content);
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setMessage('Saved.');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(res.error || 'Save failed.');
    }
  };

  const deleteFile = async (filePath: string) => {
    if (!confirm(`Delete ${filePath}?`)) return;
    const res = await window.devdash.template.deleteFile(selectedTemplate, filePath);
    if (res.ok) {
      if (selectedFile === filePath) {
        setSelectedFile('');
        setContent('');
        setDirty(false);
      }
      await loadFiles(selectedTemplate);
      setMessage('Deleted.');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(res.error || 'Delete failed.');
    }
  };

  const renameFile = async () => {
    if (!renameTarget || !newFileName.trim()) return;
    const res = await window.devdash.template.renameFile(selectedTemplate, renameTarget, newFileName.trim());
    if (res.ok) {
      if (selectedFile === renameTarget) setSelectedFile(newFileName.trim());
      await loadFiles(selectedTemplate);
      setShowRename(false);
      setMessage('Renamed.');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(res.error || 'Rename failed.');
    }
  };

  const createNewFile = async () => {
    const name = prompt('New file path (e.g. src/utils.ts):');
    if (!name?.trim()) return;
    const res = await window.devdash.template.writeFile(selectedTemplate, name.trim(), '');
    if (res.ok) {
      await loadFiles(selectedTemplate);
      setSelectedFile(name.trim());
      setContent('');
      setDirty(false);
    } else {
      setMessage(res.error || 'Create failed.');
    }
  };

  const createTemplate = async () => {
    if (!newId.trim() || !newName.trim()) return;
    const res = await window.devdash.template.createTemplate({
      id: newId.trim(),
      name: newName.trim(),
      description: newDesc.trim(),
      duplicateFrom: duplicateFrom || undefined,
    });
    if (res.ok) {
      setShowCreate(false);
      setNewId('');
      setNewName('');
      setNewDesc('');
      setDuplicateFrom('');
      setSelectedTemplate(newId.trim());
      setMessage('Template created.');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(res.error || 'Create failed.');
    }
  };

  // Build tree structure for display
  const buildTree = (fileList: string[]) => {
    const folders = new Set<string>();
    for (const f of fileList) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join('/'));
      }
    }
    return { folders: [...folders].sort(), files: [...fileList].sort() };
  };

  const tree = buildTree(files);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">Template Editor</h3>
        <button onClick={() => setShowCreate(true)} className="btn-soft text-[10px]">
          + New Template
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.label} ({t.id})</option>
          ))}
        </select>
      </div>

      {message && (
        <p className={`text-[10px] ${message.includes('fail') || message.includes('error') ? 'text-red-400' : 'text-dash-ok'}`}>
          {message}
        </p>
      )}

      <div className="flex flex-1 min-h-0 gap-2 overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-48 flex-shrink-0 overflow-y-auto rounded-lg border border-dash-line bg-dash-bg p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-dash-mute uppercase">Files ({files.length})</span>
            <button onClick={createNewFile} className="text-[10px] text-dash-accent hover:text-dash-text" title="New file">+</button>
          </div>
          <div className="space-y-0.5">
            {tree.files.map((f) => (
              <div
                key={f}
                className={`group flex items-center justify-between text-[10px] font-mono cursor-pointer rounded px-1 py-0.5 truncate ${
                  selectedFile === f ? 'bg-dash-accent/20 text-dash-accent' : 'text-dash-text hover:bg-dash-line/50'
                }`}
              >
                <span onClick={() => openFile(f)} className="truncate flex-1" title={f}>
                  {f.split('/').pop()}
                </span>
                <span className="hidden group-hover:flex gap-0.5 ml-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenameTarget(f); setNewFileName(f); setShowRename(true); }}
                    className="text-[9px] text-dash-mute hover:text-dash-text"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFile(f); }}
                    className="text-[9px] text-dash-mute hover:text-red-400"
                    title="Delete"
                  >
                    🗑
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-lg border border-dash-line bg-dash-bg">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between border-b border-dash-line px-3 py-1.5">
                <span className="text-[10px] font-mono text-dash-mute truncate">{selectedFile}</span>
                <div className="flex gap-2 items-center">
                  {dirty && <span className="text-[10px] text-yellow-400">unsaved</span>}
                  <button
                    onClick={saveFile}
                    disabled={!dirty || saving}
                    className="btn-soft text-[10px] disabled:opacity-40"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                className="flex-1 w-full resize-none bg-transparent p-3 font-mono text-[11px] text-dash-text outline-none"
                spellCheck={false}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-dash-mute">
              Select a file to edit
            </div>
          )}
        </div>
      </div>

      {/* Create template modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm rounded-xl border border-dash-line bg-dash-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-dash-text mb-3">Create New Template</h4>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-dash-mute">ID (folder name)</label>
                <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="my-template" className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-dash-mute">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Template" className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-dash-mute">Description</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="A custom template..." className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-dash-mute">Duplicate from (optional)</label>
                <select value={duplicateFrom} onChange={(e) => setDuplicateFrom(e.target.value)} className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text">
                  <option value="">Start blank</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={createTemplate} className="btn-primary text-xs flex-1">Create</button>
                <button onClick={() => setShowCreate(false)} className="btn-soft text-xs flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowRename(false)}>
          <div className="w-full max-w-sm rounded-xl border border-dash-line bg-dash-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-dash-text mb-3">Rename File</h4>
            <p className="text-[10px] text-dash-mute mb-2">From: {renameTarget}</p>
            <input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text"
            />
            <div className="flex gap-2 pt-3">
              <button onClick={renameFile} className="btn-primary text-xs flex-1">Rename</button>
              <button onClick={() => setShowRename(false)} className="btn-soft text-xs flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
