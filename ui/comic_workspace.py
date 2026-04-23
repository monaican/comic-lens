from pathlib import Path
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QScrollArea, QGridLayout, QFrame, QMessageBox, QGroupBox, QTextEdit,
)
from PySide6.QtCore import Signal, Qt, Slot
from PySide6.QtGui import QPixmap
from config import AppConfig
from storage.database import Database
from storage.file_manager import FileManager
from ui.progress_widget import ProgressWidget
from workers.worker_pool import WorkerPool
from services.vision_service import VisionService
from services.reasoning_service import ReasoningService
from services.image_gen_service import ImageGenService
from log import logger

PAGE_STATUS_ICONS = {
    "pending": "⬜",
    "analyzing": "🔍",
    "analyzed": "📝",
    "translating": "⏳",
    "completed": "✅",
    "failed": "❌",
}


class PageThumbnail(QFrame):
    double_clicked = Signal(str)

    def __init__(self, page: dict, source_dir: Path, parent=None) -> None:
        super().__init__(parent)
        self.page_id = page["id"]
        self.setFrameStyle(QFrame.Shape.Box)
        self.setFixedSize(120, 150)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(3, 3, 3, 3)

        thumb = QLabel()
        thumb.setFixedSize(110, 110)
        thumb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        thumb.setScaledContents(True)
        img_path = source_dir / page["filename"]
        if img_path.exists():
            pixmap = QPixmap(str(img_path))
            thumb.setPixmap(pixmap.scaled(
                220, 220, Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.FastTransformation))
        else:
            thumb.setText("?")
        layout.addWidget(thumb)

        status_icon = PAGE_STATUS_ICONS.get(page["status"], "?")
        info = QLabel(f"{status_icon} {page['filename']}")
        info.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info.setStyleSheet("font-size: 10px;")
        info.setWordWrap(True)
        layout.addWidget(info)

    def mouseDoubleClickEvent(self, event) -> None:
        self.double_clicked.emit(self.page_id)


