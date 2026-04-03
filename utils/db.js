const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'app.db');
const db = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 创建所有表
db.exec(`
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('his', 'her', 'admin')),
    display_name  TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 回忆
CREATE TABLE IF NOT EXISTS memories (
    id         INTEGER PRIMARY KEY,
    title      TEXT    NOT NULL DEFAULT '',
    date       TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    author     TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    visible    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_date   ON memories (date);
CREATE INDEX IF NOT EXISTS idx_memories_author ON memories (author);

-- 照片
CREATE TABLE IF NOT EXISTS photos (
    id             TEXT    PRIMARY KEY,
    caption        TEXT    NOT NULL DEFAULT '',
    description    TEXT    NOT NULL DEFAULT '',
    author         TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    filename       TEXT    NOT NULL,
    originalname   TEXT    NOT NULL DEFAULT '',
    url            TEXT    NOT NULL,
    thumbnail_url  TEXT    NOT NULL DEFAULT '',
    date           TEXT    NOT NULL,
    timestamp      INTEGER NOT NULL,
    visible        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_date   ON photos (date);
CREATE INDEX IF NOT EXISTS idx_photos_author ON photos (author);

-- 消息
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY,
    content     TEXT    NOT NULL DEFAULT '',
    author      TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    should_blur INTEGER NOT NULL DEFAULT 0,
    date        TEXT    NOT NULL,
    visible     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_date   ON messages (date);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages (author);

-- 评论（多态）
CREATE TABLE IF NOT EXISTS comments (
    id          TEXT    PRIMARY KEY,
    entity_type TEXT    NOT NULL CHECK (entity_type IN ('memory', 'photo')),
    entity_id   TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    author      TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    date        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments (entity_type, entity_id);

-- 每日心情
CREATE TABLE IF NOT EXISTS daily_moods (
    date               TEXT PRIMARY KEY,
    his_mood           TEXT    NOT NULL DEFAULT '',
    his_note           TEXT    NOT NULL DEFAULT '',
    his_image_url      TEXT    NOT NULL DEFAULT '',
    his_thumbnail_url  TEXT    NOT NULL DEFAULT '',
    her_mood           TEXT    NOT NULL DEFAULT '',
    her_note           TEXT    NOT NULL DEFAULT '',
    her_image_url      TEXT    NOT NULL DEFAULT '',
    her_thumbnail_url  TEXT    NOT NULL DEFAULT '',
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 纪念日
CREATE TABLE IF NOT EXISTS anniversaries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'anniversary' CHECK (type IN ('anniversary', 'countdown', 'birthday')),
    repeat     TEXT    NOT NULL DEFAULT 'yearly' CHECK (repeat IN ('none', 'yearly', 'monthly')),
    icon       TEXT    NOT NULL DEFAULT '',
    author     TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_anniversaries_date ON anniversaries (date);

-- 情侣任务
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    assigned_to TEXT    NOT NULL CHECK (assigned_to IN ('his', 'her', 'both')),
    status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
    due_date    TEXT,
    created_by  TEXT    NOT NULL CHECK (created_by IN ('his', 'her')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

-- 愿望清单
CREATE TABLE IF NOT EXISTS wishes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    author       TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 每日问答
CREATE TABLE IF NOT EXISTS daily_questions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    question   TEXT    NOT NULL,
    his_answer TEXT    NOT NULL DEFAULT '',
    her_answer TEXT    NOT NULL DEFAULT '',
    date       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 地图足迹
CREATE TABLE IF NOT EXISTS locations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    lat        REAL    NOT NULL,
    lng        REAL    NOT NULL,
    memory_id  INTEGER REFERENCES memories(id) ON DELETE SET NULL,
    photo_id   TEXT    REFERENCES photos(id)   ON DELETE SET NULL,
    author     TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    visited_at TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_locations_memory ON locations (memory_id);
CREATE INDEX IF NOT EXISTS idx_locations_photo  ON locations (photo_id);
`);

// 自动迁移：为已有数据库添加缺失的列
try {
    const cols = db.prepare("PRAGMA table_info(daily_moods)").all().map(c => c.name);
    if (!cols.includes('his_note')) {
        db.exec("ALTER TABLE daily_moods ADD COLUMN his_note TEXT NOT NULL DEFAULT ''");
    }
    if (!cols.includes('her_note')) {
        db.exec("ALTER TABLE daily_moods ADD COLUMN her_note TEXT NOT NULL DEFAULT ''");
    }
} catch (e) { /* table may not exist yet */ }

module.exports = db;
