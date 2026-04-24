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

const statusLabels: Record<string, string> = {
  pending: '待处理',
  analyzing: '处理中',
  analyzed: '已分析',
  translating: '翻译中',
  completed: '已完成',
  failed: '失败'
}

interface Props {
  pages: Page[]
  sourceDir: string
  projectId: string
  selectedId: string | null
  onSelect: (id: string) => void
  pageStatuses: Map<string, { phase: Phase; status: string }>
}

export default function ThumbnailList({ pages, sourceDir, projectId, selectedId, onSelect, pageStatuses }: Props) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef<Set<string>>(new Set())

  const loadThumb = useCallback(async (filename: string) => {
    if (thumbs[filename] || loadingRef.current.has(filename)) return
    loadingRef.current.add(filename)
    try {
      let src = await window.api.thumbnail.get(projectId, filename)
      if (!src) {
        src = await window.api.thumbnail.generate(projectId, sourceDir, filename)
      }
      if (src) {
        setThumbs(prev => ({ ...prev, [filename]: src! }))
      }
    } catch { /* ignore */ }
    loadingRef.current.delete(filename)
  }, [projectId, sourceDir, thumbs])

  useEffect(() => {
    const onProgress = (data: { projectId: string; filename: string }) => {
      if (data.projectId === projectId) {
        loadThumb(data.filename)
      }
    }
    window.api.thumbnail.onProgress(onProgress)
    return () => { window.api.thumbnail.removeProgressListener() }
  }, [projectId, loadThumb])

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
      { root: containerRef.current, rootMargin: '200px' }
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
        const src = thumbs[page.filename]
        const liveStatus = pageStatuses.get(page.id)
        const displayStatus = liveStatus ? liveStatus.status : statusLabels[page.status] || page.status
        const colorKey = liveStatus
          ? (liveStatus.phase === 'vision' || liveStatus.phase === 'analysis' ? 'analyzing' : 'translating')
          : page.status
        const colorClass = statusColors[colorKey] || statusColors.pending
        const isActive = colorKey === 'analyzing' || colorKey === 'translating'

        return (
          <div
            key={page.id}
            data-filename={page.filename}
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-base-200 transition-colors ${
              selectedId === page.id ? 'bg-primary/10 border-l-2 border-primary' : ''
            }`}
            onClick={() => onSelect(page.id)}
          >
            <div className={`w-1 h-10 rounded-full ${colorClass} ${isActive ? 'animate-pulse' : ''}`} />
            <div className="w-10 h-14 bg-base-200 rounded overflow-hidden flex-shrink-0">
              {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="loading loading-spinner loading-xs text-base-content/30" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs truncate">{page.filename}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-base-content/40">#{i + 1}</span>
                {liveStatus && (
                  <span className="text-xs text-primary truncate">{displayStatus}</span>
                )}
                {!liveStatus && page.status !== 'pending' && (
                  <span className={`text-xs ${page.status === 'failed' ? 'text-error' : 'text-base-content/50'}`}>
                    {statusLabels[page.status] || page.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}