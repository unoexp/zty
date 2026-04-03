const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser } = require('../middleware/auth');

// 获取所有纪念日
router.get('/', (req, res) => {
    const anniversaries = db.prepare('SELECT * FROM anniversaries ORDER BY date ASC').all();
    res.json({ success: true, data: anniversaries });
});

// 获取即将到来的纪念日
router.get('/upcoming', (req, res) => {
    const all = db.prepare('SELECT * FROM anniversaries ORDER BY date ASC').all();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];

    for (const item of all) {
        // 只取日期的月和日部分，兼容各种格式
        const dateStr = (item.date || '').slice(0, 10);
        const parts = dateStr.split('-');
        if (parts.length < 3) continue;

        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        if (isNaN(month) || isNaN(day)) continue;

        let nextDate = null;

        if (item.repeat === 'yearly') {
            const thisYear = new Date(today.getFullYear(), month, day);
            const nextYear = new Date(today.getFullYear() + 1, month, day);
            nextDate = thisYear >= today ? thisYear : nextYear;
        } else if (item.repeat === 'monthly') {
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), day);
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, day);
            nextDate = thisMonth >= today ? thisMonth : nextMonth;
        } else {
            // repeat='none'
            const orig = new Date(parseInt(parts[0]), month, day);
            if (orig >= today) nextDate = orig;
        }

        if (!nextDate) continue;

        const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        upcoming.push({
            ...item,
            nextDate: nextDate.toISOString().split('T')[0],
            daysUntil
        });
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json({ success: true, data: upcoming });
});

// 创建纪念日
router.post('/', authenticateUser, (req, res) => {
    const { title, date, type, repeat, icon } = req.body;
    const author = req.user.username;

    if (!title || !date) {
        return res.status(400).json({ success: false, message: '标题和日期不能为空' });
    }

    const stmt = db.prepare(
        'INSERT INTO anniversaries (title, date, type, repeat, icon, author) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
        title,
        date,
        type || 'anniversary',
        repeat || 'yearly',
        icon || '',
        author
    );

    const newItem = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: newItem });
});

// 更新纪念日
router.put('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '纪念日不存在' });
    }

    const { title, date, type, repeat, icon } = req.body;
    db.prepare(`UPDATE anniversaries SET
        title = COALESCE(?, title),
        date = COALESCE(?, date),
        type = COALESCE(?, type),
        repeat = COALESCE(?, repeat),
        icon = COALESCE(?, icon)
        WHERE id = ?`)
        .run(title ?? null, date ?? null, type ?? null, repeat ?? null, icon ?? null, id);

    const updated = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// 删除纪念日
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: '纪念日不存在' });
    }

    db.prepare('DELETE FROM anniversaries WHERE id = ?').run(id);
    res.json({ success: true });
});

module.exports = router;
