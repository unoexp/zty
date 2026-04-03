const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// GET / — 获取所有情书（已开封的显示内容，未到期的隐藏内容）
router.get('/', optionalAuth, (req, res) => {
    const letters = db.prepare('SELECT * FROM love_letters ORDER BY created_at DESC').all();
    const today = new Date().toISOString().split('T')[0];
    const currentUser = req.user?.username;

    const result = letters.map(l => {
        const canOpen = l.open_date <= today;
        return {
            id: l.id,
            author: l.author,
            recipient: l.recipient,
            openDate: l.open_date,
            isOpened: !!l.is_opened,
            openedAt: l.opened_at,
            createdAt: l.created_at,
            canOpen,
            // 只有到期后才显示内容
            content: canOpen ? l.content : null,
            // 未开封且可以打开时的提示
            isNew: canOpen && !l.is_opened && l.recipient === currentUser
        };
    });

    res.json({ success: true, data: result });
});

// POST / — 写一封情书
router.post('/', authenticateUser, (req, res) => {
    const { content, openDate } = req.body;
    const author = req.user.username;
    const recipient = author === 'his' ? 'her' : 'his';

    if (!content || !openDate) {
        return res.status(400).json({ success: false, message: '内容和开封日期不能为空' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (openDate <= today) {
        return res.status(400).json({ success: false, message: '开封日期必须是未来的日期' });
    }

    const result = db.prepare(
        'INSERT INTO love_letters (content, author, recipient, open_date) VALUES (?, ?, ?, ?)'
    ).run(content, author, recipient, openDate);

    const letter = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: letter });
});

// PATCH /:id/open — 打开一封情书
router.patch('/:id/open', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const letter = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(id);

    if (!letter) {
        return res.status(404).json({ success: false, message: '情书不存在' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (letter.open_date > today) {
        return res.status(403).json({ success: false, message: '还没到开封日期哦，再等等吧~' });
    }

    if (!letter.is_opened) {
        db.prepare('UPDATE love_letters SET is_opened = 1, opened_at = datetime(?) WHERE id = ?')
            .run('now', id);
    }

    const updated = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
});

// DELETE /:id — 删除情书（仅作者可删）
router.delete('/:id', authenticateUser, (req, res) => {
    const id = parseInt(req.params.id);
    const letter = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(id);

    if (!letter) {
        return res.status(404).json({ success: false, message: '情书不存在' });
    }

    if (letter.author !== req.user.username) {
        return res.status(403).json({ success: false, message: '只能删除自己写的情书' });
    }

    db.prepare('DELETE FROM love_letters WHERE id = ?').run(id);
    res.json({ success: true });
});

module.exports = router;
