import sharp from 'sharp'
import { join, extname } from 'path'
import { mkdirSync, existsSync, readFileSync } from 'fs'
import { app, BrowserWindow } from 'electron'
import { removeDirectoryIfExists } from './file-service'
import { validateImageFilename } from './safety-utils'

const THUMB_WIDTH = 160
const THUMB_HEIGHT = 224

function thumbDir(projectId: string): string {
  const dir = join(app.getPath('userData'), 'thumbnails', projectId)
  mkdirSync(dir, { recursive: true })
  return dir
}

function thumbPath(projectId: string, filename: string): string {
  const safeFilename = validateImageFilename(filename)
  const base = safeFilename.replace(extname(safeFilename), '.webp')
  return join(thumbDir(projectId), base)
}

export async function generateThumbnail(
  projectId: string, sourceDir: string, filename: string
): Promise<string> {
  const safeFilename = validateImageFilename(filename)
  const out = thumbPath(projectId, filename)
  if (existsSync(out)) {
    const buf = readFileSync(out)
    return `data:image/webp;base64,${buf.toString('base64')}`
  }
  const src = join(sourceDir, safeFilename)
  const buf = await sharp(src)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'top' })
    .webp({ quality: 70 })
    .toBuffer()
  await sharp(buf).toFile(out)
  return `data:image/webp;base64,${buf.toString('base64')}`
}

export async function getThumbnail(
  projectId: string, filename: string
): Promise<string | null> {
  const p = thumbPath(projectId, filename)
  if (!existsSync(p)) return null
  const buf = readFileSync(p)
  return `data:image/webp;base64,${buf.toString('base64')}`
}

export async function generateAllThumbnails(
  projectId: string,
  sourceDir: string,
  filenames: string[],
  win: BrowserWindow | null
): Promise<void> {
  const total = filenames.length
  for (let i = 0; i < total; i++) {
    try {
      await generateThumbnail(projectId, sourceDir, filenames[i])
    } catch { /* skip failed thumbnails */ }
    if (win && !win.isDestroyed()) {
      win.webContents.send('thumbnail:progress', {
        projectId, completed: i + 1, total, filename: filenames[i]
      })
    }
  }
}

export function deleteProjectThumbnails(projectId: string): void {
  removeDirectoryIfExists(join(app.getPath('userData'), 'thumbnails', projectId))
}
