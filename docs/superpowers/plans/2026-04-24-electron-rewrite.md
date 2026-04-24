# Comics Translate Electron 重写实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Python/PySide6 漫画翻译桌面应用重写为 Electron + React + TailwindCSS + DaisyUI 应用，保留核心四阶段翻译流水线，重新设计 UI/UX，新增手动翻译模式。

**Architecture:** Electron 双进程架构。Main 进程负责 SQLite 数据库、文件系统、API 调用和翻译流水线编排。Renderer 进程是 React SPA，通过 IPC bridge 与主进程通信。单窗口 + Tab 模式，工作区采用三栏 PDF 阅读器式布局。

**Tech Stack:** electron-vite, React 18, TypeScript, TailwindCSS, DaisyUI, better-sqlite3

---

## File Structure

```
comics-translate/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.js
├── postcss.config.js
├── CLAUDE.md
├── docs/superpowers/                    # 保留设计文档
├── src/
│   ├── main/                            # Electron 主进程
│   │   ├── index.ts                     # 主进程入口，窗口创建
│   │   ├── ipc.ts                       # IPC handler 注册总入口
│   │   ├── database.ts                  # better-sqlite3 封装
│   │   ├── config.ts                    # AppConfig 读写 + 默认提示词
│   │   ├── file-service.ts              # 图片扫描、文件 I/O
│   │   ├── vision-service.ts            # 视觉模型 API 调用
│   │   ├── reasoning-service.ts         # 推理模型 API 调用
│   │   ├── image-gen-service.ts         # 图片生成 API（SSE）
│   │   ├── provider-api.ts              # OpenAI Responses API 封装
│   │   ├── translate-pipeline.ts        # 四阶段翻译流水线编排
│   │   └── semaphore.ts                 # 并发限制器
│   ├── preload/
│   │   └── index.ts                     # contextBridge IPC 暴露
│   └── renderer/                        # React SPA
│       ├── index.html
│       ├── main.tsx                     # React 入口
│       ├── App.tsx                      # 根组件，Tab 管理
│       ├── types.ts                     # 共享 TypeScript 类型
│       ├── hooks/
│       │   ├── useProjects.ts           # 项目 CRUD hook
│       │   ├── usePages.ts              # 页面数据 hook
│       │   ├── useConfig.ts             # 配置读写 hook
│       │   └── useTranslation.ts        # 翻译进度监听 hook
│       ├── components/
│       │   ├── TitleBar.tsx             # 自定义标题栏
│       │   ├── TabBar.tsx               # Tab 栏（书架/设置/工作区）
│       │   ├── Bookshelf.tsx            # 书架页
│       │   ├── ComicCard.tsx            # 漫画卡片
│       │   ├── ImportModal.tsx          # 导入漫画对话框
│       │   ├── Workspace.tsx            # 工作区页（三栏布局容器）
│       │   ├── ThumbnailList.tsx        # 左栏缩略图列表
│       │   ├── ImageViewer.tsx          # 中栏大图查看器
│       │   ├── DetailPanel.tsx          # 右栏详情面板
│       │   ├── WorkspaceToolbar.tsx     # 工作区顶部信息栏
│       │   ├── PhaseConfirmBar.tsx      # 手动模式阶段确认栏
│       │   ├── Settings.tsx             # 设置页
│       │   └── Toast.tsx                # Toast 通知
│       └── assets/
│           └── index.css                # TailwindCSS 入口
└── resources/
    └── icon.png                         # 应用图标
```

---

## Task 1: 项目迁移与 Electron 脚手架初始化

**Files:**
- Move: 所有 Python 文件移至 `D:/Project/python/comics-translate-legacy/`
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `tailwind.config.js`, `postcss.config.js`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/assets/index.css`

- [ ] **Step 1: 移动旧 Python 项目**

```bash
mkdir -p "D:/Project/python/comics-translate-legacy"
# 移动 Python 源码（保留 docs、.git、CLAUDE.md、data、output）
mv config.py log.py main.py requirements.txt "D:/Project/python/comics-translate-legacy/"
mv models services storage tests ui workers "D:/Project/python/comics-translate-legacy/"
mv __pycache__ .pytest_cache "D:/Project/python/comics-translate-legacy/" 2>/dev/null || true
```

- [ ] **Step 2: 初始化 npm 项目并安装依赖**

```bash
pnpm init
pnpm add electron electron-vite react react-dom better-sqlite3
pnpm add -D typescript @types/react @types/react-dom @types/better-sqlite3 tailwindcss @tailwindcss/vite postcss daisyui @electron-toolkit/preload @electron-toolkit/utils vite @vitejs/plugin-react
pnpm add lucide-react
```

- [ ] **Step 3: 创建 electron.vite.config.ts**

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 4: 创建 tsconfig 文件**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "outDir": "out",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "jsx": "react-jsx",
    "outDir": "out",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*"]
}
```

- [ ] **Step 5: 创建 TailwindCSS 入口**

`src/renderer/assets/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 6: 创建主进程入口**

`src/main/index.ts`:
```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
```

- [ ] **Step 7: 创建 preload 脚本骨架**

`src/preload/index.ts`:
```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // 后续 Task 逐步填充
})
```

- [ ] **Step 8: 创建 renderer 入口**

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>漫画翻译</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/renderer/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/App.tsx`:
```tsx
function App(): React.ReactElement {
  return <div data-theme="light" className="h-screen">漫画翻译</div>
}

export default App
```

- [ ] **Step 9: 更新 package.json scripts**

在 `package.json` 中添加：
```json
{
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  }
}
```

- [ ] **Step 10: 验证应用启动**

```bash
npm run dev
```

预期：Electron 窗口打开，显示"漫画翻译"文字，无边框窗口。

- [ ] **Step 11: 提交**

```bash
git add -A
git commit -m "feat: initialize electron-vite project with React + TailwindCSS + DaisyUI"
```

---

## Task 2: 共享类型定义 + 数据库服务

**Files:**
- Create: `src/renderer/types.ts`
- Create: `src/main/database.ts`

- [ ] **Step 1: 创建共享类型定义**

`src/renderer/types.ts`:
```ts
export interface ModelConfig {
  provider: string
  base_url: string
  api_key: string
  model: string
}

export interface AppConfig {
  vision_model: ModelConfig
  reasoning_model: ModelConfig
  image_gen: ModelConfig
  concurrency: number
  max_retries: number
  output_base_dir: string
  default_source_lang: string
  default_target_lang: string
  vision_prompt: string
  global_analysis_prompt: string
  page_translate_prompt: string
  image_gen_prompt: string
}

export interface Project {
  id: string
  name: string
  source_dir: string
  output_dir: string
  source_lang: string
  target_lang: string
  master_prompt: string
  status: string
  translate_mode: string
  current_phase: string
  phase_confirmed: number
  created_at: string
  updated_at: string
}

export interface Page {
  id: string
  project_id: string
  filename: string
  page_order: number
  summary: string
  vision_result: string
  refined_translation: string
  final_prompt: string
  status: string
  error_message: string
  retry_count: number
  edited: number
  created_at: string
  updated_at: string
}

export type ProjectStatus = 'idle' | 'analyzing' | 'translating' | 'completed' | 'failed'
export type PageStatus = 'pending' | 'analyzing' | 'analyzed' | 'translating' | 'completed' | 'failed'
export type TranslateMode = 'auto' | 'manual'
export type Phase = 'vision' | 'analysis' | 'translation' | 'image_gen'

export interface TranslateProgress {
  pageId: string
  phase: Phase
  status: string
}

export interface PhaseCompleted {
  phase: Phase
  nextPhase: Phase | null
}
```

- [ ] **Step 2: 创建数据库服务**

`src/main/database.ts`:
```ts
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database

function now(): string {
  return new Date().toISOString()
}

export function initDatabase(): void {
  const dbPath = join(app.getAppPath(), 'data', 'comics.db')
  const dir = join(app.getAppPath(), 'data')
  require('fs').mkdirSync(dir, { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_dir TEXT NOT NULL,
      output_dir TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      master_prompt TEXT DEFAULT '',
      status TEXT DEFAULT 'idle',
      translate_mode TEXT DEFAULT 'auto',
      current_phase TEXT DEFAULT '',
      phase_confirmed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      page_order INTEGER NOT NULL,
      summary TEXT DEFAULT '',
      vision_result TEXT DEFAULT '',
      refined_translation TEXT DEFAULT '',
      final_prompt TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      error_message TEXT DEFAULT '',
      retry_count INTEGER DEFAULT 0,
      edited INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export function createProject(
  name: string, sourceDir: string, outputDir: string,
  sourceLang: string, targetLang: string, translateMode: string
): string {
  const id = randomUUID().replace(/-/g, '')
  const ts = now()
  db.prepare(
    `INSERT INTO projects (id,name,source_dir,output_dir,source_lang,target_lang,translate_mode,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id, name, sourceDir, outputDir, sourceLang, targetLang, translateMode, ts, ts)
  return id
}

export function getProject(id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM projects WHERE id=?').get(id) as Record<string, unknown> | undefined
}

export function listProjects(): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]
}

export function updateProject(id: string, fields: Record<string, unknown>): void {
  fields.updated_at = now()
  const keys = Object.keys(fields)
  const sets = keys.map(k => `${k}=?`).join(', ')
  db.prepare(`UPDATE projects SET ${sets} WHERE id=?`).run(...keys.map(k => fields[k]), id)
}

export function deleteProject(id: string): void {
  db.prepare('DELETE FROM projects WHERE id=?').run(id)
}

