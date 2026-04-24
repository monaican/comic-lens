import { writeFileSync } from 'fs'
import { join } from 'path'
import { readImageAsBase64, ensureOutputDir } from './file-service'
import { buildEditPayload, sendImageGenRequest, extractImageResult } from './provider-api'
import { resizeImageIfNeeded } from './image-utils'
import { type ModelConfig } from './config'

export async function translatePageImage(
  config: ModelConfig,
  imagePath: string,
  prompt: string,
  outputDir: string,
  outputFilename: string
): Promise<string> {
  const { base64, mimeType } = readImageAsBase64(imagePath)
  const resized = await resizeImageIfNeeded(Buffer.from(base64, 'base64'))
  const dataUrl = `data:${mimeType};base64,${resized.toString('base64')}`

  const payload = buildEditPayload(config.model, prompt, dataUrl)
  const sseText = await sendImageGenRequest(config.base_url, config.api_key, payload)
  const { result } = extractImageResult(sseText)

  ensureOutputDir(outputDir)
  const outputPath = join(outputDir, outputFilename)
  writeFileSync(outputPath, Buffer.from(result, 'base64'))
  return outputPath
}
