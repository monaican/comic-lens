import tempfile
from pathlib import Path
from storage.file_manager import FileManager


def test_scan_images_from_directory():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "comic"
        src.mkdir()
        (src / "page_001.jpg").write_bytes(b"fake")
        (src / "page_002.png").write_bytes(b"fake")
        (src / "readme.txt").write_text("not an image")
        fm = FileManager()
        images = fm.scan_images(src)
        assert len(images) == 2
        assert images[0].name == "page_001.jpg"
        assert images[1].name == "page_002.png"


def test_scan_images_sorted_by_name():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "comic"
        src.mkdir()
        (src / "003.jpg").write_bytes(b"fake")
        (src / "001.jpg").write_bytes(b"fake")
        (src / "002.jpg").write_bytes(b"fake")
        fm = FileManager()
        images = fm.scan_images(src)
        assert [img.name for img in images] == ["001.jpg", "002.jpg", "003.jpg"]


def test_ensure_output_dir():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "output" / "my_comic"
        fm = FileManager()
        result = fm.ensure_output_dir(out)
        assert result.exists()
        assert result == out


def test_get_cover_path_empty_dir():
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "empty"
        src.mkdir()
        fm = FileManager()
        assert fm.get_cover_path(src) is None
