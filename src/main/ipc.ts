import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  createProject, getProject, listProjects, updateProject, deleteProject,
  createPage, getPage, listPages, updatePage
} from './database'
import { loadConfig, saveConfig, type AppConfig } from './config'
import { scanImages, getCoverPath, readImageAsBase64 } from './file-service'
import { startTranslation, stopTranslation, confirmPhase, retryFailed } from './translate-pipeline'
import { generateThumbnail, getThumbnail, generateAllThumbnails } from './thumbnail-service'
import { basename } from 'path'

export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('db:projects:list', () => listProjects())
  ipcMain.handle('db:projects:get', (_, id: string) => getProject(id))
  ipcMain.handle('db:projects:create', (event, data: {
    name: string; sourceDir: string; outputDir: string;
    sourceLang: string; targetLang: string; translateMode: string
  }) => {
    const pid = createProject(
      data.name, data.sourceDir, data.outputDir,
      data.sourceLang, data.targetLang, data.translateMode
    )
    const images = scanImages(data.sourceDir)
    const filenames: string[] = []
    images.forEach((imgPath, i) => {
      const fn = basename(imgPath)
      createPage(pid, fn, i)
      filenames.push(fn)
    })
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && filenames.length > 0) {
      generateAllThumbnails(pid, data.sourceDir, filenames, win)
    }
    return pid
  })
  ipcMain.handle('db:projects:update', (_, id: string, fields: Record<string, unknown>) => {
    updateProject(id, fields)
  })
  ipcMain.handle('db:projects:delete', (_, id: string) => deleteProject(id))

  // Pages
  ipcMain.handle('db:pages:list', (_, projectId: string) => listPages(projectId))
  ipcMain.handle('db:pages:get', (_, id: string) => getPage(id))
  ipcMain.handle('db:pages:update', (_, id: string, fields: Record<string, unknown>) => {
    updatePage(id, fields)
  })

  // Config
  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:save', (_, config: AppConfig) => saveConfig(config))

  // File operations
  ipcMain.handle('file:select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('file:scan-images', (_, dir: string) => scanImages(dir))
  ipcMain.handle('file:get-cover', (_, dir: string) => getCoverPath(dir))
  ipcMain.handle('file:read-image', (_, path: string) => readImageAsBase64(path))

  // Thumbnails
  ipcMain.handle('thumbnail:get', (_, projectId: string, filename: string) =>
    getThumbnail(projectId, filename)
  )
  ipcMain.handle('thumbnail:generate', (_, projectId: string, sourceDir: string, filename: string) =>
    generateThumbnail(projectId, sourceDir, filename)
  )
  ipcMain.handle('thumbnail:generate-all', (event, projectId: string, sourceDir: string, filenames: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return generateAllThumbnails(projectId, sourceDir, filenames, win)
  })

  // Translation control
  ipcMain.handle('translate:start', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    startTranslation(projectId, win)
  })
  ipcMain.handle('translate:stop', (_, projectId: string) => stopTranslation(projectId))
  ipcMain.handle('translate:confirm-phase', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    confirmPhase(projectId, win)
  })
  ipcMain.handle('translate:retry-failed', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    retryFailed(projectId, win)
  })

  // Window controls
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
