import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await window.api.projects.list()
    setProjects(list)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createProject = useCallback(async (data: Record<string, string>) => {
    const id = await window.api.projects.create(data)
    await refresh()
    return id
  }, [refresh])

  const deleteProject = useCallback(async (id: string) => {
    await window.api.projects.delete(id)
    await refresh()
  }, [refresh])

  const updateProject = useCallback(async (id: string, fields: Record<string, unknown>) => {
    await window.api.projects.update(id, fields)
    await refresh()
  }, [refresh])

  return { projects, loading, refresh, createProject, deleteProject, updateProject }
}
