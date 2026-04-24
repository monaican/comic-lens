import { useState, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useConfig } from '../hooks/useConfig'
import { Library } from 'lucide-react'
import ComicCard from './ComicCard'
import ImportModal from './ImportModal'
import type { Project } from '../types'

interface Props {
  onOpenProject: (project: Project) => void
  onProjectDeleted?: (projectId: string) => void
}

export default function Bookshelf({ onOpenProject, onProjectDeleted }: Props) {
  const { projects, createProject, deleteProject } = useProjects()
  const { config } = useConfig()
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const filtered = useMemo(() => {
    if (!search) return projects
    return projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [projects, search])

  const handleImport = async (data: Record<string, string>) => {
    await createProject(data)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const projectId = deleteTarget.id
    await deleteProject(projectId)
    onProjectDeleted?.(projectId)
    setDeleteTarget(null)
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          className="input input-bordered input-sm flex-1 max-w-xs"
          placeholder="搜索漫画..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={() => setShowImport(true)}>导入漫画</button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-base-content/40">
          <div className="mb-4"><Library className="w-16 h-16 text-base-content/20" /></div>
          <p>导入你的第一部漫画</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-4">
            {filtered.map(project => (
              <ComicCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        </div>
      )}

      <ImportModal
        open={showImport}
        defaultSourceLang={config?.default_source_lang || '日本語'}
        defaultTargetLang={config?.default_target_lang || '简体中文'}
        defaultOutputBaseDir={config?.output_base_dir || 'output'}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />

      <dialog className={`modal ${deleteTarget ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">确认删除</h3>
          <p className="py-4">确定要删除「{deleteTarget?.name}」吗？此操作不可恢复。</p>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>取消</button>
            <button className="btn btn-error" onClick={handleDelete}>删除</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button onClick={() => setDeleteTarget(null)}>关闭</button></form>
      </dialog>
    </div>
  )
}
