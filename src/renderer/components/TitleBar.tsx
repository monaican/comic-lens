import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div className="flex items-center justify-between h-9 bg-base-200 select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="pl-3 text-sm font-medium">漫画翻译</div>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9"
                onClick={() => window.api.window.minimize()}><Minus className="w-4 h-4" /></button>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9"
                onClick={() => window.api.window.maximize()}><Square className="w-3.5 h-3.5" /></button>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9 hover:bg-error hover:text-error-content"
                onClick={() => window.api.window.close()}><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
