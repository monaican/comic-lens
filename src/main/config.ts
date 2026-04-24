import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

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

export const DEFAULT_VISION_PROMPT = `你是一个漫画分析助手。请分析这张漫画图片：
1. 用一两句话简短描述这张漫画主要讲了什么
2. 按格子（面板）顺序，描述每一句对话/文字的位置和原文内容

格式示例：
这张漫画描述了……

第一格
右侧对话框："原文内容"
左侧对话框："原文内容"

第二格
顶部旁白："原文内容"

请用自然语言描述位置（如：右侧对话框、左上角旁白、粗体大字等），不需要精确坐标。
源语言为：{source_lang}`

export const DEFAULT_GLOBAL_ANALYSIS_PROMPT = `你是一个专业的漫画翻译审校助手。

我会提供一部漫画所有页面的识图分析结果（包含每页的内容描述和原文对话）。

请你通读所有页面内容，生成一个"总控提示词"，包含：
- 作品主题和故事背景概述
- 人物名字的统一翻译（如有）
- 地名的统一翻译（如有）
- 语气风格要求（如：热血少年漫、日常轻松、严肃剧情等）
- 特殊术语或专有名词的统一翻译
- 其他需要注意的翻译一致性问题

只输出总控提示词内容，不要做任何翻译。

源语言：{source_lang}
目标语言：{target_lang}`

export const DEFAULT_PAGE_TRANSLATE_PROMPT = `你是一个专业的漫画翻译助手。

以下是本作品的总控提示词（翻译注意事项）：
{master_prompt}

请根据以上注意事项，将下面这一页漫画的识图分析结果中的对话/文字翻译为{target_lang}。
保持原有的位置描述格式（如"第一格 右侧对话框"等），只替换对话/文字内容为译文。
不要包含漫画内容描述（如"这张漫画描述了……"），只保留位置+译文。

源语言：{source_lang}
目标语言：{target_lang}`

export const DEFAULT_IMAGE_GEN_PROMPT = '根据图片,画一个图片，在不改变排版和字体的情况下将{source_lang}改为{target_lang},参考译文：\n{refined}'

function getConfigPath(): string {
  return join(app.getAppPath(), 'data', 'config.json')
}

function defaultConfig(): AppConfig {
  return {
    vision_model: { provider: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o' },
    reasoning_model: { provider: 'anthropic', base_url: 'https://api.anthropic.com/v1', api_key: '', model: 'claude-sonnet-4-6' },
    image_gen: { provider: '', base_url: '', api_key: '', model: 'gpt-image-2' },
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
  return { ...defaultConfig(), ...raw }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = join(app.getAppPath(), 'data')
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
