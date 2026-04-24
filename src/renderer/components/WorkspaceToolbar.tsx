import type { Phase, TranslateMode } from '../types'

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
  isRunning: boolean
  completedCount: number
  totalCount: number
  elapsedMs: number
  onStart: () => void
  onStop: () => void
  onRetryFailed: () => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function WorkspaceToolbar({
  projectName, sourceLang, targetLang, translateMode, onModeChange,
  currentPhase, isRunning, completedCount, totalCount, elapsedMs,
  onStart, onStop, onRetryFailed
}: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-base-200 border-b border-base-300 text-sm">
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
          {phases.map(p => (
            <div
              key={p}
              className={`px-2 py-0.5 text-xs rounded ${
                currentPhase === p
                  ? 'bg-primary text-primary-content'
                  : 'bg-base-300 text-base-content/50'
              }`}
            >
              {phaseLabels[p]}
            </div>
          ))}
        </div>
        <span className="text-base-content/60">{completedCount}/{totalCount}</span>
        {isRunning && <span className="text-base-content/60">{formatTime(elapsedMs)}</span>}
      </div>

      <div className="flex items-center gap-2">
        {!isRunning ? (
          <button className="btn btn-primary btn-xs" onClick={onStart}>开始翻译</button>
        ) : (
          <button className="btn btn-error btn-xs" onClick={onStop}>停止</button>
        )}
        <button className="btn btn-warning btn-xs" onClick={onRetryFailed} disabled={isRunning}>重试失败</button>
      </div>
    </div>
  )
}
