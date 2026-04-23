# 🎨 Comics Translate - AI 漫画翻译工具

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![PySide6](https://img.shields.io/badge/UI-PySide6-41CD52?logo=qt&logoColor=white)
![GPT Image 2](https://img.shields.io/badge/AI-GPT%20Image%202-412991?logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)

一款基于 AI 的漫画翻译桌面工具，利用 GPT Image 2 的图像编辑能力，直接在原画上生成译文，保留原作字体风格与画面构图，告别传统嵌字翻译对画面的破坏。

## ✨ 为什么不一样

传统漫画翻译流程是"擦字 → 补图 → 贴字"，无论怎么精修都难以还原原作的字体设计和排版美感，尤其是手写体、特效字、融入画面的拟声词，贴字后总显得突兀。

本工具借助 GPT Image 2 的图像编辑能力，跳过了擦字和贴字环节——AI 直接理解画面内容，在保持原有排版、字体风格和画面完整性的前提下，将源语言替换为目标语言。拟声词、特效字、手写对白都能自然融入画面，输出接近原生级别的翻译效果。

## 🔄 翻译流程

```
原图 → 视觉识别(提取文字与位置) → 全局分析(统一术语/人名/风格) → 逐页翻译 → GPT Image 2 生图
```

1. **视觉识别** — 视觉模型逐页分析漫画，提取对话文字及其位置描述
2. **全局分析** — 推理模型通读全部页面，生成总控提示词，统一人名、术语和语气风格
3. **逐页翻译** — 基于总控提示词对每页文字进行翻译，确保上下文一致
4. **AI 生图** — GPT Image 2 在原图基础上直接编辑，生成带有译文的成品图

## 📸 效果对比

> 原作：[作品标题](https://www.pixiv.net/artworks/xxxxxxxx) by 作者名

| 原图 | 译图 |
|:---:|:---:|
| ![原图](docs/images/demo_original.jpg) | ![译图](docs/images/demo_translated.jpg) |

<!-- 
使用方法：
1. 在项目根目录创建 docs/images/ 文件夹
2. 将原图放入并命名为 demo_original.jpg
3. 将译图放入并命名为 demo_translated.jpg
4. 修改上方的作品标题、pixiv 链接和作者名
5. 可复制表格行添加更多对比图
-->

## 🚀 安装

### 环境要求

- Python 3.11+
- Windows / macOS / Linux

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行

```bash
python main.py
```

## ⚙️ 配置

首次运行后在"设置"页面配置以下模型：

| 模型 | 用途 | 推荐 |
|------|------|------|
| 识图模型 | 提取漫画文字与位置 | Gemini3Flash |
| 推理模型 | 全局分析与逐页翻译 | Gemini3Flash |
| 生图模型 | 图像编辑生成译图 | GPT Image 2(暂时只支持v1/responses codex 逆向接口) |

所有提示词均可在设置中自定义，留空则使用内置默认值。

## 💡 功能特性

- 支持 OpenAI 和 Anthropic 双 Provider
- 可中断恢复的翻译流水线，断点续翻不丢进度
- 可调并发数与自动重试
- 逐页详情查看，支持手动编辑识图结果、翻译文本和提示词后重新生图
- 总控提示词可手动编辑，精确控制翻译风格

## 📁 项目结构

```
├── main.py              # 入口
├── config.py            # 配置与默认提示词
├── log.py               # 日志
├── services/            # AI 服务层
│   ├── vision_service.py      # 视觉识别
│   ├── reasoning_service.py   # 全局分析与翻译
│   ├── image_gen_service.py   # 图片生成
│   ├── provider_api.py        # OpenAI Responses API 封装
│   └── image_utils.py         # 图片缩放
├── workers/             # 并发任务
│   ├── translate_worker.py    # 单任务 Worker
│   └── worker_pool.py         # 线程池管理
├── storage/             # 数据持久化
│   ├── database.py            # SQLite 数据库
│   └── file_manager.py        # 文件扫描
├── ui/                  # PySide6 界面
│   ├── main_window.py         # 主窗口
│   ├── bookshelf.py           # 书架
│   ├── comic_workspace.py     # 翻译工作区
│   ├── page_detail.py         # 页面详情
│   ├── settings_dialog.py     # 设置
│   └── progress_widget.py     # 进度条
└── tests/               # 测试
```

## 🤝 Contributing

欢迎提交 Pull Request！无论是新功能、Bug 修复还是文档改进，都非常欢迎。

1. Fork 本仓库
2. 创建你的分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add some feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 提交 Pull Request

如果你有任何想法或建议，也欢迎在 [Issues](../../issues) 中讨论。

## 📄 License

MIT
