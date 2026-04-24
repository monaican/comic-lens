import { BrowserWindow } from 'electron'
import { Semaphore } from './semaphore'
import { analyzePageVision } from './vision-service'
import { analyzeGlobal, translatePage } from './reasoning-service'
import { translatePageImage } from './image-gen-service'
import {
  loadConfig, getVisionPrompt, getGlobalAnalysisPrompt,
  getPageTranslatePrompt, getImageGenPrompt, type AppConfig, type ModelConfig
} from './config'
import {
  getProject, listPages, updateProject, updatePage
} from './database'
import { join, basename } from 'path'

type Phase = 'vision' | 'analysis' | 'translation' | 'image_gen'

interface PipelineState {
  projectId: string
  stopped: boolean
}

const activePipelines = new Map<string, PipelineState>()

function send(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>, maxRetries: number, pageId: string, win: BrowserWindow
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const delay = Math.pow(2, attempt) * 1000
      send(win, 'translate:page-progress', {
        pageId, phase: '', status: `重试中 (${attempt + 1}/${maxRetries})...`
      })
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

export async function startTranslation(projectId: string, win: BrowserWindow): Promise<void> {
  const config = loadConfig()
  const project = getProject(projectId)
  if (!project) throw new Error('项目不存在')

  const state: PipelineState = { projectId, stopped: false }
  activePipelines.set(projectId, state)

  const pages = listPages(projectId)
  const semaphore = new Semaphore(config.concurrency)
  const isManual = project.translate_mode === 'manual'

  try {
    // Phase 1: Vision
    const needsVision = pages.filter(p => !p.vision_result)
    if (needsVision.length > 0) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'vision' })
      send(win, 'translate:phase-started', { phase: 'vision', total: needsVision.length })

      const visionPrompt = getVisionPrompt(config).replace('{source_lang}', project.source_lang as string)
      let visionDone = 0

      await Promise.allSettled(needsVision.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'vision', status: '分析中' })
          updatePage(pageId, { status: 'analyzing' })
          try {
            const imagePath = join(project.source_dir as string, page.filename as string)
            const result = await retryWithBackoff(
              () => analyzePageVision(config.vision_model, imagePath, visionPrompt),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { vision_result: result, status: 'analyzed' })
            visionDone++
            send(win, 'translate:page-finished', { pageId, phase: 'vision', result })
            send(win, 'translate:phase-progress', { phase: 'vision', completed: visionDone, total: needsVision.length })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'vision', error: msg })
          }
        })
      ))

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'vision', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'vision', nextPhase: 'analysis' })
        return
      }
    }

    // Phase 2: Global Analysis
    if (!project.master_prompt) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'analysis' })
      send(win, 'translate:phase-started', { phase: 'analysis', total: 1 })

      const allPages = listPages(projectId)
      const visionResults: Record<string, string> = {}
      for (const p of allPages) {
        if (p.vision_result) visionResults[p.filename as string] = p.vision_result as string
      }

      const globalPrompt = getGlobalAnalysisPrompt(config)
        .replace('{source_lang}', project.source_lang as string)
        .replace('{target_lang}', project.target_lang as string)

      const masterPrompt = await retryWithBackoff(
        () => analyzeGlobal(config.reasoning_model, visionResults, globalPrompt),
        config.max_retries, 'global', win
      )
      updateProject(projectId, { master_prompt: masterPrompt })
      send(win, 'translate:phase-progress', { phase: 'analysis', completed: 1, total: 1 })
      send(win, 'translate:phase-completed', { phase: 'analysis', nextPhase: 'translation' })

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'analysis', phase_confirmed: 0 })
        return
      }
    }

    // Phase 3: Page Translation
    const updatedProject = getProject(projectId)!
    const needsTranslation = listPages(projectId).filter(p => p.vision_result && !p.refined_translation)
    if (needsTranslation.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'translation' })
      send(win, 'translate:phase-started', { phase: 'translation', total: needsTranslation.length })

      const pagePrompt = getPageTranslatePrompt(config)
        .replace('{master_prompt}', updatedProject.master_prompt as string)
        .replace('{source_lang}', updatedProject.source_lang as string)
        .replace(/{target_lang}/g, updatedProject.target_lang as string)

      let translationDone = 0

      await Promise.allSettled(needsTranslation.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'translation', status: '翻译中' })
          updatePage(pageId, { status: 'translating' })
          try {
            const result = await retryWithBackoff(
              () => translatePage(config.reasoning_model, pagePrompt, page.vision_result as string),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { refined_translation: result, status: 'analyzed' })
            translationDone++
            send(win, 'translate:page-finished', { pageId, phase: 'translation', result })
            send(win, 'translate:phase-progress', { phase: 'translation', completed: translationDone, total: needsTranslation.length })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'translation', error: msg })
          }
        })
      ))

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'translation', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'translation', nextPhase: 'image_gen' })
        return
      }
    }

    // Phase 4: Image Generation
    const latestProject = getProject(projectId)!
    const needsImageGen = listPages(projectId).filter(p => p.refined_translation && p.status !== 'completed')
    if (needsImageGen.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'image_gen' })
      send(win, 'translate:phase-started', { phase: 'image_gen', total: needsImageGen.length })

      const outputDir = join(
        config.output_base_dir,
        latestProject.name as string
      )

      let imageGenDone = 0

      await Promise.allSettled(needsImageGen.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'image_gen', status: '生成中' })
          updatePage(pageId, { status: 'translating' })

          const finalPrompt = (page.final_prompt as string) || getImageGenPrompt(config)
            .replace('{source_lang}', latestProject.source_lang as string)
            .replace('{target_lang}', latestProject.target_lang as string)
            .replace('{refined}', page.refined_translation as string)

          if (!page.final_prompt) {
            updatePage(pageId, { final_prompt: finalPrompt })
          }

          try {
            const imagePath = join(latestProject.source_dir as string, page.filename as string)
            await retryWithBackoff(
              () => translatePageImage(
                config.image_gen, imagePath, finalPrompt,
                outputDir, page.filename as string
              ),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { status: 'completed' })
            imageGenDone++
            send(win, 'translate:page-finished', { pageId, phase: 'image_gen', result: 'done' })
            send(win, 'translate:phase-progress', { phase: 'image_gen', completed: imageGenDone, total: needsImageGen.length })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'image_gen', error: msg })
          }
        })
      ))
    }

    if (!state.stopped) {
      updateProject(projectId, { status: 'completed', current_phase: '' })
      send(win, 'translate:all-finished', { projectId })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateProject(projectId, { status: 'failed' })
    send(win, 'translate:pipeline-error', { projectId, error: msg })
  } finally {
    activePipelines.delete(projectId)
  }
}

export function stopTranslation(projectId: string): void {
  const state = activePipelines.get(projectId)
  if (state) state.stopped = true
}

export async function confirmPhase(projectId: string, win: BrowserWindow): Promise<void> {
  updateProject(projectId, { phase_confirmed: 1 })
  await startTranslation(projectId, win)
}

export async function retryFailed(projectId: string, win: BrowserWindow): Promise<void> {
  const pages = listPages(projectId)
  for (const page of pages) {
    if (page.status === 'failed') {
      updatePage(page.id as string, { status: 'pending', error_message: '', retry_count: 0 })
    }
  }
  await startTranslation(projectId, win)
}
