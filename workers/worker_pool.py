from typing import Callable
from PySide6.QtCore import QObject, QThreadPool, Signal
from workers.translate_worker import TranslateWorker


class WorkerPool(QObject):
    all_finished = Signal()
    page_finished = Signal(str, object)
    page_error = Signal(str, str)
    page_progress = Signal(str, str)

    def __init__(self, max_workers: int = 3, max_retries: int = 3, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.pool = QThreadPool()
        self.pool.setMaxThreadCount(max_workers)
        self.max_retries = max_retries
        self._pending = 0
        self._stopped = False

    def submit(self, page_id: str, task_fn: Callable, use_progress: bool = False) -> None:
        if self._stopped:
            return
        self._pending += 1
        worker = TranslateWorker(page_id, task_fn, use_progress, max_retries=self.max_retries)
        worker.signals.finished.connect(self._on_finished)
        worker.signals.error.connect(self._on_error)
        worker.signals.progress.connect(self._on_progress)
        self.pool.start(worker)

    def stop(self) -> None:
        self._stopped = True

    def reset(self) -> None:
        self._stopped = False
        self._pending = 0

    def wait_for_done(self, timeout_ms: int = -1) -> bool:
        return self.pool.waitForDone(timeout_ms)

    def _on_finished(self, page_id: str, result: object) -> None:
        self.page_finished.emit(page_id, result)
        self._pending -= 1
        if self._pending <= 0:
            self.all_finished.emit()

    def _on_error(self, page_id: str, error: str) -> None:
        self.page_error.emit(page_id, error)
        self._pending -= 1
        if self._pending <= 0:
            self.all_finished.emit()

    def _on_progress(self, page_id: str, status: str) -> None:
        self.page_progress.emit(page_id, status)
