import { useState, useEffect, useCallback } from 'react'
import type { AppConfig } from '../types'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const cfg = await window.api.config.get()
    setConfig(cfg)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveConfig = useCallback(async (cfg: AppConfig) => {
    await window.api.config.save(cfg)
    setConfig(cfg)
  }, [])

  return { config, loading, refresh, saveConfig }
}
