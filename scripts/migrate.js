/**
 * JSON → SQLite 数据迁移脚本
 * 用法: node scripts/migrate.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function migrate() {
    console.log('开始数据迁移...\n');

    // 1. 迁移 admin → users 表
    const admin = readJSON('admin.json');
    if (admin && admin.password) {
        const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
        if (!existing) {
            const hash = await bcrypt.hash(admin.password, 10);
            db.prepare('INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)')
                .run('admin', hash, 'admin', '管理员');
            console.log('✓ 管理员账号已迁移（密码已加密）');
        } else {
            console.log('- 管理员账号已存在，跳过');
        }
    }

    // 2. 迁移回忆
    const memories = readJSON('memories.json');
    if (memories && memories.length > 0) {
        const insertMemory = db.prepare(`
            INSERT OR IGNORE INTO memories (id, title, date, content, author, visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertComment = db.prepare(`
            INSERT OR IGNORE INTO comments (id, entity_type, entity_id, content, author, date)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const migrateMemories = db.transaction(() => {
            for (const m of memories) {
                insertMemory.run(m.id, m.title || '', m.date, m.content || '', m.author || 'his',
                    m.visible !== false ? 1 : 0, m.createdAt || new Date().toISOString());

                if (m.comments && m.comments.length > 0) {
                    for (const c of m.comments) {
                        insertComment.run(c.id, 'memory', String(m.id), c.content, c.author, c.date);
                    }
                }
            }
        });
        migrateMemories();
        console.log(`✓ 迁移了 ${memories.length} 条回忆`);
    }

    // 3. 迁移照片
    const photos = readJSON('photos.json');
    if (photos && photos.length > 0) {
        const insertPhoto = db.prepare(`
            INSERT OR IGNORE INTO photos (id, caption, description, author, filename, originalname, url, thumbnail_url, date, timestamp, visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertComment = db.prepare(`
            INSERT OR IGNORE INTO comments (id, entity_type, entity_id, content, author, date)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const migratePhotos = db.transaction(() => {
            for (const p of photos) {
                insertPhoto.run(p.id, p.caption || '', p.description || '', p.author || 'his',
                    p.filename, p.originalname || '', p.url, p.thumbnailUrl || '',
                    p.date, p.timestamp, p.visible !== false ? 1 : 0,
                    p.createdAt || new Date().toISOString());

                if (p.comments && p.comments.length > 0) {
                    for (const c of p.comments) {
                        insertComment.run(c.id, 'photo', p.id, c.content, c.author, c.date);
                    }
                }
            }
        });
        migratePhotos();
        console.log(`✓ 迁移了 ${photos.length} 张照片`);
    }

    // 4. 迁移消息
    const messages = readJSON('messages.json');
    if (messages && messages.length > 0) {
        const insertMessage = db.prepare(`
            INSERT OR IGNORE INTO messages (id, content, author, should_blur, date, visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const migrateMessages = db.transaction(() => {
            for (const m of messages) {
                insertMessage.run(m.id, m.content || '', m.author || 'his',
                    m.shouldBlur ? 1 : 0, m.date, m.visible !== false ? 1 : 0,
                    m.createdAt || new Date().toISOString());
            }
        });
        migrateMessages();
        console.log(`✓ 迁移了 ${messages.length} 条消息`);
    }

    // 5. 迁移每日心情
    const moods = readJSON('daily-moods.json');
    if (moods && moods.length > 0) {
        const insertMood = db.prepare(`
            INSERT OR IGNORE INTO daily_moods (date, his_mood, his_image_url, his_thumbnail_url, her_mood, her_image_url, her_thumbnail_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const migrateMoods = db.transaction(() => {
            for (const m of moods) {
                insertMood.run(
                    m.date,
                    m.his?.mood || m.his?.emoji || '',
                    m.his?.imageUrl || '',
                    m.his?.thumbnailUrl || '',
                    m.her?.mood || m.her?.emoji || '',
                    m.her?.imageUrl || '',
                    m.her?.thumbnailUrl || '',
                    m.createdAt || new Date().toISOString(),
                    m.updatedAt || new Date().toISOString()
                );
            }
        });
        migrateMoods();
        console.log(`✓ 迁移了 ${moods.length} 条心情数据`);
    }

    console.log('\n✅ 数据迁移完成！');
    console.log('原始 JSON 文件保留在 data/ 目录中，可在确认无误后手动删除。');
}

migrate().catch(err => {
    console.error('迁移失败:', err);
    process.exit(1);
});
