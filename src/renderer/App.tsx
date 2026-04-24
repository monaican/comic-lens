import { useState, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import Bookshelf from './components/Bookshelf'
import Settings from './components/Settings'
import Workspace from './components/Workspace'
import Toast from './components/Toast'
import type { Project } from './types'

interface WorkspaceTab {
  id: string
  projectId: string
  label: string
  status: string
}

function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState('bookshelf')
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const openProject = useCallback((project: Project) => {
    const existing = workspaceTabs.find(t => t.projectId === project.id)
    if (existing) {
      setActiveTab(existing.id)
      return
    }
    const tab: WorkspaceTab = {
      id: `ws-${project.id}`,
      projectId: project.id,
      label: project.name,
      status: project.status
    }
    setWorkspaceTabs(prev => [...prev, tab])
    setActiveTab(tab.id)
  }, [workspaceTabs])

  const closeTab = useCallback((tabId: string) => {
    setWorkspaceTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTab === tabId) setActiveTab('bookshelf')
  }, [activeTab])

  const tabs = [
    { id: 'bookshelf', label: '书架', closable: false },
    { id: 'settings', label: '设置', closable: false },
    ...workspaceTabs.map(t => ({
      id: t.id, label: t.label, closable: true, status: t.status
    }))
  ]

  const activeWorkspace = workspaceTabs.find(t => t.id === activeTab)

  return (
    <div data-theme={theme} className="h-screen flex flex-col">
      <TitleBar />
      <TabBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} onClose={closeTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'bookshelf' && <Bookshelf onOpenProject={openProject} />}
        {activeTab === 'settings' && <Settings />}
        {activeWorkspace && <Workspace projectId={activeWorkspace.projectId} />}
      </div>
      <Toast />
    </div>
  )
}

export default App
