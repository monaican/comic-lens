import { useState, useEffect, useCallback } from 'react'
import { usePages } from '../hooks/usePages'
import { useTranslation } from '../hooks/useTranslation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import WorkspaceToolbar from './WorkspaceToolbar'
import PhaseConfirmBar from './PhaseConfirmBar'
import ThumbnailList from './ThumbnailList'
import ImageViewer from './ImageViewer'
import DetailPanel from './DetailPanel'
import LogModal from './LogModal'
import type { Project, TranslateMode } from '../types'

interface Props {
  projectId: string
  onProjectChange?: (project: Project) => void
}

export default function Workspace({ projectId, onProjectChange }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const { pages, updatePage, refresh: refreshPages } = usePages(projectId)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const refreshProject = useCallback(async () => {
    const updated = await window.api.projects.get(projectId)
    if (updated) {
      setProject(updated)
      onProjectChange?.(updated)
    }
  }, [onProjectChange, projectId])

  const refreshWorkspace = useCallback(() => {
    void refreshPages()
    void refreshProject()
  }, [refreshPages, refreshProject])

  const translation = useTranslation(projectId, refreshWorkspace)

  useEffect(() => {
    void refreshProject()
  }, [refreshProject])

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id)
    }
  }, [pages, selectedPageId])

  const handleModeChange = useCallback(async (mode: TranslateMode) => {
    await window.api.projects.update(projectId, { translate_mode: mode })
    await refreshProject()
  }, [projectId, refreshProject])

  const handleMasterPromptSave = useCallback(async (prompt: string) => {
    await window.api.projects.update(projectId, { master_prompt: prompt })
    await refreshProject()
  }, [projectId, refreshProject])

  const selectedPage = pages.find(p => p.id === selectedPageId) || null

  if (!project) return <div className="flex items-center justify-center h-full">加载中...</div>

  return (
    <div className="h-full flex flex-col">
      <WorkspaceToolbar
        projectName={project.name}
        sourceLang={project.source_lang}
        targetLang={project.target_lang}
        translateMode={project.translate_mode as TranslateMode}
        onModeChange={handleModeChange}
        currentPhase={translation.currentPhase}
        phaseProgress={translation.phaseProgress}
        isRunning={translation.isRunning}
        completedCount={pages.filter(p => p.status === 'completed').length}
        totalCount={pages.length}
        elapsedMs={translation.elapsedMs}
        onStart={translation.start}
        onStop={translation.stop}
        onRetryFailed={translation.retryFailed}
        logCount={translation.logs.length}
        onShowLog={() => setShowLog(true)}
      />
      <PhaseConfirmBar phaseCompleted={translation.phaseCompleted} onConfirm={translation.confirmPhase} />

      <div className="flex-1 flex overflow-hidden">
        {!leftCollapsed && (
          <div className="w-48 border-r border-base-300 flex flex-col">
            <ThumbnailList
              pages={pages}
              sourceDir={project.source_dir}
              projectId={projectId}
              selectedId={selectedPageId}
              onSelect={setSelectedPageId}
              pageStatuses={translation.pageStatuses}
            />
          </div>
        )}
        <button
          className="btn btn-ghost btn-xs rounded-none border-r border-base-300"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
        >{leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button>

        <div className="flex-1 overflow-hidden">
          <ImageViewer page={selectedPage} projectId={projectId} />
        </div>

        <button
          className="btn btn-ghost btn-xs rounded-none border-l border-base-300"
          onClick={() => setRightCollapsed(!rightCollapsed)}
        >{rightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
        {!rightCollapsed && (
          <div className="w-80 border-l border-base-300 flex flex-col">
            <DetailPanel
              page={selectedPage}
              masterPrompt={project.master_prompt}
              onSave={updatePage}
              onRegenerate={translation.regeneratePage}
              onMasterPromptSave={handleMasterPromptSave}
            />
          </div>
        )}
      </div>
      <LogModal open={showLog} onClose={() => setShowLog(false)} logs={translation.logs} />
    </div>
  )
}
