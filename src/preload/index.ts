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
    scanImages: (dir: string) => ipcRenderer.invoke('file:scan-images', dir),
    getCover: (dir: string) => ipcRenderer.invoke('file:get-cover', dir),
    readImage: (path: string) => ipcRenderer.invoke('file:read-image', path)
  },
  translate: {
    start: (projectId: string) => ipcRenderer.invoke('translate:start', projectId),
    stop: (projectId: string) => ipcRenderer.invoke('translate:stop', projectId),
    confirmPhase: (projectId: string) => ipcRenderer.invoke('translate:confirm-phase', projectId),
    retryFailed: (projectId: string) => ipcRenderer.invoke('translate:retry-failed', projectId),
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
    removeAllListeners: () => {
      const channels = [
        'translate:page-progress', 'translate:page-finished', 'translate:page-error',
        'translate:phase-started', 'translate:phase-completed',
        'translate:all-finished', 'translate:pipeline-error'
      ]
      channels.forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