export function createPage(projectId: string, filename: string, pageOrder: number): string {
  const id = randomUUID().replace(/-/g, '')
  const ts = now()
  db.prepare(
    `INSERT INTO pages (id,project_id,filename,page_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id, projectId, filename, pageOrder, ts, ts)
  return id
}

export function getPage(id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM pages WHERE id=?').get(id) as Record<string, unknown> | undefined
}

export function listPages(projectId: string): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM pages WHERE project_id=? ORDER BY page_order').all(projectId) as Record<string, unknown>[]
}

export function updatePage(id: string, fields: Record<string, unknown>): void {
  fields.updated_at = now()
  const keys = Object.keys(fields)
  const sets = keys.map(k => `${k}=?`).join(', ')
  db.prepare(`UPDATE pages SET ${sets} WHERE id=?`).run(...keys.map(k => fields[k]), id)
}

export function closeDatabase(): void {
  if (db) db.close()
}
```

- [ ] **Step 3: 验证编译通过**

```bash
pnpm run dev
```

预期：应用正常启动，无 TypeScript 编译错误。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add shared types and database service"
```

---

## Task 3: 配置服务 + 文件服务

**Files:**
- Create: `src/main/config.ts`
- Create: `src/main/file-service.ts`

- [ ] **Step 1: 创建配置服务**

`src/main/config.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface ModelConfig {
  provider: string
  base_url: string
  api_key: string
  model: string
}

export interface AppConfig {
  vision_model: ModelConfig
  reasoning_model: ModelConfig
  image_gen: ModelConfig
  concurrency: number
  max_retries: number
  output_base_dir: string
  default_source_lang: string
  default_target_lang: string
  vision_prompt: string
  global_analysis_prompt: string
  page_translate_prompt: string
  image_gen_prompt: string
}

export const DEFAULT_VISION_PROMPT = `你是一个漫画分析助手。请分析这张漫画图片：
1. 用一两句话简短描述这张漫画主要讲了什么
2. 按格子（面板）顺序，描述每一句对话/文字的位置和原文内容

格式示例：
这张漫画描述了……

第一格
右侧对话框："原文内容"
左侧对话框："原文内容"

第二格
顶部旁白："原文内容"

请用自然语言描述位置（如：右侧对话框、左上角旁白、粗体大字等），不需要精确坐标。
源语言为：{source_lang}`

export const DEFAULT_GLOBAL_ANALYSIS_PROMPT = `你是一个专业的漫画翻译审校助手。

我会提供一部漫画所有页面的识图分析结果（包含每页的内容描述和原文对话）。

请你通读所有页面内容，生成一个"总控提示词"，包含：
- 作品主题和故事背景概述
- 人物名字的统一翻译（如有）
- 地名的统一翻译（如有）
- 语气风格要求（如：热血少年漫、日常轻松、严肃剧情等）
- 特殊术语或专有名词的统一翻译
- 其他需要注意的翻译一致性问题

只输出总控提示词内容，不要做任何翻译。

源语言：{source_lang}
目标语言：{target_lang}`

export const DEFAULT_PAGE_TRANSLATE_PROMPT = `你是一个专业的漫画翻译助手。

以下是本作品的总控提示词（翻译注意事项）：
{master_prompt}

请根据以上注意事项，将下面这一页漫画的识图分析结果中的对话/文字翻译为{target_lang}。
保持原有的位置描述格式（如"第一格 右侧对话框"等），只替换对话/文字内容为译文。
不要包含漫画内容描述（如"这张漫画描述了……"），只保留位置+译文。

源语言：{source_lang}
目标语言：{target_lang}`

export const DEFAULT_IMAGE_GEN_PROMPT = '根据图片,画一个图片，在不改变排版和字体的情况下将{source_lang}改为{target_lang},参考译文：\n{refined}'

function getConfigPath(): string {
  return join(app.getAppPath(), 'data', 'config.json')
}

function defaultConfig(): AppConfig {
  return {
    vision_model: { provider: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o' },
    reasoning_model: { provider: 'anthropic', base_url: 'https://api.anthropic.com/v1', api_key: '', model: 'claude-sonnet-4-6' },
    image_gen: { provider: '', base_url: '', api_key: '', model: 'gpt-image-2' },
    concurrency: 3,
    max_retries: 3,
    output_base_dir: 'output',
    default_source_lang: '日本語',
    default_target_lang: '简体中文',
    vision_prompt: '',
    global_analysis_prompt: '',
    page_translate_prompt: '',
    image_gen_prompt: ''
  }
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    const cfg = defaultConfig()
    saveConfig(cfg)
    return cfg
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  return { ...defaultConfig(), ...raw }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = join(app.getAppPath(), 'data')
  mkdirSync(dir, { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getVisionPrompt(config: AppConfig): string {
  return config.vision_prompt || DEFAULT_VISION_PROMPT
}

export function getGlobalAnalysisPrompt(config: AppConfig): string {
  return config.global_analysis_prompt || DEFAULT_GLOBAL_ANALYSIS_PROMPT
}

export function getPageTranslatePrompt(config: AppConfig): string {
  return config.page_translate_prompt || DEFAULT_PAGE_TRANSLATE_PROMPT
}

export function getImageGenPrompt(config: AppConfig): string {
  return config.image_gen_prompt || DEFAULT_IMAGE_GEN_PROMPT
}
```

- [ ] **Step 2: 创建文件服务**

`src/main/file-service.ts`:
```ts
import { readdirSync, readFileSync, mkdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])

export function scanImages(directory: string): string[] {
  try {
    const stat = statSync(directory)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }
  const files = readdirSync(directory)
    .filter(f => {
      const ext = extname(f).toLowerCase()
      return IMAGE_EXTENSIONS.has(ext)
    })
    .sort()
  return files.map(f => join(directory, f))
}

export function readImageAsBase64(imagePath: string): { base64: string; mimeType: string } {
  const ext = extname(imagePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  }
  const mimeType = mimeMap[ext] || 'image/png'
  const buffer = readFileSync(imagePath)
  const base64 = buffer.toString('base64')
  return { base64, mimeType }
}

export function ensureOutputDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

export function getCoverPath(directory: string): string | null {
  const images = scanImages(directory)
  return images.length > 0 ? images[0] : null
}

export function readImageBuffer(imagePath: string): Buffer {
  return readFileSync(imagePath)
}
```

- [ ] **Step 3: 验证编译通过**

```bash
pnpm run dev
```

预期：应用正常启动，无编译错误。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add config service and file service"
```

---

## Task 4: API 服务层（Vision + Reasoning + ImageGen）

**Files:**
- Create: `src/main/semaphore.ts`
- Create: `src/main/vision-service.ts`
- Create: `src/main/reasoning-service.ts`
- Create: `src/main/provider-api.ts`
- Create: `src/main/image-gen-service.ts`

- [ ] **Step 1: 创建并发限制器**

`src/main/semaphore.ts`:
```ts
export class Semaphore {
  private queue: (() => void)[] = []
  private running = 0

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) {
      this.running++
      next()
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}
```

- [ ] **Step 2: 创建 Vision 服务**

`src/main/vision-service.ts`:
```ts
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
```

同时创建 `src/main/image-utils.ts`:
```ts
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
```

注意：需要安装 sharp：
```bash
pnpm add sharp
```

如果不想引入 sharp 依赖，可以跳过 resize 逻辑直接返回原 buffer，后续再加。

- [ ] **Step 3: 创建 Reasoning 服务**

`src/main/reasoning-service.ts`:
```ts
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
```

- [ ] **Step 4: 创建 Provider API（图片生成 SSE）**

`src/main/provider-api.ts`:
```ts
export function buildResponsesEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('BASE_URL 为空')
  if (normalized.endsWith('/v1/responses')) return normalized
  return `${normalized}/v1/responses`
}

export async function sendImageGenRequest(
  baseUrl: string, apiKey: string, payload: Record<string, unknown>
): Promise<string> {
  const endpoint = buildResponsesEndpoint(baseUrl)
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'accept': 'text/event-stream'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(600000)
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
  for (const block of sseText.split('\n\n')) {
    const stripped = block.trim()
    if (!stripped) continue
    let eventName = ''
    const dataLines: string[] = []
    for (const line of stripped.split('\n')) {
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
```

- [ ] **Step 5: 创建图片生成服务**

`src/main/image-gen-service.ts`:
```ts
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
```

- [ ] **Step 6: 验证编译通过**

```bash
pnpm run dev
```

预期：应用正常启动，无编译错误。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add vision, reasoning, image-gen services and semaphore"
```

---

## Task 5: 翻译流水线编排

**Files:**
- Create: `src/main/translate-pipeline.ts`

- [ ] **Step 1: 创建翻译流水线**

`src/main/translate-pipeline.ts`:
```ts
import { BrowserWindow } from 'electron'
import { Semaphore } from './semaphore'
import { analyzePageVision } from './vision-service'
import { analyzeGlobal, translatePage } from './reasoning-service'
import { translatePageImage } from './image-gen-service'
import {
  loadConfig, getVisionPrompt, getGlobalAnalysisPrompt,
  getPageTranslatePrompt, getImageGenPrompt, type AppConfig, type ModelConfig
} from './config'
import {
  getProject, listPages, updateProject, updatePage
} from './database'
import { join, basename } from 'path'

type Phase = 'vision' | 'analysis' | 'translation' | 'image_gen'

interface PipelineState {
  projectId: string
  stopped: boolean
}

const activePipelines = new Map<string, PipelineState>()

function send(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>, maxRetries: number, pageId: string, win: BrowserWindow
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const delay = Math.pow(2, attempt) * 1000
      send(win, 'translate:page-progress', {
        pageId, phase: '', status: `重试中 (${attempt + 1}/${maxRetries})...`
      })
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

export async function startTranslation(projectId: string, win: BrowserWindow): Promise<void> {
  const config = loadConfig()
  const project = getProject(projectId)
  if (!project) throw new Error('项目不存在')

  const state: PipelineState = { projectId, stopped: false }
  activePipelines.set(projectId, state)

  const pages = listPages(projectId)
  const semaphore = new Semaphore(config.concurrency)
  const isManual = project.translate_mode === 'manual'

  try {
    // Phase 1: Vision
    const needsVision = pages.filter(p => !p.vision_result)
    if (needsVision.length > 0) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'vision' })
      send(win, 'translate:phase-started', { phase: 'vision' })

      const visionPrompt = getVisionPrompt(config).replace('{source_lang}', project.source_lang as string)

      await Promise.allSettled(needsVision.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'vision', status: '分析中' })
          updatePage(pageId, { status: 'analyzing' })
          try {
            const imagePath = join(project.source_dir as string, page.filename as string)
            const result = await retryWithBackoff(
              () => analyzePageVision(config.vision_model, imagePath, visionPrompt),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { vision_result: result, status: 'analyzed' })
            send(win, 'translate:page-finished', { pageId, phase: 'vision', result })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'vision', error: msg })
          }
        })
      ))

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'vision', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'vision', nextPhase: 'analysis' })
        return
      }
    }

    // Phase 2: Global Analysis
    if (!project.master_prompt) {
      updateProject(projectId, { status: 'analyzing', current_phase: 'analysis' })
      send(win, 'translate:phase-started', { phase: 'analysis' })

      const allPages = listPages(projectId)
      const visionResults: Record<string, string> = {}
      for (const p of allPages) {
        if (p.vision_result) visionResults[p.filename as string] = p.vision_result as string
      }

      const globalPrompt = getGlobalAnalysisPrompt(config)
        .replace('{source_lang}', project.source_lang as string)
        .replace('{target_lang}', project.target_lang as string)

      const masterPrompt = await retryWithBackoff(
        () => analyzeGlobal(config.reasoning_model, visionResults, globalPrompt),
        config.max_retries, 'global', win
      )
      updateProject(projectId, { master_prompt: masterPrompt })
      send(win, 'translate:phase-completed', { phase: 'analysis', nextPhase: 'translation' })

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'analysis', phase_confirmed: 0 })
        return
      }
    }

    // Phase 3: Page Translation
    const updatedProject = getProject(projectId)!
    const needsTranslation = listPages(projectId).filter(p => p.vision_result && !p.refined_translation)
    if (needsTranslation.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'translation' })
      send(win, 'translate:phase-started', { phase: 'translation' })

      const pagePrompt = getPageTranslatePrompt(config)
        .replace('{master_prompt}', updatedProject.master_prompt as string)
        .replace('{source_lang}', updatedProject.source_lang as string)
        .replace(/{target_lang}/g, updatedProject.target_lang as string)

      await Promise.allSettled(needsTranslation.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'translation', status: '翻译中' })
          updatePage(pageId, { status: 'translating' })
          try {
            const result = await retryWithBackoff(
              () => translatePage(config.reasoning_model, pagePrompt, page.vision_result as string),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { refined_translation: result, status: 'analyzed' })
            send(win, 'translate:page-finished', { pageId, phase: 'translation', result })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'translation', error: msg })
          }
        })
      ))

      if (state.stopped) return
      if (isManual) {
        updateProject(projectId, { current_phase: 'translation', phase_confirmed: 0 })
        send(win, 'translate:phase-completed', { phase: 'translation', nextPhase: 'image_gen' })
        return
      }
    }

    // Phase 4: Image Generation
    const latestProject = getProject(projectId)!
    const needsImageGen = listPages(projectId).filter(p => p.refined_translation && p.status !== 'completed')
    if (needsImageGen.length > 0) {
      updateProject(projectId, { status: 'translating', current_phase: 'image_gen' })
      send(win, 'translate:phase-started', { phase: 'image_gen' })

      const outputDir = join(
        config.output_base_dir,
        latestProject.name as string
      )

      await Promise.allSettled(needsImageGen.map(page =>
        semaphore.run(async () => {
          if (state.stopped) return
          const pageId = page.id as string
          send(win, 'translate:page-progress', { pageId, phase: 'image_gen', status: '生成中' })
          updatePage(pageId, { status: 'translating' })

          const finalPrompt = (page.final_prompt as string) || getImageGenPrompt(config)
            .replace('{source_lang}', latestProject.source_lang as string)
            .replace('{target_lang}', latestProject.target_lang as string)
            .replace('{refined}', page.refined_translation as string)

          if (!page.final_prompt) {
            updatePage(pageId, { final_prompt: finalPrompt })
          }

          try {
            const imagePath = join(latestProject.source_dir as string, page.filename as string)
            await retryWithBackoff(
              () => translatePageImage(
                config.image_gen, imagePath, finalPrompt,
                outputDir, page.filename as string
              ),
              config.max_retries, pageId, win
            )
            updatePage(pageId, { status: 'completed' })
            send(win, 'translate:page-finished', { pageId, phase: 'image_gen', result: 'done' })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            updatePage(pageId, { status: 'failed', error_message: msg })
            send(win, 'translate:page-error', { pageId, phase: 'image_gen', error: msg })
          }
        })
      ))
    }

    if (!state.stopped) {
      updateProject(projectId, { status: 'completed', current_phase: '' })
      send(win, 'translate:all-finished', { projectId })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateProject(projectId, { status: 'failed' })
    send(win, 'translate:pipeline-error', { projectId, error: msg })
  } finally {
    activePipelines.delete(projectId)
  }
}

