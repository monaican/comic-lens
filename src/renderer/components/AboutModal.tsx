import { useState, useEffect } from 'react'
import { Info, Github, RefreshCw } from 'lucide-react'

const REPO_URL = 'https://github.com/monaican/comic-lens'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AboutModal({ open, onClose }: Props) {
  const [version, setVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle')
  const [latestRelease, setLatestRelease] = useState<{ tag: string; url: string } | null>(null)

  useEffect(() => {
    if (open) {
      window.api.app.getVersion().then(setVersion)
      setUpdateStatus('idle')
      setLatestRelease(null)
    }
  }, [open])

  const checkUpdate = async () => {
    setUpdateStatus('checking')
    try {
      const release = await window.api.app.checkUpdate()
      setLatestRelease(release)
      const latest = release.tag.replace(/^v/, '')
      setUpdateStatus(latest === version ? 'latest' : 'available')
    } catch {
      setUpdateStatus('error')
    }
  }

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Info className="w-7 h-7 text-primary-content" />
          </div>
          <h2 className="text-xl font-bold">ComicLens</h2>
          <span className="badge badge-outline text-xs">v{version}</span>
          <p className="text-sm text-base-content/60 max-w-xs">
            AI 驱动的漫画翻译工具。通过视觉识别、智能翻译和图片生成，一键完成漫画本地化。
          </p>
        </div>

        <div className="flex justify-center gap-2 pb-3">
          <button className="btn btn-sm btn-outline gap-1" onClick={() => window.api.app.openExternal(REPO_URL)}>
            <Github className="w-3.5 h-3.5" /> GitHub
          </button>
          <button
            className="btn btn-sm btn-outline gap-1"
            onClick={checkUpdate}
            disabled={updateStatus === 'checking'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
            检查更新
          </button>
        </div>

        {updateStatus === 'latest' && (
          <p className="text-xs text-success pb-2">已是最新版本</p>
        )}
        {updateStatus === 'available' && latestRelease && (
          <div className="pb-2">
            <p className="text-xs text-warning">发现新版本: {latestRelease.tag}</p>
            <button className="btn btn-xs btn-link" onClick={() => window.api.app.openExternal(latestRelease.url)}>
              前往下载
            </button>
          </div>
        )}
        {updateStatus === 'error' && (
          <p className="text-xs text-error pb-2">检查更新失败，请稍后重试</p>
        )}

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
