const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser } = require('../middleware/auth');

// 获取所有任务（可通过 ?status=pending 筛选）
router.get('/', authenticateUser, (req, res) => {
    const { status } = req.query;
    let tasks;
    if (status) {
        tasks = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC').all(status);
    } else {
        tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    }
    res.json({ success: true, data: tasks });
});

// 创建任务
router.post('/', authenticateUser, (req, res) => {
    const { title, description, assigned_to, due_date } = req.body;
    const created_by = req.user.username;

    if (!title) {
        return res.status(400).json({ success: false, message: '任务标题不能为空' });
    }
    if (!assigned_to || !['his', 'her', 'both'].includes(assigned_to)) {
        return res.status(400).json({ success: false, message: '请指定有效的任务负责人（his/her/both）' });
    }

    const result = db.prepare(
        'INSERT INTO tasks (title, description, assigned_to, due_date, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(title, description || '', assigned_to, due_date || null, created_by);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: task });
});

// 更新任务
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '任务不存在' });
    }

    const { title, description, assigned_to, status, due_date } = req.body;

    if (assigned_to && !['his', 'her', 'both'].includes(assigned_to)) {
        return res.status(400).json({ success: false, message: '无效的任务负责人' });
    }
    if (status && !['pending', 'in_progress', 'done'].includes(status)) {
        return res.status(400).json({ success: false, message: '无效的任务状态' });
    }

    db.prepare(`UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        assigned_to = COALESCE(?, assigned_to),
        status = COALESCE(?, status),
        due_date = COALESCE(?, due_date),
        updated_at = datetime('now')
        WHERE id = ?`)
        .run(
            title ?? null,
            description ?? null,
            assigned_to ?? null,
            status ?? null,
            due_date ?? null,
            id
        );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// 删除任务
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '任务不存在' });
    }
    res.json({ success: true });
});

// 快速更新任务状态
router.patch('/:id/status', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'done'].includes(status)) {
        return res.status(400).json({ success: false, message: '无效的任务状态（pending/in_progress/done）' });
    }

    const result = db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '任务不存在' });
    }

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

module.exports = router;
