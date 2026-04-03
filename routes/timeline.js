const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { optionalAuth } = require('../middleware/auth');

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

    // 找最早的记录日期
    const earliestMemory = db.prepare('SELECT MIN(date) AS d FROM memories').get().d;
    const earliestPhoto = db.prepare('SELECT MIN(date) AS d FROM photos').get().d;
    const earliestMessage = db.prepare('SELECT MIN(date) AS d FROM messages').get().d;

    const dates = [earliestMemory, earliestPhoto, earliestMessage].filter(Boolean);
    const earliestDate = dates.length > 0 ? dates.sort()[0] : new Date().toISOString();
    const daysTogether = Math.floor((Date.now() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24));

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
            daysTogether,
            earliestDate,
            monthly
        }
    });
});

module.exports = router;
