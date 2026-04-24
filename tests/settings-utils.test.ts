import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PROMPTS } from '../src/shared/prompt-defaults.ts'
import { getPromptEditorValue } from '../src/renderer/settings-utils.ts'

test('getPromptEditorValue falls back to the built-in prompt when config value is empty', () => {
  assert.equal(
    getPromptEditorValue('', DEFAULT_PROMPTS.vision_prompt),
    DEFAULT_PROMPTS.vision_prompt
  )
})

test('getPromptEditorValue keeps customized prompt text unchanged', () => {
  assert.equal(
    getPromptEditorValue('自定义提示词', DEFAULT_PROMPTS.vision_prompt),
    '自定义提示词'
  )
})