export function stopTranslation(projectId: string): void {
  const state = activePipelines.get(projectId)
  if (state) state.stopped = true
}

export async function confirmPhase(projectId: string, win: BrowserWindow): Promise<void> {
  updateProject(projectId, { phase_confirmed: 1 })
  await startTranslation(projectId, win)
}

export async function retryFailed(projectId: string, win: BrowserWindow): Promise<void> {
  const pages = listPages(projectId)
  for (const page of pages) {
    if (page.status === 'failed') {
      updatePage(page.id as string, { status: 'pending', error_message: '', retry_count: 0 })
    }
  }
  await startTranslation(projectId, win)
}
```

- [ ] **Step 2: 验证编译通过**

```bash
pnpm run dev
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add translation pipeline orchestration"
```

---

## Task 6: IPC Handler 注册 + Preload Bridge

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 创建 IPC handler 注册**

`src/main/ipc.ts`:
```ts
import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  createProject, getProject, listProjects, updateProject, deleteProject,
  createPage, getPage, listPages, updatePage
} from './database'
import { loadConfig, saveConfig, type AppConfig } from './config'
import { scanImages, getCoverPath, readImageAsBase64 } from './file-service'
import { startTranslation, stopTranslation, confirmPhase, retryFailed } from './translate-pipeline'
import { basename } from 'path'

