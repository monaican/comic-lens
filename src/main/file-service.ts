import { readdirSync, readFileSync, mkdirSync, statSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { naturalSortFilenames, validateImagePath } from './safety-utils'

export function scanImages(directory: string): string[] {
  try {
    const stat = statSync(directory)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }
  const files = naturalSortFilenames(readdirSync(directory)
    .filter(f => {
      try {
        validateImagePath(f)
        return true
      } catch {
        return false
      }
    }))
  return files.map(f => join(directory, f))
}

export function readImageAsBase64(imagePath: string): { base64: string; mimeType: string } {
  const validatedPath = validateImagePath(imagePath)
  const ext = validatedPath.slice(validatedPath.lastIndexOf('.')).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  }
  const mimeType = mimeMap[ext] || 'image/png'
  const buffer = readFileSync(validatedPath)
  const base64 = buffer.toString('base64')
  return { base64, mimeType }
}

export function ensureOutputDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

export function getCoverPath(directory: string): string | null {
  const images = scanImages(directory)
  return images.length > 0 ? images[0] : null
}

export function readImageBuffer(imagePath: string): Buffer {
  return readFileSync(validateImagePath(imagePath))
}

export function removeDirectoryIfExists(directory: string): void {
  if (!existsSync(directory)) return
  rmSync(directory, { recursive: true, force: true })
}
