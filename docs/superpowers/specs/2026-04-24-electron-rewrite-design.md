# Comics Translate — Electron 重写设计文档

## 概述

将现有 Python/PySide6 漫画翻译桌面应用重写为 Electron 应用，使用 electron-vite + React + TypeScript + TailwindCSS + DaisyUI 技术栈。保留核心四阶段翻译流水线，重新设计 UI/UX，新增手动翻译模式。

## 决策记录

- 项目位置：当前目录 `D:\Project\python\comics-translate`，旧 Python 代码移至别处
- 功能范围：核心功能 + UX 重新设计
- 数据存储：SQLite（better-sqlite3）
- 界面语言：简体中文
- API 调用：原生 HTTP（fetch），不用 SDK
- 窗口架构：单窗口 + Tab 模式
- 主题：默认 light，可切换 dark
- UI 组件：尽量复用 DaisyUI，不自造组件
- 图标：使用 lucide-react SVG 图标库，禁止使用 emoji

---

## 1. 整体架构

### 技术栈

- electron-vite（构建工具）
- React 18 + TypeScript
- TailwindCSS + DaisyUI
- better-sqlite3（数据库）
- Node.js 原生 fetch（API 调用）

### 进程模型

- **Main 进程：** 窗口管理、SQLite 操作、文件系统操作、API 调用（所有网络请求在主进程发起，避免 CORS）
- **Renderer 进程：** React SPA，纯 UI 层，通过 IPC 与主进程通信
- **Preload 脚本：** 通过 `contextBridge.exposeInMainWorld` 暴露类型安全的 IPC bridge

### 主进程服务层

- `VisionService` — 调用视觉模型提取文字
- `ReasoningService` — 全局分析 + 逐页翻译
- `ImageGenService` — 图片生成（OpenAI Responses API + SSE）
- `DatabaseService` — better-sqlite3 封装，同步 API
- `FileService` — 图片扫描、输出文件管理
- `ConfigService` — JSON 配置读写

### 并发模型

用 Promise 并发 + semaphore 模式替代 Python 版的 QThreadPool。可配置最大并发数（默认 3）。每个 API 调用是一个 async 函数，通过 semaphore 控制同时执行数量。内置指数退避重试（2^attempt 秒）。

---

## 2. UI 结构与导航

### 窗口布局

- 顶部：自定义标题栏（draggable），集成窗口控制按钮（最小化/最大化/关闭）
- 标题栏下方：Tab 栏，固定两个 Tab（书架、设置），动态添加漫画工作区 Tab（可关闭）
- 主区域：当前 Tab 对应的内容

### Tab 系统

- 使用 DaisyUI `tabs` 组件
- 书架 Tab 和设置 Tab 固定在左侧，不可关闭
- 漫画工作区 Tab 带关闭按钮，显示项目名称 + 翻译状态指示（小圆点颜色）
- Tab 过多时水平滚动

### 页面视图

#### 书架页（Bookshelf）— 默认首页

- 顶部工具栏：搜索框 + 导入按钮
- 网格布局展示漫画卡片（封面图 + 名称 + 状态 badge）
- 卡片右键菜单：打开、删除
- 双击卡片 → 新开工作区 Tab
- 空状态：居中图标 + "导入你的第一部漫画" 引导文案
- 导入漫画：点击导入按钮 → DaisyUI modal，一次性填写文件夹路径（带选择按钮）、源语言、目标语言、翻译模式 → 确认创建

#### 工作区页（Workspace）— 三栏布局，类 PDF 阅读器

**顶部信息栏（slim bar）：**
- 左侧：项目名 + 语言对 + 翻译模式切换（自动/手动）
- 中间：整体进度条（分段显示四阶段，当前阶段高亮）+ 阶段标签 + 计时器 + 完成计数
- 右侧：操作按钮（开始翻译 / 停止 / 重试失败）

**左栏（缩略图导航栏，~180px，可折叠）：**
- 垂直滚动的页面缩略图列表
- 显示序号 + 小缩略图 + 状态色条（灰=待处理，蓝=进行中，绿=完成，红=失败，黄=待审阅）
- 点击选中页面，右侧同步切换
- 当前选中项高亮，键盘上下箭头可切换
- 懒加载 + 虚拟滚动，只渲染可视区域

**中栏（主视图区，占据大部分空间）：**
- 上方 toolbar：缩放控制、原图/译图切换（toggle）、并排对比模式（split view）
- 展示当前选中页面的大图
- 支持鼠标滚轮缩放、拖拽平移
- 并排模式下左右各一张图
- 双击恢复适应宽度，原图/译图切换有淡入淡出过渡

**右栏（详情面板，~320px，可收缩/展开）：**
- 收起时只显示展开按钮贴在右边缘
- 顶部：总控提示词（折叠区域，始终可访问）
- 当前页状态 badge + 文件名
- 三个可折叠区域：视觉结果、精炼翻译、最终 prompt（各带编辑/只读切换）
- 操作按钮：保存修改、重新生成当前页图片、单页重试
- 未选中页面时默认展示全局信息（master prompt + 项目概览）

#### 设置页（Settings）

