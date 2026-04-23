import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class Database:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def _create_tables(self) -> None:
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_dir TEXT NOT NULL,
                output_dir TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                master_prompt TEXT DEFAULT '',
                status TEXT DEFAULT 'idle',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pages (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                page_order INTEGER NOT NULL,
                summary TEXT DEFAULT '',
                vision_result TEXT DEFAULT '',
                refined_translation TEXT DEFAULT '',
                final_prompt TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                error_message TEXT DEFAULT '',
                retry_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        """)

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def create_project(self, name: str, source_dir: str, output_dir: str,
                       source_lang: str, target_lang: str) -> str:
        pid = uuid.uuid4().hex
        now = self._now()
        self.conn.execute(
            "INSERT INTO projects (id,name,source_dir,output_dir,source_lang,target_lang,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
            (pid, name, source_dir, output_dir, source_lang, target_lang, now, now),
        )
        self.conn.commit()
        return pid

    def get_project(self, pid: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
        return dict(row) if row else None

    def list_projects(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def update_project(self, pid: str, **kwargs: Any) -> None:
        kwargs["updated_at"] = self._now()
        sets = ", ".join(f"{k}=?" for k in kwargs)
        self.conn.execute(f"UPDATE projects SET {sets} WHERE id=?", (*kwargs.values(), pid))
        self.conn.commit()

    def delete_project(self, pid: str) -> None:
        self.conn.execute("DELETE FROM projects WHERE id=?", (pid,))
        self.conn.commit()

    def create_page(self, project_id: str, filename: str, page_order: int) -> str:
        page_id = uuid.uuid4().hex
        now = self._now()
        self.conn.execute(
            "INSERT INTO pages (id,project_id,filename,page_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
            (page_id, project_id, filename, page_order, now, now),
        )
        self.conn.commit()
        return page_id

    def get_page(self, page_id: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM pages WHERE id=?", (page_id,)).fetchone()
        return dict(row) if row else None

    def list_pages(self, project_id: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM pages WHERE project_id=? ORDER BY page_order", (project_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def update_page(self, page_id: str, **kwargs: Any) -> None:
        kwargs["updated_at"] = self._now()
        sets = ", ".join(f"{k}=?" for k in kwargs)
        self.conn.execute(f"UPDATE pages SET {sets} WHERE id=?", (*kwargs.values(), page_id))
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
