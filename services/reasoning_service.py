import json
import urllib.request
from urllib.error import HTTPError, URLError
from config import ModelConfig
from log import logger

class ReasoningService:
    def __init__(self, config: ModelConfig, global_analysis_prompt: str = "",
                 page_translate_prompt: str = "") -> None:
        self.config = config
        self.global_analysis_prompt = global_analysis_prompt
        self.page_translate_prompt = page_translate_prompt

    def analyze_global(
        self, vision_results: dict[str, str], source_lang: str, target_lang: str
    ) -> str:
        logger.info(f"[Reasoning] 开始全局分析, {len(vision_results)}页, provider={self.config.provider}, model={self.config.model}")
        prompt = self.global_analysis_prompt.format(source_lang=source_lang, target_lang=target_lang)
        filenames = sorted(vision_results.keys())
        pages_text = ""
        for i, fname in enumerate(filenames, 1):
            pages_text += f"\n### 第{i}页 ({fname})\n{vision_results[fname]}\n"

        user_message = f"以下是所有页面的识图分析结果：\n{pages_text}"

        try:
            if self.config.provider == "anthropic":
                result = self._call_anthropic(prompt, user_message)
            else:
                result = self._call_openai_compatible(prompt, user_message)
            logger.info(f"[Reasoning] 全局分析完成, 结果长度={len(result)}")
            logger.debug(f"[Reasoning] 总控提示词:\n{result[:500]}")
            return result
        except Exception as e:
            logger.error(f"[Reasoning] 全局分析失败: {e}")
            raise

    def translate_page(
        self, master_prompt: str, vision_result: str, source_lang: str, target_lang: str
    ) -> str:
        logger.info(f"[Reasoning] 开始逐页翻译, provider={self.config.provider}, model={self.config.model}")
        prompt = self.page_translate_prompt.format(
            master_prompt=master_prompt,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        user_message = f"以下是本页的识图分析结果：\n\n{vision_result}"

        try:
            if self.config.provider == "anthropic":
                result = self._call_anthropic(prompt, user_message)
            else:
                result = self._call_openai_compatible(prompt, user_message)
            logger.info(f"[Reasoning] 逐页翻译完成, 结果长度={len(result)}")
            logger.debug(f"[Reasoning] 翻译结果:\n{result[:500]}")
            return result
        except Exception as e:
            logger.error(f"[Reasoning] 逐页翻译失败: {e}")
            raise

    def _call_openai_compatible(self, system_prompt: str, user_message: str) -> str:
        url = self.config.base_url.rstrip("/") + "/chat/completions"
        logger.debug(f"[Reasoning] OpenAI请求: POST {url}, model={self.config.model}")
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 8192,
        }
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(f"[Reasoning] OpenAI响应长度: {len(raw)}")
                result = json.loads(raw)
            return result["choices"][0]["message"]["content"]
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[Reasoning] OpenAI请求失败 HTTP {exc.code}: {detail}")
            raise RuntimeError(f"Reasoning请求失败，HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            logger.error(f"[Reasoning] OpenAI网络错误: {exc}")
            raise RuntimeError(f"Reasoning网络请求失败: {exc}") from exc

    def _call_anthropic(self, system_prompt: str, user_message: str) -> str:
        url = self.config.base_url.rstrip("/") + "/messages"
        logger.debug(f"[Reasoning] Anthropic请求: POST {url}, model={self.config.model}")
        payload = {
            "model": self.config.model,
            "max_tokens": 8192,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
        headers = {
            "x-api-key": self.config.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(f"[Reasoning] Anthropic响应长度: {len(raw)}")
                result = json.loads(raw)
            return result["content"][0]["text"]
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[Reasoning] Anthropic请求失败 HTTP {exc.code}: {detail}")
            raise RuntimeError(f"Reasoning请求失败，HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            logger.error(f"[Reasoning] Anthropic网络错误: {exc}")
            raise RuntimeError(f"Reasoning网络请求失败: {exc}") from exc
