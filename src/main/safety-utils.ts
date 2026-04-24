import { basename, extname, join } from 'path'

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])

export function isSupportedImagePath(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function validateImageFilename(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed) {
    throw new Error('文件名为空')
  }
  if (basename(trimmed) !== trimmed) {
    throw new Error('文件名非法')
  }
  if (!isSupportedImagePath(trimmed)) {
    throw new Error('仅支持图片文件')
  }
  return trimmed
}

export function validateImagePath(imagePath: string): string {
  const trimmed = imagePath.trim()
  if (!trimmed) {
    throw new Error('图片路径为空')
  }
  if (!isSupportedImagePath(trimmed)) {
    throw new Error('仅支持图片文件')
  }
  return trimmed
}

export function naturalSortFilenames(filenames: string[]): string[] {
  return [...filenames].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  }))
}

export function filterAllowedFields(
  fields: Record<string, unknown>,
  allowedKeys: readonly string[]
): Record<string, unknown> {
  const allowed = new Set(allowedKeys)
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => allowed.has(key))
  )
}

export function buildProjectOutputDir(outputBaseDir: string, projectName: string): string {
  const baseDir = outputBaseDir.trim()
  const name = projectName.trim()
  if (!baseDir) {
    throw new Error('输出目录为空')
  }
  if (!name) {
    throw new Error('项目名为空')
  }
  return join(baseDir, name)
}

export function hasFailedPages(pages: Array<{ status?: unknown }>): boolean {
  return pages.some(page => page.status === 'failed')
}

export function isSafeExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
