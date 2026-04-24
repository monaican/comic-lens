import { useState, useEffect, useCallback } from 'react'
import type { Page } from '../types'

export function usePages(projectId: string | null) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!projectId) { setPages([]); return }
    setLoading(true)
    const list = await window.api.pages.list(projectId)
    setPages(list)
    setLoading(false)
  }, [projectId])

  useEffect(() => { refresh() }, [refresh])

  const updatePage = useCallback(async (id: string, fields: Record<string, unknown>) => {
    await window.api.pages.update(id, fields)
    await refresh()
  }, [refresh])

  return { pages, loading, refresh, updatePage }
}
