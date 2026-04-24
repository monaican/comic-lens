export function buildResponsesEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('BASE_URL 为空')
  if (normalized.endsWith('/v1/responses')) return normalized
  if (normalized.endsWith('/v1')) return `${normalized}/responses`
  return `${normalized}/v1/responses`
}

export async function sendImageGenRequest(
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = buildResponsesEndpoint(baseUrl)
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(600000)])
    : AbortSignal.timeout(600000)
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'accept': 'text/event-stream'
    },
    body: JSON.stringify(payload),
    signal: requestSignal
  })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`请求失败，HTTP ${resp.status}: ${detail}`)
  }
  return resp.text()
}

export function buildEditPayload(
  model: string, prompt: string, imageDataUrl: string
): Record<string, unknown> {
  return {
    model,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        { type: 'input_image', image_url: imageDataUrl, detail: 'auto' }
      ]
    }],
    tools: [{ type: 'image_generation', output_format: 'png', action: 'edit' }],
    instructions: 'you are a helpful assistant',
    tool_choice: 'auto',
    stream: true,
    store: false
  }
}

interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

export function parseSSEEvents(sseText: string): SSEEvent[] {
  const events: SSEEvent[] = []
  for (const block of sseText.split(/\r?\n\r?\n/)) {
    const stripped = block.trim()
    if (!stripped) continue
    let eventName = ''
    const dataLines: string[] = []
    for (const line of stripped.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (!dataLines.length) continue
    const dataText = dataLines.join('\n').trim()
    if (dataText === '[DONE]') continue
    const payload = JSON.parse(dataText)
    events.push({ event: eventName || String(payload.type || ''), data: payload })
  }
  return events
}

export function extractImageResult(sseText: string): { result: string; revisedPrompt?: string } {
  for (const event of parseSSEEvents(sseText)) {
    if (event.event === 'response.failed') {
      const error = (event.data.response as Record<string, unknown>)?.error as Record<string, unknown> || {}
      throw new Error(`响应失败: ${error.message || 'unknown'}`)
    }
    if (event.event === 'response.incomplete') {
      const details = (event.data.response as Record<string, unknown>)?.incomplete_details as Record<string, unknown> || {}
      throw new Error(`响应未完成: ${details.reason || 'unknown'}`)
    }
    if (event.event !== 'response.output_item.done') continue
    const item = event.data.item as Record<string, unknown> | undefined
    if (item && item.type === 'image_generation_call') {
      const result = item.result as string
      if (!result) throw new Error('image_generation_call 缺少 result 字段')
      return { result, revisedPrompt: item.revised_prompt as string | undefined }
    }
  }
  throw new Error('SSE 响应中没有 image_generation_call')
}
