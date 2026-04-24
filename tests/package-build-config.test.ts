import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
const workflowText = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf-8')

test('electron-builder unpacks sharp platform runtime packages', () => {
  assert.ok(Array.isArray(packageJson.build?.asarUnpack))
  assert.ok(
    packageJson.build.asarUnpack.includes('node_modules/@img/**'),
    'asarUnpack 应包含 sharp 的 @img 平台运行时目录'
  )
})

test('ci install step keeps optional dependencies for sharp runtime packages', () => {
  assert.match(
    workflowText,
    /pnpm install --include=optional/,
    'Windows 打包前应显式安装 optional dependencies'
  )
})
