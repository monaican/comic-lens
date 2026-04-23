from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


class FileManager:
    def scan_images(self, directory: Path) -> list[Path]:
        if not directory.is_dir():
            return []
        images = [
            f for f in directory.iterdir()
            if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
        ]
        images.sort(key=lambda p: p.name)
        return images

    def ensure_output_dir(self, path: Path) -> Path:
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_cover_path(self, directory: Path) -> Path | None:
        images = self.scan_images(directory)
        return images[0] if images else None
