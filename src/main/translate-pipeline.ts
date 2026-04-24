import { BrowserWindow } from 'electron'
import { join } from 'path'
import { Semaphore } from './semaphore'
import { analyzePageVision } from './vision-service'
import { analyzeGlobal, translatePage } from './reasoning-service'
import { translatePageImage } from './image-gen-service'
import {
  loadConfig,
  getVisionPrompt,
  getGlobalAnalysisPrompt,
  getPageTranslatePrompt,
  getImageGenPrompt
} from './config'
import {
  getPage,
  getProject,
  listPages,
  updateProject,
  updatePage
} from './database'
import { hasFailedPages } from './safety-utils'

type Phase = 'vision' | 'analysis' | 'translation' | 'image_gen'

interface PipelineState {
  projectId: string
  stopped: boolean
  controllers: Set<AbortController>
}

const activePipelines = new Map<string, PipelineState>()

function send(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

function log(win: BrowserWindow, level: 'info' | 'warn' | 'error', message: string): void {
  send(win, 'translate:log', { time: Date.now(), level, message })
}

function createState(projectId: string): PipelineState {
  return {
    projectId,
    stopped: false,
    controllers: new Set()
  }
}

function ensurePipelineAvailable(projectId: string): void {
  if (activePipelines.has(projectId)) {
    throw new Error('项目正在翻译中')
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function ensureRunning(state: PipelineState): void {
  if (state.stopped) {
    throw new Error('翻译已停止')
  }
}

async function sleepWithStop(delayMs: number, state: PipelineState): Promise<void> {
  const step = 100
  let elapsed = 0
  while (elapsed < delayMs) {
    ensureRunning(state)
    await new Promise(resolve => setTimeout(resolve, Math.min(step, delayMs - elapsed)))
    elapsed += step
  }
}

async function retryWithBackoff<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  maxRetries: number,
  pageId: string,
  win: BrowserWindow,
  state: PipelineState
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    ensureRunning(state)
    const controller = new AbortController()
    state.controllers.add(controller)
    try {
      return await fn(controller.signal)
    } catch (error) {
      if (state.stopped || isAbortError(error)) {
        throw new Error('翻译已停止')
      }
      if (attempt === maxRetries) {
        throw error
      }
      const delay = Math.pow(2, attempt) * 1000
      send(win, 'translate:page-progress', {
        pageId,
        phase: '',
        status: `重试中 (${attempt + 1}/${maxRetries})...`
      })
      await sleepWithStop(delay, state)
    } finally {
      state.controllers.delete(controller)
    }
  }
  throw new Error('unreachable')
}

function abortPipeline(state: PipelineState): void {
  state.stopped = true
  for (const controller of state.controllers) {
    controller.abort()
  }
  state.controllers.clear()
}

function buildFinalPrompt(
  page: Record<string, unknown>,
  project: Record<string, unknown>,
  configPrompt: string
): string {
  return (page.final_prompt as string) || configPrompt
    .replace('{source_lang}', project.source_lang as string)
    .replace('{target_lang}', project.target_lang as string)
    .replace('{refined}', page.refined_translation as string)
}

function completeProjectIfPossible(projectId: string): 'completed' | 'failed' | 'idle' {
  const pages = listPages(projectId)
  if (hasFailedPages(pages)) {
    updateProject(projectId, { status: 'failed', current_phase: '' })
    return 'failed'
  }
  if (!pages.every(page => page.status === 'completed')) {
    updateProject(projectId, { status: 'idle', current_phase: '' })
    return 'idle'
  }
  updateProject(projectId, { status: 'completed', current_phase: '' })
  return 'completed'
}

function resetInterruptedPages(projectId: string): void {
  for (const page of listPages(projectId)) {
    if (page.status !== 'analyzing' && page.status !== 'translating') continue
    if (page.refined_translation) {
      updatePage(page.id as string, { status: 'analyzed' })
    } else if (page.vision_result) {
      updatePage(page.id as string, { status: 'analyzed' })
    } else {
      updatePage(page.id as string, { status: 'pending' })
    }
  }
}

async function runSinglePageImageGen(
  projectId: string,
  pageId: string,
  win: BrowserWindow,
  state: PipelineState
): Promise<void> {
  const config = loadConfig()
  const project = getProject(projectId)
  const page = getPage(pageId)
  if (!project) throw new Error('项目不存在')
  if (!page) throw new Error('页面不存在')
  if (!page.refined_translation) throw new Error('缺少精炼翻译，无法重新生图')

  updateProject(projectId, { status: 'translating', current_phase: 'image_gen' })
  updatePage(pageId, { status: 'translating', error_message: '' })
  send(win, 'translate:phase-started', { phase: 'image_gen', total: 1 })
  send(win, 'translate:page-progress', { pageId, phase: 'image_gen', status: '生成中' })

  const finalPrompt = buildFinalPrompt(page, project, getImageGenPrompt(config))
  updatePage(pageId, { final_prompt: finalPrompt })

  const imagePath = join(project.source_dir as string, page.filename as string)
  await retryWithBackoff(
    signal => translatePageImage(
      config.image_gen,
      imagePath,
      finalPrompt,
      project.output_dir as string,
      page.filename as string,
      signal
    ),
    config.max_retries,
    pageId,
    win,
    state
  )

  updatePage(pageId, { status: 'completed', error_message: '' })
  send(win, 'translate:page-finished', { pageId, phase: 'image_gen', result: 'done' })
  send(win, 'translate:phase-progress', { phase: 'image_gen', completed: 1, total: 1 })
}

export async function startTranslation(projectId: string, win: BrowserWindow): Promise<void> {
  ensurePipelineAvailable(projectId)
  const config = loadConfig()
  const project = getProject(projectId)
  if (!project) throw new Error('项目不存在')

  const state = createState(projectId)
  activePipelines.set(projectId, state)

  const pages = listPages(projectId)
  const semaphore = new Semaphore(config.concurrency)
  const isManual = project.translate_mode === 'manual'

  log(
    win,
    'info',
    `开始翻译项目「${project.name}」，共 ${pages.length} 页，并发数 ${config.concurrency}，模式：${isManual ? '手动' : '自动'}`
  )

  try {
    const needsVision = pages.filter(page => !page.vision_result)
    if (needsVision.length > 0) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'vision' })
      send(win, 'translate:phase-started', { phase: 'vision', total: needsVision.length })
      log(win, 'info', `[识图] 开始，待处理 ${needsVision.length} 页`)

      const visionPrompt = getVisionPrompt(config).replace('{source_lang}', project.source_lang as string)
      let visionDone = 0

      await Promise.allSettled(needsVision.map(page =>
        semaphore.run(async () => {
          ensureRunning(state)
          const currentPageId = page.id as string
          send(win, 'translate:page-progress', { pageId: currentPageId, phase: 'vision', status: '分析中' })
          updatePage(currentPageId, { status: 'analyzing', error_message: '' })
          try {
            const imagePath = join(project.source_dir as string, page.filename as string)
            const result = await retryWithBackoff(
              signal => analyzePageVision(config.vision_model, imagePath, visionPrompt, signal),
              config.max_retries,
              currentPageId,
              win,
              state
            )
            updatePage(currentPageId, { vision_result: result, status: 'analyzed', error_message: '' })
            visionDone++
            send(win, 'translate:page-finished', { pageId: currentPageId, phase: 'vision', result })
            send(win, 'translate:phase-progress', { phase: 'vision', completed: visionDone, total: needsVision.length })
            log(win, 'info', `[识图] ${page.filename} 完成 (${visionDone}/${needsVision.length})`)
          } catch (error) {
            if (state.stopped || isAbortError(error)) return
            const message = error instanceof Error ? error.message : String(error)
            updatePage(currentPageId, { status: 'failed', error_message: message })
            send(win, 'translate:page-error', { pageId: currentPageId, phase: 'vision', error: message })
            log(win, 'error', `[识图] ${page.filename} 失败: ${message}`)
          }
        })
      ))

      if (state.stopped) {
        updateProject(projectId, { status: 'idle', current_phase: '' })
        resetInterruptedPages(projectId)
        log(win, 'warn', '翻译已停止')
        return
      }
      log(win, 'info', '[识图] 阶段完成')
      if (isManual) {
        updateProject(projectId, { status: 'idle', current_phase: 'vision', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'vision', nextPhase: 'analysis', paused: true })
        return
      }
    }

    if (!(getProject(projectId)?.master_prompt as string)) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'analysis' })
      send(win, 'translate:phase-started', { phase: 'analysis', total: 1 })
      log(win, 'info', '[全局分析] 开始')

      const allPages = listPages(projectId)
      const visionResults: Record<string, string> = {}
      for (const page of allPages) {
        if (page.vision_result) {
          visionResults[page.filename as string] = page.vision_result as string
        }
      }

      const globalPrompt = getGlobalAnalysisPrompt(config)
        .replace('{source_lang}', project.source_lang as string)
        .replace('{target_lang}', project.target_lang as string)

      const masterPrompt = await retryWithBackoff(
        signal => analyzeGlobal(config.reasoning_model, visionResults, globalPrompt, signal),
        config.max_retries,
        'global',
        win,
        state
      )

      updateProject(projectId, { master_prompt: masterPrompt })
      send(win, 'translate:phase-progress', { phase: 'analysis', completed: 1, total: 1 })
      log(win, 'info', '[全局分析] 完成')

      if (state.stopped) {
        updateProject(projectId, { status: 'idle', current_phase: '' })
        resetInterruptedPages(projectId)
        log(win, 'warn', '翻译已停止')
        return
      }
      if (isManual) {
        updateProject(projectId, { status: 'idle', current_phase: 'analysis', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'analysis', nextPhase: 'translation', paused: true })
        return
      }
      send(win, 'translate:phase-completed', { phase: 'analysis', nextPhase: 'translation', paused: false })
    }

    const updatedProject = getProject(projectId)
    if (!updatedProject) throw new Error('项目不存在')
    const needsTranslation = listPages(projectId).filter(page => page.vision_result && !page.refined_translation)
    if (needsTranslation.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'translation' })
      send(win, 'translate:phase-started', { phase: 'translation', total: needsTranslation.length })
      log(win, 'info', `[翻译] 开始，待处理 ${needsTranslation.length} 页`)

      const pagePrompt = getPageTranslatePrompt(config)
        .replace('{master_prompt}', updatedProject.master_prompt as string)
        .replace('{source_lang}', updatedProject.source_lang as string)
        .replace(/{target_lang}/g, updatedProject.target_lang as string)

      let translationDone = 0
      await Promise.allSettled(needsTranslation.map(page =>
        semaphore.run(async () => {
          ensureRunning(state)
          const currentPageId = page.id as string
          send(win, 'translate:page-progress', { pageId: currentPageId, phase: 'translation', status: '翻译中' })
          updatePage(currentPageId, { status: 'translating', error_message: '' })
          try {
            const result = await retryWithBackoff(
              signal => translatePage(config.reasoning_model, pagePrompt, page.vision_result as string, signal),
              config.max_retries,
              currentPageId,
              win,
              state
            )
            updatePage(currentPageId, { refined_translation: result, status: 'analyzed', error_message: '' })
            translationDone++
            send(win, 'translate:page-finished', { pageId: currentPageId, phase: 'translation', result })
            send(win, 'translate:phase-progress', { phase: 'translation', completed: translationDone, total: needsTranslation.length })
            log(win, 'info', `[翻译] ${page.filename} 完成 (${translationDone}/${needsTranslation.length})`)
          } catch (error) {
            if (state.stopped || isAbortError(error)) return
            const message = error instanceof Error ? error.message : String(error)
            updatePage(currentPageId, { status: 'failed', error_message: message })
            send(win, 'translate:page-error', { pageId: currentPageId, phase: 'translation', error: message })
            log(win, 'error', `[翻译] ${page.filename} 失败: ${message}`)
          }
        })
      ))

      if (state.stopped) {
        updateProject(projectId, { status: 'idle', current_phase: '' })
        resetInterruptedPages(projectId)
        log(win, 'warn', '翻译已停止')
        return
      }
      log(win, 'info', '[翻译] 阶段完成')
      if (isManual) {
        updateProject(projectId, { status: 'idle', current_phase: 'translation', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'translation', nextPhase: 'image_gen', paused: true })
        return
      }
    }

    const latestProject = getProject(projectId)
    if (!latestProject) throw new Error('项目不存在')
    const needsImageGen = listPages(projectId).filter(page => page.refined_translation && page.status !== 'completed')
    if (needsImageGen.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'image_gen' })
      send(win, 'translate:phase-started', { phase: 'image_gen', total: needsImageGen.length })
      log(win, 'info', `[生图] 开始，待处理 ${needsImageGen.length} 页`)

      let imageGenDone = 0
      await Promise.allSettled(needsImageGen.map(page =>
        semaphore.run(async () => {
          ensureRunning(state)
          const currentPageId = page.id as string
          send(win, 'translate:page-progress', { pageId: currentPageId, phase: 'image_gen', status: '生成中' })
          updatePage(currentPageId, { status: 'translating', error_message: '' })

          const finalPrompt = buildFinalPrompt(page, latestProject, getImageGenPrompt(config))
          updatePage(currentPageId, { final_prompt: finalPrompt })

          try {
            const imagePath = join(latestProject.source_dir as string, page.filename as string)
            await retryWithBackoff(
              signal => translatePageImage(
                config.image_gen,
                imagePath,
                finalPrompt,
                latestProject.output_dir as string,
                page.filename as string,
                signal
              ),
              config.max_retries,
              currentPageId,
              win,
              state
            )
            updatePage(currentPageId, { status: 'completed', error_message: '' })
            imageGenDone++
            send(win, 'translate:page-finished', { pageId: currentPageId, phase: 'image_gen', result: 'done' })
            send(win, 'translate:phase-progress', { phase: 'image_gen', completed: imageGenDone, total: needsImageGen.length })
            log(win, 'info', `[生图] ${page.filename} 完成 (${imageGenDone}/${needsImageGen.length})`)
          } catch (error) {
            if (state.stopped || isAbortError(error)) return
            const message = error instanceof Error ? error.message : String(error)
            updatePage(currentPageId, { status: 'failed', error_message: message })
            send(win, 'translate:page-error', { pageId: currentPageId, phase: 'image_gen', error: message })
            log(win, 'error', `[生图] ${page.filename} 失败: ${message}`)
          }
        })
      ))

      if (state.stopped) {
        updateProject(projectId, { status: 'idle', current_phase: '' })
        resetInterruptedPages(projectId)
        log(win, 'warn', '翻译已停止')
        return
      }
      log(win, 'info', '[生图] 阶段完成')
    }

    const finalStatus = completeProjectIfPossible(projectId)
    if (finalStatus === 'completed') {
      send(win, 'translate:all-finished', { projectId })
      log(win, 'info', `项目「${project.name}」翻译完成`)
      return
    }

    const message = '部分页面处理失败，请检查错误信息后重试'
    send(win, 'translate:pipeline-error', { projectId, error: message })
    log(win, 'warn', message)
  } catch (error) {
    if (state.stopped || isAbortError(error)) {
      updateProject(projectId, { status: 'idle', current_phase: '' })
      resetInterruptedPages(projectId)
      log(win, 'warn', '翻译已停止')
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    updateProject(projectId, { status: 'failed' })
    send(win, 'translate:pipeline-error', { projectId, error: message })
    log(win, 'error', `翻译流程异常终止: ${message}`)
  } finally {
    activePipelines.delete(projectId)
  }
}

