import { useState } from 'react'

interface Props {
  open: boolean
  defaultSourceLang: string
  defaultTargetLang: string
  onClose: () => void
  onImport: (data: { name: string; sourceDir: string; outputDir: string; sourceLang: string; targetLang: string; translateMode: string }) => void
}

export default function ImportModal({ open, defaultSourceLang, defaultTargetLang, onClose, onImport }: Props) {
  const [sourceDir, setSourceDir] = useState('')
  const [sourceLang, setSourceLang] = useState(defaultSourceLang)
  const [targetLang, setTargetLang] = useState(defaultTargetLang)
  const [translateMode, setTranslateMode] = useState('auto')

  const handleSelectFolder = async () => {
    const path = await window.api.file.selectFolder()
    if (path) setSourceDir(path)
  }

  const handleSubmit = () => {
    if (!sourceDir) return
    const name = sourceDir.split(/[/\\]/).pop() || 'untitled'
    onImport({
      name,
      sourceDir,
      outputDir: `output/${name}`,
      sourceLang,
      targetLang,
      translateMode
    })
    setSourceDir('')
    onClose()
  }

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">导入漫画</h3>

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
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={!sourceDir} onClick={handleSubmit}>导入</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>关闭</button></form>
    </dialog>
  )
}
