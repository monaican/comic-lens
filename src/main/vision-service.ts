import { readImageAsBase64 } from './file-service'
import { type ModelConfig } from './config'
import { resizeImageIfNeeded } from './image-utils'

export async function analyzePageVision(
  config: ModelConfig,
  imagePath: string,
  prompt: string
): Promise<string> {
  const { base64, mimeType } = readImageAsBase64(imagePath)
  const resized = await resizeImageIfNeeded(Buffer.from(base64, 'base64'))
  const b64 = resized.toString('base64')
  const dataUrl = `data:${mimeType};base64,${b64}`

  if (config.provider === 'anthropic') {
    return callAnthropicVision(config, prompt, b64, mimeType)
  }
  return callOpenAIVision(config, prompt, dataUrl)
}

async function callOpenAIVision(config: ModelConfig, prompt: string, dataUrl: string): Promise<string> {
  const url = config.base_url.replace(/\/+$/, '') + '/chat/completions'
  const payload = {
    model: config.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
      ]
    }],
    max_tokens: 4096
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000)
  })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Vision请求失败，HTTP ${resp.status}: ${detail}`)
  }
  const result = await resp.json()
  return result.choices[0].message.content
}

async function callAnthropicVision(
  config: ModelConfig, prompt: string, b64Data: string, mimeType: string
): Promise<string> {
  const url = config.base_url.replace(/\/+$/, '') + '/messages'
  const payload = {
    model: config.model,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64Data } },
        { type: 'text', text: prompt }
      ]
    }]
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': config.api_key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000)
  })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Vision请求失败，HTTP ${resp.status}: ${detail}`)
  }
  const result = await resp.json()
  return result.content[0].text
}