- 三个 DaisyUI card 分区：模型配置、通用设置、提示词
- 模型配置：provider 选择、base_url、api_key（密码输入 + 显示/隐藏切换）、model，每个模型区增加"测试连接"按钮
- 通用设置：并发数、最大重试、输出目录、默认源/目标语言
- 提示词：textarea 带行号，模板变量高亮，各带"重置默认"按钮
- 底部保存按钮，保存后 DaisyUI toast 提示

### 翻译模式

**全自动模式：** 四个阶段自动串联执行，完成后通知用户。

**手动模式：** 每个阶段完成后暂停，等待用户审阅和编辑，确认后才进入下一阶段。

手动模式流程：
1. Vision 完成 → 暂停，用户逐页查看/编辑视觉识别结果 → 点击"确认，进入全局分析"
2. 全局分析完成 → 暂停，用户编辑 master prompt → 点击"确认，开始翻译"
3. 逐页翻译完成 → 暂停，用户逐页查看/编辑精炼翻译和最终 prompt → 点击"确认，开始生图"
4. 图片生成完成 → 结束

手动模式 UI：
- 阶段完成后顶部信息栏变为确认栏（DaisyUI alert，info 色调，脉冲动画）
- 左栏缩略图状态色条标记哪些页面已完成当前阶段
- 模式可中途切换：手动模式下审阅完可切回全自动让后续阶段自动跑完

---

## 3. 数据层设计

### 数据库 Schema

沿用 SQLite（better-sqlite3），基本保持现有 schema，增加少量字段。

**projects 表：**
```sql
CREATE TABLE projects (
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
```

新增字段：
- `translate_mode` — 翻译模式（auto / manual）
- `current_phase` — 当前阶段，用于恢复暂停状态
- `phase_confirmed` — 手动模式下当前阶段是否已确认

**pages 表：**
```sql
CREATE TABLE pages (
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
```

新增字段：
- `edited` — 用户是否手动编辑过该页

### 配置

继续用 JSON 文件（`data/config.json`），AppConfig 结构不变。

### IPC 通信设计

Main 进程暴露的 IPC channels 按领域分组：

- `db:projects:*` — 项目 CRUD（list, get, create, update, delete）
- `db:pages:*` — 页面 CRUD（list, get, update）
- `config:*` — 配置读写（get, save）
- `file:*` — 文件操作（scan-images, select-folder, read-image）
- `translate:*` — 翻译流程控制（start, stop, retry, confirm-phase）
- `translate:progress` — 主进程 → renderer 的进度推送（用 webContents.send）

Preload 脚本通过 `contextBridge.exposeInMainWorld` 暴露类型安全的 API 对象，renderer 侧调用如 `window.api.projects.list()`。

---

## 4. 翻译流水线（主进程）

### 并发控制

semaphore 模式的并发限制器：
- 可配置最大并发数（默认 3）
- 每个 API 调用是 async 函数，通过 semaphore 控制同时执行数量
- 内置指数退避重试（2^attempt 秒）

### 四阶段流程

1. **Vision** — 并发调用视觉模型，每页一个任务。完成一页就通过 IPC 推送进度
2. **Global Analysis** — 单次调用，汇总所有 vision 结果生成 master prompt
3. **Page Translation** — 并发调用推理模型，每页一个任务
4. **Image Generation** — 并发调用 OpenAI Responses API（SSE 流式），每页一个任务

### 模式差异

- 全自动：阶段间自动衔接
- 手动：每阶段完成后发送 `translate:phase-completed` 事件，等待 `translate:confirm-phase` 才继续

### 可恢复性

启动翻译时检查每页已有数据（vision_result、refined_translation、final_prompt）判断从哪个阶段开始。手动模式额外检查 `current_phase` 和 `phase_confirmed` 恢复暂停位置。

### 进度推送事件

- `translate:page-progress` — { pageId, phase, status }
- `translate:page-finished` — { pageId, phase, result }
- `translate:page-error` — { pageId, phase, error }
- `translate:phase-completed` — { phase, nextPhase }
- `translate:all-finished` — 全部完成

### API 调用

Node.js 原生 fetch，两种 provider 格式与 Python 版保持一致：
- OpenAI 兼容：`/chat/completions`，Bearer auth
- Anthropic：`/messages`，`x-api-key` header
- 图片生成：OpenAI Responses API `/v1/responses`，SSE 流式，用 ReadableStream 解析

---

## 5. UX 细节

### 主题

- 默认 light 主题，设置中可切换 light/dark
- 使用 DaisyUI 内置主题切换

### 交互细节

- 漫画卡片：hover 上浮 + 阴影加深，状态用 DaisyUI badge 颜色区分
- 删除确认：DaisyUI modal
- 缩略图：选中态用主题色边框，翻译中页面有呼吸动画
- 中栏大图：默认 fit-to-width，滚轮缩放，双击恢复
- 右栏文本编辑区：monospace 字体，自动调整高度
- 翻译开始/完成：DaisyUI toast 通知
- 所有破坏性操作有确认步骤
- 窗口标题显示当前项目名和翻译状态

### 组件原则

尽量复用 DaisyUI 原生组件，不自造 UI 组件：
- tabs, card, badge, modal, alert, toast, btn, toggle, collapse, drawer, progress, input, textarea, select, tooltip
