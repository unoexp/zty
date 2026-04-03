const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// GET / — 获取所有约会建议
router.get('/', optionalAuth, (req, res) => {
    const ideas = db.prepare('SELECT * FROM date_ideas ORDER BY created_at DESC').all();
    res.json({ success: true, data: ideas });
});

// GET /random — 随机抽取一个约会建议
router.get('/random', optionalAuth, (req, res) => {
    const category = req.query.category;
    let idea;
    if (category && category !== 'all') {
        idea = db.prepare('SELECT * FROM date_ideas WHERE category = ? ORDER BY RANDOM() LIMIT 1').get(category);
    } else {
        idea = db.prepare('SELECT * FROM date_ideas ORDER BY RANDOM() LIMIT 1').get();
    }

    if (!idea) {
        return res.json({ success: true, data: null });
    }

    // 更新使用次数
    db.prepare('UPDATE date_ideas SET used_count = used_count + 1, last_used = datetime(?) WHERE id = ?')
        .run('now', idea.id);

    res.json({ success: true, data: idea });
});

// GET /categories — 获取所有分类
router.get('/categories', optionalAuth, (req, res) => {
    const categories = db.prepare('SELECT DISTINCT category FROM date_ideas ORDER BY category').all();
    const categoryLabels = {
        home: '居家', outdoor: '户外', food: '美食',
        entertainment: '娱乐', creative: '创意', other: '其他'
    };
    const result = categories.map(c => ({
        value: c.category,
        label: categoryLabels[c.category] || c.category
    }));
    res.json({ success: true, data: result });
});

// POST / — 添加自定义约会建议
router.post('/', authenticateUser, (req, res) => {
    const { title, category } = req.body;
    const author = req.user.username;

    if (!title) {
        return res.status(400).json({ success: false, message: '标题不能为空' });
    }

    const result = db.prepare(
        'INSERT INTO date_ideas (title, category, author) VALUES (?, ?, ?)'
    ).run(title, category || 'other', author);

    const idea = db.prepare('SELECT * FROM date_ideas WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: idea });
});

// DELETE /:id — 删除约会建议
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const idea = db.prepare('SELECT * FROM date_ideas WHERE id = ?').get(id);

    if (!idea) {
        return res.status(404).json({ success: false, message: '建议不存在' });
    }

    db.prepare('DELETE FROM date_ideas WHERE id = ?').run(id);
    res.json({ success: true });
});

module.exports = router;