export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('db:projects:list', () => listProjects())
  ipcMain.handle('db:projects:get', (_, id: string) => getProject(id))
  ipcMain.handle('db:projects:create', (_, data: {
    name: string; sourceDir: string; outputDir: string;
    sourceLang: string; targetLang: string; translateMode: string
  }) => {
    const pid = createProject(
      data.name, data.sourceDir, data.outputDir,
      data.sourceLang, data.targetLang, data.translateMode
    )
    const images = scanImages(data.sourceDir)
    images.forEach((imgPath, i) => {
      createPage(pid, basename(imgPath), i)
    })
    return pid
  })
  ipcMain.handle('db:projects:update', (_, id: string, fields: Record<string, unknown>) => {
    updateProject(id, fields)
  })
  ipcMain.handle('db:projects:delete', (_, id: string) => deleteProject(id))

  // Pages
  ipcMain.handle('db:pages:list', (_, projectId: string) => listPages(projectId))
  ipcMain.handle('db:pages:get', (_, id: string) => getPage(id))
  ipcMain.handle('db:pages:update', (_, id: string, fields: Record<string, unknown>) => {
    updatePage(id, fields)
  })

  // Config
  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:save', (_, config: AppConfig) => saveConfig(config))

  // File operations
  ipcMain.handle('file:select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('file:scan-images', (_, dir: string) => scanImages(dir))
  ipcMain.handle('file:get-cover', (_, dir: string) => getCoverPath(dir))
  ipcMain.handle('file:read-image', (_, path: string) => readImageAsBase64(path))

  // Translation control
  ipcMain.handle('translate:start', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    startTranslation(projectId, win)
  })
  ipcMain.handle('translate:stop', (_, projectId: string) => stopTranslation(projectId))
  ipcMain.handle('translate:confirm-phase', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    confirmPhase(projectId, win)
  })
  ipcMain.handle('translate:retry-failed', (event, projectId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    retryFailed(projectId, win)
  })

  // Window controls
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
```

- [ ] **Step 2: 更新主进程入口**

在 `src/main/index.ts` 中，`app.whenReady()` 回调内添加：

```ts
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc'

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  closeDatabase()
  app.quit()
})
```

- [ ] **Step 3: 更新 preload 脚本**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  projects: {
    list: () => ipcRenderer.invoke('db:projects:list'),
    get: (id: string) => ipcRenderer.invoke('db:projects:get', id),
    create: (data: Record<string, string>) => ipcRenderer.invoke('db:projects:create', data),
    update: (id: string, fields: Record<string, unknown>) => ipcRenderer.invoke('db:projects:update', id, fields),
    delete: (id: string) => ipcRenderer.invoke('db:projects:delete', id)
  },
  pages: {
    list: (projectId: string) => ipcRenderer.invoke('db:pages:list', projectId),
    get: (id: string) => ipcRenderer.invoke('db:pages:get', id),
    update: (id: string, fields: Record<string, unknown>) => ipcRenderer.invoke('db:pages:update', id, fields)
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config)
  },
  file: {
    selectFolder: () => ipcRenderer.invoke('file:select-folder'),
    scanImages: (dir: string) => ipcRenderer.invoke('file:scan-images', dir),
    getCover: (dir: string) => ipcRenderer.invoke('file:get-cover', dir),
    readImage: (path: string) => ipcRenderer.invoke('file:read-image', path)
  },
  translate: {
    start: (projectId: string) => ipcRenderer.invoke('translate:start', projectId),
    stop: (projectId: string) => ipcRenderer.invoke('translate:stop', projectId),
    confirmPhase: (projectId: string) => ipcRenderer.invoke('translate:confirm-phase', projectId),
    retryFailed: (projectId: string) => ipcRenderer.invoke('translate:retry-failed', projectId),
    onPageProgress: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-progress', (_, data) => cb(data))
    },
    onPageFinished: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-finished', (_, data) => cb(data))
    },
    onPageError: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:page-error', (_, data) => cb(data))
    },
    onPhaseStarted: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:phase-started', (_, data) => cb(data))
    },
    onPhaseCompleted: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:phase-completed', (_, data) => cb(data))
    },
    onAllFinished: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:all-finished', (_, data) => cb(data))
    },
    onPipelineError: (cb: (data: unknown) => void) => {
      ipcRenderer.on('translate:pipeline-error', (_, data) => cb(data))
    },
    removeAllListeners: () => {
      const channels = [
        'translate:page-progress', 'translate:page-finished', 'translate:page-error',
        'translate:phase-started', 'translate:phase-completed',
        'translate:all-finished', 'translate:pipeline-error'
      ]
      channels.forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 4: 添加 window.api 类型声明**

在 `src/renderer/types.ts` 末尾追加：

```ts
declare global {
  interface Window {
    api: {
      projects: {
        list: () => Promise<Project[]>
        get: (id: string) => Promise<Project | undefined>
        create: (data: Record<string, string>) => Promise<string>
        update: (id: string, fields: Record<string, unknown>) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      pages: {
        list: (projectId: string) => Promise<Page[]>
        get: (id: string) => Promise<Page | undefined>
        update: (id: string, fields: Record<string, unknown>) => Promise<void>
      }
      config: {
        get: () => Promise<AppConfig>
        save: (config: AppConfig) => Promise<void>
      }
      file: {
        selectFolder: () => Promise<string | null>
        scanImages: (dir: string) => Promise<string[]>
        getCover: (dir: string) => Promise<string | null>
        readImage: (path: string) => Promise<{ base64: string; mimeType: string }>
      }
      translate: {
        start: (projectId: string) => Promise<void>
        stop: (projectId: string) => Promise<void>
        confirmPhase: (projectId: string) => Promise<void>
        retryFailed: (projectId: string) => Promise<void>
        onPageProgress: (cb: (data: TranslateProgress) => void) => void
        onPageFinished: (cb: (data: { pageId: string; phase: Phase; result: string }) => void) => void
        onPageError: (cb: (data: { pageId: string; phase: Phase; error: string }) => void) => void
        onPhaseStarted: (cb: (data: { phase: Phase }) => void) => void
        onPhaseCompleted: (cb: (data: PhaseCompleted) => void) => void
        onAllFinished: (cb: (data: { projectId: string }) => void) => void
        onPipelineError: (cb: (data: { projectId: string; error: string }) => void) => void
        removeAllListeners: () => void
      }
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
    }
  }
}
```

- [ ] **Step 5: 验证编译通过**

```bash
pnpm run dev
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add IPC handlers and preload bridge"
```

---

## Task 7: React Hooks 层

**Files:**
- Create: `src/renderer/hooks/useProjects.ts`
- Create: `src/renderer/hooks/usePages.ts`
- Create: `src/renderer/hooks/useConfig.ts`
- Create: `src/renderer/hooks/useTranslation.ts`

- [ ] **Step 1: 创建 useProjects hook**

`src/renderer/hooks/useProjects.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await window.api.projects.list()
    setProjects(list)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createProject = useCallback(async (data: Record<string, string>) => {
    const id = await window.api.projects.create(data)
    await refresh()
    return id
  }, [refresh])

  const deleteProject = useCallback(async (id: string) => {
    await window.api.projects.delete(id)
    await refresh()
  }, [refresh])

  const updateProject = useCallback(async (id: string, fields: Record<string, unknown>) => {
    await window.api.projects.update(id, fields)
    await refresh()
  }, [refresh])

  return { projects, loading, refresh, createProject, deleteProject, updateProject }
}
```

- [ ] **Step 2: 创建 usePages hook**

`src/renderer/hooks/usePages.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { Page } from '../types'

export function usePages(projectId: string | null) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!projectId) { setPages([]); return }
    setLoading(true)
    const list = await window.api.pages.list(projectId)
    setPages(list)
    setLoading(false)
  }, [projectId])

  useEffect(() => { refresh() }, [refresh])

  const updatePage = useCallback(async (id: string, fields: Record<string, unknown>) => {
    await window.api.pages.update(id, fields)
    await refresh()
  }, [refresh])

  return { pages, loading, refresh, updatePage }
}
```

- [ ] **Step 3: 创建 useConfig hook**

`src/renderer/hooks/useConfig.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { AppConfig } from '../types'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const cfg = await window.api.config.get()
    setConfig(cfg)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveConfig = useCallback(async (cfg: AppConfig) => {
    await window.api.config.save(cfg)
    setConfig(cfg)
  }, [])

  return { config, loading, refresh, saveConfig }
}
```

- [ ] **Step 4: 创建 useTranslation hook**

`src/renderer/hooks/useTranslation.ts`:
```ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Phase, TranslateProgress, PhaseCompleted } from '../types'

interface TranslationState {
  isRunning: boolean
  currentPhase: Phase | null
  phaseCompleted: PhaseCompleted | null
  pageStatuses: Map<string, { phase: Phase; status: string }>
  errors: Map<string, string>
  finished: boolean
  pipelineError: string | null
  elapsedMs: number
}

export function useTranslation(projectId: string | null, onUpdate?: () => void) {
  const [state, setState] = useState<TranslationState>({
    isRunning: false,
    currentPhase: null,
    phaseCompleted: null,
    pageStatuses: new Map(),
    errors: new Map(),
    finished: false,
    pipelineError: null,
    elapsedMs: 0
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, elapsedMs: Date.now() - startTimeRef.current }))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!projectId) return

    const handleProgress = (data: TranslateProgress) => {
      setState(prev => {
        const newStatuses = new Map(prev.pageStatuses)
        newStatuses.set(data.pageId, { phase: data.phase, status: data.status })
        return { ...prev, pageStatuses: newStatuses }
      })
    }

    const handleFinished = (data: { pageId: string; phase: Phase }) => {
      setState(prev => {
        const newStatuses = new Map(prev.pageStatuses)
        newStatuses.set(data.pageId, { phase: data.phase, status: '完成' })
        return { ...prev, pageStatuses: newStatuses }
      })
      onUpdate?.()
    }

    const handleError = (data: { pageId: string; phase: Phase; error: string }) => {
      setState(prev => {
        const newErrors = new Map(prev.errors)
        newErrors.set(data.pageId, data.error)
        return { ...prev, errors: newErrors }
      })
      onUpdate?.()
    }

    const handlePhaseStarted = (data: { phase: Phase }) => {
      setState(prev => ({ ...prev, currentPhase: data.phase, phaseCompleted: null }))
    }

    const handlePhaseCompleted = (data: PhaseCompleted) => {
      setState(prev => ({ ...prev, phaseCompleted: data }))
      onUpdate?.()
    }

    const handleAllFinished = () => {
      stopTimer()
      setState(prev => ({ ...prev, isRunning: false, finished: true }))
      onUpdate?.()
    }

    const handlePipelineError = (data: { error: string }) => {
      stopTimer()
      setState(prev => ({ ...prev, isRunning: false, pipelineError: data.error }))
      onUpdate?.()
    }

    window.api.translate.onPageProgress(handleProgress)
    window.api.translate.onPageFinished(handleFinished)
    window.api.translate.onPageError(handleError)
    window.api.translate.onPhaseStarted(handlePhaseStarted)
    window.api.translate.onPhaseCompleted(handlePhaseCompleted)
    window.api.translate.onAllFinished(handleAllFinished)
    window.api.translate.onPipelineError(handlePipelineError)

    return () => {
      window.api.translate.removeAllListeners()
      stopTimer()
    }
  }, [projectId, onUpdate, stopTimer])

  const start = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({
      ...prev,
      isRunning: true, finished: false, pipelineError: null,
      pageStatuses: new Map(), errors: new Map(), elapsedMs: 0
    }))
    startTimer()
    await window.api.translate.start(projectId)
  }, [projectId, startTimer])

  const stop = useCallback(async () => {
    if (!projectId) return
    await window.api.translate.stop(projectId)
    stopTimer()
    setState(prev => ({ ...prev, isRunning: false }))
  }, [projectId, stopTimer])

  const confirmPhase = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({ ...prev, phaseCompleted: null }))
    await window.api.translate.confirmPhase(projectId)
  }, [projectId])

  const retryFailed = useCallback(async () => {
    if (!projectId) return
    setState(prev => ({
      ...prev, isRunning: true, finished: false,
      pipelineError: null, errors: new Map(), elapsedMs: 0
    }))
    startTimer()
    await window.api.translate.retryFailed(projectId)
  }, [projectId, startTimer])

  return { ...state, start, stop, confirmPhase, retryFailed }
}
```

- [ ] **Step 5: 验证编译通过**

```bash
pnpm run dev
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add React hooks for projects, pages, config, translation"
```

---

## Task 8: TitleBar + TabBar + App 骨架

**Files:**
- Create: `src/renderer/components/TitleBar.tsx`
- Create: `src/renderer/components/TabBar.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 创建 TitleBar 组件**

