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
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
    close: () => ipcRenderer.invoke('window:close'),
  },
};

contextBridge.exposeInMainWorld('devdash', api);

export type DevDashApi = typeof api;
