import base64
from pathlib import Path
from config import ModelConfig
from services.provider_api import (
    build_edit_payload,
    encode_image_path_as_data_url,
    extract_image_result,
    send_request,
)


class ImageGenService:
    def __init__(self, config: ModelConfig) -> None:
        self.config = config

    def translate_page(
        self,
        image_path: Path,
        prompt: str,
        output_dir: Path,
        output_filename: str,
    ) -> Path:
        data_url = encode_image_path_as_data_url(image_path)
        payload = build_edit_payload(
            model=self.config.model,
            prompt=prompt,
            edit_image_data_url=data_url,
        )
        sse_text = send_request(self.config.base_url, self.config.api_key, payload)
        result = extract_image_result(sse_text)
        image_bytes = base64.b64decode(result["result"])
        output_path = output_dir / output_filename
        output_path.write_bytes(image_bytes)
        return output_path
