import { useState, useEffect } from 'react'
import type { Page } from '../types'

interface Props {
  page: Page | null
  masterPrompt: string
  onSave: (pageId: string, fields: Record<string, unknown>) => Promise<void>
  onRegenerate: (pageId: string) => Promise<void>
  onMasterPromptSave: (prompt: string) => Promise<void>
}

export default function DetailPanel({ page, masterPrompt, onSave, onRegenerate, onMasterPromptSave }: Props) {
  const [editMaster, setEditMaster] = useState(masterPrompt)
  const [visionResult, setVisionResult] = useState('')
  const [refinedTranslation, setRefinedTranslation] = useState('')
  const [finalPrompt, setFinalPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEditMaster(masterPrompt) }, [masterPrompt])

  useEffect(() => {
    if (!page) return
    setVisionResult(page.vision_result)
    setRefinedTranslation(page.refined_translation)
    setFinalPrompt(page.final_prompt)
  }, [page])

  const handleSavePage = async () => {
    if (!page) return
    setSaving(true)
    await onSave(page.id, {
      vision_result: visionResult,
      refined_translation: refinedTranslation,
      final_prompt: finalPrompt,
      edited: 1
    })
    setSaving(false)
  }

  const statusBadge: Record<string, { class: string; label: string }> = {
    pending: { class: 'badge-ghost', label: '待处理' },
    analyzing: { class: 'badge-info', label: '分析中' },
    analyzed: { class: 'badge-info badge-outline', label: '已分析' },
    translating: { class: 'badge-warning', label: '翻译中' },
    completed: { class: 'badge-success', label: '已完成' },
    failed: { class: 'badge-error', label: '失败' }
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 min-w-0">
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium">总控提示词</div>
        <div className="collapse-content">
          <textarea
            className="textarea textarea-bordered w-full text-xs font-mono h-32 resize-y"
            value={editMaster}
            onChange={e => setEditMaster(e.target.value)}
          />
          <button
            className="btn btn-xs btn-primary mt-2"
            onClick={() => onMasterPromptSave(editMaster)}
          >保存总控提示词</button>
        </div>
      </div>

      {!page ? (
        <div className="text-center text-base-content/40 py-8">
          <p className="text-sm">选择页面查看详情</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate flex-1 min-w-0">{page.filename}</span>
            <span className={`badge badge-sm flex-shrink-0 ${statusBadge[page.status]?.class || ''}`}>
              {statusBadge[page.status]?.label || page.status}
            </span>
          </div>

          {page.error_message && (
            <div className="alert alert-error text-xs py-2">
              <span className="break-all">{page.error_message}</span>
            </div>
          )}

          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">视觉结果</div>
            <div className="collapse-content overflow-hidden">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28 resize-y"
                value={visionResult}
                onChange={e => setVisionResult(e.target.value)}
              />
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">精炼翻译</div>
            <div className="collapse-content overflow-hidden">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28 resize-y"
                value={refinedTranslation}
                onChange={e => setRefinedTranslation(e.target.value)}
              />
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">最终 Prompt</div>
            <div className="collapse-content overflow-hidden">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28 resize-y"
                value={finalPrompt}
                onChange={e => setFinalPrompt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary flex-1" onClick={handleSavePage} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : '保存修改'}
            </button>
            <button
              className="btn btn-sm btn-secondary flex-1"
              onClick={() => onRegenerate(page.id)}
              disabled={!page.refined_translation}
            >重新生图</button>
          </div>
        </>
      )}
    </div>
  )
}
