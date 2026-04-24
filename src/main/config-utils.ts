interface ModelLike {
  provider: string
  base_url: string
  api_key: string
  model: string
}

interface AppConfigLike {
  vision_model: ModelLike
  reasoning_model: ModelLike
  image_gen: ModelLike
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

export function mergeAppConfig<T extends AppConfigLike>(
  defaults: T,
  raw: Partial<T> | null | undefined
): T {
  return {
    ...defaults,
    ...raw,
    vision_model: {
      ...defaults.vision_model,
      ...raw?.vision_model
    },
    reasoning_model: {
      ...defaults.reasoning_model,
      ...raw?.reasoning_model
    },
    image_gen: {
      ...defaults.image_gen,
      ...raw?.image_gen
    }
  }
}
