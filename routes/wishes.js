const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser } = require('../middleware/auth');

// 获取所有愿望（可通过 ?completed=0 筛选未完成）
router.get('/', authenticateUser, (req, res) => {
    const { completed } = req.query;
    let wishes;
    if (completed !== undefined) {
        wishes = db.prepare('SELECT * FROM wishes WHERE completed = ? ORDER BY created_at DESC').all(parseInt(completed));
    } else {
        wishes = db.prepare('SELECT * FROM wishes ORDER BY created_at DESC').all();
    }
    res.json({ success: true, data: wishes });
});

// 创建愿望
router.post('/', authenticateUser, (req, res) => {
    const { title, description } = req.body;
    const author = req.user.username;

    if (!title) {
        return res.status(400).json({ success: false, message: '愿望标题不能为空' });
    }

    const result = db.prepare(
        'INSERT INTO wishes (title, description, author) VALUES (?, ?, ?)'
    ).run(title, description || '', author);

    const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: wish });
});

// 更新愿望
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '愿望不存在' });
    }

    const { title, description } = req.body;

    db.prepare(`UPDATE wishes SET
        title = COALESCE(?, title),
        description = COALESCE(?, description)
        WHERE id = ?`)
        .run(title ?? null, description ?? null, id);

    const updated = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// 删除愿望
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const result = db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '愿望不存在' });
    }
    res.json({ success: true });
});

// 标记完成/取消完成
router.patch('/:id/complete', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '愿望不存在' });
    }

    const newCompleted = existing.completed ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;

    db.prepare('UPDATE wishes SET completed = ?, completed_at = ? WHERE id = ?')
        .run(newCompleted, completedAt, id);

    const updated = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

module.exports = router;
