import { X } from 'lucide-react'

interface Tab {
  id: string
  label: string
  closable: boolean
  status?: string
}

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

const statusColors: Record<string, string> = {
  idle: 'bg-base-300',
  analyzing: 'bg-info',
  translating: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-error'
}

export default function TabBar({ tabs, activeId, onSelect, onClose }: TabBarProps) {
  return (
    <div className="flex items-center bg-base-100 border-b border-base-300 overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`flex items-center gap-1 px-4 py-2 cursor-pointer border-b-2 text-sm whitespace-nowrap ${
            activeId === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent hover:bg-base-200'
          }`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.status && (
            <span className={`w-2 h-2 rounded-full ${statusColors[tab.status] || 'bg-base-300'}`} />
          )}
          <span>{tab.label}</span>
          {tab.closable && (
            <button
              className="btn btn-ghost btn-xs btn-circle ml-1"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
            ><X className="w-3 h-3" /></button>
          )}
        </div>
      ))}
    </div>
  )
}
