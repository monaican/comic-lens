import { readdirSync, readFileSync, mkdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])

export function scanImages(directory: string): string[] {
  try {
    const stat = statSync(directory)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }
  const files = readdirSync(directory)
    .filter(f => {
      const ext = extname(f).toLowerCase()
      return IMAGE_EXTENSIONS.has(ext)
    })
    .sort()
  return files.map(f => join(directory, f))
}

export function readImageAsBase64(imagePath: string): { base64: string; mimeType: string } {
  const ext = extname(imagePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  }
  const mimeType = mimeMap[ext] || 'image/png'
  const buffer = readFileSync(imagePath)
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
  return readFileSync(imagePath)
}
