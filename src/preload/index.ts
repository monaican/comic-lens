import { contextBridge, ipcRenderer } from 'electron'

const api = {
  projects: {
    list: () => ipcRenderer.invoke('db:projects:list'),
    get: (id: string) => ipcRenderer.invoke('db:projects:get', id),
    create: (data: Record<string, string>) => ipcRenderer.invoke('db:projects:create', data),
    update: (id: string, fields: Record<string, unknown>) => ipcRenderer.invoke('db:projects:update', id, fields),
    delete: (id: string) => ipcRenderer.invoke('db:projects:delete', id)
  },
  pages: {
    list: (projectId: string) => ipcRenderer.invoke('db:pages:list', projectId),
    get: (id: string) => ipcRenderer.invoke('db:pages:get', id),
    update: (id: string, fields: Record<string, unknown>) => ipcRenderer.invoke('db:pages:update', id, fields)
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config)
  },
  file: {
    selectFolder: () => ipcRenderer.invoke('file:select-folder'),
    openFolder: (folderPath: string) => ipcRenderer.invoke('file:open-folder', folderPath),
    getProjectCover: (projectId: string) => ipcRenderer.invoke('file:get-project-cover', projectId),
    readProjectImage: (projectId: string, filename: string, kind: 'source' | 'output') =>
      ipcRenderer.invoke('file:read-project-image', projectId, filename, kind)
  },
  thumbnail: {
    get: (projectId: string, filename: string) => ipcRenderer.invoke('thumbnail:get', projectId, filename),
    generate: (projectId: string, sourceDir: string, filename: string) => ipcRenderer.invoke('thumbnail:generate', projectId, sourceDir, filename),
    generateAll: (projectId: string, sourceDir: string, filenames: string[]) => ipcRenderer.invoke('thumbnail:generate-all', projectId, sourceDir, filenames),
    onProgress: (cb: (data: unknown) => void) => {
      ipcRenderer.on('thumbnail:progress', (_, data) => cb(data))
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('thumbnail:progress')
    }
  },
  translate: {
    start: (projectId: string) => ipcRenderer.invoke('translate:start', projectId),
    stop: (projectId: string) => ipcRenderer.invoke('translate:stop', projectId),
    confirmPhase: (projectId: string) => ipcRenderer.invoke('translate:confirm-phase', projectId),
    retryFailed: (projectId: string) => ipcRenderer.invoke('translate:retry-failed', projectId),
    regeneratePage: (projectId: string, pageId: string) => ipcRenderer.invoke('translate:regenerate-page', projectId, pageId),
    onPageProgress: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-progress', (_, data) => cb(data))
    },
    onPageFinished: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-finished', (_, data) => cb(data))
    },
    onPageError: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-error', (_, data) => cb(data))
    },
    onPhaseStarted: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:phase-started', (_, data) => cb(data))
    },
    onPhaseCompleted: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:phase-completed', (_, data) => cb(data))
    },
    onAllFinished: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:all-finished', (_, data) => cb(data))
    },
    onPipelineError: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:pipeline-error', (_, data) => cb(data))
    },
    onPhaseProgress: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:phase-progress', (_, data) => cb(data))
    },
    onLog: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:log', (_, data) => cb(data))
    },
    removeAllListeners: () => {
      const channels = [
        'translate:page-progress', 'translate:page-finished', 'translate:page-error',
        'translate:phase-started', 'translate:phase-completed',
        'translate:all-finished', 'translate:pipeline-error', 'translate:phase-progress',
        'translate:log'
      ]
      channels.forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
