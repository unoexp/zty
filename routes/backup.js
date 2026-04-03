const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateAdmin } = require('../middleware/auth');

const EXPORT_TABLES = [
  'memories',
  'photos',
  'messages',
  'daily_moods',
  'anniversaries',
  'tasks',
  'wishes',
  'daily_questions',
  'locations',
  'comments'
];

// GET /api/backup/export — 导出所有数据
router.get('/export', authenticateAdmin, (req, res) => {
  try {
    const data = {};
    for (const table of EXPORT_TABLES) {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    }

    const filename = `backup_${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: '导出失败: ' + err.message });
  }
});

// POST /api/backup/import — 导入数据
router.post('/import', authenticateAdmin, (req, res) => {
  const incoming = req.body.data;

  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ success: false, message: '无效的导入数据' });
  }

  const importTransaction = db.transaction(() => {
    for (const table of EXPORT_TABLES) {
      const rows = incoming[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        continue;
      }

      // 清空目标表
      db.prepare(`DELETE FROM ${table}`).run();

      // 用第一行的 key 构建 INSERT 语句
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      );

      for (const row of rows) {
        stmt.run(...columns.map((col) => row[col] ?? null));
      }
    }
  });

  try {
    importTransaction();
    res.json({ success: true, message: '数据导入成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: '导入失败: ' + err.message });
  }
});

module.exports = router;
