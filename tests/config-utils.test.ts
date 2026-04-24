import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeAppConfig } from '../src/main/config-utils.ts'

const defaults = {
  vision_model: { provider: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o' },
  reasoning_model: { provider: 'anthropic', base_url: 'https://api.anthropic.com/v1', api_key: '', model: 'claude-sonnet-4-6' },
  image_gen: { provider: 'openai', base_url: 'https://api.openai.com/v1/responses', api_key: '', model: 'gpt-image-1' },
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

test('mergeAppConfig keeps nested model defaults when stored config is partial', () => {
  const merged = mergeAppConfig(defaults, {
    vision_model: {
      provider: 'openai'
    },
    concurrency: 5
  })

  assert.equal(merged.concurrency, 5)
  assert.equal(merged.vision_model.provider, 'openai')
  assert.equal(merged.vision_model.base_url, defaults.vision_model.base_url)
  assert.equal(merged.vision_model.model, defaults.vision_model.model)
  assert.equal(merged.image_gen.base_url, defaults.image_gen.base_url)
})
