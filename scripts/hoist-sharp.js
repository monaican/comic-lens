const { cpSync, mkdirSync, existsSync, readdirSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const nodeModules = join(root, 'node_modules')
const pnpmDir = join(nodeModules, '.pnpm')

const platform = process.platform
const arch = process.arch

const packages = [
  `@img/sharp-${platform}-${arch}`,
  '@img/colour',
  'detect-libc',
  'semver',
  'bindings',
  'file-uri-to-path',
  'prebuild-install',
  'node-addon-api',
]

function findInPnpm(pkg) {
  const prefix = pkg.replace('/', '+') + '@'
  const match = readdirSync(pnpmDir).find(d => d.startsWith(prefix))
  if (!match) return null
  return join(pnpmDir, match, 'node_modules', ...pkg.split('/'))
}

let hoisted = 0
for (const pkg of packages) {
  const dest = join(nodeModules, ...pkg.split('/'))
  if (existsSync(dest)) {
    console.log(`  skip ${pkg} (already exists)`)
    continue
  }
  const src = findInPnpm(pkg)
  if (!src || !existsSync(src)) {
    console.log(`  skip ${pkg} (not found in .pnpm)`)
    continue
  }
  mkdirSync(join(dest, '..'), { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`  hoisted ${pkg}`)
  hoisted++
}

console.log(`Done. Hoisted ${hoisted} packages.`)
