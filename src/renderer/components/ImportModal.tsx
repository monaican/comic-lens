import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  defaultSourceLang: string
  defaultTargetLang: string
  defaultOutputBaseDir: string
  onClose: () => void
  onImport: (data: {
    name: string
    sourceDir: string
    outputDir: string
    sourceLang: string
    targetLang: string
    translateMode: string
  }) => Promise<void>
}

export default function ImportModal({
  open,
  defaultSourceLang,
  defaultTargetLang,
  defaultOutputBaseDir,
  onClose,
  onImport
}: Props) {
  const [sourceDir, setSourceDir] = useState('')
  const [sourceLang, setSourceLang] = useState(defaultSourceLang)
  const [targetLang, setTargetLang] = useState(defaultTargetLang)
  const [translateMode, setTranslateMode] = useState('auto')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSourceDir('')
    setSourceLang(defaultSourceLang)
    setTargetLang(defaultTargetLang)
    setTranslateMode('auto')
    setError('')
  }, [defaultSourceLang, defaultTargetLang, open])

  const handleSelectFolder = async () => {
    const path = await window.api.file.selectFolder()
    if (path) {
      setSourceDir(path)
      setError('')
    }
  }

  const handleSubmit = async () => {
    if (!sourceDir) return
    const name = sourceDir.split(/[/\\]/).pop() || 'untitled'
    setSubmitting(true)
    setError('')
    try {
      await onImport({
        name,
        sourceDir,
        outputDir: `${defaultOutputBaseDir}/${name}`,
        sourceLang,
        targetLang,
        translateMode
      })
      setSourceDir('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">导入漫画</h3>

        {error && (
          <div className="alert alert-error mb-3 text-sm py-2">
            <span>{error}</span>
          </div>
        )}

        <div className="form-control mb-3">
          <label className="label"><span className="label-text">漫画文件夹</span></label>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered flex-1" value={sourceDir} readOnly placeholder="选择文件夹..." />
            <button className="btn btn-outline" onClick={handleSelectFolder}>浏览</button>
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="form-control flex-1">
            <label className="label"><span className="label-text">源语言</span></label>
            <input type="text" className="input input-bordered" value={sourceLang} onChange={e => setSourceLang(e.target.value)} />
          </div>
          <div className="form-control flex-1">
            <label className="label"><span className="label-text">目标语言</span></label>
            <input type="text" className="input input-bordered" value={targetLang} onChange={e => setTargetLang(e.target.value)} />
          </div>
        </div>

        <div className="form-control mb-4">
          <label className="label"><span className="label-text">翻译模式</span></label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input type="radio" name="mode" className="radio radio-sm" checked={translateMode === 'auto'} onChange={() => setTranslateMode('auto')} />
              <span className="label-text">全自动</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input type="radio" name="mode" className="radio radio-sm" checked={translateMode === 'manual'} onChange={() => setTranslateMode('manual')} />
              <span className="label-text">手动</span>
            </label>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn btn-primary" disabled={!sourceDir || submitting} onClick={handleSubmit}>
            {submitting ? <span className="loading loading-spinner loading-sm" /> : '导入'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>关闭</button></form>
    </dialog>
  )
}
