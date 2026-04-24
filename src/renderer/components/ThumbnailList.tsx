import type { Page, Phase } from '../types'

interface Props {
  pages: Page[]
  sourceDir: string
  selectedId: string | null
  onSelect: (id: string) => void
  pageStatuses: Map<string, { phase: Phase; status: string }>
}

export default function ThumbnailList({ pages: _, sourceDir: __, selectedId: ___, onSelect: ____, pageStatuses: _____ }: Props) {
  return <div className="flex-1 overflow-y-auto p-2">缩略图列表（待实现）</div>
}
