import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { mkdirSync } from 'fs'

let db: Database.Database

function now(): string {
  return new Date().toISOString()
}

export function initDatabase(): void {
  const dir = join(app.getAppPath(), 'data')
  mkdirSync(dir, { recursive: true })
  const dbPath = join(dir, 'comics.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_dir TEXT NOT NULL,
      output_dir TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      master_prompt TEXT DEFAULT '',
      status TEXT DEFAULT 'idle',
      translate_mode TEXT DEFAULT 'auto',
      current_phase TEXT DEFAULT '',
      phase_confirmed INTEGER DEFAULT 0,
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
      edited INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  const projectCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]
  const projectColNames = new Set(projectCols.map(c => c.name))
  if (!projectColNames.has('translate_mode')) {
    db.exec("ALTER TABLE projects ADD COLUMN translate_mode TEXT DEFAULT 'auto'")
  }
  if (!projectColNames.has('current_phase')) {
    db.exec("ALTER TABLE projects ADD COLUMN current_phase TEXT DEFAULT ''")
  }
  if (!projectColNames.has('phase_confirmed')) {
    db.exec("ALTER TABLE projects ADD COLUMN phase_confirmed INTEGER DEFAULT 0")
  }

  const pageCols = db.prepare("PRAGMA table_info(pages)").all() as { name: string }[]
  const pageColNames = new Set(pageCols.map(c => c.name))
  if (!pageColNames.has('error_message')) {
    db.exec("ALTER TABLE pages ADD COLUMN error_message TEXT DEFAULT ''")
  }
  if (!pageColNames.has('retry_count')) {
    db.exec("ALTER TABLE pages ADD COLUMN retry_count INTEGER DEFAULT 0")
  }
  if (!pageColNames.has('edited')) {
    db.exec("ALTER TABLE pages ADD COLUMN edited INTEGER DEFAULT 0")
  }
}

export function createProject(
  name: string, sourceDir: string, outputDir: string,
  sourceLang: string, targetLang: string, translateMode: string
): string {
  const id = randomUUID().replace(/-/g, '')
  const ts = now()
  db.prepare(
    `INSERT INTO projects (id,name,source_dir,output_dir,source_lang,target_lang,translate_mode,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id, name, sourceDir, outputDir, sourceLang, targetLang, translateMode, ts, ts)
  return id
}

export function getProject(id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM projects WHERE id=?').get(id) as Record<string, unknown> | undefined
}

export function listProjects(): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]
}

export function updateProject(id: string, fields: Record<string, unknown>): void {
  fields.updated_at = now()
  const keys = Object.keys(fields)
  const sets = keys.map(k => `${k}=?`).join(', ')
  db.prepare(`UPDATE projects SET ${sets} WHERE id=?`).run(...keys.map(k => fields[k]), id)
}

export function deleteProject(id: string): void {
  db.prepare('DELETE FROM projects WHERE id=?').run(id)
}

export function createPage(projectId: string, filename: string, pageOrder: number): string {
  const id = randomUUID().replace(/-/g, '')
  const ts = now()
  db.prepare(
    `INSERT INTO pages (id,project_id,filename,page_order,created_at,updated_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id, projectId, filename, pageOrder, ts, ts)
  return id
}

export function getPage(id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM pages WHERE id=?').get(id) as Record<string, unknown> | undefined
}

export function listPages(projectId: string): Record<string, unknown>[] {
  return db.prepare('SELECT * FROM pages WHERE project_id=? ORDER BY page_order').all(projectId) as Record<string, unknown>[]
}

export function updatePage(id: string, fields: Record<string, unknown>): void {
  fields.updated_at = now()
  const keys = Object.keys(fields)
  const sets = keys.map(k => `${k}=?`).join(', ')
  db.prepare(`UPDATE pages SET ${sets} WHERE id=?`).run(...keys.map(k => fields[k]), id)
}

export function closeDatabase(): void {
  if (db) db.close()
}
