import base64
import json
import mimetypes
from pathlib import Path
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError
from log import logger
from services.image_utils import resize_image_if_needed

USER_AGENT = "comics-translate/1.0.0"
VERSION = "1.0.0"
SESSION_ID = "comics-translate-session"
INSTRUCTIONS = "you are a helpful assistant"


def build_responses_endpoint(base_url: str) -> str:
    normalized = base_url.strip().rstrip("/")
    if not normalized:
        raise ValueError("BASE_URL 为空")
    if normalized.endswith("/v1/responses"):
        return normalized
    return f"{normalized}/v1/responses"


def build_request_headers(api_key: str) -> dict[str, str]:
    cleaned = api_key.strip()
    if not cleaned:
        raise ValueError("API_KEY 为空")
    return {
        "Authorization": f"Bearer {cleaned}",
        "user-agent": USER_AGENT,
        "version": VERSION,
        "session_id": SESSION_ID,
        "accept": "text/event-stream",
        "Content-Type": "application/json",
    }


def encode_image_as_data_url(image_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def encode_image_path_as_data_url(path: Path) -> str:
    mime_type = mimetypes.guess_type(str(path))[0] or "image/png"
    image_bytes = resize_image_if_needed(path.read_bytes())
    return encode_image_as_data_url(image_bytes, mime_type)


def build_edit_payload(
    model: str,
    prompt: str,
    edit_image_data_url: str,
    output_format: str = "png",
) -> dict[str, Any]:
    return {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": edit_image_data_url, "detail": "auto"},
                ],
            }
        ],
        "tools": [{"type": "image_generation", "output_format": output_format, "action": "edit"}],
        "instructions": INSTRUCTIONS,
        "tool_choice": "auto",
        "stream": True,
        "store": False,
    }


def send_request(base_url: str, api_key: str, payload: dict[str, Any], timeout: int = 600) -> str:
    endpoint = build_responses_endpoint(base_url)
    logger.info(f"[ImageGen] 发送请求: POST {endpoint}, model={payload.get('model', '?')}")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(endpoint, data=body, headers=build_request_headers(api_key), method="POST")
    try:
        with request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            logger.debug(f"[ImageGen] SSE响应长度: {len(raw)}")
            return raw
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.error(f"[ImageGen] 请求失败 HTTP {exc.code}: {detail}")
        raise RuntimeError(f"请求失败，HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        logger.error(f"[ImageGen] 网络错误: {exc}")
        raise RuntimeError(f"网络请求失败: {exc}") from exc


def parse_sse_events(sse_text: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in sse_text.split("\n\n"):
        stripped = block.strip()
        if not stripped:
            continue
        event_name = ""
        data_lines: list[str] = []
        for line in stripped.splitlines():
            if line.startswith("event:"):
                event_name = line.partition(":")[2].strip()
            elif line.startswith("data:"):
                data_lines.append(line.partition(":")[2].strip())
        if not data_lines:
            continue
        data_text = "\n".join(data_lines).strip()
        if data_text == "[DONE]":
            continue
        payload = json.loads(data_text)
        events.append({"event": event_name or str(payload.get("type", "")), "data": payload})
    return events


def extract_image_result(sse_text: str) -> dict[str, Any]:
    for event in parse_sse_events(sse_text):
        if event["event"] == "response.failed":
            error = event["data"].get("response", {}).get("error", {})
            msg = f"响应失败: {error.get('message', 'unknown')}"
            logger.error(f"[ImageGen] {msg}")
            raise RuntimeError(msg)
        if event["event"] == "response.incomplete":
            details = event["data"].get("response", {}).get("incomplete_details", {})
            msg = f"响应未完成: {details.get('reason', 'unknown')}"
            logger.error(f"[ImageGen] {msg}")
            raise RuntimeError(msg)
        if event["event"] != "response.output_item.done":
            continue
        item = event["data"].get("item")
        if isinstance(item, dict) and item.get("type") == "image_generation_call":
            result = item.get("result")
            if not result:
                logger.error("[ImageGen] image_generation_call 缺少 result 字段")
                raise ValueError("image_generation_call 缺少 result 字段")
            logger.info(f"[ImageGen] 图片生成成功, revised_prompt={item.get('revised_prompt', '')[:80]}")
            return {"result": result, "revised_prompt": item.get("revised_prompt")}
    logger.error("[ImageGen] SSE 响应中没有 image_generation_call")
    raise ValueError("SSE 响应中没有 image_generation_call")
