import type { Page } from '../types'

interface Props {
  page: Page | null
  masterPrompt: string
  onSave: (id: string, fields: Record<string, unknown>) => Promise<void>
  onRegenerate: (pageId: string) => Promise<void>
  onMasterPromptSave: (prompt: string) => Promise<void>
}

export default function DetailPanel({ page: _, masterPrompt: __, onSave: ___, onRegenerate: ____, onMasterPromptSave: _____ }: Props) {
  return <div className="flex-1 overflow-y-auto p-2">详情面板（待实现）</div>
}
