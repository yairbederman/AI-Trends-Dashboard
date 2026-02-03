import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Database file location
const DB_PATH = path.join(process.cwd(), 'data', 'ai-trends.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables if they don't exist (for development convenience)
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 3,
        last_fetched_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        published_at INTEGER NOT NULL,
        fetched_at INTEGER NOT NULL,
        author TEXT,
        tags TEXT,
        sentiment TEXT,
        sentiment_score REAL,
        engagement TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_content_source ON content_items(source_id);
    CREATE INDEX IF NOT EXISTS idx_content_published ON content_items(published_at);
    CREATE INDEX IF NOT EXISTS idx_content_source_published ON content_items(source_id, published_at);

    CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        recorded_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_source ON metrics(source_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_source_recorded ON metrics(source_id, recorded_at);

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        item_ids TEXT NOT NULL,
        summary TEXT,
        created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_highlights_date ON daily_highlights(date);
`);

export const db = drizzle(sqlite, { schema });

// Export schema for use elsewhere
export { schema };
