import { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ProjectsView from './components/ProjectsView';
import DeploysView from './components/DeploysView';
import SettingsView from './components/SettingsView';
import UptimeView from './components/UptimeView';
import TimeView from './components/TimeView';
import DepsView from './components/DepsView';
import ProjectDetail from './components/ProjectDetail';
import CommandPalette from './components/CommandPalette';
import ChatView from './components/ChatView';
import AutomationsView from './components/AutomationsView';
import DbHealthView from './components/DbHealthView';
import MetricsView from './components/MetricsView';
import OnboardingWizard from './components/OnboardingWizard';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import Toasts from './components/Toasts';
import type { ProjectConfig } from './types';

type Tab = 'projects' | 'deploys' | 'uptime' | 'time' | 'deps' | 'automations' | 'dbhealth' | 'metrics' | 'chat' | 'settings';
type DetailTab = 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release';

export default function App() {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [detail, setDetail] = useState<{ project: ProjectConfig; initialTab?: DetailTab } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadProjects = async () => {
    setProjects(await window.devdash.projects.list());
  };

  useEffect(() => {
    void loadProjects();
    void (async () => {
      const s = await window.devdash.settings.get();
      if (!s.onboardingComplete) setShowOnboarding(true);
    })();
    const h = () => setShowOnboarding(true);
    window.addEventListener('devdash:restart-onboarding', h);
    return () => window.removeEventListener('devdash:restart-onboarding', h);
  }, []);

  // Apply theme from settings
  useEffect(() => {
    const applyTheme = async () => {
      const s = await window.devdash.settings.get();
      const pref = s.theme || 'dark';
      let effective: 'dark' | 'light';
      if (pref === 'system') {
        effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      } else {
        effective = pref as 'dark' | 'light';
      }
      document.documentElement.setAttribute('data-theme', effective);
    };
    void applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const listener = () => void applyTheme();
    mq.addEventListener('change', listener);
    window.addEventListener('devdash:theme-changed', listener);
    return () => {
      mq.removeEventListener('change', listener);
      window.removeEventListener('devdash:theme-changed', listener);
    };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === '?' && !paletteOpen) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const inInput = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
        if (!inInput) {
          e.preventDefault();
          setShortcutsOpen((p) => !p);
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [paletteOpen]);

  const openProject = async (id: string, detailTab: DetailTab = 'overview') => {
    const list = await window.devdash.projects.list();
    setProjects(list);
    const project = list.find((p) => p.id === id);
    if (project) setDetail({ project, initialTab: detailTab });
  };

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
          {tab === 'projects' && <ProjectsView onOpenProject={openProject} />}
          {tab === 'deploys' && <DeploysView />}
          {tab === 'uptime' && <UptimeView onOpenProject={(id) => openProject(id, 'overview')} />}
          {tab === 'time' && <TimeView onOpenProject={(id) => openProject(id, 'time')} />}
          {tab === 'deps' && <DepsView onOpenProject={(id) => openProject(id, 'deps')} />}
          {tab === 'automations' && <AutomationsView />}
          {tab === 'dbhealth' && <DbHealthView />}
          {tab === 'metrics' && <MetricsView />}
          {tab === 'chat' && <ChatView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projects={projects}
        onOpenProject={openProject}
        onSwitchTab={setTab}
      />
      {detail && (
        <ProjectDetail
          project={detail.project}
          initialTab={detail.initialTab}
          allProjects={projects}
          onClose={() => {
            setDetail(null);
            void loadProjects();
          }}
        />
      )}
      <Toasts />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            setShowOnboarding(false);
            void loadProjects();
          }}
        />
      )}
    </div>
  );
}
