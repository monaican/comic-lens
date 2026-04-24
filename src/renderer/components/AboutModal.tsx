import { Info } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AboutModal({ open, onClose }: Props) {
  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Info className="w-7 h-7 text-primary-content" />
          </div>
          <h2 className="text-xl font-bold">ComicLens</h2>
          <span className="badge badge-outline text-xs">v1.0.0</span>
          <p className="text-sm text-base-content/60 max-w-xs">
            AI 驱动的漫画翻译工具。通过视觉识别、智能翻译和图片生成，一键完成漫画本地化。
          </p>
        </div>

        <div className="divider text-xs text-base-content/40 my-1">技术栈</div>
        <div className="flex flex-wrap justify-center gap-1.5 pb-4">
          {['Electron', 'React', 'TypeScript', 'TailwindCSS', 'DaisyUI', 'SQLite', 'Sharp'].map(t => (
            <span key={t} className="badge badge-sm badge-ghost">{t}</span>
          ))}
        </div>

        <div className="divider text-xs text-base-content/40 my-1">开源协议</div>
        <p className="text-xs text-base-content/50 pb-4">MIT License</p>

        <div className="modal-action justify-center">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>关闭</button>
      </form>
    </dialog>
  )
}
