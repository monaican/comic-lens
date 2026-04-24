import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import type { Project } from '../types'

const statusBadge: Record<string, { class: string; label: string }> = {
  idle: { class: 'badge-ghost', label: '未开始' },
  analyzing: { class: 'badge-info', label: '分析中' },
  translating: { class: 'badge-warning', label: '翻译中' },
  completed: { class: 'badge-success', label: '已完成' },
  failed: { class: 'badge-error', label: '失败' }
}

interface Props {
  project: Project
  onOpen: () => void
  onDelete: () => void
}

export default function ComicCard({ project, onOpen, onDelete }: Props) {
  const [coverSrc, setCoverSrc] = useState<string | null>(null)
  const badge = statusBadge[project.status] || statusBadge.idle

  useEffect(() => {
    window.api.file.getCover(project.source_dir).then(async (path) => {
      if (!path) return
      const { base64, mimeType } = await window.api.file.readImage(path)
      setCoverSrc(`data:${mimeType};base64,${base64}`)
    })
  }, [project.source_dir])

  return (
    <div
      className="card card-compact bg-base-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer w-40"
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        const menu = document.getElementById(`menu-${project.id}`) as HTMLDialogElement
        menu?.showModal()
      }}
    >
      <figure className="h-48 bg-base-200 overflow-hidden">
        {coverSrc ? (
          <img src={coverSrc} alt={project.name} className="object-cover w-full h-full" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-base-content/30"><BookOpen className="w-10 h-10" /></div>
        )}
      </figure>
      <div className="card-body gap-1">
        <h3 className="card-title text-sm truncate">{project.name}</h3>
        <div className={`badge badge-sm ${badge.class}`}>{badge.label}</div>
      </div>

      <dialog id={`menu-${project.id}`} className="modal">
        <div className="modal-box w-52">
          <ul className="menu">
            <li><button onClick={() => { onOpen(); (document.getElementById(`menu-${project.id}`) as HTMLDialogElement)?.close() }}>打开</button></li>
            <li><button className="text-error" onClick={() => {
              (document.getElementById(`menu-${project.id}`) as HTMLDialogElement)?.close()
              onDelete()
            }}>删除</button></li>
          </ul>
        </div>
        <form method="dialog" className="modal-backdrop"><button>关闭</button></form>
      </dialog>
    </div>
  )
}
