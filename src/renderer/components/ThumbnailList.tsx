import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page, Phase } from '../types'

const statusColors: Record<string, string> = {
  pending: 'bg-base-300',
  analyzing: 'bg-info',
  analyzed: 'bg-info/50',
  translating: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-error'
}

interface Props {
  pages: Page[]
  sourceDir: string
  selectedId: string | null
  onSelect: (id: string) => void
  pageStatuses: Map<string, { phase: Phase; status: string }>
}

interface ThumbCache {
  [path: string]: string
}

export default function ThumbnailList({ pages, sourceDir, selectedId, onSelect, pageStatuses }: Props) {
  const [thumbs, setThumbs] = useState<ThumbCache>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const loadThumb = useCallback(async (filename: string) => {
    const path = `${sourceDir}/${filename}`.replace(/\\/g, '/')
    if (thumbs[path]) return
    try {
      const { base64, mimeType } = await window.api.file.readImage(path)
      setThumbs(prev => ({ ...prev, [path]: `data:${mimeType};base64,${base64}` }))
    } catch { /* ignore */ }
  }, [sourceDir, thumbs])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const filename = entry.target.getAttribute('data-filename')
            if (filename) loadThumb(filename)
          }
        })
      },
      { root: containerRef.current, rootMargin: '100px' }
    )
    return () => observerRef.current?.disconnect()
  }, [loadThumb])

  useEffect(() => {
    const observer = observerRef.current
    if (!observer) return
    const container = containerRef.current
    if (!container) return
    const items = container.querySelectorAll('[data-filename]')
    items.forEach(el => observer.observe(el))
    return () => items.forEach(el => observer.unobserve(el))
  }, [pages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = pages.findIndex(p => p.id === selectedId)
    if (e.key === 'ArrowDown' && idx < pages.length - 1) {
      e.preventDefault()
      onSelect(pages[idx + 1].id)
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault()
      onSelect(pages[idx - 1].id)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {pages.map((page, i) => {
        const path = `${sourceDir}/${page.filename}`.replace(/\\/g, '/')
        const src = thumbs[path]
        const liveStatus = pageStatuses.get(page.id)
        const displayStatus = liveStatus ? 'analyzing' : page.status
        const colorClass = statusColors[displayStatus] || statusColors.pending

        return (
          <div
            key={page.id}
            data-filename={page.filename}
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-base-200 ${
              selectedId === page.id ? 'bg-primary/10 border-l-2 border-primary' : ''
            }`}
            onClick={() => onSelect(page.id)}
          >
            <div className={`w-1 h-10 rounded-full ${colorClass} ${
              displayStatus === 'analyzing' || displayStatus === 'translating' ? 'animate-pulse' : ''
            }`} />
            <div className="w-10 h-14 bg-base-200 rounded overflow-hidden flex-shrink-0">
              {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-base-content/30">{i + 1}</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs truncate">{page.filename}</div>
              <div className="text-xs text-base-content/40">#{i + 1}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