`src/renderer/components/TitleBar.tsx`:
```tsx
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div className="flex items-center justify-between h-9 bg-base-200 select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="pl-3 text-sm font-medium">漫画翻译</div>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9"
                onClick={() => window.api.window.minimize()}><Minus className="w-4 h-4" /></button>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9"
                onClick={() => window.api.window.maximize()}><Square className="w-3.5 h-3.5" /></button>
        <button className="btn btn-ghost btn-xs rounded-none w-10 h-9 hover:bg-error hover:text-error-content"
                onClick={() => window.api.window.close()}><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 TabBar 组件**

`src/renderer/components/TabBar.tsx`:
```tsx
import { X } from 'lucide-react'

interface Tab {
  id: string
  label: string
  closable: boolean
  status?: string
}

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

const statusColors: Record<string, string> = {
  idle: 'bg-base-300',
  analyzing: 'bg-info',
  translating: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-error'
}

export default function TabBar({ tabs, activeId, onSelect, onClose }: TabBarProps) {
  return (
    <div className="flex items-center bg-base-100 border-b border-base-300 overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`flex items-center gap-1 px-4 py-2 cursor-pointer border-b-2 text-sm whitespace-nowrap ${
            activeId === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent hover:bg-base-200'
          }`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.status && (
            <span className={`w-2 h-2 rounded-full ${statusColors[tab.status] || 'bg-base-300'}`} />
          )}
          <span>{tab.label}</span>
          {tab.closable && (
            <button
              className="btn btn-ghost btn-xs btn-circle ml-1"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
            ><X className="w-3 h-3" /></button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 更新 App.tsx**

`src/renderer/App.tsx`:
```tsx
import { useState, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import Bookshelf from './components/Bookshelf'
import Settings from './components/Settings'
import Workspace from './components/Workspace'
import type { Project } from './types'

interface WorkspaceTab {
  id: string
  projectId: string
  label: string
  status: string
}

function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState('bookshelf')
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([])

  const openProject = useCallback((project: Project) => {
    const existing = workspaceTabs.find(t => t.projectId === project.id)
    if (existing) {
      setActiveTab(existing.id)
      return
    }
    const tab: WorkspaceTab = {
      id: `ws-${project.id}`,
      projectId: project.id,
      label: project.name,
      status: project.status
    }
    setWorkspaceTabs(prev => [...prev, tab])
    setActiveTab(tab.id)
  }, [workspaceTabs])

  const closeTab = useCallback((tabId: string) => {
    setWorkspaceTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTab === tabId) setActiveTab('bookshelf')
  }, [activeTab])

  const tabs = [
    { id: 'bookshelf', label: '书架', closable: false },
    { id: 'settings', label: '设置', closable: false },
    ...workspaceTabs.map(t => ({
      id: t.id, label: t.label, closable: true, status: t.status
    }))
  ]

  const activeWorkspace = workspaceTabs.find(t => t.id === activeTab)

  return (
    <div data-theme="light" className="h-screen flex flex-col">
      <TitleBar />
      <TabBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} onClose={closeTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'bookshelf' && <Bookshelf onOpenProject={openProject} />}
        {activeTab === 'settings' && <Settings />}
        {activeWorkspace && <Workspace projectId={activeWorkspace.projectId} />}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 4: 创建占位组件**

`src/renderer/components/Bookshelf.tsx`:
```tsx
import type { Project } from '../types'

interface Props { onOpenProject: (project: Project) => void }

export default function Bookshelf({ onOpenProject: _ }: Props) {
  return <div className="p-4">书架（待实现）</div>
}
```

`src/renderer/components/Settings.tsx`:
```tsx
export default function Settings() {
  return <div className="p-4">设置（待实现）</div>
}
```

`src/renderer/components/Workspace.tsx`:
```tsx
interface Props { projectId: string }

export default function Workspace({ projectId: _ }: Props) {
  return <div className="p-4">工作区（待实现）</div>
}
```

- [ ] **Step 5: 验证应用启动，Tab 切换正常**

```bash
pnpm run dev
```

预期：窗口显示自定义标题栏 + Tab 栏（书架、设置），点击可切换。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add TitleBar, TabBar, and App shell with tab management"
```

---

## Task 9: 书架页（Bookshelf + ComicCard + ImportModal）

**Files:**
- Modify: `src/renderer/components/Bookshelf.tsx`
- Create: `src/renderer/components/ComicCard.tsx`
- Create: `src/renderer/components/ImportModal.tsx`

- [ ] **Step 1: 创建 ComicCard 组件**

`src/renderer/components/ComicCard.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import type { Project } from '../types'

const statusBadge: Record<string, { class: string; label: string }> = {
  idle: { class: 'badge-ghost', label: '未开始' },
  analyzing: { class: 'badge-info', label: '分析中' },
  translating: { class: 'badge-warning', label: '翻译中' },
  completed: { class: 'badge-success', label: '已完成' },
  failed: { class: 'badge-error', label: '失败' }
}

interface Props {
  project: Project
  onOpen: () => void
  onDelete: () => void
}

export default function ComicCard({ project, onOpen, onDelete }: Props) {
  const [coverSrc, setCoverSrc] = useState<string | null>(null)
  const badge = statusBadge[project.status] || statusBadge.idle

  useEffect(() => {
    window.api.file.getCover(project.source_dir).then(async (path) => {
      if (!path) return
      const { base64, mimeType } = await window.api.file.readImage(path)
      setCoverSrc(`data:${mimeType};base64,${base64}`)
    })
  }, [project.source_dir])

  return (
    <div
      className="card card-compact bg-base-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer w-40"
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        const menu = document.getElementById(`menu-${project.id}`) as HTMLDialogElement
        menu?.showModal()
      }}
    >
      <figure className="h-48 bg-base-200 overflow-hidden">
        {coverSrc ? (
          <img src={coverSrc} alt={project.name} className="object-cover w-full h-full" />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-base-content/30"><BookOpen className="w-10 h-10" /></div>
        )}
      </figure>
      <div className="card-body gap-1">
        <h3 className="card-title text-sm truncate">{project.name}</h3>
        <div className={`badge badge-sm ${badge.class}`}>{badge.label}</div>
      </div>

      <dialog id={`menu-${project.id}`} className="modal">
        <div className="modal-box w-52">
          <ul className="menu">
            <li><button onClick={() => { onOpen(); (document.getElementById(`menu-${project.id}`) as HTMLDialogElement)?.close() }}>打开</button></li>
            <li><button className="text-error" onClick={() => {
              (document.getElementById(`menu-${project.id}`) as HTMLDialogElement)?.close()
              onDelete()
            }}>删除</button></li>
          </ul>
        </div>
        <form method="dialog" className="modal-backdrop"><button>关闭</button></form>
      </dialog>
    </div>
  )
}
```

- [ ] **Step 2: 创建 ImportModal 组件**

`src/renderer/components/ImportModal.tsx`:
```tsx
import { useState } from 'react'

interface Props {
  open: boolean
  defaultSourceLang: string
  defaultTargetLang: string
  onClose: () => void
  onImport: (data: { name: string; sourceDir: string; outputDir: string; sourceLang: string; targetLang: string; translateMode: string }) => void
}

export default function ImportModal({ open, defaultSourceLang, defaultTargetLang, onClose, onImport }: Props) {
  const [sourceDir, setSourceDir] = useState('')
  const [sourceLang, setSourceLang] = useState(defaultSourceLang)
  const [targetLang, setTargetLang] = useState(defaultTargetLang)
  const [translateMode, setTranslateMode] = useState('auto')

  const handleSelectFolder = async () => {
    const path = await window.api.file.selectFolder()
    if (path) setSourceDir(path)
  }

  const handleSubmit = () => {
    if (!sourceDir) return
    const name = sourceDir.split(/[/\\]/).pop() || 'untitled'
    onImport({
      name,
      sourceDir,
      outputDir: `output/${name}`,
      sourceLang,
      targetLang,
      translateMode
    })
    setSourceDir('')
    onClose()
  }

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">导入漫画</h3>

        <div className="form-control mb-3">
          <label className="label"><span className="label-text">漫画文件夹</span></label>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered flex-1" value={sourceDir} readOnly placeholder="选择文件夹..." />
            <button className="btn btn-outline" onClick={handleSelectFolder}>浏览</button>
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="form-control flex-1">
            <label className="label"><span className="label-text">源语言</span></label>
            <input type="text" className="input input-bordered" value={sourceLang} onChange={e => setSourceLang(e.target.value)} />
          </div>
          <div className="form-control flex-1">
            <label className="label"><span className="label-text">目标语言</span></label>
            <input type="text" className="input input-bordered" value={targetLang} onChange={e => setTargetLang(e.target.value)} />
          </div>
        </div>

        <div className="form-control mb-4">
          <label className="label"><span className="label-text">翻译模式</span></label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input type="radio" name="mode" className="radio radio-sm" checked={translateMode === 'auto'} onChange={() => setTranslateMode('auto')} />
              <span className="label-text">全自动</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input type="radio" name="mode" className="radio radio-sm" checked={translateMode === 'manual'} onChange={() => setTranslateMode('manual')} />
              <span className="label-text">手动</span>
            </label>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={!sourceDir} onClick={handleSubmit}>导入</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>关闭</button></form>
    </dialog>
  )
}
```

- [ ] **Step 3: 实现 Bookshelf 组件**

`src/renderer/components/Bookshelf.tsx`:
```tsx
import { useState, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useConfig } from '../hooks/useConfig'
import { Library } from 'lucide-react'
import ComicCard from './ComicCard'
import ImportModal from './ImportModal'
import type { Project } from '../types'

