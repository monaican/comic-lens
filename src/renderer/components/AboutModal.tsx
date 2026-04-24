import { useState, useEffect } from 'react'
import { Info, RefreshCw } from 'lucide-react'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 98 96" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M41.44 69.38C28.81 67.85 19.91 58.76 19.91 46.99c0-4.79 1.72-9.95 4.59-13.4-1.24-3.16-1.05-9.86.39-12.63 3.83-.48 9 1.53 12.06 4.3 3.64-1.14 7.47-1.72 12.16-1.72s7.61.58 11.06 1.63c2.97-2.68 8.23-4.69 12.06-4.21 1.34 2.58 1.53 9.28.29 12.54 3.06 3.64 4.69 8.52 4.69 13.5 0 11.77-8.9 20.67-21.72 22.3 3.25 2.1 5.46 6.7 5.46 11.96v9.95c0 2.87 2.39 4.5 5.26 3.35C84.41 87.95 98 70.63 98 49.19 98 22.11 75.99 0 48.9 0 21.82 0 0 22.11 0 49.19c0 21.25 13.49 38.86 31.68 45.46 2.58.96 5.07-.76 5.07-3.35v-7.66a18 18 0 01-4.59.96c-6.32 0-10.05-3.45-12.73-9.86-1.05-2.58-2.2-4.11-4.4-4.4-1.15-.1-1.53-.57-1.53-1.15 0-1.15 1.91-2.01 3.83-2.01 2.77 0 5.17 1.72 7.65 5.26 1.92 2.78 3.93 4.02 6.32 4.02s3.92-.86 6.12-3.06c1.63-1.63 2.87-3.06 4.02-4.02z"/>
    </svg>
  )
}

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
            <GithubIcon className="w-3.5 h-3.5" /> GitHub
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
