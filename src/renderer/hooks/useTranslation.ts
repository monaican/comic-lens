import { useState, useEffect, useCallback, useRef } from 'react'
import type { Phase, TranslateProgress, PhaseCompleted } from '../types'

interface TranslationState {
  isRunning: boolean
  currentPhase: Phase | null
  phaseCompleted: PhaseCompleted | null
  pageStatuses: Map<string, { phase: Phase; status: string }>
  errors: Map<string, string>
  finished: boolean
  pipelineError: string | null
  elapsedMs: number
}

export function useTranslation(projectId: string | null, onUpdate?: () => void) {
  const [state, setState] = useState<TranslationState>({
    isRunning: false,
    currentPhase: null,
    phaseCompleted: null,
    pageStatuses: new Map(),
    errors: new Map(),
    finished: false,
    pipelineError: null,
    elapsedMs: 0
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, elapsedMs: Date.now() - startTimeRef.current }))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!projectId) return

    const handleProgress = (data: TranslateProgress) => {
      setState(prev => {
        const newStatuses = new Map(prev.pageStatuses)
        newStatuses.set(data.pageId, { phase: data.phase, status: data.status })
        return { ...prev, pageStatuses: newStatuses }
      })
    }

    const handleFinished = (data: { pageId: string; phase: Phase }) => {
      setState(prev => {
        const newStatuses = new Map(prev.pageStatuses)
        newStatuses.set(data.pageId, { phase: data.phase, status: '完成' })
        return { ...prev, pageStatuses: newStatuses }
      })
      onUpdate?.()
    }

    const handleError = (data: { pageId: string; phase: Phase; error: string }) => {
      setState(prev => {
        const newErrors = new Map(prev.errors)
        newErrors.set(data.pageId, data.error)
        return { ...prev, errors: newErrors }
      })
      onUpdate?.()
    }

    const handlePhaseStarted = (data: { phase: Phase }) => {
      setState(prev => ({ ...prev, currentPhase: data.phase, phaseCompleted: null }))
    }

    const handlePhaseCompleted = (data: PhaseCompleted) => {
      setState(prev => ({ ...prev, phaseCompleted: data }))
      onUpdate?.()
    }

    const handleAllFinished = () => {
      stopTimer()
      setState(prev => ({ ...prev, isRunning: false, finished: true }))
      onUpdate?.()
    }

    const handlePipelineError = (data: { error: string }) => {
      stopTimer()
      setState(prev => ({ ...prev, isRunning: false, pipelineError: data.error }))
      onUpdate?.()
    }

    window.api.translate.onPageProgress(handleProgress)
    window.api.translate.onPageFinished(handleFinished)
    window.api.translate.onPageError(handleError)
    window.api.translate.onPhaseStarted(handlePhaseStarted)
    window.api.translate.onPhaseCompleted(handlePhaseCompleted)
    window.api.translate.onAllFinished(handleAllFinished)
    window.api.translate.onPipelineError(handlePipelineError)

    return () => {
      window.api.translate.removeAllListeners()
      stopTimer()
    }
  }, [projectId, onUpdate, stopTimer])

  const start = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({
      ...prev,
      isRunning: true, finished: false, pipelineError: null,
      pageStatuses: new Map(), errors: new Map(), elapsedMs: 0
    }))
    startTimer()
    await window.api.translate.start(projectId)
  }, [projectId, startTimer])

  const stop = useCallback(async () => {
    if (!projectId) return
    await window.api.translate.stop(projectId)
    stopTimer()
    setState(prev => ({ ...prev, isRunning: false }))
  }, [projectId, stopTimer])

  const confirmPhase = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({ ...prev, phaseCompleted: null }))
    await window.api.translate.confirmPhase(projectId)
  }, [projectId])

  const retryFailed = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({
      ...prev, isRunning: true, finished: false,
      pipelineError: null, errors: new Map(), elapsedMs: 0
    }))
    startTimer()
    await window.api.translate.retryFailed(projectId)
  }, [projectId, startTimer])

  return { ...state, start, stop, confirmPhase, retryFailed }
}
