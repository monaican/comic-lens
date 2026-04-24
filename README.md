# ComicLens

AI 驱动的漫画翻译桌面应用。通过视觉识别、智能翻译和图片生成，一键完成漫画本地化。

## 功能

- 4 阶段自动翻译流水线：识图 → 全局分析 → 逐页翻译 → 图片生成
- 支持 OpenAI 和 Anthropic 两种 API 提供商
- 自动/手动两种翻译模式，手动模式可在每阶段暂停审核
- 实时进度追踪，每页状态可视化
- 3 栏工作区：缩略图导航、图片查看器（原图/译图/对比）、详情编辑面板
- 翻译结果可手动编辑后重新生图
- 异步缩略图生成，流畅的 UI 体验
- 全局翻译日志
- 浅色/深色主题切换
- 自定义提示词模板

## 截图

| 原图 | 翻译后 |
|------|--------|
| ![原图](docs/images/demo_original.png) | ![翻译后](docs/images/demo_translated.png) |

## 安装

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm run dev
```

### 构建

```bash
# 构建生产版本
pnpm run build

# 打包 Windows 安装包
pnpm run pack
```

## 技术栈

- Electron + electron-vite
- React + TypeScript
- TailwindCSS + DaisyUI
- better-sqlite3 (本地数据库)
- Sharp (图片处理/缩略图)
- lucide-react (图标)

## 项目结构

```
src/
  main/           # Electron 主进程
    index.ts        # 窗口管理、应用入口
    database.ts     # SQLite 数据库操作
    config.ts       # 配置文件读写
    ipc.ts          # IPC 通信处理
    translate-pipeline.ts  # 4 阶段翻译流水线
    vision-service.ts      # 视觉识别 API
    reasoning-service.ts   # 推理/翻译 API
    image-gen-service.ts   # 图片生成 API
    thumbnail-service.ts   # 缩略图生成
  preload/        # Preload 脚本
    index.ts        # contextBridge API 暴露
  renderer/       # React 渲染进程
    components/     # UI 组件
    hooks/          # React Hooks
    types.ts        # TypeScript 类型定义
    assets/         # 样式文件
data/             # 运行时数据 (SQLite, 配置, 缩略图)
```

## 配置说明

首次启动后在「设置」页面配置：

- 视觉模型：用于识别漫画页面内容 (推荐 GPT-4o / Claude)
- 推理模型：用于全局分析和逐页翻译
- 图片生成模型：用于生成翻译后的图片 (OpenAI Responses API)
- 并发数、重试次数、默认语言等

提示词模板支持变量：`{source_lang}`, `{target_lang}`, `{master_prompt}`, `{refined}`

## License

[MIT](LICENSE)
