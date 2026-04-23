from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QProgressBar, QLabel
from PySide6.QtCore import Qt, QTimer, QElapsedTimer


class ProgressWidget(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        top = QHBoxLayout()
        self.status_label = QLabel("就绪")
        self.count_label = QLabel("0/0")
        self.time_label = QLabel("")
        top.addWidget(self.status_label)
        top.addStretch()
        top.addWidget(self.time_label)
        top.addWidget(self.count_label)
        layout.addLayout(top)

        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        self._elapsed = QElapsedTimer()
        self._timer = QTimer(self)
        self._timer.setInterval(1000)
        self._timer.timeout.connect(self._update_time)
        self._running = False

    def start_timer(self) -> None:
        self._elapsed.start()
        self._running = True
        self._timer.start()
        self._update_time()

    def stop_timer(self) -> None:
        self._running = False
        self._timer.stop()
        self._update_time()

    def _update_time(self) -> None:
        if not self._running and not self._elapsed.isValid():
            self.time_label.setText("")
            return
        secs = self._elapsed.elapsed() // 1000
        m, s = divmod(secs, 60)
        h, m = divmod(m, 60)
        if h:
            self.time_label.setText(f"耗时 {h}:{m:02d}:{s:02d}")
        else:
            self.time_label.setText(f"耗时 {m}:{s:02d}")

    def update_progress(self, completed: int, total: int, status: str = "") -> None:
        self.count_label.setText(f"{completed}/{total}")
        if total > 0:
            self.progress_bar.setValue(int(completed / total * 100))
        else:
            self.progress_bar.setValue(0)
        if status:
            self.status_label.setText(status)

    def reset(self) -> None:
        self.progress_bar.setValue(0)
        self.count_label.setText("0/0")
        self.status_label.setText("就绪")
        self._running = False
        self._timer.stop()
        self.time_label.setText("")
