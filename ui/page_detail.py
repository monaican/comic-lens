from pathlib import Path
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QTextEdit,
    QPushButton, QSplitter, QGroupBox, QMessageBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from config import AppConfig
from storage.database import Database
from services.image_gen_service import ImageGenService
from workers.worker_pool import WorkerPool


class PageDetailDialog(QDialog):
    def __init__(self, page_id: str, db: Database, config: AppConfig,
                 project: dict, parent=None) -> None:
        super().__init__(parent)
        self.page_id = page_id
        self.db = db
        self.config = config
        self.project = project
        self.setWindowTitle("页面详情")
        self.setMinimumSize(900, 700)
        self._init_ui()
        self._load_data()

    def _init_ui(self) -> None:
        layout = QVBoxLayout(self)

        image_splitter = QSplitter(Qt.Orientation.Horizontal)

        orig_group = QGroupBox("原图")
        orig_layout = QVBoxLayout(orig_group)
        self.orig_label = QLabel()
        self.orig_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.orig_label.setMinimumSize(350, 350)
        orig_layout.addWidget(self.orig_label)
        image_splitter.addWidget(orig_group)

        trans_group = QGroupBox("译图")
        trans_layout = QVBoxLayout(trans_group)
        self.trans_label = QLabel("尚未生成")
        self.trans_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.trans_label.setMinimumSize(350, 350)
        trans_layout.addWidget(self.trans_label)
        image_splitter.addWidget(trans_group)

        layout.addWidget(image_splitter)

        text_splitter = QSplitter(Qt.Orientation.Horizontal)

        vision_group = QGroupBox("识图结果")
        vl = QVBoxLayout(vision_group)
        self.vision_edit = QTextEdit()
        vl.addWidget(self.vision_edit)
        text_splitter.addWidget(vision_group)

        refined_group = QGroupBox("精修翻译")
        rl = QVBoxLayout(refined_group)
        self.refined_edit = QTextEdit()
        rl.addWidget(self.refined_edit)
        text_splitter.addWidget(refined_group)

        prompt_group = QGroupBox("最终提示词")
        pl = QVBoxLayout(prompt_group)
        self.prompt_edit = QTextEdit()
        pl.addWidget(self.prompt_edit)
        text_splitter.addWidget(prompt_group)

        layout.addWidget(text_splitter)

        btn_layout = QHBoxLayout()
        self.regen_btn = QPushButton("重新生成图片")
        self.regen_btn.clicked.connect(self._regenerate)
        self.save_btn = QPushButton("保存修改")
        self.save_btn.clicked.connect(self._save)
        self.close_btn = QPushButton("关闭")
        self.close_btn.clicked.connect(self.close)
        btn_layout.addWidget(self.regen_btn)
        btn_layout.addWidget(self.save_btn)
        btn_layout.addStretch()
        btn_layout.addWidget(self.close_btn)
        layout.addLayout(btn_layout)

    def _load_data(self) -> None:
        page = self.db.get_page(self.page_id)
        if not page:
            return

        source_dir = Path(self.project["source_dir"])
        orig_path = source_dir / page["filename"]
        if orig_path.exists():
            pixmap = QPixmap(str(orig_path))
            self.orig_label.setPixmap(pixmap.scaled(
                self.orig_label.size(), Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation))

        output_dir = Path(self.config.output_base_dir) / self.project["name"]
        trans_path = output_dir / page["filename"]
        if trans_path.exists():
            pixmap = QPixmap(str(trans_path))
            self.trans_label.setPixmap(pixmap.scaled(
                self.trans_label.size(), Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation))

        self.vision_edit.setPlainText(page.get("vision_result", ""))
        self.refined_edit.setPlainText(page.get("refined_translation", ""))
        self.prompt_edit.setPlainText(page.get("final_prompt", ""))

    def _save(self) -> None:
        self.db.update_page(
            self.page_id,
            vision_result=self.vision_edit.toPlainText(),
            refined_translation=self.refined_edit.toPlainText(),
            final_prompt=self.prompt_edit.toPlainText(),
        )
        QMessageBox.information(self, "保存成功", "修改已保存。")

    def _regenerate(self) -> None:
        self._save()
        page = self.db.get_page(self.page_id)
        if not page:
            return

        prompt = self.prompt_edit.toPlainText()
        if not prompt.strip():
            QMessageBox.warning(self, "提示", "最终提示词为空，无法生成。")
            return

        source_dir = Path(self.project["source_dir"])
        img_path = source_dir / page["filename"]
        output_dir = Path(self.config.output_base_dir) / self.project["name"]
        output_dir.mkdir(parents=True, exist_ok=True)

        self.regen_btn.setEnabled(False)
        self.regen_btn.setText("生成中...")
        self.db.update_page(self.page_id, status="translating")

        image_gen_svc = ImageGenService(self.config.image_gen)
        pool = WorkerPool(max_workers=1)
        pool.page_finished.connect(self._on_regen_finished)
        pool.page_error.connect(self._on_regen_error)
        self._regen_pool = pool

        def task():
            return image_gen_svc.translate_page(img_path, prompt, output_dir, page["filename"])

        pool.submit(self.page_id, task)

    def _on_regen_finished(self, page_id: str, result: object) -> None:
        self.db.update_page(page_id, status="completed", error_message="")
        self.regen_btn.setEnabled(True)
        self.regen_btn.setText("重新生成图片")
        self._load_data()
        QMessageBox.information(self, "完成", "图片已重新生成。")

    def _on_regen_error(self, page_id: str, error: str) -> None:
        self.db.update_page(page_id, status="failed", error_message=error)
        self.regen_btn.setEnabled(True)
        self.regen_btn.setText("重新生成图片")
        QMessageBox.warning(self, "生成失败", error)
