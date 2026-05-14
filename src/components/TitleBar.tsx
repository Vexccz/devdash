interface Props {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export default function TitleBar({ onMinimize, onMaximize, onClose }: Props) {
  return (
    <header className="drag flex h-9 items-center justify-between border-b border-[#222] bg-[#0A0A0A] px-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center">
          <LogoMark />
        </span>
        <span className="font-semibold tracking-tight text-white">DevDash</span>
        <span className="text-[#444]">v0.2.0</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <button
          title="Minimize"
          onClick={onMinimize}
          className="rounded px-2 py-1 text-[#666] hover:bg-white/[0.04] hover:text-white transition-all duration-150"
        >
          –
        </button>
        <button
          title="Maximize / restore"
          onClick={onMaximize}
          className="rounded px-2 py-1 text-[#666] hover:bg-white/[0.04] hover:text-white transition-all duration-150"
        >
          ▢
        </button>
        <button
          title="Close"
          onClick={onClose}
          className="rounded px-2 py-1 text-[#666] hover:bg-[#EE0000]/80 hover:text-white transition-all duration-150"
        >
          ×
        </button>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="1" y="3" width="10" height="2.2" rx="1" fill="#EDEDED" />
      <rect x="1" y="6.9" width="7" height="2.2" rx="1" fill="#888" />
      <rect x="1" y="10.8" width="12" height="2.2" rx="1" fill="#0070F3" />
    </svg>
  );
}
