import sharp from 'sharp'

const MAX_DIMENSION = 1920

export async function resizeImageIfNeeded(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata()
  const { width, height } = metadata
  if (!width || !height) return buffer
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return buffer
  return sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .toBuffer()
}
