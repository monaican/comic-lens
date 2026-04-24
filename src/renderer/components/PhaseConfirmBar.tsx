import type { PhaseCompleted } from '../types'

const phaseNames: Record<string, string> = {
  vision: '识图',
  analysis: '全局分析',
  translation: '逐页翻译',
  image_gen: '图片生成'
}

interface Props {
  phaseCompleted: PhaseCompleted | null
  onConfirm: () => void
}

export default function PhaseConfirmBar({ phaseCompleted, onConfirm }: Props) {
  if (!phaseCompleted) return null

  return (
    <div className="alert alert-info rounded-none animate-pulse">
      <span>
        {phaseNames[phaseCompleted.phase]}阶段已完成，请检查结果后继续
        {phaseCompleted.nextPhase && `（下一步：${phaseNames[phaseCompleted.nextPhase]}）`}
      </span>
      <button className="btn btn-sm btn-primary" onClick={onConfirm}>确认继续</button>
    </div>
  )
}
