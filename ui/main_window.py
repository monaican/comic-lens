from PySide6.QtWidgets import QMainWindow, QTabWidget, QStatusBar
from config import AppConfig
from storage.database import Database
from storage.file_manager import FileManager
from ui.settings_dialog import SettingsWidget
from ui.bookshelf import BookshelfWidget
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("漫画翻译工具")
        self.setMinimumSize(1000, 700)

        self.config = AppConfig.load()
        self.db = Database(DATA_DIR / "comics.db")
        self.file_manager = FileManager()
        self._open_tabs: dict[str, int] = {}

        self._init_menu()
        self._init_tabs()
        self._init_statusbar()

    def _init_menu(self) -> None:
        menubar = self.menuBar()
        file_menu = menubar.addMenu("文件")
        file_menu.addAction("导入漫画集", self._import_comic)
        file_menu.addSeparator()
        file_menu.addAction("退出", self.close)

    def _init_tabs(self) -> None:
        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self._close_tab)

        self.bookshelf = BookshelfWidget(self.db, self.file_manager, self)
        self.bookshelf.comic_opened.connect(self._open_comic_tab)
        self.tabs.addTab(self.bookshelf, "我的书架")
        self.tabs.tabBar().setTabButton(0, self.tabs.tabBar().ButtonPosition.RightSide, None)

        self.settings_widget = SettingsWidget(self.config, self)
        self.settings_widget.config_changed.connect(self._on_config_changed)
        self.tabs.addTab(self.settings_widget, "设置")
        self.tabs.tabBar().setTabButton(1, self.tabs.tabBar().ButtonPosition.RightSide, None)

        self.setCentralWidget(self.tabs)

    def _init_statusbar(self) -> None:
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("就绪")

    def _import_comic(self) -> None:
        self.bookshelf.import_comic()

    def _on_config_changed(self) -> None:
        self.config = AppConfig.load()

    def _open_comic_tab(self, project_id: str) -> None:
        if project_id in self._open_tabs:
            self.tabs.setCurrentIndex(self._open_tabs[project_id])
            return
        from ui.comic_workspace import ComicWorkspace
        project = self.db.get_project(project_id)
        if not project:
            return
        workspace = ComicWorkspace(project_id, self.db, self.file_manager, self.config, self)
        idx = self.tabs.addTab(workspace, project["name"])
        self._open_tabs[project_id] = idx
        self.tabs.setCurrentIndex(idx)

    def _close_tab(self, index: int) -> None:
        if index <= 1:
            return
        widget = self.tabs.widget(index)
        pid = None
        for k, v in self._open_tabs.items():
            if v == index:
                pid = k
                break
        if pid:
            del self._open_tabs[pid]
        for k in self._open_tabs:
            if self._open_tabs[k] > index:
                self._open_tabs[k] -= 1
        self.tabs.removeTab(index)
        widget.deleteLater()

    def closeEvent(self, event) -> None:
        self.db.close()
        event.accept()
