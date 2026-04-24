import { DEFAULT_PROMPTS, type PromptConfigKey } from '../shared/prompt-defaults.ts'

export const PROMPT_FIELDS: Array<{
  key: PromptConfigKey
  label: string
  defaultPrompt: string
}> = [
  { key: 'vision_prompt', label: '视觉提示词', defaultPrompt: DEFAULT_PROMPTS.vision_prompt },
  { key: 'global_analysis_prompt', label: '全局分析提示词', defaultPrompt: DEFAULT_PROMPTS.global_analysis_prompt },
  { key: 'page_translate_prompt', label: '逐页翻译提示词', defaultPrompt: DEFAULT_PROMPTS.page_translate_prompt },
  { key: 'image_gen_prompt', label: '图片生成提示词', defaultPrompt: DEFAULT_PROMPTS.image_gen_prompt }
]

export function getPromptEditorValue(value: string, defaultPrompt: string): string {
  return value || defaultPrompt
}
