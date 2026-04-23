import io
from PIL import Image
from log import logger

MAX_DIMENSION = 1920


def resize_image_if_needed(image_bytes: bytes, max_dim: int = MAX_DIMENSION) -> bytes:
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        return image_bytes
    w, h = img.size
    if w <= max_dim and h <= max_dim:
        return image_bytes

    if w >= h:
        new_w = max_dim
        new_h = int(h * max_dim / w)
    else:
        new_h = max_dim
        new_w = int(w * max_dim / h)

    logger.info(f"[Resize] {w}x{h} -> {new_w}x{new_h}")
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    fmt = img.format or "PNG"
    if fmt.upper() == "JPEG" or img.mode == "RGB":
        img.save(buf, format="JPEG", quality=90)
    else:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        img.save(buf, format="PNG")
    return buf.getvalue()
