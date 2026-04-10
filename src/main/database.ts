import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function initDatabase(): void {
  const dataDir = path.join(app.getPath('userData'), 'freetarget')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = path.join(dataDir, 'storage.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createSchema()
}

function createSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      decimal_scoring INTEGER NOT NULL DEFAULT 0,
      shot_limit INTEGER NOT NULL DEFAULT -1,
      duration_minutes INTEGER NOT NULL DEFAULT -1,
      caliber REAL NOT NULL DEFAULT 4.5,
      rapid_fire INTEGER NOT NULL DEFAULT 0,
      rf_shots_per_series INTEGER,
      rf_series_seconds INTEGER,
      rf_load_seconds INTEGER,
      final_shots_per_series INTEGER,
      final_series_seconds INTEGER,
      final_shots_before_single INTEGER,
      final_single_shots_per_series INTEGER,
      final_single_shot_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS Sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shooter TEXT NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'saved',
      calibration_x REAL NOT NULL DEFAULT 0,
      calibration_y REAL NOT NULL DEFAULT 0,
      calibration_angle REAL NOT NULL DEFAULT 0,
      start_time TEXT NOT NULL,
      end_time TEXT,
      diary_entry TEXT,
      total_score INTEGER NOT NULL DEFAULT 0,
      total_decimal_score REAL NOT NULL DEFAULT 0,
      inner_ten_count INTEGER NOT NULL DEFAULT 0,
      shot_count INTEGER,
      average_score REAL,
      average_shot_duration_ms REAL,
      shortest_shot_duration_ms REAL,
      longest_shot_duration_ms REAL,
      windage REAL,
      elevation REAL,
      mean_radius REAL,
      group_size REAL,
      FOREIGN KEY (event_id) REFERENCES Events(id)
    );

    CREATE TABLE IF NOT EXISTS Shots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      shot_index INTEGER NOT NULL,
      miss INTEGER NOT NULL DEFAULT 0,
      raw_x REAL NOT NULL DEFAULT 0,
      raw_y REAL NOT NULL DEFAULT 0,
      calibration_x REAL NOT NULL DEFAULT 0,
      calibration_y REAL NOT NULL DEFAULT 0,
      calibration_angle REAL NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      decimal_score REAL NOT NULL DEFAULT 0,
      inner_ten INTEGER NOT NULL DEFAULT 0,
      adjusted_x REAL NOT NULL DEFAULT 0,
      adjusted_y REAL NOT NULL DEFAULT 0,
      radius REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      duration_ms REAL,
      FOREIGN KEY (session_id) REFERENCES Sessions(id)
    );

    CREATE TABLE IF NOT EXISTS Settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

// ── Events ─────────────────────────────────────────────────────────────────

export function getEvents(): unknown[] {
  return db.prepare('SELECT * FROM Events ORDER BY id ASC').all()
}

export function saveEvent(ev: Record<string, unknown>): number {
  const stmt = db.prepare(`
    INSERT INTO Events (name, type, target_name, decimal_scoring, shot_limit,
      duration_minutes, caliber, rapid_fire, rf_shots_per_series, rf_series_seconds,
      rf_load_seconds, final_shots_per_series, final_series_seconds,
      final_shots_before_single, final_single_shots_per_series, final_single_shot_seconds)
    VALUES (@name, @type, @target_name, @decimal_scoring, @shot_limit,
      @duration_minutes, @caliber, @rapid_fire, @rf_shots_per_series, @rf_series_seconds,
      @rf_load_seconds, @final_shots_per_series, @final_series_seconds,
      @final_shots_before_single, @final_single_shots_per_series, @final_single_shot_seconds)
  `)
  const result = stmt.run(ev)
  return result.lastInsertRowid as number
}

export function countEvents(): number {
  const row = db.prepare('SELECT COUNT(*) as c FROM Events').get() as { c: number }
  return row.c
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function createSession(s: Record<string, unknown>): number {
  const stmt = db.prepare(`
    INSERT INTO Sessions (shooter, event_id, status, calibration_x, calibration_y,
      calibration_angle, start_time, total_score, total_decimal_score, inner_ten_count)
    VALUES (@shooter, @event_id, 'active', @calibration_x, @calibration_y,
      @calibration_angle, @start_time, 0, 0, 0)
  `)
  const result = stmt.run(s)
  return result.lastInsertRowid as number
}

export function saveSession(
  sessionId: number,
  updates: Record<string, unknown>,
  shots: Record<string, unknown>[]
): void {
  const updateSession = db.prepare(`
    UPDATE Sessions SET
      status = 'saved',
      end_time = @end_time,
      total_score = @total_score,
      total_decimal_score = @total_decimal_score,
      inner_ten_count = @inner_ten_count,
      shot_count = @shot_count,
      average_score = @average_score,
      average_shot_duration_ms = @average_shot_duration_ms,
      shortest_shot_duration_ms = @shortest_shot_duration_ms,
      longest_shot_duration_ms = @longest_shot_duration_ms,
      windage = @windage,
      elevation = @elevation,
      mean_radius = @mean_radius,
      group_size = @group_size,
      diary_entry = @diary_entry
    WHERE id = @id
  `)

  const insertShot = db.prepare(`
    INSERT INTO Shots (session_id, shot_index, miss, raw_x, raw_y,
      calibration_x, calibration_y, calibration_angle,
      score, decimal_score, inner_ten, adjusted_x, adjusted_y, radius,
      timestamp, duration_ms)
    VALUES (@session_id, @shot_index, @miss, @raw_x, @raw_y,
      @calibration_x, @calibration_y, @calibration_angle,
      @score, @decimal_score, @inner_ten, @adjusted_x, @adjusted_y, @radius,
      @timestamp, @duration_ms)
  `)

  const saveAll = db.transaction(() => {
    updateSession.run({ ...updates, id: sessionId })
    for (const shot of shots) {
      insertShot.run({ ...shot, session_id: sessionId })
    }
  })
  saveAll()
}

export function getSessions(shooter?: string): unknown[] {
  if (shooter) {
    return db
      .prepare(
        `SELECT s.id, s.shooter, e.name as event_name, e.type as event_type,
          e.decimal_scoring, s.start_time, s.total_score, s.total_decimal_score,
          s.inner_ten_count, s.shot_count
         FROM Sessions s JOIN Events e ON s.event_id = e.id
         WHERE s.shooter = ? AND s.status = 'saved'
         ORDER BY s.id DESC`
      )
      .all(shooter)
  }
  return db
    .prepare(
      `SELECT s.id, s.shooter, e.name as event_name, e.type as event_type,
        e.decimal_scoring, s.start_time, s.total_score, s.total_decimal_score,
        s.inner_ten_count, s.shot_count
       FROM Sessions s JOIN Events e ON s.event_id = e.id
       WHERE s.status = 'saved'
       ORDER BY s.id DESC`
    )
    .all()
}

export function getSession(id: number): { session: unknown; shots: unknown[] } {
  const session = db
    .prepare('SELECT s.*, e.* FROM Sessions s JOIN Events e ON s.event_id = e.id WHERE s.id = ?')
    .get(id)
  const shots = db
    .prepare('SELECT * FROM Shots WHERE session_id = ? ORDER BY shot_index ASC')
    .all(id)
  return { session, shots }
}

// ── Settings ────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM Settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM Settings').all() as {
    key: string
    value: string
  }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}
