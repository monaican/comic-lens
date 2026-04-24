import { useState, useEffect } from 'react'
import { Eye, Pencil } from 'lucide-react'
import type { Page } from '../types'

interface Props {
  page: Page | null
  masterPrompt: string
  onSave: (pageId: string, fields: Record<string, unknown>) => Promise<void>
  onRegenerate: (pageId: string) => Promise<void>
  onMasterPromptSave: (prompt: string) => Promise<void>
}

interface PromptModalProps {
  open: boolean
  title: string
  value: string
  readOnly?: boolean
  onClose: () => void
  onConfirm?: (value: string) => void
}

function PromptModal({ open, title, value, readOnly, onClose, onConfirm }: PromptModalProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value, open])

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-2xl h-[70vh] flex flex-col p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <textarea
            className="textarea textarea-bordered w-full h-full text-xs font-mono resize-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-base-300">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>取消</button>
          {!readOnly && onConfirm && (
            <button className="btn btn-sm btn-primary" onClick={() => onConfirm(draft)}>确认</button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>关闭</button>
      </form>
    </dialog>
  )
}
function PromptCard({ label, value, onView, onEdit }: {
  label: string
  value: string
  onView: () => void
  onEdit: () => void
}) {
  const preview = value ? value.slice(0, 80).replace(/\n/g, ' ') : ''
  return (
    <div className="bg-base-200 rounded-lg px-3 py-2 flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {preview ? (
          <div className="text-xs text-base-content/50 truncate">{preview}…</div>
        ) : (
          <div className="text-xs text-base-content/30">暂无内容</div>
        )}
      </div>
      <button className="btn btn-ghost btn-xs btn-square" onClick={onView} title="查看">
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button className="btn btn-ghost btn-xs btn-square" onClick={onEdit} title="编辑">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function DetailPanel({ page, masterPrompt, onSave, onRegenerate, onMasterPromptSave }: Props) {
  const [editMaster, setEditMaster] = useState(masterPrompt)
  const [visionResult, setVisionResult] = useState('')
  const [refinedTranslation, setRefinedTranslation] = useState('')
  const [finalPrompt, setFinalPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{ title: string; field: string; readOnly: boolean } | null>(null)

  useEffect(() => { setEditMaster(masterPrompt) }, [masterPrompt])

  useEffect(() => {
    if (!page) return
    setVisionResult(page.vision_result)
    setRefinedTranslation(page.refined_translation)
    setFinalPrompt(page.final_prompt)
  }, [page])

  const fieldMap: Record<string, { get: () => string; set: (v: string) => void }> = {
    master: { get: () => editMaster, set: setEditMaster },
    vision: { get: () => visionResult, set: setVisionResult },
    refined: { get: () => refinedTranslation, set: setRefinedTranslation },
    final: { get: () => finalPrompt, set: setFinalPrompt },
  }

  const openModal = (field: string, title: string, readOnly: boolean) => {
    setModal({ title, field, readOnly })
  }

  const handleModalConfirm = async (value: string) => {
    if (!modal) return
    const f = fieldMap[modal.field]
    if (f) f.set(value)
    if (modal.field === 'master') {
      await onMasterPromptSave(value)
    }
    setModal(null)
  }

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
      <PromptCard
        label="总控提示词"
        value={editMaster}
        onView={() => openModal('master', '总控提示词', true)}
        onEdit={() => openModal('master', '总控提示词', false)}
      />

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

          <PromptCard
            label="视觉结果"
            value={visionResult}
            onView={() => openModal('vision', '视觉结果', true)}
            onEdit={() => openModal('vision', '视觉结果', false)}
          />
          <PromptCard
            label="精炼翻译"
            value={refinedTranslation}
            onView={() => openModal('refined', '精炼翻译', true)}
            onEdit={() => openModal('refined', '精炼翻译', false)}
          />
          <PromptCard
            label="最终 Prompt"
            value={finalPrompt}
            onView={() => openModal('final', '最终 Prompt', true)}
            onEdit={() => openModal('final', '最终 Prompt', false)}
          />

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

      <PromptModal
        open={!!modal}
        title={modal?.title || ''}
        value={modal ? fieldMap[modal.field]?.get() || '' : ''}
        readOnly={modal?.readOnly}
        onClose={() => setModal(null)}
        onConfirm={handleModalConfirm}
      />
    </div>
  )
}
