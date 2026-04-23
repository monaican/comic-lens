from PySide6.QtCore import QObject, QRunnable, Signal, Slot
from typing import Callable
import time
from log import logger


class WorkerSignals(QObject):
    finished = Signal(str, object)
    error = Signal(str, str)
    progress = Signal(str, str)


class TranslateWorker(QRunnable):
    def __init__(self, page_id: str, task_fn: Callable, use_progress: bool = False,
                 max_retries: int = 3) -> None:
        super().__init__()
        self.page_id = page_id
        self.task_fn = task_fn
        self.use_progress = use_progress
        self.max_retries = max_retries
        self.signals = WorkerSignals()
        self.setAutoDelete(True)

    @Slot()
    def run(self) -> None:
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    delay = 2 ** attempt
                    logger.info(f"[Worker] 重试 {attempt}/{self.max_retries} page_id={self.page_id}, {delay}s后重试")
                    self.signals.progress.emit(self.page_id, f"重试 {attempt}/{self.max_retries}...")
                    time.sleep(delay)
                if self.use_progress:
                    result = self.task_fn(
                        progress_callback=lambda msg: self.signals.progress.emit(self.page_id, msg)
                    )
                else:
                    result = self.task_fn()
                if attempt > 0:
                    logger.info(f"[Worker] 重试成功 page_id={self.page_id}, 第{attempt}次重试")
                self.signals.finished.emit(self.page_id, result)
                return
            except Exception as e:
                last_error = e
                logger.warning(f"[Worker] 任务失败 page_id={self.page_id}, 尝试 {attempt + 1}/{self.max_retries + 1}: {e}")

        logger.error(f"[Worker] 任务最终失败 page_id={self.page_id}, 已重试{self.max_retries}次: {last_error}")
        self.signals.error.emit(self.page_id, str(last_error))
