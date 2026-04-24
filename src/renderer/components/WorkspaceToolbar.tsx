import { ScrollText, FolderOpen } from 'lucide-react'
import type { Phase, PhaseProgress, TranslateMode } from '../types'
import { canRetryFailedPages } from '../workspace-utils'

const phaseLabels: Record<Phase, string> = {
  vision: '识图',
  analysis: '分析',
  translation: '翻译',
  image_gen: '生图'
}

const phases: Phase[] = ['vision', 'analysis', 'translation', 'image_gen']

interface Props {
  projectName: string
  sourceLang: string
  targetLang: string
  translateMode: TranslateMode
  onModeChange: (mode: TranslateMode) => void
  currentPhase: Phase | null
  phaseProgress: PhaseProgress | null
  isRunning: boolean
  completedCount: number
  failedCount: number
  totalCount: number
  elapsedMs: number
  onStart: () => void
  onStop: () => void
  onRetryFailed: () => void
  logCount: number
  onShowLog: () => void
  outputDir: string
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function WorkspaceToolbar({
  projectName, sourceLang, targetLang, translateMode, onModeChange,
  currentPhase, phaseProgress, isRunning, completedCount, failedCount, totalCount, elapsedMs,
  onStart, onStop, onRetryFailed, logCount, onShowLog, outputDir
}: Props) {
  const retryEnabled = canRetryFailedPages(isRunning, failedCount)
  const progressPct = phaseProgress && phaseProgress.total > 0
    ? Math.round((phaseProgress.completed / phaseProgress.total) * 100)
    : 0

  return (
    <div className="bg-base-200 border-b border-base-300">
      <div className="flex items-center gap-3 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate max-w-40">{projectName}</span>
          <span className="text-base-content/50">{sourceLang} → {targetLang}</span>
          <select
            className="select select-xs select-bordered"
            value={translateMode}
            onChange={e => onModeChange(e.target.value as TranslateMode)}
            disabled={isRunning}
          >
            <option value="auto">自动</option>
            <option value="manual">手动</option>
          </select>
        </div>

        <div className="flex-1 flex items-center gap-2 justify-center">
          <div className="flex gap-0.5">
            {phases.map((p, idx) => {
              const isCurrent = currentPhase === p
              const isPast = currentPhase ? phases.indexOf(currentPhase) > idx : false
              const showCount = isCurrent && phaseProgress && phaseProgress.phase === p

              return (
                <div
                  key={p}
                  className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-content'
                      : isPast
                        ? 'bg-primary/20 text-primary'
                        : 'bg-base-300 text-base-content/50'
                  }`}
                >
                  {isCurrent && isRunning && <span className="loading loading-spinner w-3 h-3" />}
                  {phaseLabels[p]}
                  {showCount && (
                    <span className="text-primary-content/70">{phaseProgress.completed}/{phaseProgress.total}</span>
                  )}
                </div>
              )
            })}
          </div>
          <span className="text-base-content/60">{completedCount}/{totalCount}</span>
          {isRunning && <span className="text-base-content/60">{formatTime(elapsedMs)}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => window.api.file.openFolder(outputDir)} title="打开输出目录">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost btn-xs gap-1" onClick={onShowLog}>
            <ScrollText className="w-3.5 h-3.5" />
            {logCount > 0 && <span className="text-xs text-base-content/50">{logCount}</span>}
          </button>
          {!isRunning ? (
            <button className="btn btn-primary btn-xs" onClick={onStart}>开始翻译</button>
          ) : (
            <button className="btn btn-error btn-xs" onClick={onStop}>停止</button>
          )}
          <button className="btn btn-warning btn-xs gap-1" onClick={onRetryFailed} disabled={!retryEnabled}>
            <span>重试失败</span>
            {failedCount > 0 && <span className="text-xs text-base-content/60">{failedCount}</span>}
          </button>
        </div>
      </div>

      {isRunning && phaseProgress && phaseProgress.total > 0 && (
        <div className="px-3 pb-1.5">
          <progress
            className="progress progress-primary w-full h-1.5"
            value={progressPct}
            max={100}
          />
        </div>
      )}
    </div>
  )
}
