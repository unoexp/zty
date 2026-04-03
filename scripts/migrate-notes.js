/**
 * 从 daily-moods.json 恢复心情文字(note)到 SQLite
 * 用法: node scripts/migrate-notes.js
 */
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');

const jsonPath = path.join(__dirname, '..', 'data', 'daily-moods.json');
if (!fs.existsSync(jsonPath)) {
    console.log('daily-moods.json 不存在，无需迁移');
    process.exit(0);
}

const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
let updated = 0;
let skipped = 0;

for (const entry of jsonData) {
    const hisNote = entry.his?.note || '';
    const herNote = entry.her?.note || '';
    if (!hisNote && !herNote) continue;

    const existing = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(entry.date);
    if (existing) {
        db.prepare('UPDATE daily_moods SET his_note = ?, her_note = ? WHERE date = ?')
            .run(hisNote, herNote, entry.date);
        console.log(`[OK] ${entry.date} | his: ${hisNote || '(空)'} | her: ${herNote || '(空)'}`);
        updated++;
    } else {
        console.log(`[SKIP] ${entry.date} 不在数据库中`);
        skipped++;
    }
}

console.log(`\n迁移完成: 更新 ${updated} 条, 跳过 ${skipped} 条`);
