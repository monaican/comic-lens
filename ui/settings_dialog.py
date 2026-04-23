from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QGroupBox,
    QLineEdit, QComboBox, QSpinBox, QTextEdit, QPushButton,
    QTabWidget, QScrollArea, QMessageBox, QLabel,
)
from PySide6.QtCore import Signal
from config import (
    AppConfig, ModelConfig,
    DEFAULT_VISION_PROMPT, DEFAULT_GLOBAL_ANALYSIS_PROMPT,
    DEFAULT_PAGE_TRANSLATE_PROMPT, DEFAULT_IMAGE_GEN_PROMPT,
)


class SettingsWidget(QWidget):
    config_changed = Signal()

    def __init__(self, config: AppConfig, parent=None) -> None:
        super().__init__(parent)
        self.config = config
        self._init_ui()
        self._load_config()

    def _init_ui(self) -> None:
        layout = QVBoxLayout(self)

        self.inner_tabs = QTabWidget()
        layout.addWidget(self.inner_tabs)

        self.inner_tabs.addTab(self._build_model_tab(), "模型配置")
        self.inner_tabs.addTab(self._build_general_tab(), "通用设置")
        self.inner_tabs.addTab(self._build_prompt_tab(), "提示词")

        btn_bar = QHBoxLayout()
        btn_bar.addStretch()
        save_btn = QPushButton("保存设置")
        save_btn.clicked.connect(self._save_config)
        btn_bar.addWidget(save_btn)
        layout.addLayout(btn_bar)

    def _build_model_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)

        self.vision_group = QGroupBox("识图模型")
        vf = QFormLayout()
        self.vision_provider = QComboBox()
        self.vision_provider.addItems(["openai", "anthropic"])
        self.vision_base_url = QLineEdit()
        self.vision_api_key = QLineEdit()
        self.vision_api_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.vision_model = QLineEdit()
        vf.addRow("Provider:", self.vision_provider)
        vf.addRow("Base URL:", self.vision_base_url)
        vf.addRow("API Key:", self.vision_api_key)
        vf.addRow("Model:", self.vision_model)
        self.vision_group.setLayout(vf)
        layout.addWidget(self.vision_group)

        self.reasoning_group = QGroupBox("推理模型")
        rf = QFormLayout()
        self.reasoning_provider = QComboBox()
        self.reasoning_provider.addItems(["openai", "anthropic"])
        self.reasoning_base_url = QLineEdit()
        self.reasoning_api_key = QLineEdit()
        self.reasoning_api_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.reasoning_model = QLineEdit()
        rf.addRow("Provider:", self.reasoning_provider)
        rf.addRow("Base URL:", self.reasoning_base_url)
        rf.addRow("API Key:", self.reasoning_api_key)
        rf.addRow("Model:", self.reasoning_model)
        self.reasoning_group.setLayout(rf)
        layout.addWidget(self.reasoning_group)

        self.image_gen_group = QGroupBox("图片生成 (GPT Image 2)")
        igf = QFormLayout()
        self.ig_base_url = QLineEdit()
        self.ig_api_key = QLineEdit()
        self.ig_api_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.ig_model = QLineEdit()
        igf.addRow("Base URL:", self.ig_base_url)
        igf.addRow("API Key:", self.ig_api_key)
        igf.addRow("Model:", self.ig_model)
        self.image_gen_group.setLayout(igf)
        layout.addWidget(self.image_gen_group)

        layout.addStretch()
        return widget

    def _build_general_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)

        group = QGroupBox("通用设置")
        gf = QFormLayout()
        self.concurrency_spin = QSpinBox()
        self.concurrency_spin.setRange(1, 20)
        self.max_retries_spin = QSpinBox()
        self.max_retries_spin.setRange(0, 10)
        self.output_dir = QLineEdit()
        self.default_source_lang = QLineEdit()
        self.default_target_lang = QLineEdit()
        gf.addRow("并发数:", self.concurrency_spin)
        gf.addRow("最大重试:", self.max_retries_spin)
        gf.addRow("输出目录:", self.output_dir)
        gf.addRow("默认源语言:", self.default_source_lang)
        gf.addRow("默认目标语言:", self.default_target_lang)
        group.setLayout(gf)
        layout.addWidget(group)

        layout.addStretch()
        return widget

    def _build_prompt_tab(self) -> QWidget:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        container = QWidget()
        layout = QVBoxLayout(container)

        hint = QLabel("留空则使用默认提示词。可用变量见各提示词说明。")
        hint.setStyleSheet("color: gray; font-size: 11px;")
        layout.addWidget(hint)

        self.vision_prompt_edit = self._add_prompt_group(
            layout, "识图提示词", "可用变量: {source_lang}",
            DEFAULT_VISION_PROMPT,
        )
        self.global_analysis_prompt_edit = self._add_prompt_group(
            layout, "全局分析提示词", "可用变量: {source_lang}, {target_lang}",
            DEFAULT_GLOBAL_ANALYSIS_PROMPT,
        )
        self.page_translate_prompt_edit = self._add_prompt_group(
            layout, "逐页翻译提示词", "可用变量: {master_prompt}, {source_lang}, {target_lang}",
            DEFAULT_PAGE_TRANSLATE_PROMPT,
        )
        self.image_gen_prompt_edit = self._add_prompt_group(
            layout, "生图提示词", "可用变量: {source_lang}, {target_lang}, {refined}",
            DEFAULT_IMAGE_GEN_PROMPT,
        )

        scroll.setWidget(container)
        return scroll

    def _add_prompt_group(self, parent_layout: QVBoxLayout, title: str,
                          hint: str, default: str) -> QTextEdit:
        group = QGroupBox(title)
        gl = QVBoxLayout()
        hint_label = QLabel(hint)
        hint_label.setStyleSheet("color: gray; font-size: 10px;")
        gl.addWidget(hint_label)
        edit = QTextEdit()
        edit.setMinimumHeight(120)
        edit.setPlaceholderText(default)
        gl.addWidget(edit)
        reset_btn = QPushButton("恢复默认")
        reset_btn.setFixedWidth(80)
        reset_btn.clicked.connect(lambda: edit.setPlainText(default))
        gl.addWidget(reset_btn)
        group.setLayout(gl)
        parent_layout.addWidget(group)
        return edit

    def _load_config(self) -> None:
        v = self.config.vision_model
        self.vision_provider.setCurrentText(v.provider)
        self.vision_base_url.setText(v.base_url)
        self.vision_api_key.setText(v.api_key)
        self.vision_model.setText(v.model)

        r = self.config.reasoning_model
        self.reasoning_provider.setCurrentText(r.provider)
        self.reasoning_base_url.setText(r.base_url)
        self.reasoning_api_key.setText(r.api_key)
        self.reasoning_model.setText(r.model)

        ig = self.config.image_gen
        self.ig_base_url.setText(ig.base_url)
        self.ig_api_key.setText(ig.api_key)
        self.ig_model.setText(ig.model)

        self.concurrency_spin.setValue(self.config.concurrency)
        self.max_retries_spin.setValue(self.config.max_retries)
        self.output_dir.setText(self.config.output_base_dir)
        self.default_source_lang.setText(self.config.default_source_lang)
        self.default_target_lang.setText(self.config.default_target_lang)

        self.vision_prompt_edit.setPlainText(self.config.vision_prompt or DEFAULT_VISION_PROMPT)
        self.global_analysis_prompt_edit.setPlainText(self.config.global_analysis_prompt or DEFAULT_GLOBAL_ANALYSIS_PROMPT)
        self.page_translate_prompt_edit.setPlainText(self.config.page_translate_prompt or DEFAULT_PAGE_TRANSLATE_PROMPT)
        self.image_gen_prompt_edit.setPlainText(self.config.image_gen_prompt or DEFAULT_IMAGE_GEN_PROMPT)

    def _save_config(self) -> None:
        self.config.vision_model = ModelConfig(
            provider=self.vision_provider.currentText(),
            base_url=self.vision_base_url.text(),
            api_key=self.vision_api_key.text(),
            model=self.vision_model.text(),
        )
        self.config.reasoning_model = ModelConfig(
            provider=self.reasoning_provider.currentText(),
            base_url=self.reasoning_base_url.text(),
            api_key=self.reasoning_api_key.text(),
            model=self.reasoning_model.text(),
        )
        self.config.image_gen = ModelConfig(
            base_url=self.ig_base_url.text(),
            api_key=self.ig_api_key.text(),
            model=self.ig_model.text(),
        )
        self.config.concurrency = self.concurrency_spin.value()
        self.config.max_retries = self.max_retries_spin.value()
        self.config.output_base_dir = self.output_dir.text()
        self.config.default_source_lang = self.default_source_lang.text()
        self.config.default_target_lang = self.default_target_lang.text()

        self.config.vision_prompt = self.vision_prompt_edit.toPlainText().strip()
        self.config.global_analysis_prompt = self.global_analysis_prompt_edit.toPlainText().strip()
        self.config.page_translate_prompt = self.page_translate_prompt_edit.toPlainText().strip()
        self.config.image_gen_prompt = self.image_gen_prompt_edit.toPlainText().strip()

        self.config.save()
        self.config_changed.emit()
        QMessageBox.information(self, "提示", "设置已保存。")
