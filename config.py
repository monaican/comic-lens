import json
from dataclasses import dataclass, field, asdict
from pathlib import Path

CONFIG_DIR = Path(__file__).parent / "data"
CONFIG_PATH = CONFIG_DIR / "config.json"

@dataclass
class ModelConfig:
    provider: str = ""
    base_url: str = ""
    api_key: str = ""
    model: str = ""

DEFAULT_VISION_PROMPT = """你是一个漫画分析助手。请分析这张漫画图片：
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
源语言为：{source_lang}"""

DEFAULT_GLOBAL_ANALYSIS_PROMPT = """你是一个专业的漫画翻译审校助手。

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
目标语言：{target_lang}"""

DEFAULT_PAGE_TRANSLATE_PROMPT = """你是一个专业的漫画翻译助手。

以下是本作品的总控提示词（翻译注意事项）：
{master_prompt}

请根据以上注意事项，将下面这一页漫画的识图分析结果中的对话/文字翻译为{target_lang}。
保持原有的位置描述格式（如"第一格 右侧对话框"等），只替换对话/文字内容为译文。
不要包含漫画内容描述（如"这张漫画描述了……"），只保留位置+译文。

源语言：{source_lang}
目标语言：{target_lang}"""

DEFAULT_IMAGE_GEN_PROMPT = "根据图片,画一个图片，在不改变排版和字体的情况下将{source_lang}改为{target_lang},参考译文：\n{refined}"


@dataclass
class AppConfig:
    vision_model: ModelConfig = field(default_factory=lambda: ModelConfig(
        provider="openai", base_url="https://api.openai.com/v1", model="gpt-4o"
    ))
    reasoning_model: ModelConfig = field(default_factory=lambda: ModelConfig(
        provider="anthropic", base_url="https://api.anthropic.com/v1", model="claude-sonnet-4-6"
    ))
    image_gen: ModelConfig = field(default_factory=lambda: ModelConfig(model="gpt-image-2"))
    concurrency: int = 3
    max_retries: int = 3
    output_base_dir: str = "output"
    default_source_lang: str = "日本語"
    default_target_lang: str = "简体中文"
    vision_prompt: str = ""
    global_analysis_prompt: str = ""
    page_translate_prompt: str = ""
    image_gen_prompt: str = ""

    def get_vision_prompt(self) -> str:
        return self.vision_prompt or DEFAULT_VISION_PROMPT

    def get_global_analysis_prompt(self) -> str:
        return self.global_analysis_prompt or DEFAULT_GLOBAL_ANALYSIS_PROMPT

    def get_page_translate_prompt(self) -> str:
        return self.page_translate_prompt or DEFAULT_PAGE_TRANSLATE_PROMPT

    def get_image_gen_prompt(self) -> str:
        return self.image_gen_prompt or DEFAULT_IMAGE_GEN_PROMPT

    def save(self) -> None:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(
            json.dumps(asdict(self), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @classmethod
    def load(cls) -> "AppConfig":
        if not CONFIG_PATH.exists():
            cfg = cls()
            cfg.save()
            return cfg
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return cls(
            vision_model=ModelConfig(**raw.get("vision_model", {})),
            reasoning_model=ModelConfig(**raw.get("reasoning_model", {})),
            image_gen=ModelConfig(**raw.get("image_gen", {})),
            concurrency=raw.get("concurrency", 3),
            max_retries=raw.get("max_retries", 3),
            output_base_dir=raw.get("output_base_dir", "output"),
            default_source_lang=raw.get("default_source_lang", "日本語"),
            default_target_lang=raw.get("default_target_lang", "简体中文"),
            vision_prompt=raw.get("vision_prompt", ""),
            global_analysis_prompt=raw.get("global_analysis_prompt", ""),
            page_translate_prompt=raw.get("page_translate_prompt", ""),
            image_gen_prompt=raw.get("image_gen_prompt", ""),
        )
