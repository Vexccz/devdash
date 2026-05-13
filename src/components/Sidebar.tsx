type Tab = 'projects' | 'deploys' | 'uptime' | 'time' | 'deps' | 'automations' | 'dbhealth' | 'metrics' | 'ports' | 'build' | 'chat' | 'settings';

interface Props {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

export default function Sidebar({ tab, onChange }: Props) {
  const items: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'projects', label: 'Projects', icon: <FolderIcon /> },
    { id: 'deploys', label: 'Deploys', icon: <RadarIcon /> },
    { id: 'uptime', label: 'Uptime', icon: <PulseIcon /> },
    { id: 'time', label: 'Time', icon: <ClockIcon /> },
    { id: 'deps', label: 'Deps', icon: <BoxIcon /> },
    { id: 'automations', label: 'Automations', icon: <BoltIcon /> },
    { id: 'dbhealth', label: 'DB Health', icon: <DbIcon /> },
    { id: 'metrics', label: 'Metrics', icon: <ChartIcon /> },
    { id: 'ports', label: 'Ports', icon: <PortIcon /> },
    { id: 'build', label: 'Build code', icon: <BuildIcon /> },
    { id: 'chat', label: 'Chat', icon: <ChatIcon /> },
    { id: 'settings', label: 'Settings', icon: <GearIcon /> },
  ];

  return (
    <aside className="no-drag flex w-44 flex-col border-r border-dash-line bg-dash-panel/40 py-3">
      <div className="px-3 pb-3 text-[11px] uppercase tracking-wider text-dash-mute">Dashboard</div>
      <nav className="flex flex-col gap-1 px-2">
        {items.map((it) => {
          const active = it.id === tab;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                active
                  ? 'bg-dash-indigo/20 text-dash-indigoBright'
                  : 'text-dash-mute hover:bg-white/5 hover:text-dash-text'
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-4 text-[10px] leading-relaxed text-dash-mute">
        <p>Solo dev companion.</p>
        <p className="mt-1">
          Press <kbd className="rounded border border-dash-line px-1 font-mono">Ctrl</kbd>+
          <kbd className="ml-0.5 rounded border border-dash-line px-1 font-mono">K</kbd> for
          palette.
        </p>
      </div>
    </aside>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <path d="M8 8 L12 5" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8h3l2-4 3 8 2-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 2" strokeLinecap="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" strokeLinejoin="round" />
      <path d="M2 5l6 3 6-3M8 8v7" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 2.5V12H3a1 1 0 01-1-1V4z" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" strokeLinejoin="round" />
    </svg>
  );
}

function DbIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="8" cy="3.5" rx="5" ry="1.75" />
      <path d="M3 3.5v9c0 0.97 2.24 1.75 5 1.75s5-0.78 5-1.75v-9" />
      <path d="M3 8c0 0.97 2.24 1.75 5 1.75s5-0.78 5-1.75" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 13V2M2 13h12" strokeLinecap="round" />
      <path d="M5 11V7M8 11V4M11 11V9" strokeLinecap="round" />
    </svg>
  );
}

function PortIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="12" height="6" rx="1.5" />
      <path d="M5 5V3M11 5V3" strokeLinecap="round" />
      <circle cx="5.5" cy="8" r="0.6" fill="currentColor" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" />
      <circle cx="10.5" cy="8" r="0.6" fill="currentColor" />
    </svg>
  );
}

function BuildIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12l3-3 2 2 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 6h3v3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
    </svg>
  );
}
