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
          className={`toast pointer-events-auto min-w-[240px] max-w-sm rounded-md border px-3 py-2 text-xs shadow-lg ${
            t.type === 'error'
              ? 'border-[#EE0000]/30 bg-[#EE0000]/5 text-white'
              : t.type === 'success'
              ? 'border-[#00C853]/30 bg-[#00C853]/5 text-white'
              : 'border-[#222] bg-[#111] text-white'
          }`}
        >
          <div className="font-medium">{t.title}</div>
          {t.body && <div className="mt-0.5 text-[11px] text-[#888]">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
