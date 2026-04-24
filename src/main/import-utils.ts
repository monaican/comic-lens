export function assertImportableImages<T>(images: T[]): T[] {
  if (images.length === 0) {
    throw new Error('所选文件夹中没有可导入的图片')
  }
  return images
}
