const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有回忆
router.get('/', optionalAuth, (req, res) => {
    const memories = db.prepare('SELECT * FROM memories ORDER BY date DESC').all();
    // 附加评论
    const commentStmt = db.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY date ASC');
    const result = memories.map(m => ({
        ...m,
        visible: !!m.visible,
        comments: commentStmt.all('memory', String(m.id))
    }));
    res.json({ success: true, data: result });
});

// 创建回忆
router.post('/', authenticateUser, (req, res) => {
    const { title, date, content, visible } = req.body;
    const author = req.user.username;
    const id = Date.now();
    const createdAt = new Date().toISOString();

    db.prepare('INSERT INTO memories (id, title, date, content, author, visible, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, title || '', date || createdAt, content || '', author, visible !== false ? 1 : 0, createdAt);

    const newMemory = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    res.json({ success: true, data: { ...newMemory, visible: !!newMemory.visible, comments: [] } });
});

// 更新回忆
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }

    const { title, date, content, author, visible } = req.body;
    db.prepare(`UPDATE memories SET
        title = COALESCE(?, title),
        date = COALESCE(?, date),
        content = COALESCE(?, content),
        author = COALESCE(?, author),
        visible = COALESCE(?, visible)
        WHERE id = ?`)
        .run(title ?? null, date ?? null, content ?? null, author ?? null,
            visible !== undefined ? (visible ? 1 : 0) : null, id);

    const updated = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    res.json({ success: true, data: { ...updated, visible: !!updated.visible } });
});

// 删除回忆
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM comments WHERE entity_type = ? AND entity_id = ?').run('memory', String(id));
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    res.json({ success: true });
});

// 切换可见性
router.patch('/:id/visibility', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const { visible } = req.body;
    const result = db.prepare('UPDATE memories SET visible = ? WHERE id = ?').run(visible ? 1 : 0, id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }
    res.json({ success: true });
});

// 获取回忆评论
router.get('/:memoryId/comments', (req, res) => {
    const { memoryId } = req.params;
    const memory = db.prepare('SELECT id FROM memories WHERE id = ?').get(parseInt(memoryId));
    if (!memory) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }
    const comments = db.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY date ASC')
        .all('memory', memoryId);
    res.json({ success: true, comments });
});

// 添加回忆评论
router.post('/:memoryId/comments', authenticateUser, (req, res) => {
    const { memoryId } = req.params;
    const { content } = req.body;
    const author = req.user.username;

    if (!content) {
        return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    const memory = db.prepare('SELECT id FROM memories WHERE id = ?').get(parseInt(memoryId));
    if (!memory) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }

    const comment = {
        id: Date.now().toString(),
        entity_type: 'memory',
        entity_id: memoryId,
        content,
        author,
        date: new Date().toISOString()
    };

    db.prepare('INSERT INTO comments (id, entity_type, entity_id, content, author, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(comment.id, comment.entity_type, comment.entity_id, comment.content, comment.author, comment.date);

    res.json({ success: true, comment });
});

// 按日期查询回忆
router.get('/query', (req, res) => {
    const { date } = req.query;
    if (date) {
        const memories = db.prepare("SELECT * FROM memories WHERE date(date) = date(?) ORDER BY date DESC").all(date);
        return res.json(memories.map(m => ({ ...m, visible: !!m.visible })));
    }
    const memories = db.prepare('SELECT * FROM memories ORDER BY date DESC').all();
    res.json(memories.map(m => ({ ...m, visible: !!m.visible })));
});

module.exports = router;