interface Props { onOpenProject: (project: Project) => void }

export default function Bookshelf({ onOpenProject }: Props) {
  const { projects, createProject, deleteProject } = useProjects()
  const { config } = useConfig()
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const filtered = useMemo(() => {
    if (!search) return projects
    return projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [projects, search])

  const handleImport = async (data: Record<string, string>) => {
    await createProject(data)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          className="input input-bordered input-sm flex-1 max-w-xs"
          placeholder="搜索漫画..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={() => setShowImport(true)}>导入漫画</button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-base-content/40">
          <div className="mb-4"><Library className="w-16 h-16 text-base-content/20" /></div>
          <p>导入你的第一部漫画</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-4">
            {filtered.map(project => (
              <ComicCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        </div>
      )}

      <ImportModal
        open={showImport}
        defaultSourceLang={config?.default_source_lang || '日本語'}
        defaultTargetLang={config?.default_target_lang || '简体中文'}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />

      <dialog className={`modal ${deleteTarget ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">确认删除</h3>
          <p className="py-4">确定要删除「{deleteTarget?.name}」吗？此操作不可恢复。</p>
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>取消</button>
            <button className="btn btn-error" onClick={handleDelete}>删除</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button onClick={() => setDeleteTarget(null)}>关闭</button></form>
      </dialog>
    </div>
  )
}
```

- [ ] **Step 4: 验证书架页功能**

```bash
pnpm run dev
```

预期：书架页显示空状态引导，点击"导入漫画"弹出 modal，选择文件夹后可创建项目，卡片显示在网格中。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: implement Bookshelf with ComicCard and ImportModal"
```

---

## Task 10: 工作区页 — 三栏布局容器 + 顶部工具栏

**Files:**
- Modify: `src/renderer/components/Workspace.tsx`
- Create: `src/renderer/components/WorkspaceToolbar.tsx`
- Create: `src/renderer/components/PhaseConfirmBar.tsx`

- [ ] **Step 1: 创建 WorkspaceToolbar 组件**

`src/renderer/components/WorkspaceToolbar.tsx`:
```tsx
import type { Phase, TranslateMode } from '../types'

const phaseLabels: Record<Phase, string> = {
  vision: '识图',
  analysis: '分析',
  translation: '翻译',
  image_gen: '生图'
}

const phases: Phase[] = ['vision', 'analysis', 'translation', 'image_gen']

interface Props {
  projectName: string
  sourceLang: string
  targetLang: string
  translateMode: TranslateMode
  onModeChange: (mode: TranslateMode) => void
  currentPhase: Phase | null
  isRunning: boolean
  completedCount: number
  totalCount: number
  elapsedMs: number
  onStart: () => void
  onStop: () => void
  onRetryFailed: () => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function WorkspaceToolbar({
  projectName, sourceLang, targetLang, translateMode, onModeChange,
  currentPhase, isRunning, completedCount, totalCount, elapsedMs,
  onStart, onStop, onRetryFailed
}: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-base-200 border-b border-base-300 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate max-w-40">{projectName}</span>
        <span className="text-base-content/50">{sourceLang} → {targetLang}</span>
        <select
          className="select select-xs select-bordered"
          value={translateMode}
          onChange={e => onModeChange(e.target.value as TranslateMode)}
          disabled={isRunning}
        >
          <option value="auto">自动</option>
          <option value="manual">手动</option>
        </select>
      </div>

      <div className="flex-1 flex items-center gap-2 justify-center">
        <div className="flex gap-0.5">
          {phases.map(p => (
            <div
              key={p}
              className={`px-2 py-0.5 text-xs rounded ${
                currentPhase === p
                  ? 'bg-primary text-primary-content'
                  : 'bg-base-300 text-base-content/50'
              }`}
            >
              {phaseLabels[p]}
            </div>
          ))}
        </div>
        <span className="text-base-content/60">{completedCount}/{totalCount}</span>
        {isRunning && <span className="text-base-content/60">{formatTime(elapsedMs)}</span>}
      </div>

      <div className="flex items-center gap-2">
        {!isRunning ? (
          <button className="btn btn-primary btn-xs" onClick={onStart}>开始翻译</button>
        ) : (
          <button className="btn btn-error btn-xs" onClick={onStop}>停止</button>
        )}
        <button className="btn btn-warning btn-xs" onClick={onRetryFailed} disabled={isRunning}>重试失败</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 PhaseConfirmBar 组件**

`src/renderer/components/PhaseConfirmBar.tsx`:
```tsx
import type { PhaseCompleted } from '../types'

const phaseNames: Record<string, string> = {
  vision: '识图',
  analysis: '全局分析',
  translation: '逐页翻译',
  image_gen: '图片生成'
}

interface Props {
  phaseCompleted: PhaseCompleted | null
  onConfirm: () => void
}

export default function PhaseConfirmBar({ phaseCompleted, onConfirm }: Props) {
  if (!phaseCompleted) return null

  return (
    <div className="alert alert-info rounded-none animate-pulse">
      <span>
        {phaseNames[phaseCompleted.phase]}阶段已完成，请检查结果后继续
        {phaseCompleted.nextPhase && `（下一步：${phaseNames[phaseCompleted.nextPhase]}）`}
      </span>
      <button className="btn btn-sm btn-primary" onClick={onConfirm}>确认继续</button>
    </div>
  )
}
```

- [ ] **Step 3: 实现 Workspace 三栏布局容器**

`src/renderer/components/Workspace.tsx`:
```tsx
import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePages } from '../hooks/usePages'
import { useTranslation } from '../hooks/useTranslation'
import WorkspaceToolbar from './WorkspaceToolbar'
import PhaseConfirmBar from './PhaseConfirmBar'
import ThumbnailList from './ThumbnailList'
import ImageViewer from './ImageViewer'
import DetailPanel from './DetailPanel'
import type { Project, Page, TranslateMode } from '../types'

interface Props { projectId: string }

export default function Workspace({ projectId }: Props) {
  const [project, setProject] = useState<Project | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const { pages, refresh: refreshPages } = usePages(projectId)
  const translation = useTranslation(projectId, refreshPages)

  useEffect(() => {
    window.api.projects.get(projectId).then(p => { if (p) setProject(p as unknown as Project) })
  }, [projectId])

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id)
    }
  }, [pages, selectedPageId])

  const handleModeChange = useCallback(async (mode: TranslateMode) => {
    await window.api.projects.update(projectId, { translate_mode: mode })
    setProject(prev => prev ? { ...prev, translate_mode: mode } : prev)
  }, [projectId])

  const selectedPage = pages.find(p => p.id === selectedPageId) || null

  const completedCount = pages.filter(p => p.status === 'completed').length

  if (!project) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner" /></div>

  return (
    <div className="h-full flex flex-col">
      <WorkspaceToolbar
        projectName={project.name}
        sourceLang={project.source_lang}
        targetLang={project.target_lang}
        translateMode={project.translate_mode as TranslateMode}
        onModeChange={handleModeChange}
        currentPhase={translation.currentPhase}
        isRunning={translation.isRunning}
        completedCount={completedCount}
        totalCount={pages.length}
        elapsedMs={translation.elapsedMs}
        onStart={translation.start}
        onStop={translation.stop}
        onRetryFailed={translation.retryFailed}
      />
      <PhaseConfirmBar
        phaseCompleted={translation.phaseCompleted}
        onConfirm={translation.confirmPhase}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：缩略图 */}
        {!leftCollapsed ? (
          <div className="w-44 border-r border-base-300 flex flex-col">
            <div className="flex items-center justify-between px-2 py-1 border-b border-base-300">
              <span className="text-xs text-base-content/50">页面</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setLeftCollapsed(true)}><ChevronLeft className="w-4 h-4" /></button>
            </div>
            <ThumbnailList
              pages={pages}
              sourceDir={project.source_dir}
              selectedId={selectedPageId}
              onSelect={setSelectedPageId}
              pageStatuses={translation.pageStatuses}
            />
          </div>
        ) : (
          <button
            className="w-6 border-r border-base-300 flex items-center justify-center hover:bg-base-200"
            onClick={() => setLeftCollapsed(false)}
          ><ChevronRight className="w-4 h-4" /></button>
        )}

        {/* 中栏：大图 */}
        <div className="flex-1 overflow-hidden">
          <ImageViewer
            page={selectedPage}
            sourceDir={project.source_dir}
            outputDir={project.output_dir}
          />
        </div>

        {/* 右栏：详情 */}
        {!rightCollapsed ? (
          <div className="w-80 border-l border-base-300 flex flex-col">
            <div className="flex items-center justify-between px-2 py-1 border-b border-base-300">
              <span className="text-xs text-base-content/50">详情</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setRightCollapsed(true)}><ChevronRight className="w-4 h-4" /></button>
            </div>
            <DetailPanel
              page={selectedPage}
              masterPrompt={project.master_prompt}
              onSave={async (id, fields) => {
                await window.api.pages.update(id, fields)
                refreshPages()
              }}
              onRegenerate={async (pageId) => {
                // 单页重新生成 — 复用翻译流水线的单页逻辑
                // 简化处理：更新状态后触发 retryFailed
                await window.api.pages.update(pageId, { status: 'failed' })
                translation.retryFailed()
              }}
              onMasterPromptSave={async (prompt) => {
                await window.api.projects.update(projectId, { master_prompt: prompt })
                setProject(prev => prev ? { ...prev, master_prompt: prompt } : prev)
              }}
            />
          </div>
        ) : (
          <button
            className="w-6 border-l border-base-300 flex items-center justify-center hover:bg-base-200"
            onClick={() => setRightCollapsed(false)}
          ><ChevronLeft className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 验证编译通过**

```bash
pnpm run dev
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: implement Workspace layout with toolbar and phase confirm bar"
```

---

## Task 11: 左栏缩略图列表

**Files:**
- Create: `src/renderer/components/ThumbnailList.tsx`

- [ ] **Step 1: 实现 ThumbnailList 组件**

`src/renderer/components/ThumbnailList.tsx`:
```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page, Phase } from '../types'

const statusColors: Record<string, string> = {
  pending: 'bg-base-300',
  analyzing: 'bg-info',
  analyzed: 'bg-info/50',
  translating: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-error'
}

interface Props {
  pages: Page[]
  sourceDir: string
  selectedId: string | null
  onSelect: (id: string) => void
  pageStatuses: Map<string, { phase: Phase; status: string }>
}

interface ThumbCache {
  [path: string]: string
}

export default function ThumbnailList({ pages, sourceDir, selectedId, onSelect, pageStatuses }: Props) {
  const [thumbs, setThumbs] = useState<ThumbCache>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const loadThumb = useCallback(async (filename: string) => {
    const path = `${sourceDir}/${filename}`.replace(/\\/g, '/')
    if (thumbs[path]) return
    try {
      const { base64, mimeType } = await window.api.file.readImage(path)
      setThumbs(prev => ({ ...prev, [path]: `data:${mimeType};base64,${base64}` }))
    } catch { /* ignore */ }
  }, [sourceDir, thumbs])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const filename = entry.target.getAttribute('data-filename')
            if (filename) loadThumb(filename)
          }
        })
      },
      { root: containerRef.current, rootMargin: '100px' }
    )
    return () => observerRef.current?.disconnect()
  }, [loadThumb])

  useEffect(() => {
    const observer = observerRef.current
    if (!observer) return
    const container = containerRef.current
    if (!container) return
    const items = container.querySelectorAll('[data-filename]')
    items.forEach(el => observer.observe(el))
    return () => items.forEach(el => observer.unobserve(el))
  }, [pages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = pages.findIndex(p => p.id === selectedId)
    if (e.key === 'ArrowDown' && idx < pages.length - 1) {
      e.preventDefault()
      onSelect(pages[idx + 1].id)
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault()
      onSelect(pages[idx - 1].id)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {pages.map((page, i) => {
        const path = `${sourceDir}/${page.filename}`.replace(/\\/g, '/')
        const src = thumbs[path]
        const liveStatus = pageStatuses.get(page.id)
        const displayStatus = liveStatus ? 'analyzing' : page.status
        const colorClass = statusColors[displayStatus] || statusColors.pending

        return (
          <div
            key={page.id}
            data-filename={page.filename}
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-base-200 ${
              selectedId === page.id ? 'bg-primary/10 border-l-2 border-primary' : ''
            }`}
            onClick={() => onSelect(page.id)}
          >
            <div className={`w-1 h-10 rounded-full ${colorClass} ${
              displayStatus === 'analyzing' || displayStatus === 'translating' ? 'animate-pulse' : ''
            }`} />
            <div className="w-10 h-14 bg-base-200 rounded overflow-hidden flex-shrink-0">
              {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-base-content/30">{i + 1}</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs truncate">{page.filename}</div>
              <div className="text-xs text-base-content/40">#{i + 1}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 验证缩略图列表显示**

```bash
pnpm run dev
```

预期：打开工作区后左栏显示缩略图列表，懒加载图片，点击可选中，键盘上下切换。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: implement ThumbnailList with lazy loading"
```

---

## Task 12: 中栏大图查看器

**Files:**
- Create: `src/renderer/components/ImageViewer.tsx`

- [ ] **Step 1: 实现 ImageViewer 组件**

`src/renderer/components/ImageViewer.tsx`:
```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page } from '../types'

interface Props {
  page: Page | null
  sourceDir: string
  outputDir: string
}

type ViewMode = 'original' | 'translated' | 'split'

export default function ImageViewer({ page, sourceDir, outputDir }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('original')
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [translatedSrc, setTranslatedSrc] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOriginalSrc(null)
    setTranslatedSrc(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
    if (!page) return

    const origPath = `${sourceDir}/${page.filename}`.replace(/\\/g, '/')
    window.api.file.readImage(origPath).then(({ base64, mimeType }) => {
      setOriginalSrc(`data:${mimeType};base64,${base64}`)
    }).catch(() => {})

    if (page.status === 'completed') {
      const transPath = `${outputDir}/${page.filename}`.replace(/\\/g, '/')
      window.api.file.readImage(transPath).then(({ base64, mimeType }) => {
        setTranslatedSrc(`data:${mimeType};base64,${base64}`)
      }).catch(() => {})
    }
  }, [page, sourceDir, outputDir])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => Math.max(0.1, Math.min(5, prev * delta)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  if (!page) {
    return <div className="h-full flex items-center justify-center text-base-content/30">选择一个页面查看</div>
  }

  const imgStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
    transformOrigin: 'center center',
    transition: dragging ? 'none' : 'transform 0.1s'
  }

  const renderImage = (src: string | null, alt: string) => (
    <div className="flex-1 flex items-center justify-center overflow-hidden">
      {src ? (
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain" style={imgStyle} draggable={false} />
      ) : (
        <span className="loading loading-spinner" />
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-base-300">
        <div className="join">
          <button className={`join-item btn btn-xs ${viewMode === 'original' ? 'btn-active' : ''}`} onClick={() => setViewMode('original')}>原图</button>
          <button className={`join-item btn btn-xs ${viewMode === 'translated' ? 'btn-active' : ''}`} onClick={() => setViewMode('translated')} disabled={!translatedSrc}>译图</button>
          <button className={`join-item btn btn-xs ${viewMode === 'split' ? 'btn-active' : ''}`} onClick={() => setViewMode('split')} disabled={!translatedSrc}>对比</button>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-xs" onClick={() => setScale(s => Math.max(0.1, s * 0.8))}>−</button>
          <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setScale(s => Math.min(5, s * 1.2))}>+</button>
        </div>
        <button className="btn btn-ghost btn-xs" onDoubleClick={resetView} onClick={resetView}>适应</button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-base-200"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {viewMode === 'split' ? (
          <div className="flex h-full">
            {renderImage(originalSrc, '原图')}
            <div className="w-px bg-base-300" />
            {renderImage(translatedSrc, '译图')}
          </div>
        ) : viewMode === 'translated' ? (
          renderImage(translatedSrc, '译图')
        ) : (
          renderImage(originalSrc, '原图')
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证大图查看器**

```bash
pnpm run dev
```

预期：选中页面后中栏显示大图，可缩放、拖拽、切换原图/译图/对比模式。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: implement ImageViewer with zoom, pan, and split view"
```

---

## Task 13: 右栏详情面板

**Files:**
- Create: `src/renderer/components/DetailPanel.tsx`

- [ ] **Step 1: 实现 DetailPanel 组件**

`src/renderer/components/DetailPanel.tsx`:
```tsx
import { useState, useEffect } from 'react'
import type { Page } from '../types'

interface Props {
  page: Page | null
  masterPrompt: string
  onSave: (pageId: string, fields: Record<string, unknown>) => Promise<void>
  onRegenerate: (pageId: string) => Promise<void>
  onMasterPromptSave: (prompt: string) => Promise<void>
}

export default function DetailPanel({ page, masterPrompt, onSave, onRegenerate, onMasterPromptSave }: Props) {
  const [editMaster, setEditMaster] = useState(masterPrompt)
  const [visionResult, setVisionResult] = useState('')
  const [refinedTranslation, setRefinedTranslation] = useState('')
  const [finalPrompt, setFinalPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEditMaster(masterPrompt) }, [masterPrompt])

  useEffect(() => {
    if (!page) return
    setVisionResult(page.vision_result)
    setRefinedTranslation(page.refined_translation)
    setFinalPrompt(page.final_prompt)
  }, [page])

  const handleSavePage = async () => {
    if (!page) return
    setSaving(true)
    await onSave(page.id, {
      vision_result: visionResult,
      refined_translation: refinedTranslation,
      final_prompt: finalPrompt,
      edited: 1
    })
    setSaving(false)
  }

  const statusBadge: Record<string, { class: string; label: string }> = {
    pending: { class: 'badge-ghost', label: '待处理' },
    analyzing: { class: 'badge-info', label: '分析中' },
    analyzed: { class: 'badge-info badge-outline', label: '已分析' },
    translating: { class: 'badge-warning', label: '翻译中' },
    completed: { class: 'badge-success', label: '已完成' },
    failed: { class: 'badge-error', label: '失败' }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* 总控提示词 */}
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium">总控提示词</div>
        <div className="collapse-content">
          <textarea
            className="textarea textarea-bordered w-full text-xs font-mono h-32"
            value={editMaster}
            onChange={e => setEditMaster(e.target.value)}
          />
          <button
            className="btn btn-xs btn-primary mt-2"
            onClick={() => onMasterPromptSave(editMaster)}
          >保存总控提示词</button>
        </div>
      </div>

      {!page ? (
        <div className="text-center text-base-content/40 py-8">
          <p className="text-sm">选择页面查看详情</p>
        </div>
      ) : (
        <>
          {/* 页面信息 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{page.filename}</span>
            <span className={`badge badge-sm ${statusBadge[page.status]?.class || ''}`}>
              {statusBadge[page.status]?.label || page.status}
            </span>
          </div>

          {page.error_message && (
            <div className="alert alert-error text-xs py-2">
              <span>{page.error_message}</span>
            </div>
          )}

          {/* 视觉结果 */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium">视觉结果</div>
            <div className="collapse-content">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28"
                value={visionResult}
                onChange={e => setVisionResult(e.target.value)}
              />
            </div>
          </div>

          {/* 精炼翻译 */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium">精炼翻译</div>
            <div className="collapse-content">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28"
                value={refinedTranslation}
                onChange={e => setRefinedTranslation(e.target.value)}
              />
            </div>
          </div>

          {/* 最终 Prompt */}
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium">最终 Prompt</div>
            <div className="collapse-content">
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono h-28"
                value={finalPrompt}
                onChange={e => setFinalPrompt(e.target.value)}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary flex-1" onClick={handleSavePage} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : '保存修改'}
            </button>
            <button
              className="btn btn-sm btn-secondary flex-1"
              onClick={() => onRegenerate(page.id)}
              disabled={!page.refined_translation}
            >重新生图</button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证详情面板**

```bash
pnpm run dev
```

预期：右栏显示总控提示词折叠区域，选中页面后显示视觉结果、精炼翻译、最终 prompt 编辑区，可保存和重新生图。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: implement DetailPanel with editable fields"
```

---

## Task 14: 设置页

**Files:**
- Modify: `src/renderer/components/Settings.tsx`
- Create: `src/renderer/components/Toast.tsx`

- [ ] **Step 1: 创建 Toast 组件**

`src/renderer/components/Toast.tsx`:
```tsx
import { useState, useCallback, useEffect } from 'react'

interface ToastMessage {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0
let addToastFn: ((text: string, type: ToastMessage['type']) => void) | null = null

export function showToast(text: string, type: ToastMessage['type'] = 'success') {
  addToastFn?.(text, type)
}

export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: ToastMessage['type']) => {
    const id = ++toastId
    setMessages(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id))
    }, 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  const alertClass: Record<string, string> = {
    success: 'alert-success',
    error: 'alert-error',
    info: 'alert-info'
  }

  return (
    <div className="toast toast-end toast-top z-50">
      {messages.map(m => (
        <div key={m.id} className={`alert ${alertClass[m.type]} text-sm py-2`}>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 实现 Settings 组件**

`src/renderer/components/Settings.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { showToast } from './Toast'
import type { AppConfig, ModelConfig } from '../types'

function ModelConfigCard({ label, value, onChange }: {
  label: string
  value: ModelConfig
  onChange: (v: ModelConfig) => void
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h4 className="font-medium text-sm">{label}</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Provider</span></label>
          <select className="select select-bordered select-sm" value={value.provider}
            onChange={e => onChange({ ...value, provider: e.target.value })}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Model</span></label>
          <input className="input input-bordered input-sm" value={value.model}
            onChange={e => onChange({ ...value, model: e.target.value })} />
        </div>
      </div>
      <div className="form-control">
        <label className="label py-0.5"><span className="label-text text-xs">Base URL</span></label>
        <input className="input input-bordered input-sm" value={value.base_url}
          onChange={e => onChange({ ...value, base_url: e.target.value })} />
      </div>
      <div className="form-control">
        <label className="label py-0.5"><span className="label-text text-xs">API Key</span></label>
        <div className="flex gap-1">
          <input className="input input-bordered input-sm flex-1"
            type={showKey ? 'text' : 'password'} value={value.api_key}
            onChange={e => onChange({ ...value, api_key: e.target.value })} />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { config, saveConfig } = useConfig()
  const [draft, setDraft] = useState<AppConfig | null>(null)

  useEffect(() => { if (config) setDraft({ ...config }) }, [config])

  if (!draft) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner" /></div>

  const handleSave = async () => {
    await saveConfig(draft)
    showToast('设置已保存')
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto">
      <h2 className="text-lg font-bold">设置</h2>

      {/* 模型配置 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-base-content/60">模型配置</h3>
        <ModelConfigCard label="视觉模型" value={draft.vision_model}
          onChange={v => setDraft({ ...draft, vision_model: v })} />
        <ModelConfigCard label="推理模型" value={draft.reasoning_model}
          onChange={v => setDraft({ ...draft, reasoning_model: v })} />
        <ModelConfigCard label="图片生成模型" value={draft.image_gen}
          onChange={v => setDraft({ ...draft, image_gen: v })} />
      </div>

      {/* 通用设置 */}
      <div className="card bg-base-200 p-4 space-y-2">
        <h3 className="text-sm font-medium">通用设置</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">并发数</span></label>
            <input type="number" className="input input-bordered input-sm" min={1} max={20}
              value={draft.concurrency} onChange={e => setDraft({ ...draft, concurrency: Number(e.target.value) })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">最大重试</span></label>
            <input type="number" className="input input-bordered input-sm" min={0} max={10}
              value={draft.max_retries} onChange={e => setDraft({ ...draft, max_retries: Number(e.target.value) })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">默认源语言</span></label>
            <input className="input input-bordered input-sm" value={draft.default_source_lang}
              onChange={e => setDraft({ ...draft, default_source_lang: e.target.value })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">默认目标语言</span></label>
            <input className="input input-bordered input-sm" value={draft.default_target_lang}
              onChange={e => setDraft({ ...draft, default_target_lang: e.target.value })} />
          </div>
        </div>
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">输出目录</span></label>
          <input className="input input-bordered input-sm" value={draft.output_base_dir}
            onChange={e => setDraft({ ...draft, output_base_dir: e.target.value })} />
        </div>
      </div>

      {/* 提示词 */}
      <div className="card bg-base-200 p-4 space-y-3">
        <h3 className="text-sm font-medium">提示词</h3>
        {([
          { key: 'vision_prompt' as const, label: '视觉提示词' },
          { key: 'global_analysis_prompt' as const, label: '全局分析提示词' },
          { key: 'page_translate_prompt' as const, label: '逐页翻译提示词' },
          { key: 'image_gen_prompt' as const, label: '图片生成提示词' }
        ]).map(({ key, label }) => (
          <div key={key} className="form-control">
            <div className="flex items-center justify-between">
              <label className="label py-0.5"><span className="label-text text-xs">{label}</span></label>
              <button className="btn btn-ghost btn-xs" onClick={() => setDraft({ ...draft, [key]: '' })}>重置默认</button>
            </div>
            <textarea
              className="textarea textarea-bordered text-xs font-mono h-24"
              value={draft[key]}
              onChange={e => setDraft({ ...draft, [key]: e.target.value })}
              placeholder="留空使用默认提示词"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end pb-4">
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 在 App.tsx 中添加 Toast**

在 `App.tsx` 的 return 中，`</div>` 闭合标签前添加：

```tsx
import Toast from './components/Toast'

// 在 JSX 最外层 div 内末尾添加：
<Toast />
```

- [ ] **Step 4: 验证设置页功能**

```bash
pnpm run dev
```

预期：设置页显示三个模型配置卡片、通用设置、提示词编辑区。保存后显示 toast 提示。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: implement Settings page with Toast notifications"
```

---

## Task 15: 主题切换 + .gitignore + CLAUDE.md 更新 + 最终验证

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Settings.tsx`
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 添加主题切换**

在 `App.tsx` 中添加主题状态：

```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light')

// 在最外层 div 上：
<div data-theme={theme} className="h-screen flex flex-col">
```

在 `Settings.tsx` 通用设置卡片中添加主题切换：

```tsx
<div className="form-control">
  <label className="label py-0.5"><span className="label-text text-xs">主题</span></label>
  <select className="select select-bordered select-sm" value={theme} onChange={e => setTheme(e.target.value)}>
    <option value="light">浅色</option>
    <option value="dark">深色</option>
  </select>
</div>
```

注意：主题状态需要通过 props 或 context 从 App 传递到 Settings。简单做法是在 App 中通过 props 传递 `theme` 和 `setTheme` 给 Settings。

- [ ] **Step 2: 更新 .gitignore**

```gitignore
node_modules/
out/
dist/
data/
output/
*.db
__pycache__/
.pytest_cache/
```

- [ ] **Step 3: 更新 CLAUDE.md**

更新 CLAUDE.md 反映新的 Electron 项目结构、命令和架构。

- [ ] **Step 4: 全流程验证**

```bash
pnpm run dev
```

验证清单：
1. 应用启动，显示自定义标题栏和 Tab 栏
2. 书架页：空状态引导 → 导入漫画 → 卡片显示
3. 双击卡片 → 工作区 Tab 打开
4. 工作区三栏布局：缩略图列表、大图查看器、详情面板
5. 左栏/右栏可折叠展开
6. 大图缩放、拖拽、原图/译图/对比切换
7. 设置页：模型配置、通用设置、提示词编辑、保存 toast
8. 主题切换 light/dark
9. Tab 关闭功能正常
10. 窗口最小化/最大化/关闭按钮正常

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add theme toggle, update gitignore and CLAUDE.md"
```

- [ ] **Step 6: 构建验证**

```bash
pnpm run build
```

预期：构建成功，输出到 `out/` 目录。
