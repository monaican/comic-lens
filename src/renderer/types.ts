export interface ModelConfig {
  provider: string
  base_url: string
  api_key: string
  model: string
}

export interface AppConfig {
  vision_model: ModelConfig
  reasoning_model: ModelConfig
  image_gen: ModelConfig
  concurrency: number
  max_retries: number
  output_base_dir: string
  default_source_lang: string
  default_target_lang: string
  vision_prompt: string
  global_analysis_prompt: string
  page_translate_prompt: string
  image_gen_prompt: string
}

export interface Project {
  id: string
  name: string
  source_dir: string
  output_dir: string
  source_lang: string
  target_lang: string
  master_prompt: string
  status: string
  translate_mode: string
  current_phase: string
  phase_confirmed: number
  created_at: string
  updated_at: string
}

export interface Page {
  id: string
  project_id: string
  filename: string
  page_order: number
  summary: string
  vision_result: string
  refined_translation: string
  final_prompt: string
  status: string
  error_message: string
  retry_count: number
  edited: number
  created_at: string
  updated_at: string
}

export type ProjectStatus = 'idle' | 'analyzing' | 'translating' | 'completed' | 'failed'
export type PageStatus = 'pending' | 'analyzing' | 'analyzed' | 'translating' | 'completed' | 'failed'
export type TranslateMode = 'auto' | 'manual'
export type Phase = 'vision' | 'analysis' | 'translation' | 'image_gen'

export interface TranslateProgress {
  pageId: string
  phase: Phase
  status: string
}

export interface PhaseProgress {
  phase: Phase
  completed: number
  total: number
}

export interface PhaseCompleted {
  phase: Phase
  nextPhase: Phase | null
  paused: boolean
}

export interface LogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  message: string
}

declare global {
  interface Window {
    api: {
      projects: {
        list: () => Promise<Project[]>
        get: (id: string) => Promise<Project | undefined>
        create: (data: Record<string, string>) => Promise<string>
        update: (id: string, fields: Record<string, unknown>) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      pages: {
        list: (projectId: string) => Promise<Page[]>
        get: (id: string) => Promise<Page | undefined>
        update: (id: string, fields: Record<string, unknown>) => Promise<void>
      }
      config: {
        get: () => Promise<AppConfig>
        save: (config: AppConfig) => Promise<void>
      }
      file: {
        selectFolder: () => Promise<string | null>
        getProjectCover: (projectId: string) => Promise<{ base64: string; mimeType: string } | null>
        readProjectImage: (
          projectId: string,
          filename: string,
          kind: 'source' | 'output'
        ) => Promise<{ base64: string; mimeType: string }>
      }
      thumbnail: {
        get: (projectId: string, filename: string) => Promise<string | null>
        generate: (projectId: string, sourceDir: string, filename: string) => Promise<string>
        generateAll: (projectId: string, sourceDir: string, filenames: string[]) => Promise<void>
        onProgress: (cb: (data: { projectId: string; completed: number; total: number; filename: string }) => void) => void
        removeProgressListener: () => void
      }
      translate: {
        start: (projectId: string) => Promise<void>
        stop: (projectId: string) => Promise<void>
        confirmPhase: (projectId: string) => Promise<void>
        retryFailed: (projectId: string) => Promise<void>
        regeneratePage: (projectId: string, pageId: string) => Promise<void>
        onPageProgress: (cb: (data: TranslateProgress) => void) => void
        onPageFinished: (cb: (data: { pageId: string; phase: Phase; result: string }) => void) => void
        onPageError: (cb: (data: { pageId: string; phase: Phase; error: string }) => void) => void
        onPhaseStarted: (cb: (data: { phase: Phase; total: number }) => void) => void
        onPhaseCompleted: (cb: (data: PhaseCompleted) => void) => void
        onAllFinished: (cb: (data: { projectId: string }) => void) => void
        onPipelineError: (cb: (data: { projectId: string; error: string }) => void) => void
        onPhaseProgress: (cb: (data: PhaseProgress) => void) => void
        onLog: (cb: (data: LogEntry) => void) => void
        removeAllListeners: () => void
      }
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
    }
  }
}
