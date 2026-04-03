const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有消息
router.get('/', optionalAuth, (req, res) => {
    const messages = db.prepare('SELECT * FROM messages ORDER BY date DESC').all();
    const result = messages.map(m => ({
        ...m,
        shouldBlur: !!m.should_blur,
        visible: !!m.visible
    }));
    res.json({ success: true, data: result });
});

// 创建消息
router.post('/', authenticateUser, (req, res) => {
    const { content, shouldBlur } = req.body;
    const author = req.user.username;
    const id = Date.now();
    const date = new Date().toISOString();

    db.prepare('INSERT INTO messages (id, content, author, should_blur, date, visible, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
        .run(id, content || '', author, shouldBlur ? 1 : 0, date, date);

    const newMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    res.json({ success: true, data: { ...newMessage, shouldBlur: !!newMessage.should_blur, visible: true } });
});

// 更新消息
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '消息不存在' });
    }

    const { content, author, shouldBlur, visible } = req.body;
    db.prepare(`UPDATE messages SET
        content = COALESCE(?, content),
        author = COALESCE(?, author),
        should_blur = COALESCE(?, should_blur),
        visible = COALESCE(?, visible)
        WHERE id = ?`)
        .run(content ?? null, author ?? null,
            shouldBlur !== undefined ? (shouldBlur ? 1 : 0) : null,
            visible !== undefined ? (visible ? 1 : 0) : null, id);

    const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    res.json({ success: true, data: { ...updated, shouldBlur: !!updated.should_blur, visible: !!updated.visible } });
});

// 删除消息
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    res.json({ success: true });
});

// 切换可见性
router.patch('/:id/visibility', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const { visible } = req.body;
    const result = db.prepare('UPDATE messages SET visible = ? WHERE id = ?').run(visible ? 1 : 0, id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '消息不存在' });
    }
    res.json({ success: true });
});

// 按日期查询消息
router.get('/query', (req, res) => {
    const { date } = req.query;
    if (date) {
        const messages = db.prepare("SELECT * FROM messages WHERE date(date) = date(?) ORDER BY date DESC").all(date);
        return res.json(messages.map(m => ({ ...m, shouldBlur: !!m.should_blur, visible: !!m.visible })));
    }
    const messages = db.prepare('SELECT * FROM messages ORDER BY date DESC').all();
    res.json(messages.map(m => ({ ...m, shouldBlur: !!m.should_blur, visible: !!m.visible })));
});

module.exports = router;