export function stopTranslation(projectId: string): void {
  const state = activePipelines.get(projectId)
  if (!state) return
  abortPipeline(state)
  updateProject(projectId, { status: 'idle', current_phase: '' })
  resetInterruptedPages(projectId)
}

export async function confirmPhase(projectId: string, win: BrowserWindow): Promise<void> {
  updateProject(projectId, { phase_confirmed: 1 })
  await startTranslation(projectId, win)
}

export async function retryFailed(projectId: string, win: BrowserWindow): Promise<void> {
  const pages = listPages(projectId)
  for (const page of pages) {
    if (page.status === 'failed') {
      updatePage(page.id as string, {
        status: 'pending',
        error_message: '',
        retry_count: 0
      })
    }
  }
  await startTranslation(projectId, win)
}

export async function regeneratePageImage(
  projectId: string,
  pageId: string,
  win: BrowserWindow
): Promise<void> {
  ensurePipelineAvailable(projectId)
  const project = getProject(projectId)
  if (!project) throw new Error('项目不存在')

  const state = createState(projectId)
  activePipelines.set(projectId, state)

  try {
    log(win, 'info', '[生图] 开始重新生成单页')
    await runSinglePageImageGen(projectId, pageId, win, state)
    const finalStatus = completeProjectIfPossible(projectId)
    if (finalStatus === 'completed') {
      send(win, 'translate:all-finished', { projectId })
    }
    log(win, 'info', '[生图] 单页重新生成完成')
  } catch (error) {
    if (state.stopped || isAbortError(error)) {
      updateProject(projectId, { status: 'idle', current_phase: '' })
      resetInterruptedPages(projectId)
      log(win, 'warn', '[生图] 单页重新生成已停止')
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    updatePage(pageId, { status: 'failed', error_message: message })
    updateProject(projectId, { status: 'failed', current_phase: '' })
    send(win, 'translate:pipeline-error', { projectId, error: message })
    log(win, 'error', `[生图] 单页重新生成失败: ${message}`)
  } finally {
    activePipelines.delete(projectId)
  }
}
