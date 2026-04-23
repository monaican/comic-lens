import tempfile
from pathlib import Path
from storage.database import Database


def test_create_and_get_project():
    with tempfile.TemporaryDirectory() as tmp:
        db = Database(Path(tmp) / "test.db")
        pid = db.create_project("TestComic", "/src", "/out", "日本語", "简体中文")
        proj = db.get_project(pid)
        assert proj["name"] == "TestComic"
        assert proj["source_dir"] == "/src"
        assert proj["status"] == "idle"
        db.close()


def test_create_and_list_pages():
    with tempfile.TemporaryDirectory() as tmp:
        db = Database(Path(tmp) / "test.db")
        pid = db.create_project("Test", "/src", "/out", "ja", "zh")
        db.create_page(pid, "page_001.jpg", 1)
        db.create_page(pid, "page_002.jpg", 2)
        pages = db.list_pages(pid)
        assert len(pages) == 2
        assert pages[0]["filename"] == "page_001.jpg"
        assert pages[0]["status"] == "pending"
        db.close()


def test_update_page_status():
    with tempfile.TemporaryDirectory() as tmp:
        db = Database(Path(tmp) / "test.db")
        pid = db.create_project("Test", "/src", "/out", "ja", "zh")
        page_id = db.create_page(pid, "page_001.jpg", 1)
        db.update_page(page_id, status="analyzed", vision_result="第一格\n右侧：你好")
        page = db.get_page(page_id)
        assert page["status"] == "analyzed"
        assert "你好" in page["vision_result"]
        db.close()


def test_list_projects():
    with tempfile.TemporaryDirectory() as tmp:
        db = Database(Path(tmp) / "test.db")
        db.create_project("Comic1", "/a", "/b", "ja", "zh")
        db.create_project("Comic2", "/c", "/d", "en", "zh")
        projects = db.list_projects()
        assert len(projects) == 2
        db.close()


def test_delete_project_cascades_pages():
    with tempfile.TemporaryDirectory() as tmp:
        db = Database(Path(tmp) / "test.db")
        pid = db.create_project("Test", "/src", "/out", "ja", "zh")
        db.create_page(pid, "p1.jpg", 1)
        db.delete_project(pid)
        assert db.get_project(pid) is None
        assert db.list_pages(pid) == []
        db.close()
