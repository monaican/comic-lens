import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { mergeAppConfig } from './config-utils'
import {
  DEFAULT_GLOBAL_ANALYSIS_PROMPT,
  DEFAULT_IMAGE_GEN_PROMPT,
  DEFAULT_PAGE_TRANSLATE_PROMPT,
  DEFAULT_VISION_PROMPT
} from '../shared/prompt-defaults.ts'

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

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function defaultConfig(): AppConfig {
  return {
    vision_model: { provider: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o' },
    reasoning_model: { provider: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', model: 'o3' },
    image_gen: { provider: 'openai', base_url: 'https://api.openai.com/v1/responses', api_key: '', model: 'gpt-image-2' },
    concurrency: 3,
    max_retries: 3,
    output_base_dir: 'output',
    default_source_lang: '日本語',
    default_target_lang: '简体中文',
    vision_prompt: '',
    global_analysis_prompt: '',
    page_translate_prompt: '',
    image_gen_prompt: ''
  }
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    const cfg = defaultConfig()
    saveConfig(cfg)
    return cfg
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  return mergeAppConfig(defaultConfig(), raw)
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getVisionPrompt(config: AppConfig): string {
  return config.vision_prompt || DEFAULT_VISION_PROMPT
}

export function getGlobalAnalysisPrompt(config: AppConfig): string {
  return config.global_analysis_prompt || DEFAULT_GLOBAL_ANALYSIS_PROMPT
}

export function getPageTranslatePrompt(config: AppConfig): string {
  return config.page_translate_prompt || DEFAULT_PAGE_TRANSLATE_PROMPT
}

export function getImageGenPrompt(config: AppConfig): string {
  return config.image_gen_prompt || DEFAULT_IMAGE_GEN_PROMPT
}
