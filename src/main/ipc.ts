import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  createProject, getProject, listProjects, updateProject, deleteProject,
  createPage, getPage, listPages, updatePage
} from './database'
import { loadConfig, saveConfig, type AppConfig } from './config'
import { scanImages, getCoverPath, readImageAsBase64, removeDirectoryIfExists } from './file-service'
import { startTranslation, stopTranslation, confirmPhase, retryFailed, regeneratePageImage } from './translate-pipeline'
import { generateThumbnail, getThumbnail, generateAllThumbnails, deleteProjectThumbnails } from './thumbnail-service'
import { basename, join } from 'path'
import { buildProjectOutputDir, validateImageFilename } from './safety-utils'
import { assertImportableImages } from './import-utils'

export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('db:projects:list', () => listProjects())
  ipcMain.handle('db:projects:get', (_, id: string) => getProject(id))
  ipcMain.handle('db:projects:create', (event, data: {
    name: string; sourceDir: string; outputDir: string;
    sourceLang: string; targetLang: string; translateMode: string
  }) => {
    const config = loadConfig()
    const outputDir = buildProjectOutputDir(config.output_base_dir, data.name)
    const images = assertImportableImages(scanImages(data.sourceDir))
    const pid = createProject(
      data.name, data.sourceDir, outputDir,
      data.sourceLang, data.targetLang, data.translateMode
    )
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
  ipcMain.handle('db:projects:delete', (_, id: string) => {
    const project = getProject(id)
    deleteProject(id)
    deleteProjectThumbnails(id)
    if (project?.output_dir && typeof project.output_dir === 'string') {
      removeDirectoryIfExists(project.output_dir)
    }
  })

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
  ipcMain.handle('file:get-project-cover', (_, projectId: string) => {
    const project = getProject(projectId)
    if (!project || typeof project.source_dir !== 'string') return null
    const coverPath = getCoverPath(project.source_dir)
    return coverPath ? readImageAsBase64(coverPath) : null
  })
  ipcMain.handle('file:read-project-image', (_, projectId: string, filename: string, kind: 'source' | 'output') => {
    const project = getProject(projectId)
    if (!project) throw new Error('项目不存在')
    const safeFilename = validateImageFilename(filename)
    const baseDir = kind === 'output'
      ? project.output_dir as string
      : project.source_dir as string
    return readImageAsBase64(join(baseDir, safeFilename))
  })

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
    return startTranslation(projectId, win)
  })
  ipcMain.handle('translate:stop', (_, projectId: string) => stopTranslation(projectId))
  ipcMain.handle('translate:confirm-phase', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    return confirmPhase(projectId, win)
  })
  ipcMain.handle('translate:retry-failed', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    return retryFailed(projectId, win)
  })
  ipcMain.handle('translate:regenerate-page', (event, projectId: string, pageId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    return regeneratePageImage(projectId, pageId, win)
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
