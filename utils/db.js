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

-- 应用设置（键值对）
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- 情书时光胶囊
CREATE TABLE IF NOT EXISTS love_letters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT    NOT NULL,
    author      TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    recipient   TEXT    NOT NULL CHECK (recipient IN ('his', 'her')),
    open_date   TEXT    NOT NULL,
    is_opened   INTEGER NOT NULL DEFAULT 0,
    opened_at   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_love_letters_open_date ON love_letters (open_date);

-- 约会建议
CREATE TABLE IF NOT EXISTS date_ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'other',
    author      TEXT    CHECK (author IN ('his', 'her', 'system')),
    used_count  INTEGER NOT NULL DEFAULT 0,
    last_used   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
`);

// 初始化内置约会建议（仅首次）
const ideaCount = db.prepare('SELECT COUNT(*) AS c FROM date_ideas WHERE author = ?').get('system').c;
if (ideaCount === 0) {
    const defaultIdeas = [
        ['一起做饭', 'home'], ['看日落', 'outdoor'], ['逛书店', 'outdoor'],
        ['野餐', 'outdoor'], ['一起画画', 'home'], ['看电影', 'entertainment'],
        ['去游乐园', 'outdoor'], ['拍一组情侣照', 'creative'], ['写信给对方', 'creative'],
        ['一起运动', 'outdoor'], ['尝试新餐厅', 'food'], ['咖啡馆约会', 'food'],
        ['一起看星星', 'outdoor'], ['逛夜市', 'food'], ['DIY礼物', 'creative'],
        ['一起泡温泉', 'outdoor'], ['海边散步', 'outdoor'], ['一起玩游戏', 'entertainment'],
        ['骑行', 'outdoor'], ['去博物馆', 'outdoor'], ['一起烘焙', 'home'],
        ['看演唱会', 'entertainment'], ['一起学做新菜', 'food'], ['去公园散步', 'outdoor'],
        ['整理旧照片', 'home'], ['一起追剧', 'home'], ['去花市买花', 'outdoor'],
        ['写下100个喜欢TA的理由', 'creative'], ['交换手机玩一天', 'creative'],
        ['模仿第一次约会', 'creative']
    ];
    const insertIdea = db.prepare('INSERT INTO date_ideas (title, category, author) VALUES (?, ?, ?)');
    const insertMany = db.transaction((ideas) => {
        for (const [title, category] of ideas) {
            insertIdea.run(title, category, 'system');
        }
    });
    insertMany(defaultIdeas);
}

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

// 自动迁移：为已有数据库添加 media_type 列
try {
    const photoCols = db.prepare("PRAGMA table_info(photos)").all().map(c => c.name);
    if (!photoCols.includes('media_type')) {
        db.exec("ALTER TABLE photos ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'");
    }
} catch (e) { /* table may not exist yet */ }

// 音频表
db.exec(`
CREATE TABLE IF NOT EXISTS audios (
    id             TEXT    PRIMARY KEY,
    caption        TEXT    NOT NULL DEFAULT '',
    author         TEXT    NOT NULL CHECK (author IN ('his', 'her')),
    filename       TEXT    NOT NULL,
    originalname   TEXT    NOT NULL DEFAULT '',
    url            TEXT    NOT NULL,
    duration       REAL    NOT NULL DEFAULT 0,
    date           TEXT    NOT NULL,
    timestamp      INTEGER NOT NULL,
    visible        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audios_date   ON audios (date);
CREATE INDEX IF NOT EXISTS idx_audios_author ON audios (author);
`);

module.exports = db;
