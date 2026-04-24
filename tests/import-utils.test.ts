import test from 'node:test'
import assert from 'node:assert/strict'

test('assertImportableImages rejects an import folder without supported images', async () => {
  const mod = await import('../src/main/import-utils.ts').catch(() => ({} as Record<string, unknown>))
  const assertImportableImages = mod.assertImportableImages as ((...args: unknown[]) => unknown) | undefined

  assert.throws(
    () => assertImportableImages?.([]),
    /所选文件夹中没有可导入的图片/
  )
})

test('assertImportableImages keeps the discovered images when import is valid', async () => {
  const mod = await import('../src/main/import-utils.ts').catch(() => ({} as Record<string, unknown>))
  const assertImportableImages = mod.assertImportableImages as ((...args: unknown[]) => unknown) | undefined

  assert.deepEqual(
    assertImportableImages?.(['001.png', '002.png']),
    ['001.png', '002.png']
  )
})
