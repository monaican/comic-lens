import logging
import sys
from pathlib import Path

LOG_DIR = Path(__file__).parent / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "comics-translate.log"


logger = logging.getLogger("comics-translate")
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
))

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s"
))

logger.addHandler(file_handler)
logger.addHandler(console_handler)
