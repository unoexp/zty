const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser } = require('../middleware/auth');

// 获取今天的问答
router.get('/today', authenticateUser, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const question = db.prepare('SELECT * FROM daily_questions WHERE date = ?').get(today);
    res.json({ success: true, data: question || null });
});

// 创建今天的问题
router.post('/', authenticateUser, (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ success: false, message: '问题内容不能为空' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // 检查今天是否已有问题
    const existing = db.prepare('SELECT * FROM daily_questions WHERE date = ?').get(today);
    if (existing) {
        return res.status(400).json({ success: false, message: '今天已经有问题了' });
    }

    const result = db.prepare(
        'INSERT INTO daily_questions (question, date) VALUES (?, ?)'
    ).run(question, today);

    const created = db.prepare('SELECT * FROM daily_questions WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created });
});

// 回答问题
router.patch('/:id/answer', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const { answer } = req.body;
    const username = req.user.username;

    if (!answer) {
        return res.status(400).json({ success: false, message: '回答内容不能为空' });
    }

    const existing = db.prepare('SELECT * FROM daily_questions WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '问题不存在' });
    }

    const field = username === 'his' ? 'his_answer' : 'her_answer';
    db.prepare(`UPDATE daily_questions SET ${field} = ? WHERE id = ?`).run(answer, id);

    const updated = db.prepare('SELECT * FROM daily_questions WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// 获取历史问答列表（分页）
router.get('/history', authenticateUser, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) AS count FROM daily_questions').get().count;
    const questions = db.prepare('SELECT * FROM daily_questions ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        success: true,
        data: questions,
        meta: { total, page, limit }
    });
});

module.exports = router;
