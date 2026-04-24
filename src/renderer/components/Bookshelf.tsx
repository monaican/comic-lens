import type { Project } from '../types'

interface Props { onOpenProject: (project: Project) => void }

export default function Bookshelf({ onOpenProject: _ }: Props) {
  return <div className="p-4">书架（待实现）</div>
}
