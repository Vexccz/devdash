import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'Navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close modal or overlay', category: 'Navigation' },

  { keys: ['Ctrl', 'Enter'], description: 'Send chat message', category: 'Chat' },

  { keys: ['Enter'], description: 'Add tag to project', category: 'Tags' },
  { keys: ['Backspace'], description: 'Remove last tag (when input empty)', category: 'Tags' },
];

export default function ShortcutsOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-dash-line bg-dash-panel shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-dash-text">Keyboard shortcuts</h2>
            <p className="text-[10px] text-dash-mute">Press Esc to close</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {categories.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-dash-mute">{cat}</h3>
              <div className="flex flex-col gap-1.5">
                {SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border border-dash-line/40 bg-dash-bg/40 px-3 py-2"
                  >
                    <span className="text-xs text-dash-text">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-[9px] text-dash-mute">+</span>}
                          <kbd className="kbd">{k}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
