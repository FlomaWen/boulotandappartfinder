import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/app.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            title TEXT NOT NULL,
                                            address TEXT DEFAULT '',
                                            city TEXT NOT NULL,
                                            price REAL NOT NULL,
                                            surface REAL DEFAULT 0,
                                            rooms INTEGER DEFAULT 0,
                                            bedrooms INTEGER DEFAULT 0,
                                            bathrooms INTEGER DEFAULT 0,
                                            type TEXT DEFAULT '',
                                            description TEXT DEFAULT '',
                                            image TEXT DEFAULT '',
                                            url TEXT NOT NULL UNIQUE,
                                            source TEXT NOT NULL,
                                            status TEXT NOT NULL DEFAULT 'nouveau',
                                            latitude REAL,
                                            longitude REAL,
                                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

    CREATE TABLE IF NOT EXISTS jobs (
                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                      title TEXT NOT NULL,
                                      company TEXT NOT NULL,
                                      city TEXT NOT NULL,
                                      sector TEXT DEFAULT '',
                                      salary TEXT DEFAULT '',
                                      salary_min REAL,
                                      remote TEXT DEFAULT '',
                                      experience TEXT DEFAULT '',
                                      description TEXT DEFAULT '',
                                      tags TEXT DEFAULT '[]',
                                      url TEXT NOT NULL UNIQUE,
                                      source TEXT NOT NULL,
                                      status TEXT NOT NULL DEFAULT 'nouveau',
                                      color TEXT DEFAULT '#10b981',
                                      latitude REAL,
                                      longitude REAL,
                                      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

    CREATE INDEX IF NOT EXISTS idx_apartments_status ON apartments(status);
    CREATE INDEX IF NOT EXISTS idx_apartments_city ON apartments(city);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);

    CREATE TABLE IF NOT EXISTS last_search_filters (
      id TEXT PRIMARY KEY,
      filters TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auto_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('apartments', 'jobs')),
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add favorite column if missing (migration-safe)
  try { db.exec('ALTER TABLE apartments ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE jobs ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0'); } catch {}
}
