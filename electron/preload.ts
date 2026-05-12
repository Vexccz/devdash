import { contextBridge, ipcRenderer } from 'electron';

const api = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    status: (id: string, fetchRemote?: boolean) =>
      ipcRenderer.invoke('projects:status', { id, fetchRemote: !!fetchRemote }),
    statusAll: (fetchRemote?: boolean) =>
      ipcRenderer.invoke('projects:statusAll', { fetchRemote: !!fetchRemote }),
    add: (input: any) => ipcRenderer.invoke('projects:add', input),
    update: (id: string, patch: any) => ipcRenderer.invoke('projects:update', { id, patch }),
    remove: (id: string) => ipcRenderer.invoke('projects:remove', id),
    pickFolder: () => ipcRenderer.invoke('projects:pickFolder'),
    openFolder: (path: string) => ipcRenderer.invoke('projects:openFolder', path),
    openInVSCode: (path: string) => ipcRenderer.invoke('projects:openInVSCode', path),
    runDev: (id: string) => ipcRenderer.invoke('projects:runDev', id),
    pull: (id: string) => ipcRenderer.invoke('projects:pull', id),
    framework: (id: string) => ipcRenderer.invoke('projects:framework', id),
  },
  devserver: {
    start: (id: string) => ipcRenderer.invoke('devserver:start', id),
    stop: (id: string) => ipcRenderer.invoke('devserver:stop', id),
    status: (id: string) => ipcRenderer.invoke('devserver:status', id),
    statusAll: () => ipcRenderer.invoke('devserver:statusAll'),
    logs: (id: string, limit?: number) => ipcRenderer.invoke('devserver:logs', { id, limit }),
    onLog: (cb: (p: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('logs:line', h);
      return () => ipcRenderer.removeListener('logs:line', h);
    },
    onStatus: (cb: (p: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('devserver:status', h);
      return () => ipcRenderer.removeListener('devserver:status', h);
    },
  },
  deploys: {
    list: () => ipcRenderer.invoke('deploys:list'),
    refresh: () => ipcRenderer.invoke('deploys:refresh'),
    onUpdate: (cb: (payload: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('deploys:update', h);
      return () => ipcRenderer.removeListener('deploys:update', h);
    },
    onToast: (cb: (payload: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('deploys:toast', h);
      return () => ipcRenderer.removeListener('deploys:toast', h);
    },
  },
  uptime: {
    all: () => ipcRenderer.invoke('uptime:all'),
    project: (id: string, hours?: number) => ipcRenderer.invoke('uptime:project', { id, hours }),
    runNow: () => ipcRenderer.invoke('uptime:runNow'),
    errors: (id: string) => ipcRenderer.invoke('uptime:errors', id),
  },
  env: {
    scan: (id: string) => ipcRenderer.invoke('env:scan', id),
    read: (id: string, file: string) => ipcRenderer.invoke('env:read', { id, file }),
    write: (id: string, file: string, entries: any) =>
      ipcRenderer.invoke('env:write', { id, file, entries }),
    clone: (sourceId: string, sourceFile: string, targetId: string, targetFile: string, overwrite?: boolean) =>
      ipcRenderer.invoke('env:clone', { sourceId, sourceFile, targetId, targetFile, overwrite: !!overwrite }),
    files: () => ipcRenderer.invoke('env:files'),
  },
  time: {
    enter: (id: string) => ipcRenderer.invoke('time:enter', id),
    leave: (id: string) => ipcRenderer.invoke('time:leave', id),
    touch: (id: string) => ipcRenderer.invoke('time:touch', id),
    summary: (id?: string | null, days?: number) =>
      ipcRenderer.invoke('time:summary', { id: id ?? null, days: days ?? 7 }),
    active: () => ipcRenderer.invoke('time:active'),
  },
  changelog: {
    generate: (id: string) => ipcRenderer.invoke('changelog:generate', id),
    write: (id: string, markdown: string) =>
      ipcRenderer.invoke('changelog:write', { id, markdown }),
  },
  release: {
    start: (id: string, opts: any) => ipcRenderer.invoke('release:start', { id, opts }),
    onProgress: (cb: (payload: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('release:progress', h);
      return () => ipcRenderer.removeListener('release:progress', h);
    },
  },
  bundle: {
    history: (id: string) => ipcRenderer.invoke('bundle:history', id),
    checkNow: (id: string) => ipcRenderer.invoke('bundle:checkNow', id),
  },
  deps: {
    runNow: (id: string) => ipcRenderer.invoke('deps:runNow', id),
    latest: (id: string) => ipcRenderer.invoke('deps:latest', id),
  },
  heatmap: {
    build: (id: string) => ipcRenderer.invoke('heatmap:build', id),
  },
  screenshots: {
    list: (id: string) => ipcRenderer.invoke('screenshots:list', id),
    captureNow: (id: string) => ipcRenderer.invoke('screenshots:captureNow', id),
    remove: (shotId: number) => ipcRenderer.invoke('screenshots:remove', shotId),
    removeOlderThan: (id: string, days: number) =>
      ipcRenderer.invoke('screenshots:removeOlderThan', { id, days }),
  },
  scheduler: {
    status: () => ipcRenderer.invoke('scheduler:status'),
    runNow: (name: string) => ipcRenderer.invoke('scheduler:runNow', name),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: any) => ipcRenderer.invoke('settings:update', patch),
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    configPath: () => ipcRenderer.invoke('app:configPath'),
    openLogs: () => ipcRenderer.invoke('app:openLogs'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),
    readFileAsDataUrl: (p: string) => ipcRenderer.invoke('shell:readFileAsDataUrl', p),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
    close: () => ipcRenderer.invoke('window:close'),
  },
};

contextBridge.exposeInMainWorld('devdash', api);

export type DevDashApi = typeof api;
