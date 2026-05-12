import { useEffect, useState } from 'react';
import type { Toast } from '../types';

export default function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const off = window.devdash.deploys.onToast((payload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: Toast = {
        id,
        type: payload.type,
        title: payload.title,
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    });
    return () => off();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast pointer-events-auto min-w-[240px] max-w-sm rounded-md border px-3 py-2 text-xs shadow-glow ${
            t.type === 'error'
              ? 'border-dash-err/50 bg-dash-err/10 text-dash-text'
              : t.type === 'success'
              ? 'border-dash-ok/50 bg-dash-ok/10 text-dash-text'
              : 'border-dash-line bg-dash-panel text-dash-text'
          }`}
        >
          <div className="font-medium">{t.title}</div>
          {t.body && <div className="mt-0.5 text-[11px] text-dash-mute">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
