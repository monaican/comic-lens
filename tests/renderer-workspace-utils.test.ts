import test from 'node:test'
import assert from 'node:assert/strict'

test('resolvePhaseCompletion hides auto-flow phase completion events', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const resolvePhaseCompletion = mod.resolvePhaseCompletion as ((...args: unknown[]) => unknown) | undefined

  const result = resolvePhaseCompletion?.(
    { phase: 'analysis', nextPhase: 'translation', paused: false },
    null
  )

  assert.equal(result, null)
})

test('resolvePhaseCompletion restores a persisted manual pause from project state', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const resolvePhaseCompletion = mod.resolvePhaseCompletion as ((...args: unknown[]) => unknown) | undefined

  const result = resolvePhaseCompletion?.(
    null,
    { translate_mode: 'manual', current_phase: 'analysis', phase_confirmed: 0 }
  )

  assert.deepEqual(result, {
    phase: 'analysis',
    nextPhase: 'translation',
    paused: true
  })
})

test('buildTranslationAlert prioritizes pipeline errors and includes failed page count', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const buildTranslationAlert = mod.buildTranslationAlert as ((...args: unknown[]) => unknown) | undefined

  const result = buildTranslationAlert?.({
    pipelineError: '网络中断',
    failedCount: 2
  })

  assert.deepEqual(result, {
    tone: 'error',
    message: '流程异常终止：网络中断。当前有 2 页处理失败。'
  })
})

test('buildTranslationAlert reports failed pages when the pipeline itself did not crash', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const buildTranslationAlert = mod.buildTranslationAlert as ((...args: unknown[]) => unknown) | undefined

  const result = buildTranslationAlert?.({
    pipelineError: null,
    failedCount: 3
  })

  assert.deepEqual(result, {
    tone: 'warning',
    message: '当前有 3 页处理失败，可在修正后重试失败页。'
  })
})

test('canRetryFailedPages requires idle state and at least one failed page', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const canRetryFailedPages = mod.canRetryFailedPages as ((...args: unknown[]) => unknown) | undefined

  assert.equal(canRetryFailedPages?.(false, 0), false)
  assert.equal(canRetryFailedPages?.(true, 2), false)
  assert.equal(canRetryFailedPages?.(false, 2), true)
})

test('removeWorkspaceTabsByProjectId removes only the deleted project tab', async () => {
  const mod = await import('../src/renderer/workspace-utils.ts').catch(() => ({} as Record<string, unknown>))
  const removeWorkspaceTabsByProjectId = mod.removeWorkspaceTabsByProjectId as ((...args: unknown[]) => unknown) | undefined

  const result = removeWorkspaceTabsByProjectId?.(
    [
      { id: 'ws-a', projectId: 'a', label: 'A', status: 'idle' },
      { id: 'ws-b', projectId: 'b', label: 'B', status: 'completed' }
    ],
    'a'
  )

  assert.deepEqual(result, [
    { id: 'ws-b', projectId: 'b', label: 'B', status: 'completed' }
  ])
})

test('normalizeTheme keeps dark and falls back to light for unknown values', async () => {
  const mod = await import('../src/renderer/theme-utils.ts').catch(() => ({} as Record<string, unknown>))
  const normalizeTheme = mod.normalizeTheme as ((...args: unknown[]) => unknown) | undefined

  assert.equal(normalizeTheme?.('dark'), 'dark')
  assert.equal(normalizeTheme?.('sepia'), 'light')
  assert.equal(normalizeTheme?.(null), 'light')
})
