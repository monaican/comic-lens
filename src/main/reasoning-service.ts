import { type ModelConfig } from './config'

export async function analyzeGlobal(
  config: ModelConfig,
  visionResults: Record<string, string>,
  systemPrompt: string
): Promise<string> {
  const filenames = Object.keys(visionResults).sort()
  let pagesText = ''
  filenames.forEach((fname, i) => {
    pagesText += `\n### 第${i + 1}页 (${fname})\n${visionResults[fname]}\n`
  })
  const userMessage = `以下是所有页面的识图分析结果：\n${pagesText}`

  if (config.provider === 'anthropic') {
    return callAnthropicReasoning(config, systemPrompt, userMessage)
  }
  return callOpenAIReasoning(config, systemPrompt, userMessage)
}

export async function translatePage(
  config: ModelConfig,
  systemPrompt: string,
  visionResult: string
): Promise<string> {
  const userMessage = `以下是本页的识图分析结果：\n\n${visionResult}`

  if (config.provider === 'anthropic') {
    return callAnthropicReasoning(config, systemPrompt, userMessage)
  }
  return callOpenAIReasoning(config, systemPrompt, userMessage)
}

async function callOpenAIReasoning(
  config: ModelConfig, systemPrompt: string, userMessage: string
): Promise<string> {
  const url = config.base_url.replace(/\/+$/, '') + '/chat/completions'
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    max_tokens: 8192
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300000)
  })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Reasoning请求失败，HTTP ${resp.status}: ${detail}`)
  }
  const result = await resp.json()
  return result.choices[0].message.content
}

async function callAnthropicReasoning(
  config: ModelConfig, systemPrompt: string, userMessage: string
): Promise<string> {
  const url = config.base_url.replace(/\/+$/, '') + '/messages'
  const payload = {
    model: config.model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': config.api_key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300000)
  })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Reasoning请求失败，HTTP ${resp.status}: ${detail}`)
  }
  const result = await resp.json()
  return result.content[0].text
}
