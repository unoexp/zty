const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有足迹点
router.get('/', optionalAuth, (req, res) => {
    const locations = db.prepare(`
        SELECT l.*,
               m.title AS memory_title, m.content AS memory_content, m.date AS memory_date,
               p.caption AS photo_caption, p.filename AS photo_filename, p.thumbnail_url AS photo_thumbnail
        FROM locations l
        LEFT JOIN memories m ON l.memory_id = m.id
        LEFT JOIN photos p ON l.photo_id = p.id
        ORDER BY l.visited_at DESC, l.created_at DESC
    `).all();
    res.json({ success: true, data: locations });
});

// 获取单个足迹（含关联的回忆/照片数据）
router.get('/:id', optionalAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const location = db.prepare(`
        SELECT l.*,
               m.title AS memory_title, m.content AS memory_content, m.date AS memory_date,
               p.caption AS photo_caption, p.filename AS photo_filename, p.thumbnail_url AS photo_thumbnail
        FROM locations l
        LEFT JOIN memories m ON l.memory_id = m.id
        LEFT JOIN photos p ON l.photo_id = p.id
        WHERE l.id = ?
    `).get(id);

    if (!location) {
        return res.status(404).json({ success: false, message: '足迹不存在' });
    }
    res.json({ success: true, data: location });
});

// 添加新足迹
router.post('/', authenticateUser, (req, res) => {
    const { name, lat, lng, memory_id, photo_id, visited_at } = req.body;
    const author = req.user.username;

    if (!name || lat == null || lng == null) {
        return res.status(400).json({ success: false, message: '名称和坐标为必填项' });
    }

    const result = db.prepare(`
        INSERT INTO locations (name, lat, lng, memory_id, photo_id, author, visited_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, lat, lng, memory_id || null, photo_id || null, author, visited_at || null);

    const newLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: newLocation });
});

// 更新足迹
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '足迹不存在' });
    }

    const { name, lat, lng, memory_id, photo_id, visited_at } = req.body;
    db.prepare(`
        UPDATE locations SET
            name = COALESCE(?, name),
            lat = COALESCE(?, lat),
            lng = COALESCE(?, lng),
            memory_id = ?,
            photo_id = ?,
            visited_at = COALESCE(?, visited_at)
        WHERE id = ?
    `).run(
        name ?? null,
        lat ?? null,
        lng ?? null,
        memory_id !== undefined ? (memory_id || null) : existing.memory_id,
        photo_id !== undefined ? (photo_id || null) : existing.photo_id,
        visited_at ?? null,
        id
    );

    const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// 删除足迹
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '足迹不存在' });
    }
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    res.json({ success: true });
});

module.exports = router;
