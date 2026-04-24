import type { Page } from '../types'

interface Props {
  page: Page | null
  sourceDir: string
  outputDir: string
}

export default function ImageViewer({ page: _, sourceDir: __, outputDir: ___ }: Props) {
  return <div className="h-full flex items-center justify-center">图片查看器（待实现）</div>
}
