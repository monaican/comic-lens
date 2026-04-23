import tempfile
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from storage.database import Database
from storage.file_manager import FileManager
from config import AppConfig, DEFAULT_VISION_PROMPT, DEFAULT_GLOBAL_ANALYSIS_PROMPT, DEFAULT_PAGE_TRANSLATE_PROMPT
from services.vision_service import VisionService
from services.reasoning_service import ReasoningService
from services.image_gen_service import ImageGenService

FAKE_VISION = "第一格\n右侧对话框：「おはよう」\n\n这张漫画描述了早晨打招呼的场景。"
FAKE_MASTER_PROMPT_ANTHROPIC = {
    "content": [{
        "type": "text",
        "text": "人名统一：太郎→太郎\n语气风格：日常轻松"
    }]
}
FAKE_PAGE_TRANSLATE_ANTHROPIC = {
    "content": [{
        "type": "text",
        "text": "第一格\n右侧对话框：\"早上好\""
    }]
}
FAKE_SSE = (
    'event: response.output_item.done\n'
    'data: {"item":{"type":"image_generation_call","result":"aWZha2VpbWFnZQ==","revised_prompt":"ok"}}\n\n'
)


def test_full_workflow():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        src = tmp_path / "test_comic"
        src.mkdir()
        (src / "page_001.jpg").write_bytes(b"fake_image_1")
        (src / "page_002.jpg").write_bytes(b"fake_image_2")

        output = tmp_path / "output" / "test_comic"

        db = Database(tmp_path / "test.db")
        fm = FileManager()

        images = fm.scan_images(src)
        assert len(images) == 2

        pid = db.create_project("test_comic", str(src), str(output), "日本語", "简体中文")
        for i, img in enumerate(images):
            db.create_page(pid, img.name, i + 1)

        pages = db.list_pages(pid)
        assert len(pages) == 2
        assert all(p["status"] == "pending" for p in pages)

        vision_cfg = AppConfig().vision_model
        vision_svc = VisionService(vision_cfg, DEFAULT_VISION_PROMPT)
        with patch("services.vision_service.urllib.request.urlopen") as mock:
            fake_resp = MagicMock()
            fake_resp.read.return_value = json.dumps({
                "choices": [{"message": {"content": FAKE_VISION}}]
            }).encode("utf-8")
            fake_resp.__enter__ = lambda s: s
            fake_resp.__exit__ = MagicMock(return_value=False)
            mock.return_value = fake_resp

            for page in pages:
                result = vision_svc.analyze_page(
                    src / page["filename"], b"fake", "日本語"
                )
                db.update_page(page["id"], status="analyzed", vision_result=result)

        pages = db.list_pages(pid)
        assert all(p["status"] == "analyzed" for p in pages)
        assert "おはよう" in pages[0]["vision_result"]

        reasoning_cfg = AppConfig().reasoning_model
        reasoning_svc = ReasoningService(reasoning_cfg, DEFAULT_GLOBAL_ANALYSIS_PROMPT, DEFAULT_PAGE_TRANSLATE_PROMPT)
        vision_results = {p["filename"]: p["vision_result"] for p in pages}

        # 阶段二：全局分析 — 只生成总控提示词
        with patch("services.reasoning_service.urllib.request.urlopen") as mock:
            fake_resp = MagicMock()
            fake_resp.read.return_value = json.dumps(FAKE_MASTER_PROMPT_ANTHROPIC).encode("utf-8")
            fake_resp.__enter__ = lambda s: s
            fake_resp.__exit__ = MagicMock(return_value=False)
            mock.return_value = fake_resp

            master_prompt = reasoning_svc.analyze_global(vision_results, "日本語", "简体中文")

        assert "太郎" in master_prompt
        db.update_project(pid, master_prompt=master_prompt)

        # 阶段三：逐页翻译
        with patch("services.reasoning_service.urllib.request.urlopen") as mock:
            fake_resp = MagicMock()
            fake_resp.read.return_value = json.dumps(FAKE_PAGE_TRANSLATE_ANTHROPIC).encode("utf-8")
            fake_resp.__enter__ = lambda s: s
            fake_resp.__exit__ = MagicMock(return_value=False)
            mock.return_value = fake_resp

            for page in pages:
                refined = reasoning_svc.translate_page(
                    master_prompt, page["vision_result"], "日本語", "简体中文"
                )
                final_prompt = f"## 总控提示词\n{master_prompt}\n\n## 本页翻译\n{refined}"
                db.update_page(page["id"], refined_translation=refined,
                               final_prompt=final_prompt)

        image_gen_cfg = AppConfig().image_gen
        image_gen_cfg.base_url = "https://fake.api"
        image_gen_cfg.api_key = "sk-test"
        image_gen_svc = ImageGenService(image_gen_cfg)
        output.mkdir(parents=True, exist_ok=True)

        with patch("services.provider_api.request.urlopen") as mock:
            fake_resp = MagicMock()
            fake_resp.read.return_value = FAKE_SSE.encode("utf-8")
            fake_resp.__enter__ = lambda s: s
            fake_resp.__exit__ = MagicMock(return_value=False)
            mock.return_value = fake_resp

            for page in pages:
                page_data = db.get_page(page["id"])
                result_path = image_gen_svc.translate_page(
                    src / page["filename"],
                    page_data["final_prompt"],
                    output,
                    page["filename"],
                )
                assert result_path.exists()
                db.update_page(page["id"], status="completed")

        pages = db.list_pages(pid)
        assert all(p["status"] == "completed" for p in pages)
        db.update_project(pid, status="completed")
        project = db.get_project(pid)
        assert project["status"] == "completed"
        db.close()


def test_retry_failed_page():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        db = Database(tmp_path / "test.db")
        pid = db.create_project("test", "/src", "/out", "ja", "zh")
        page_id = db.create_page(pid, "p1.jpg", 1)

        db.update_page(page_id, status="failed", error_message="timeout", retry_count=1)
        page = db.get_page(page_id)
        assert page["status"] == "failed"
        assert page["retry_count"] == 1

        db.update_page(page_id, status="pending", error_message="", retry_count=2)
        page = db.get_page(page_id)
        assert page["status"] == "pending"
        assert page["retry_count"] == 2
        db.close()


def test_single_page_re_edit():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        db = Database(tmp_path / "test.db")
        pid = db.create_project("test", "/src", "/out", "ja", "zh")
        page_id = db.create_page(pid, "p1.jpg", 1)

        db.update_page(page_id, status="completed",
                       vision_result="原始识图",
                       refined_translation="原始翻译",
                       final_prompt="原始提示词")

        db.update_page(page_id,
                       refined_translation="修改后的翻译",
                       final_prompt="修改后的提示词",
                       status="translating")

        page = db.get_page(page_id)
        assert page["refined_translation"] == "修改后的翻译"
        assert page["status"] == "translating"

        db.update_page(page_id, status="completed")
        page = db.get_page(page_id)
        assert page["status"] == "completed"
        db.close()
