import { writeFileSync } from 'fs'
import { join } from 'path'
import { readImageAsBase64, ensureOutputDir } from './file-service'
import { buildEditPayload, sendImageGenRequest, extractImageResult, sendImageEditsRequest } from './provider-api'
import { resizeImageIfNeeded } from './image-utils'
import { type ModelConfig } from './config'

export async function translatePageImage(
  config: ModelConfig,
  imagePath: string,
  prompt: string,
  outputDir: string,
  outputFilename: string,
  signal?: AbortSignal
): Promise<string> {
  const { base64, mimeType } = readImageAsBase64(imagePath)
  const resized = await resizeImageIfNeeded(Buffer.from(base64, 'base64'))

  let resultBase64: string

  if (config.provider === 'openai-images') {
    resultBase64 = await sendImageEditsRequest(
      config.base_url, config.api_key, config.model, prompt, resized, signal
    )
  } else if (!config.provider || config.provider === 'openai') {
    const dataUrl = `data:${mimeType};base64,${resized.toString('base64')}`
    const payload = buildEditPayload(config.model, prompt, dataUrl)
    const sseText = await sendImageGenRequest(config.base_url, config.api_key, payload, signal)
    const { result } = extractImageResult(sseText)
    resultBase64 = result
  } else {
    throw new Error(`图片生成不支持 provider: ${config.provider}`)
  }

  ensureOutputDir(outputDir)
  const outputPath = join(outputDir, outputFilename)
  writeFileSync(outputPath, Buffer.from(resultBase64, 'base64'))
  return outputPath
}
