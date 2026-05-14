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
    inspect: (targetPath: string) => ipcRenderer.invoke('projects:inspect', targetPath),
    scanParent: () => ipcRenderer.invoke('projects:scanParent'),
    importMany: (inputs: any[]) => ipcRenderer.invoke('projects:importMany', inputs),
    openFolder: (path: string) => ipcRenderer.invoke('projects:openFolder', path),
    openInVSCode: (path: string) => ipcRenderer.invoke('projects:openInVSCode', path),
    runDev: (id: string) => ipcRenderer.invoke('projects:runDev', id),
    pull: (id: string) => ipcRenderer.invoke('projects:pull', id),
    framework: (id: string) => ipcRenderer.invoke('projects:framework', id),
    quickCommit: (args: { id: string; message: string; stageAll: boolean; push: boolean }) =>
      ipcRenderer.invoke('projects:quickCommit', args),
    gitStatusShort: (id: string) => ipcRenderer.invoke('projects:gitStatusShort', id),
    gitDiff: (id: string, staged: boolean) => ipcRenderer.invoke('projects:gitDiff', { id, staged }),
    prList: (id: string) => ipcRenderer.invoke('projects:prList', id),
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
    trigger: (id: string) => ipcRenderer.invoke('deploys:trigger', id),
    createNew: (input: any) => ipcRenderer.invoke('deploys:createNew', input),
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
    syncCompare: (id: string) => ipcRenderer.invoke('env:syncCompare', id),
    syncPush: (id: string, keys: string[]) => ipcRenderer.invoke('env:syncPush', { id, keys }),
  },
  backup: {
    export: (opts?: { includeCache?: boolean }) => ipcRenderer.invoke('backup:export', opts ?? {}),
    import: (opts?: { restoreCache?: boolean }) => ipcRenderer.invoke('backup:import', opts ?? {}),
  },
  collab: {
    list: (projectId: string) => ipcRenderer.invoke('collab:list', projectId),
    invite: (projectId: string, username: string, permission: string) =>
      ipcRenderer.invoke('collab:invite', { projectId, username, permission }),
    remove: (projectId: string, username: string) =>
      ipcRenderer.invoke('collab:remove', { projectId, username }),
    cancelInvite: (projectId: string, invitationId: number) =>
      ipcRenderer.invoke('collab:cancelInvite', { projectId, invitationId }),
    checkToken: () => ipcRenderer.invoke('collab:checkToken'),
  },
  ports: {
    list: () => ipcRenderer.invoke('ports:list'),
    kill: (pid: number) => ipcRenderer.invoke('ports:kill', pid),
    killByProject: (projectId: string) => ipcRenderer.invoke('ports:killByProject', projectId),
  },
  capacitor: {
    detect: (projectId: string) => ipcRenderer.invoke('capacitor:detect', projectId),
    detectJava: (capVersion?: string) => ipcRenderer.invoke('capacitor:detectJava', capVersion),
    isBuilding: (projectId: string) => ipcRenderer.invoke('capacitor:isBuilding', projectId),
    buildApk: (args: { id: string; flavor: 'debug' | 'release'; runWebBuild: boolean; runSync: boolean; outputToDownloads?: boolean }) =>
      ipcRenderer.invoke('capacitor:buildApk', args),
    openApkFolder: (apkPath: string) => ipcRenderer.invoke('capacitor:openApkFolder', apkPath),
    onLog: (cb: (e: { projectId: string; stream: string; line: string; ts: number }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('capacitor:log', h);
      return () => ipcRenderer.removeListener('capacitor:log', h);
    },
  },
  scaffold: {
    templates: () => ipcRenderer.invoke('scaffold:templates'),
    marketplace: () => ipcRenderer.invoke('scaffold:marketplace'),
    pickParent: () => ipcRenderer.invoke('scaffold:pickParent'),
    previewTemplate: (templateId: string) => ipcRenderer.invoke('scaffold:previewTemplate', templateId),
    run: (opts: {
      projectName: string;
      targetParentDir: string;
      template: string;
      displayName: string;
      useStripe: boolean;
      install: boolean;
      gitInit: boolean;
      envFromSettings?: boolean;
      gitHubPush?: boolean;
      gitHubPrivate?: boolean;
      customTemplateRepo?: string;
      deployToVercel?: boolean;
      deployToRender?: boolean;
      uiKit?: 'tailwind' | 'shadcn' | 'material' | 'chakra';
      envPreset?: 'dev' | 'production' | 'indie-saas';
      postHooks?: Array<{ label: string; command: string; cwd?: 'root' | 'backend' | 'frontend' }>;
      structure?: 'monorepo' | 'polyrepo';
      autoOpenVSCode?: boolean;
    }) => ipcRenderer.invoke('scaffold:run', opts),
    isActive: () => ipcRenderer.invoke('scaffold:isActive'),
    compareTemplates: (idA: string, idB: string) => ipcRenderer.invoke('scaffold:compareTemplates', { idA, idB }),
    dryRun: (opts: any) => ipcRenderer.invoke('scaffold:dryRun', opts),
    generateReadme: (projectPath: string, options: any) => ipcRenderer.invoke('scaffold:generateReadme', { projectPath, options }),
    history: () => ipcRenderer.invoke('scaffold:history'),
    clearHistory: () => ipcRenderer.invoke('scaffold:clearHistory'),
    toggleFavorite: (templateId: string) => ipcRenderer.invoke('scaffold:toggleFavorite', templateId),
    hasMultipleFolders: (templateId: string) => ipcRenderer.invoke('scaffold:hasMultipleFolders', templateId),
    suggest: (name: string, desc?: string) => ipcRenderer.invoke('scaffold:suggest', name, desc),
    suggestAI: (name: string, desc?: string) => ipcRenderer.invoke('scaffold:suggestAI', name, desc),
    onLog: (cb: (e: { stream: string; line: string; ts: number }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('scaffold:log', h);
      return () => ipcRenderer.removeListener('scaffold:log', h);
    },
  },
  addons: {
    list: () => ipcRenderer.invoke('addons:list'),
    forTemplate: (templateId: string) => ipcRenderer.invoke('addons:forTemplate', templateId),
    recommended: (templateId: string) => ipcRenderer.invoke('addons:recommended', templateId),
    apply: (targetDir: string, addonIds: string[]) => ipcRenderer.invoke('addons:apply', targetDir, addonIds),
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
    safeUpdate: (id: string) => ipcRenderer.invoke('deps:safeUpdate', id),
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
  sentry: {
    validate: (dsn: string) => ipcRenderer.invoke('sentry:validate', dsn),
    resolve: (id: string) => ipcRenderer.invoke('sentry:resolve', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: any) => ipcRenderer.invoke('settings:update', patch),
    testToken: (provider: 'vercel' | 'render') => ipcRenderer.invoke('settings:testToken', provider),
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
  ollama: {
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    chat: (args: {
      streamId: string;
      chatId: string;
      model: string;
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      temperature?: number;
      systemPrompt?: string;
    }) => ipcRenderer.invoke('ollama:chat', args),
    stop: (streamId: string) => ipcRenderer.invoke('ollama:stop', streamId),
    onChunk: (cb: (payload: { streamId: string; chunk: string }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('ollama:chunk', h);
      return () => ipcRenderer.removeListener('ollama:chunk', h);
    },
    onDone: (cb: (payload: { streamId: string; content: string }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('ollama:done', h);
      return () => ipcRenderer.removeListener('ollama:done', h);
    },
    onError: (cb: (payload: { streamId: string; error: string }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('ollama:error', h);
      return () => ipcRenderer.removeListener('ollama:error', h);
    },
  },
  chats: {
    list: () => ipcRenderer.invoke('chats:list'),
    create: (args: { id: string; title: string; model: string; systemPrompt: string }) =>
      ipcRenderer.invoke('chats:create', args),
    update: (id: string, patch: { title?: string; model?: string; systemPrompt?: string }) =>
      ipcRenderer.invoke('chats:update', { id, patch }),
    delete: (id: string) => ipcRenderer.invoke('chats:delete', id),
    messages: (chatId: string) => ipcRenderer.invoke('chats:messages', chatId),
    addMessage: (args: { chatId: string; role: 'user' | 'assistant' | 'system'; content: string }) =>
      ipcRenderer.invoke('chats:addMessage', args),
  },
  config: {
    export: (passphrase: string) => ipcRenderer.invoke('config:export', passphrase),
    import: (passphrase: string) => ipcRenderer.invoke('config:import', passphrase),
  },
  aigen: {
    run: (opts: { projectPath: string; prompt: string }) => ipcRenderer.invoke('aigen:run', opts),
    preview: (opts: { projectPath: string; prompt: string }) => ipcRenderer.invoke('aigen:preview', opts),
    history: () => ipcRenderer.invoke('aigen:history'),
    onLog: (cb: (e: { stream: string; line: string; ts: number }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('aigen:log', h);
      return () => ipcRenderer.removeListener('aigen:log', h);
    },
  },
  template: {
    checkUpdates: () => ipcRenderer.invoke('template:checkUpdates'),
    viewDiff: (projectId: string) => ipcRenderer.invoke('template:viewDiff', projectId),
    applyUpdate: (projectId: string) => ipcRenderer.invoke('template:applyUpdate', projectId),
    listFiles: (templateId: string) => ipcRenderer.invoke('template:listFiles', templateId),
    readFile: (templateId: string, filePath: string) => ipcRenderer.invoke('template:readFile', { templateId, filePath }),
    writeFile: (templateId: string, filePath: string, content: string) => ipcRenderer.invoke('template:writeFile', { templateId, filePath, content }),
    deleteFile: (templateId: string, filePath: string) => ipcRenderer.invoke('template:deleteFile', { templateId, filePath }),
    renameFile: (templateId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('template:renameFile', { templateId, oldPath, newPath }),
    createTemplate: (args: { id: string; name: string; description: string; duplicateFrom?: string }) => ipcRenderer.invoke('template:createTemplate', args),
    test: (templateId: string) => ipcRenderer.invoke('template:test', templateId),
    testAll: () => ipcRenderer.invoke('template:testAll'),
    onTestLog: (cb: (e: { templateId: string; stream: string; line: string; ts: number }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('template:testLog', h);
      return () => ipcRenderer.removeListener('template:testLog', h);
    },
  },
  snippets: {
    list: (filter?: { language?: string; tag?: string; search?: string; projectId?: string }) => ipcRenderer.invoke('snippets:list', filter),
    get: (id: string) => ipcRenderer.invoke('snippets:get', id),
    save: (input: any) => ipcRenderer.invoke('snippets:save', input),
    delete: (id: string) => ipcRenderer.invoke('snippets:delete', id),
    generate: (description: string) => ipcRenderer.invoke('snippets:generate', description),
    insertIntoProject: (snippetId: string, filePath: string) => ipcRenderer.invoke('snippets:insertIntoProject', { snippetId, filePath }),
  },
  templateAnalytics: {
    scaffoldStats: () => ipcRenderer.invoke('analytics:scaffoldStats'),
    record: (entry: any) => ipcRenderer.invoke('analytics:record', entry),
  },
  sync: {
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    status: () => ipcRenderer.invoke('sync:status'),
    configure: (supabaseUrl: string, supabaseAnonKey: string, enabled: boolean) =>
      ipcRenderer.invoke('sync:configure', { supabaseUrl, supabaseAnonKey, enabled }),
  },
  automations: {
    list: () => ipcRenderer.invoke('automation:list'),
    save: (input: any) => ipcRenderer.invoke('automation:save', input),
    delete: (id: string) => ipcRenderer.invoke('automation:delete', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('automation:toggle', { id, enabled }),
    runNow: (id: string) => ipcRenderer.invoke('automation:runNow', id),
    runs: (jobId: string, limit?: number) => ipcRenderer.invoke('automation:runs', { jobId, limit }),
    validateCron: (expr: string) => ipcRenderer.invoke('automation:validateCron', expr),
    onRun: (cb: (payload: { jobId: string; ok: boolean; message: string }) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('automation:run', h);
      return () => ipcRenderer.removeListener('automation:run', h);
    },
  },
  dbhealth: {
    list: () => ipcRenderer.invoke('dbhealth:list'),
    save: (input: any) => ipcRenderer.invoke('dbhealth:save', input),
    delete: (id: string) => ipcRenderer.invoke('dbhealth:delete', id),
    ping: (id: string) => ipcRenderer.invoke('dbhealth:ping', id),
    pingProject: (projectId: string) => ipcRenderer.invoke('dbhealth:pingProject', projectId),
    autoDetect: (projectId: string) => ipcRenderer.invoke('dbhealth:autoDetect', projectId),
  },
  metrics: {
    render: (projectId: string, hours?: number) =>
      ipcRenderer.invoke('metrics:render', { projectId, hours }),
  },
  analytics: {
    vercel: (projectId: string, days?: number) =>
      ipcRenderer.invoke('analytics:vercel', { projectId, days }),
  },
};

contextBridge.exposeInMainWorld('devdash', api);

export type DevDashApi = typeof api;
