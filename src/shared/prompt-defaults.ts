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

export const DEFAULT_PROMPTS = {
  vision_prompt: DEFAULT_VISION_PROMPT,
  global_analysis_prompt: DEFAULT_GLOBAL_ANALYSIS_PROMPT,
  page_translate_prompt: DEFAULT_PAGE_TRANSLATE_PROMPT,
  image_gen_prompt: DEFAULT_IMAGE_GEN_PROMPT
} as const

export type PromptConfigKey = keyof typeof DEFAULT_PROMPTS
