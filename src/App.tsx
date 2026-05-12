import { useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ProjectsView from './components/ProjectsView';
import DeploysView from './components/DeploysView';
import SettingsView from './components/SettingsView';
import Toasts from './components/Toasts';

type Tab = 'projects' | 'deploys' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('projects');

  return (
    <div className="relative flex h-screen w-screen flex-col bg-dash-bg text-dash-text">
      <TitleBar
        onMinimize={() => window.devdash.window.minimize()}
        onMaximize={() => window.devdash.window.maximizeToggle()}
        onClose={() => window.devdash.window.close()}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar tab={tab} onChange={setTab} />
        <main className="no-drag flex min-w-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {tab === 'projects' && <ProjectsView />}
          {tab === 'deploys' && <DeploysView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
