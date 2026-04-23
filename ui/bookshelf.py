from pathlib import Path
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QScrollArea,
    QPushButton, QLineEdit, QLabel, QFileDialog, QMessageBox,
    QFrame, QInputDialog,
)
from PySide6.QtCore import Signal, Qt
from PySide6.QtGui import QPixmap
from storage.database import Database
from storage.file_manager import FileManager

STATUS_LABELS = {
    "idle": "未开始",
    "analyzing": "分析中",
    "translating": "翻译中",
    "completed": "已完成",
    "failed": "失败",
}


class ComicCard(QFrame):
    clicked = Signal(str)
    double_clicked = Signal(str)

    def __init__(self, project: dict, cover_path: Path | None, parent=None) -> None:
        super().__init__(parent)
        self.project_id = project["id"]
        self.setFrameStyle(QFrame.Shape.Box | QFrame.Shadow.Raised)
        self.setFixedSize(160, 220)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)

        cover_label = QLabel()
        cover_label.setFixedSize(150, 170)
        cover_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        cover_label.setScaledContents(True)
        if cover_path and cover_path.exists():
            pixmap = QPixmap(str(cover_path))
            cover_label.setPixmap(pixmap)
        else:
            cover_label.setText("无封面")
            cover_label.setStyleSheet("background-color: #eee; color: #999;")
        layout.addWidget(cover_label)

        name_label = QLabel(project["name"])
        name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_label.setWordWrap(True)
        layout.addWidget(name_label)

        status_text = STATUS_LABELS.get(project["status"], project["status"])
        status_label = QLabel(status_text)
        status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        status_label.setStyleSheet("color: #666; font-size: 11px;")
        layout.addWidget(status_label)

    def mouseDoubleClickEvent(self, event) -> None:
        self.double_clicked.emit(self.project_id)


class BookshelfWidget(QWidget):
    comic_opened = Signal(str)

    def __init__(self, db: Database, file_manager: FileManager, parent=None) -> None:
        super().__init__(parent)
        self.db = db
        self.file_manager = file_manager
        self._init_ui()
        self.refresh()

    def _init_ui(self) -> None:
        main_layout = QVBoxLayout(self)

        toolbar = QHBoxLayout()
        self.import_btn = QPushButton("导入漫画集")
        self.import_btn.clicked.connect(self.import_comic)
        self.delete_btn = QPushButton("删除")
        self.delete_btn.clicked.connect(self._delete_selected)
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("搜索...")
        self.search_input.textChanged.connect(self._filter_cards)
        toolbar.addWidget(self.import_btn)
        toolbar.addWidget(self.delete_btn)
        toolbar.addStretch()
        toolbar.addWidget(self.search_input)
        main_layout.addLayout(toolbar)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.grid_container = QWidget()
        self.grid_layout = QGridLayout(self.grid_container)
        self.grid_layout.setSpacing(15)
        self.grid_layout.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.scroll.setWidget(self.grid_container)
        main_layout.addWidget(self.scroll)

        self._cards: list[ComicCard] = []
        self._selected_id: str | None = None

    def import_comic(self) -> None:
        dir_path = QFileDialog.getExistingDirectory(self, "选择漫画文件夹")
        if not dir_path:
            return
        src = Path(dir_path)
        images = self.file_manager.scan_images(src)
        if not images:
            QMessageBox.warning(self, "导入失败", "所选文件夹中没有找到图片文件。")
            return

        name = src.name
        source_lang, ok1 = QInputDialog.getText(self, "源语言", "请输入源语言:", text="日本語")
        if not ok1:
            return
        target_lang, ok2 = QInputDialog.getText(self, "目标语言", "请输入目标语言:", text="简体中文")
        if not ok2:
            return

        output_dir = str(Path("output") / name)
        pid = self.db.create_project(name, str(src), output_dir, source_lang, target_lang)

        for i, img in enumerate(images):
            self.db.create_page(pid, img.name, i + 1)

        self.refresh()

    def _delete_selected(self) -> None:
        if not self._selected_id:
            QMessageBox.information(self, "提示", "请先双击选择一个漫画集。")
            return
        reply = QMessageBox.question(self, "确认删除", "确定要删除这个漫画集吗？")
        if reply == QMessageBox.StandardButton.Yes:
            self.db.delete_project(self._selected_id)
            self._selected_id = None
            self.refresh()

    def refresh(self) -> None:
        for card in self._cards:
            card.deleteLater()
        self._cards.clear()

        projects = self.db.list_projects()
        cols = max(1, self.scroll.width() // 180)
        for i, proj in enumerate(projects):
            cover = self.file_manager.get_cover_path(Path(proj["source_dir"]))
            card = ComicCard(proj, cover)
            card.double_clicked.connect(self._on_card_double_clicked)
            self.grid_layout.addWidget(card, i // cols, i % cols)
            self._cards.append(card)

    def _on_card_double_clicked(self, project_id: str) -> None:
        self._selected_id = project_id
        self.comic_opened.emit(project_id)

    def _filter_cards(self, text: str) -> None:
        for card in self._cards:
            card.setVisible(text.lower() in card.findChild(QLabel).text().lower() if text else True)
