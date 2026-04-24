import { useEffect, useRef } from 'react'
import type { LogEntry } from '../types'

const levelStyles: Record<string, string> = {
  info: 'text-base-content',
  warn: 'text-warning',
  error: 'text-error'
}

const levelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
}

interface Props {
  open: boolean
  onClose: () => void
  logs: LogEntry[]
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function LogModal({ open, onClose, logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [open, logs.length])

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-2xl h-[70vh] flex flex-col p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <span className="font-medium text-sm">翻译日志</span>
          <span className="text-xs text-base-content/40">{logs.length} 条</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 bg-base-200 font-mono text-xs leading-5">
          {logs.length === 0 ? (
            <div className="text-center text-base-content/30 py-8">暂无日志</div>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className={`flex gap-2 ${levelStyles[entry.level]}`}>
                <span className="text-base-content/40 flex-shrink-0">{formatTime(entry.time)}</span>
                <span className={`flex-shrink-0 w-12 ${levelStyles[entry.level]}`}>[{levelLabels[entry.level]}]</span>
                <span className="break-all min-w-0">{entry.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex justify-end px-4 py-3 border-t border-base-300">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>关闭</button>
      </form>
    </dialog>
  )
}
