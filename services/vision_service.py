import base64
import json
import mimetypes
import urllib.request
from pathlib import Path
from urllib.error import HTTPError, URLError
from config import ModelConfig
from services.image_utils import resize_image_if_needed
from log import logger

class VisionService:
    def __init__(self, config: ModelConfig, prompt_template: str = "") -> None:
        self.config = config
        self.prompt_template = prompt_template

    def analyze_page(self, image_path: Path, image_bytes: bytes, source_lang: str) -> str:
        logger.info(f"[Vision] 开始分析: {image_path.name}, provider={self.config.provider}, model={self.config.model}")
        image_bytes = resize_image_if_needed(image_bytes)
        mime_type = mimetypes.guess_type(str(image_path))[0] or "image/png"
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64}"
        prompt = self.prompt_template.format(source_lang=source_lang)

        try:
            if self.config.provider == "anthropic":
                result = self._call_anthropic(prompt, b64, mime_type)
            else:
                result = self._call_openai_compatible(prompt, data_url)
            logger.info(f"[Vision] 分析完成: {image_path.name}, 结果长度={len(result)}")
            logger.debug(f"[Vision] 分析结果: {image_path.name}\n{result[:500]}")
            return result
        except Exception as e:
            logger.error(f"[Vision] 分析失败: {image_path.name}, 错误: {e}")
            raise

    def _call_openai_compatible(self, prompt: str, data_url: str) -> str:
        url = self.config.base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url[:80] + "...", "detail": "high"}},
                    ],
                }
            ],
            "max_tokens": 4096,
        }
        logger.debug(f"[Vision] OpenAI请求: POST {url}, model={self.config.model}")
        payload["messages"][0]["content"][1]["image_url"]["url"] = data_url
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(f"[Vision] OpenAI响应长度: {len(raw)}")
                result = json.loads(raw)
            return result["choices"][0]["message"]["content"]
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[Vision] OpenAI请求失败 HTTP {exc.code}: {detail}")
            raise RuntimeError(f"Vision请求失败，HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            logger.error(f"[Vision] OpenAI网络错误: {exc}")
            raise RuntimeError(f"Vision网络请求失败: {exc}") from exc

    def _call_anthropic(self, prompt: str, b64_data: str, mime_type: str) -> str:
        url = self.config.base_url.rstrip("/") + "/messages"
        logger.debug(f"[Vision] Anthropic请求: POST {url}, model={self.config.model}")
        payload = {
            "model": self.config.model,
            "max_tokens": 4096,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": mime_type, "data": b64_data},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
        headers = {
            "x-api-key": self.config.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                logger.debug(f"[Vision] Anthropic响应长度: {len(raw)}")
                result = json.loads(raw)
            return result["content"][0]["text"]
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[Vision] Anthropic请求失败 HTTP {exc.code}: {detail}")
            raise RuntimeError(f"Vision请求失败，HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            logger.error(f"[Vision] Anthropic网络错误: {exc}")
            raise RuntimeError(f"Vision网络请求失败: {exc}") from exc