class ComicWorkspace(QWidget):
    def __init__(self, project_id: str, db: Database, file_manager: FileManager,
                 config: AppConfig, parent=None) -> None:
        super().__init__(parent)
        self.project_id = project_id
        self.db = db
        self.file_manager = file_manager
        self.config = config
        self.worker_pool: WorkerPool | None = None
        self._init_ui()
        self.refresh()

    def _init_ui(self) -> None:
        layout = QVBoxLayout(self)

        info_bar = QHBoxLayout()
        self.name_label = QLabel()
        self.name_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        self.lang_label = QLabel()
        self.status_label = QLabel()
        info_bar.addWidget(self.name_label)
        info_bar.addWidget(self.lang_label)
        info_bar.addStretch()
        info_bar.addWidget(self.status_label)
        layout.addLayout(info_bar)

        self.progress = ProgressWidget()
        layout.addWidget(self.progress)

        self.master_group = QGroupBox("全局分析结果（总控提示词）")
        self.master_group.setCheckable(True)
        self.master_group.setChecked(False)
        mg_layout = QVBoxLayout()
        self.master_edit = QTextEdit()
        self.master_edit.setPlaceholderText("全局分析完成后会在此显示总控提示词，也可手动编辑。")
        self.master_edit.setMaximumHeight(100)
        mg_layout.addWidget(self.master_edit)
        master_btn_bar = QHBoxLayout()
        self.master_save_btn = QPushButton("保存")
        self.master_save_btn.setFixedWidth(80)
        self.master_save_btn.clicked.connect(self._save_master_prompt)
        master_btn_bar.addStretch()
        master_btn_bar.addWidget(self.master_save_btn)
        mg_layout.addLayout(master_btn_bar)
        self.master_group.setLayout(mg_layout)
        layout.addWidget(self.master_group)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.grid_container = QWidget()
        self.grid_layout = QGridLayout(self.grid_container)
        self.grid_layout.setSpacing(10)
        self.grid_layout.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.scroll.setWidget(self.grid_container)
        layout.addWidget(self.scroll)

        action_bar = QHBoxLayout()
        self.start_btn = QPushButton("开始翻译")
        self.start_btn.clicked.connect(self._start_translation)
        self.stop_btn = QPushButton("停止")
        self.stop_btn.clicked.connect(self._stop_translation)
        self.stop_btn.setEnabled(False)
        self.retry_btn = QPushButton("重试失败")
        self.retry_btn.clicked.connect(self._retry_failed)
        action_bar.addWidget(self.start_btn)
        action_bar.addWidget(self.stop_btn)
        action_bar.addWidget(self.retry_btn)
        action_bar.addStretch()
        layout.addLayout(action_bar)

        self._thumbnails: list[PageThumbnail] = []

    def refresh(self) -> None:
        project = self.db.get_project(self.project_id)
        if not project:
            return
        self.name_label.setText(project["name"])
        self.lang_label.setText(f"{project['source_lang']} → {project['target_lang']}")
        self.status_label.setText(project["status"])

        master_prompt = project.get("master_prompt", "")
        self.master_edit.setPlainText(master_prompt)
        if master_prompt:
            self.master_group.setChecked(True)

        pages = self.db.list_pages(self.project_id)
        completed = sum(1 for p in pages if p["status"] == "completed")
        self.progress.update_progress(completed, len(pages))

        for t in self._thumbnails:
            t.deleteLater()
        self._thumbnails.clear()

        source_dir = Path(project["source_dir"])
        cols = max(1, self.scroll.width() // 140)
        for i, page in enumerate(pages):
            thumb = PageThumbnail(page, source_dir)
            thumb.double_clicked.connect(self._open_page_detail)
            self.grid_layout.addWidget(thumb, i // cols, i % cols)
            self._thumbnails.append(thumb)

    def _start_translation(self) -> None:
        project = self.db.get_project(self.project_id)
        if not project:
            return

        pages = self.db.list_pages(self.project_id)

        # 恢复中断状态：根据已有数据判断实际进度
        for p in pages:
            if p["status"] in ("analyzing", "translating"):
                if p["final_prompt"]:
                    self.db.update_page(p["id"], status="analyzed")
                elif p["vision_result"]:
                    self.db.update_page(p["id"], status="analyzed")
                else:
                    self.db.update_page(p["id"], status="pending")
        pages = self.db.list_pages(self.project_id)

        # 分类：根据数据判断每页需要从哪个阶段开始
        need_vision = []
        need_translate = []
        need_image_gen = []

        for p in pages:
            if p["status"] == "completed":
                continue
            if not p["vision_result"]:
                need_vision.append(p)
            elif not p["refined_translation"]:
                need_translate.append(p)
            elif not p["final_prompt"]:
                need_translate.append(p)
            else:
                output_dir = Path(self.config.output_base_dir) / project["name"]
                output_path = output_dir / p["filename"]
                if not output_path.exists():
                    need_image_gen.append(p)

        if not need_vision and not need_translate and not need_image_gen:
            QMessageBox.information(self, "提示", "没有需要处理的页面。")
            return

        logger.info(f"[任务] 识图={len(need_vision)}, 翻译={len(need_translate)}, 生图={len(need_image_gen)}")

        self.start_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.progress.start_timer()

        self.worker_pool = WorkerPool(
            max_workers=self.config.concurrency,
            max_retries=self.config.max_retries,
        )
        self.worker_pool.page_finished.connect(self._on_page_finished)
        self.worker_pool.page_error.connect(self._on_page_error)
        self.worker_pool.page_progress.connect(self._on_page_progress)
        self.worker_pool.all_finished.connect(self._on_all_finished)

        if need_vision:
            self._current_phase = "vision"
            self.db.update_project(self.project_id, status="analyzing")
            vision_svc = VisionService(self.config.vision_model, self.config.get_vision_prompt())
            source_dir = Path(project["source_dir"])
            for page in need_vision:
                self.db.update_page(page["id"], status="analyzing")
                img_path = source_dir / page["filename"]
                page_id = page["id"]
                source_lang = project["source_lang"]

                def make_task(p=img_path, pid=page_id, sl=source_lang):
                    def task():
                        img_bytes = p.read_bytes()
                        return vision_svc.analyze_page(p, img_bytes, sl)
                    return task

                self.worker_pool.submit(page_id, make_task())
        elif need_translate:
            self._resume_from_translate(project, need_translate, need_image_gen)
        elif need_image_gen:
            self._start_phase_four_image_gen(project, need_image_gen)

    def _on_page_finished(self, page_id: str, result: object) -> None:
        if page_id == "__global_analysis__":
            self._on_global_analysis_finished(str(result))
            return
        page = self.db.get_page(page_id)
        if not page:
            return

        if page["status"] == "analyzing":
            self.db.update_page(page_id, status="analyzed", vision_result=str(result), summary=str(result)[:100])
            self.refresh()
            pages = self.db.list_pages(self.project_id)
            all_analyzed = all(p["status"] in ("analyzed", "completed") for p in pages)
            if all_analyzed:
                self._start_phase_two()

        elif self._current_phase == "translate":
            refined = str(result)
            project = self.db.get_project(self.project_id)
            source_lang = project["source_lang"] if project else ""
            target_lang = project["target_lang"] if project else ""
            final_prompt = self.config.get_image_gen_prompt().format(
                source_lang=source_lang, target_lang=target_lang, refined=refined
            )
            self.db.update_page(page_id, status="analyzed",
                                refined_translation=refined, final_prompt=final_prompt)
            self.refresh()

        elif self._current_phase == "image_gen":
            self.db.update_page(page_id, status="completed")
            self.refresh()

    def _start_phase_two(self) -> None:
        project = self.db.get_project(self.project_id)
        if not project:
            return
        pages = self.db.list_pages(self.project_id)
        analyzed = [p for p in pages if p["status"] == "analyzed"]
        if not analyzed:
            return

        # 如果已有 master_prompt，跳过全局分析直接翻译
        if project.get("master_prompt"):
            need_translate = [p for p in analyzed if not p["refined_translation"]]
            if need_translate:
                self._start_phase_three_translate(project, need_translate)
            return

        self._current_phase = "analysis"
        self.db.update_project(self.project_id, status="translating")
        self.progress.update_progress(0, len(pages), "全局分析中...")

        reasoning_svc = ReasoningService(
            self.config.reasoning_model,
            self.config.get_global_analysis_prompt(),
            self.config.get_page_translate_prompt(),
        )
        vision_results = {p["filename"]: p["vision_result"] for p in analyzed}

        def analysis_task():
            return reasoning_svc.analyze_global(
                vision_results, project["source_lang"], project["target_lang"]
            )

        self.worker_pool.submit("__global_analysis__", analysis_task)

    def _resume_from_translate(self, project: dict, need_translate: list[dict],
                               need_image_gen: list[dict]) -> None:
        if not project.get("master_prompt"):
            pages = self.db.list_pages(self.project_id)
            all_with_vision = [p for p in pages if p["vision_result"]]
            self._current_phase = "analysis"
            self.db.update_project(self.project_id, status="translating")
            self.progress.update_progress(0, len(pages), "全局分析中...")

            reasoning_svc = ReasoningService(
                self.config.reasoning_model,
                self.config.get_global_analysis_prompt(),
                self.config.get_page_translate_prompt(),
            )
            vision_results = {p["filename"]: p["vision_result"] for p in all_with_vision}

            def analysis_task():
                return reasoning_svc.analyze_global(
                    vision_results, project["source_lang"], project["target_lang"]
                )

            self.worker_pool.submit("__global_analysis__", analysis_task)
        else:
            self._start_phase_three_translate(project, need_translate)

    def _on_global_analysis_finished(self, master_prompt: str) -> None:
        self.db.update_project(self.project_id, master_prompt=master_prompt)
        project = self.db.get_project(self.project_id)
        pages = self.db.list_pages(self.project_id)
        need_translate = [p for p in pages if p["vision_result"] and not p["refined_translation"]
                          and p["status"] != "completed"]
        if need_translate:
            self._start_phase_three_translate(project, need_translate)
        else:
            self._on_all_finished()

    def _start_phase_three_translate(self, project: dict, pages: list[dict]) -> None:
        self._current_phase = "translate"
        self.progress.update_progress(0, len(pages), "逐页翻译中...")

        reasoning_svc = ReasoningService(
            self.config.reasoning_model,
            self.config.get_global_analysis_prompt(),
            self.config.get_page_translate_prompt(),
        )
        master_prompt = project.get("master_prompt", "")
        source_lang = project["source_lang"]
        target_lang = project["target_lang"]

        for page in pages:
            self.db.update_page(page["id"], status="translating")
            page_id = page["id"]
            vision_result = page["vision_result"]

            def make_task(mp=master_prompt, vr=vision_result, sl=source_lang, tl=target_lang):
                def task():
                    return reasoning_svc.translate_page(mp, vr, sl, tl)
                return task

            self.worker_pool.submit(page_id, make_task())

    def _start_phase_four_image_gen(self, project: dict, pages: list[dict]) -> None:
        self._current_phase = "image_gen"
        self.progress.update_progress(0, len(pages), "图片生成中...")

        image_gen_svc = ImageGenService(self.config.image_gen)
        source_dir = Path(project["source_dir"])
        output_dir = Path(self.config.output_base_dir) / project["name"]
        output_dir.mkdir(parents=True, exist_ok=True)

        for page in pages:
            self.db.update_page(page["id"], status="translating")
            page_data = self.db.get_page(page["id"])
            img_path = source_dir / page["filename"]
            prompt = page_data["final_prompt"] if page_data else ""
            page_id = page["id"]
            filename = page["filename"]

            def make_task(p=img_path, pr=prompt, od=output_dir, fn=filename):
                def task():
                    return image_gen_svc.translate_page(p, pr, od, fn)
                return task

            self.worker_pool.submit(page_id, make_task())

    def _on_page_error(self, page_id: str, error: str) -> None:
        if page_id == "__global_analysis__":
            logger.error(f"[全局分析] 失败: {error}")
            QMessageBox.warning(self, "全局分析失败", error)
            self._on_all_finished()
            return
        page = self.db.get_page(page_id)
        filename = page["filename"] if page else page_id[:8]
        phase_label = {"vision": "识图", "translate": "翻译", "image_gen": "生图"}.get(self._current_phase, self._current_phase)
        logger.error(f"[{phase_label}] 页面失败: {filename}: {error}")
        self.db.update_page(page_id, status="failed",
                            error_message=f"[{phase_label}] {error}")
        self.refresh()

    def _on_page_progress(self, page_id: str, status: str) -> None:
        self.progress.status_label.setText(f"{page_id[:8]}: {status}")

    def _on_all_finished(self) -> None:
        project = self.db.get_project(self.project_id)
        pages = self.db.list_pages(self.project_id)

        # 检查是否有页面需要进入下一阶段
        if self._current_phase in ("vision", "analysis", "translate"):
            need_translate = [p for p in pages if p["vision_result"] and not p["refined_translation"]
                              and p["status"] not in ("completed", "failed")]
            need_image_gen = [p for p in pages if p["final_prompt"] and p["status"] not in ("completed", "failed")]

            if need_translate and project:
                if not project.get("master_prompt"):
                    self.worker_pool.reset()
                    self._resume_from_translate(project, need_translate, need_image_gen)
                    return
                self.worker_pool.reset()
                self._start_phase_three_translate(project, need_translate)
                return

            if need_image_gen and project:
                output_dir = Path(self.config.output_base_dir) / project["name"]
                actually_need = [p for p in need_image_gen
                                 if not (output_dir / p["filename"]).exists()]
                if actually_need:
                    self.worker_pool.reset()
                    self._start_phase_four_image_gen(project, actually_need)
                    return

        all_done = all(p["status"] == "completed" for p in pages)
        has_failed = any(p["status"] == "failed" for p in pages)
        if all_done:
            self.db.update_project(self.project_id, status="completed")
        elif has_failed:
            self.db.update_project(self.project_id, status="failed")
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.progress.stop_timer()
        self.refresh()

    def _save_master_prompt(self) -> None:
        text = self.master_edit.toPlainText().strip()
        self.db.update_project(self.project_id, master_prompt=text)
        QMessageBox.information(self, "提示", "总控提示词已保存。")

    def _stop_translation(self) -> None:
        if self.worker_pool:
            self.worker_pool.stop()
        self.progress.stop_timer()
        # 恢复中断页面状态
        pages = self.db.list_pages(self.project_id)
        for p in pages:
            if p["status"] in ("analyzing", "translating"):
                if p["final_prompt"]:
                    self.db.update_page(p["id"], status="analyzed")
                elif p["vision_result"]:
                    self.db.update_page(p["id"], status="analyzed")
                else:
                    self.db.update_page(p["id"], status="pending")
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.refresh()

    def _retry_failed(self) -> None:
        project = self.db.get_project(self.project_id)
        if not project:
            return
        pages = self.db.list_pages(self.project_id)
        failed = [p for p in pages if p["status"] == "failed"]
        if not failed:
            QMessageBox.information(self, "提示", "没有失败的页面。")
            return

        retry_vision = []
        retry_translate = []
        retry_image_gen = []

        for p in failed:
            self.db.update_page(p["id"], error_message="", retry_count=p["retry_count"] + 1)
            error_msg = p.get("error_message", "")
            if error_msg.startswith("[生图]") and p["final_prompt"]:
                retry_image_gen.append(p)
            elif error_msg.startswith("[翻译]") and p["vision_result"]:
                retry_translate.append(p)
            elif p["final_prompt"]:
                retry_image_gen.append(p)
            elif p["vision_result"]:
                retry_translate.append(p)
            else:
                retry_vision.append(p)

        self.start_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.progress.start_timer()

        self.worker_pool = WorkerPool(
            max_workers=self.config.concurrency,
            max_retries=self.config.max_retries,
        )
        self.worker_pool.page_finished.connect(self._on_page_finished)
        self.worker_pool.page_error.connect(self._on_page_error)
        self.worker_pool.page_progress.connect(self._on_page_progress)
        self.worker_pool.all_finished.connect(self._on_all_finished)

        if retry_vision:
            logger.info(f"[重试] 识图阶段: {len(retry_vision)}页")
            self._current_phase = "vision"
            vision_svc = VisionService(self.config.vision_model, self.config.get_vision_prompt())
            source_dir = Path(project["source_dir"])
            for p in retry_vision:
                self.db.update_page(p["id"], status="analyzing")
                img_path = source_dir / p["filename"]
                page_id = p["id"]
                source_lang = project["source_lang"]
                def make_task(pa=img_path, sl=source_lang):
                    def task():
                        return vision_svc.analyze_page(pa, pa.read_bytes(), sl)
                    return task
                self.worker_pool.submit(page_id, make_task())

        if retry_translate:
            logger.info(f"[重试] 翻译阶段: {len(retry_translate)}页")
            self._current_phase = "translate"
            reasoning_svc = ReasoningService(
                self.config.reasoning_model,
                self.config.get_global_analysis_prompt(),
                self.config.get_page_translate_prompt(),
            )
            master_prompt = project.get("master_prompt", "")
            for p in retry_translate:
                self.db.update_page(p["id"], status="translating")
                page_id = p["id"]
                vision_result = p["vision_result"]
                sl = project["source_lang"]
                tl = project["target_lang"]
                def make_task(mp=master_prompt, vr=vision_result, s=sl, t=tl):
                    def task():
                        return reasoning_svc.translate_page(mp, vr, s, t)
                    return task
                self.worker_pool.submit(page_id, make_task())

        if retry_image_gen:
            logger.info(f"[重试] 生图阶段: {len(retry_image_gen)}页")
            self._current_phase = "image_gen"
            image_gen_svc = ImageGenService(self.config.image_gen)
            source_dir = Path(project["source_dir"])
            output_dir = Path(self.config.output_base_dir) / project["name"]
            output_dir.mkdir(parents=True, exist_ok=True)
            for p in retry_image_gen:
                self.db.update_page(p["id"], status="translating")
                img_path = source_dir / p["filename"]
                page_data = self.db.get_page(p["id"])
                prompt = page_data["final_prompt"] if page_data else ""
                page_id = p["id"]
                filename = p["filename"]
                def make_task(pa=img_path, pr=prompt, od=output_dir, fn=filename):
                    def task():
                        return image_gen_svc.translate_page(pa, pr, od, fn)
                    return task
                self.worker_pool.submit(page_id, make_task())

        if not retry_vision and not retry_translate and not retry_image_gen:
            self.start_btn.setEnabled(True)
            self.stop_btn.setEnabled(False)

    def _open_page_detail(self, page_id: str) -> None:
        from ui.page_detail import PageDetailDialog
        project = self.db.get_project(self.project_id)
        if not project:
            return
        dlg = PageDetailDialog(page_id, self.db, self.config, project, self)
        dlg.exec()
        self.refresh()
