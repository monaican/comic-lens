import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page } from '../types'

interface Props {
  page: Page | null
  sourceDir: string
  outputDir: string
}

type ViewMode = 'original' | 'translated' | 'split'

export default function ImageViewer({ page, sourceDir, outputDir }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('original')
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [translatedSrc, setTranslatedSrc] = useState<string | null>(null)
  const [originalLoaded, setOriginalLoaded] = useState(false)
  const [translatedLoaded, setTranslatedLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOriginalSrc(null)
    setTranslatedSrc(null)
    setOriginalLoaded(false)
    setTranslatedLoaded(false)
    setScale(1)
    setPosition({ x: 0, y: 0 })
    if (!page) return

    const origPath = `${sourceDir}/${page.filename}`.replace(/\\/g, '/')
    window.api.file.readImage(origPath).then(({ base64, mimeType }) => {
      setOriginalSrc(`data:${mimeType};base64,${base64}`)
    }).catch(() => {})

    if (page.status === 'completed') {
      const transPath = `${outputDir}/${page.filename}`.replace(/\\/g, '/')
      window.api.file.readImage(transPath).then(({ base64, mimeType }) => {
        setTranslatedSrc(`data:${mimeType};base64,${base64}`)
      }).catch(() => {})
    }
  }, [page, sourceDir, outputDir])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => Math.max(0.1, Math.min(5, prev * delta)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  if (!page) {
    return <div className="h-full flex items-center justify-center text-base-content/30">选择一个页面查看</div>
  }

  const imgStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
    transformOrigin: 'center center',
    transition: dragging ? 'none' : 'transform 0.1s'
  }

  const renderImage = (src: string | null, alt: string, loaded: boolean, onLoad: () => void) => (
    <div className="flex-1 flex items-center justify-center overflow-hidden relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          <div className="flex flex-col items-center gap-2">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-xs text-base-content/40">加载中...</span>
          </div>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={imgStyle}
          draggable={false}
          onLoad={onLoad}
        />
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-base-300">
        <div className="join">
          <button className={`join-item btn btn-xs ${viewMode === 'original' ? 'btn-active' : ''}`} onClick={() => setViewMode('original')}>原图</button>
          <button className={`join-item btn btn-xs ${viewMode === 'translated' ? 'btn-active' : ''}`} onClick={() => setViewMode('translated')} disabled={!translatedSrc}>译图</button>
          <button className={`join-item btn btn-xs ${viewMode === 'split' ? 'btn-active' : ''}`} onClick={() => setViewMode('split')} disabled={!translatedSrc}>对比</button>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-xs" onClick={() => setScale(s => Math.max(0.1, s * 0.8))}>-</button>
          <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setScale(s => Math.min(5, s * 1.2))}>+</button>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={resetView}>适应</button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-base-200"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {viewMode === 'split' ? (
          <div className="flex h-full">
            {renderImage(originalSrc, '原图', originalLoaded, () => setOriginalLoaded(true))}
            <div className="w-px bg-base-300" />
            {renderImage(translatedSrc, '译图', translatedLoaded, () => setTranslatedLoaded(true))}
          </div>
        ) : viewMode === 'translated' ? (
          renderImage(translatedSrc, '译图', translatedLoaded, () => setTranslatedLoaded(true))
        ) : (
          renderImage(originalSrc, '原图', originalLoaded, () => setOriginalLoaded(true))
        )}
      </div>
    </div>
  )
}