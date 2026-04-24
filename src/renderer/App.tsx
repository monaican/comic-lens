import { useState, useCallback, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import Bookshelf from './components/Bookshelf'
import Settings from './components/Settings'
import Workspace from './components/Workspace'
import Toast from './components/Toast'
import type { Project } from './types'
import { normalizeTheme, THEME_STORAGE_KEY, type ThemeMode } from './theme-utils'
import { removeWorkspaceTabsByProjectId } from './workspace-utils'

interface WorkspaceTab {
  id: string
  projectId: string
  label: string
  status: string
}

function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState('bookshelf')
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([])
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  })

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])
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
  const handleProjectChange = useCallback((project: Project) => {
    setWorkspaceTabs(prev => prev.map(tab =>
      tab.projectId === project.id
        ? { ...tab, label: project.name, status: project.status }
        : tab
    ))
  }, [])

  const handleProjectDeleted = useCallback((projectId: string) => {
    const deletedTabIds = workspaceTabs
      .filter(tab => tab.projectId === projectId)
      .map(tab => tab.id)

    setWorkspaceTabs(prev => removeWorkspaceTabsByProjectId(prev, projectId))
    setActiveTab(prev => deletedTabIds.includes(prev) ? 'bookshelf' : prev)
  }, [workspaceTabs])

  return (
    <div data-theme={theme} className="h-screen flex flex-col">
      <TitleBar />
      <TabBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} onClose={closeTab} />
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'bookshelf' ? 'h-full' : 'hidden'}>
          <Bookshelf
            onOpenProject={openProject}
            onProjectDeleted={handleProjectDeleted}
          />
        </div>
        <div className={activeTab === 'settings' ? 'h-full' : 'hidden'}>
          <Settings theme={theme} onThemeChange={setTheme} />
        </div>
        {workspaceTabs.map(tab => (
          <div key={tab.projectId} className={activeTab === tab.id ? 'h-full' : 'hidden'}>
            <Workspace
              projectId={tab.projectId}
              onProjectChange={handleProjectChange}
            />
          </div>
        ))}
      </div>
      <Toast />
    </div>
  )
}

export default App
