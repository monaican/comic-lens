import type { Phase, PhaseCompleted, Project } from './types'

type ResumableProjectState = Pick<Project, 'translate_mode' | 'current_phase' | 'phase_confirmed'>

const nextPhaseMap: Partial<Record<Phase, Phase>> = {
  vision: 'analysis',
  analysis: 'translation',
  translation: 'image_gen'
}

export function restorePausedPhaseCompletion(
  project: ResumableProjectState | null | undefined
): PhaseCompleted | null {
  if (!project) return null
  if (project.translate_mode !== 'manual' || project.phase_confirmed !== 0) return null

  const phase = project.current_phase as Phase
  const nextPhase = nextPhaseMap[phase]
  if (!nextPhase) return null

  return {
    phase,
    nextPhase,
    paused: true
  }
}

export function resolvePhaseCompletion(
  livePhaseCompleted: PhaseCompleted | null | undefined,
  project: ResumableProjectState | null | undefined
): PhaseCompleted | null {
  if (livePhaseCompleted?.paused) return livePhaseCompleted
  return restorePausedPhaseCompletion(project)
}

export function buildTranslationAlert({
  pipelineError,
  failedCount
}: {
  pipelineError: string | null
  failedCount: number
}): { tone: 'error' | 'warning'; message: string } | null {
  if (pipelineError) {
    const suffix = failedCount > 0 ? `。当前有 ${failedCount} 页处理失败。` : '。'
    return {
      tone: 'error',
      message: `流程异常终止：${pipelineError}${suffix}`
    }
  }

  if (failedCount > 0) {
    return {
      tone: 'warning',
      message: `当前有 ${failedCount} 页处理失败，可在修正后重试失败页。`
    }
  }

  return null
}

export function canRetryFailedPages(isRunning: boolean, failedCount: number): boolean {
  return !isRunning && failedCount > 0
}

export function removeWorkspaceTabsByProjectId<T extends { projectId: string }>(
  tabs: T[],
  projectId: string
): T[] {
  return tabs.filter(tab => tab.projectId !== projectId)
}
