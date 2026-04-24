import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildResponsesEndpoint,
  extractImageResult,
  parseSSEEvents
} from '../src/main/provider-api.ts'

test('buildResponsesEndpoint appends responses to a /v1 base URL', () => {
  assert.equal(
    buildResponsesEndpoint('https://api.openai.com/v1'),
    'https://api.openai.com/v1/responses'
  )
})

test('buildResponsesEndpoint keeps an existing responses endpoint unchanged', () => {
  assert.equal(
    buildResponsesEndpoint('https://api.openai.com/v1/responses'),
    'https://api.openai.com/v1/responses'
  )
})

test('parseSSEEvents supports CRLF-delimited event streams', () => {
  const sseText = [
    'event: response.output_item.done',
    'data: {"item":{"type":"image_generation_call","result":"image-1"}}',
    '',
    'event: response.completed',
    'data: {"type":"response.completed"}',
    '',
    ''
  ].join('\r\n')

  const events = parseSSEEvents(sseText)

  assert.equal(events.length, 2)
  assert.equal(events[0]?.event, 'response.output_item.done')
  assert.equal(events[1]?.event, 'response.completed')
})

test('extractImageResult reads image_generation output from CRLF streams', () => {
  const sseText = [
    'event: response.output_item.done',
    'data: {"item":{"type":"image_generation_call","result":"base64-image","revised_prompt":"ok"}}',
    '',
    ''
  ].join('\r\n')

  assert.deepEqual(extractImageResult(sseText), {
    result: 'base64-image',
    revisedPrompt: 'ok'
  })
})
