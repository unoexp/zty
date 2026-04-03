const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { optionalAuth, authenticateUser } = require('../middleware/auth');

// GET / — 获取混合时间线
router.get('/', optionalAuth, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const year = req.query.year ? parseInt(req.query.year) : null;
    const month = req.query.month ? parseInt(req.query.month) : null;

    // 构建日期过滤条件
    let dateFilter = '';
    const params = [];

    if (year && month) {
        const monthStr = String(month).padStart(2, '0');
        dateFilter = "AND date >= ? AND date < ?";
        params.push(`${year}-${monthStr}-01`);
        // 下个月
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonthStr = String(nextMonth).padStart(2, '0');
        params.push(`${nextYear}-${nextMonthStr}-01`);
    } else if (year) {
        dateFilter = "AND date >= ? AND date < ?";
        params.push(`${year}-01-01`);
        params.push(`${year + 1}-01-01`);
    }

    // 从三个表分别查询，统一格式
    const memorySql = `
        SELECT id, title, content, author, date, 'memory' AS type, visible
        FROM memories
        WHERE 1=1 ${dateFilter}
    `;
    const photoSql = `
        SELECT id, caption AS title, description AS content, author, date, 'photo' AS type,
               url, thumbnail_url, visible
        FROM photos
        WHERE 1=1 ${dateFilter}
    `;
    const messageSql = `
        SELECT id, '' AS title, content, author, date, 'message' AS type,
               should_blur, visible
        FROM messages
        WHERE 1=1 ${dateFilter}
    `;

    const memories = db.prepare(memorySql).all(...params);
    const photos = db.prepare(photoSql).all(...params);
    const messages = db.prepare(messageSql).all(...params);

    // 合并并统一字段
    const allItems = [
        ...memories.map(m => ({
            type: 'memory',
            id: m.id,
            title: m.title,
            content: m.content,
            author: m.author,
            date: m.date,
            visible: !!m.visible
        })),
        ...photos.map(p => ({
            type: 'photo',
            id: p.id,
            title: p.title,
            content: p.content,
            author: p.author,
            date: p.date,
            url: p.url,
            thumbnailUrl: p.thumbnail_url,
            visible: !!p.visible
        })),
        ...messages.map(m => ({
            type: 'message',
            id: m.id,
            title: '',
            content: m.content,
            author: m.author,
            date: m.date,
            shouldBlur: !!m.should_blur,
            visible: !!m.visible
        }))
    ];

    // 按日期倒序
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 分页
    const total = allItems.length;
    const offset = (page - 1) * limit;
    const paged = allItems.slice(offset, offset + limit);

    res.json({
        success: true,
        data: paged,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// GET /stats — 获取统计信息
router.get('/stats', optionalAuth, (req, res) => {
    const memoryCount = db.prepare('SELECT COUNT(*) AS count FROM memories').get().count;
    const photoCount = db.prepare('SELECT COUNT(*) AS count FROM photos').get().count;
    const messageCount = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;

    // 额外统计
    const wishCount = db.prepare('SELECT COUNT(*) AS count FROM wishes').get().count;
    const wishDoneCount = db.prepare('SELECT COUNT(*) AS count FROM wishes WHERE completed = 1').get().count;
    const taskCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
    const taskDoneCount = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE status = ?').get('done').count;
    const moodDays = db.prepare('SELECT COUNT(*) AS count FROM daily_moods WHERE his_mood != ? OR her_mood != ?').get('', '').count;
    const commentCount = db.prepare('SELECT COUNT(*) AS count FROM comments').get().count;
    const locationCount = db.prepare('SELECT COUNT(*) AS count FROM locations').get().count;
    const letterCount = db.prepare('SELECT COUNT(*) AS count FROM love_letters').get().count;

    // 优先使用设置的在一起日期，否则取最早记录
    const togetherDateSetting = db.prepare("SELECT value FROM app_settings WHERE key = ?").get('together_date');

    let earliestDate;
    if (togetherDateSetting && togetherDateSetting.value) {
        earliestDate = togetherDateSetting.value;
    } else {
        const earliestMemory = db.prepare('SELECT MIN(date) AS d FROM memories').get().d;
        const earliestPhoto = db.prepare('SELECT MIN(date) AS d FROM photos').get().d;
        const earliestMessage = db.prepare('SELECT MIN(date) AS d FROM messages').get().d;
        const dates = [earliestMemory, earliestPhoto, earliestMessage].filter(Boolean);
        earliestDate = dates.length > 0 ? dates.sort()[0] : new Date().toISOString();
    }
    const daysTogether = Math.floor((Date.now() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24));

    // 计算里程碑
    const milestones = [
        { days: 100, label: '100天' }, { days: 200, label: '200天' },
        { days: 365, label: '1周年' }, { days: 500, label: '500天' },
        { days: 730, label: '2周年' }, { days: 1000, label: '1000天' },
        { days: 1095, label: '3周年' }, { days: 1461, label: '4周年' },
        { days: 1826, label: '5周年' }, { days: 2000, label: '2000天' },
        { days: 3652, label: '10周年' }
    ];
    const nextMilestone = milestones.find(m => m.days > daysTogether);
    const passedMilestones = milestones.filter(m => m.days <= daysTogether);

    // 按月统计
    const monthlyMemories = db.prepare(`
        SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count
        FROM memories GROUP BY month ORDER BY month DESC
    `).all();

    const monthlyPhotos = db.prepare(`
        SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count
        FROM photos GROUP BY month ORDER BY month DESC
    `).all();

    const monthlyMessages = db.prepare(`
        SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count
        FROM messages GROUP BY month ORDER BY month DESC
    `).all();

    // 合并月度统计
    const monthMap = {};
    for (const m of monthlyMemories) {
        if (!monthMap[m.month]) monthMap[m.month] = { month: m.month, memories: 0, photos: 0, messages: 0 };
        monthMap[m.month].memories = m.count;
    }
    for (const p of monthlyPhotos) {
        if (!monthMap[p.month]) monthMap[p.month] = { month: p.month, memories: 0, photos: 0, messages: 0 };
        monthMap[p.month].photos = p.count;
    }
    for (const m of monthlyMessages) {
        if (!monthMap[m.month]) monthMap[m.month] = { month: m.month, memories: 0, photos: 0, messages: 0 };
        monthMap[m.month].messages = m.count;
    }

    const monthly = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));

    res.json({
        success: true,
        data: {
            memoryCount,
            photoCount,
            messageCount,
            wishCount,
            wishDoneCount,
            taskCount,
            taskDoneCount,
            moodDays,
            commentCount,
            locationCount,
            letterCount,
            daysTogether,
            earliestDate,
            nextMilestone,
            passedMilestones,
            monthly
        }
    });
});

// GET /together-date — 获取在一起的日期
router.get('/together-date', (req, res) => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get('together_date');
    res.json({ success: true, data: { date: row ? row.value : null } });
});

// PUT /together-date — 设置在一起的日期
router.put('/together-date', authenticateUser, (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: '日期不能为空' });
    }
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run('together_date', date);
    res.json({ success: true });
});

module.exports = router;
