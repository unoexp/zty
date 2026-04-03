const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { upload, generateThumbnail } = require('../utils/upload');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有心情数据
router.get('/', optionalAuth, (req, res) => {
    const moods = db.prepare('SELECT * FROM daily_moods ORDER BY date DESC').all();
    const result = moods.map(m => ({
        date: m.date,
        his: { mood: m.his_mood, imageUrl: m.his_image_url, thumbnailUrl: m.his_thumbnail_url },
        her: { mood: m.her_mood, imageUrl: m.her_image_url, thumbnailUrl: m.her_thumbnail_url },
        createdAt: m.created_at,
        updatedAt: m.updated_at
    }));
    res.json({ success: true, data: result });
});

// 保存每日心情
router.post('/', authenticateUser, (req, res) => {
    const { date, his, her } = req.body;
    if (!date) {
        return res.status(400).json({ error: '日期不能为空' });
    }

    const existing = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(date);
    const now = new Date().toISOString();

    if (existing) {
        const updates = {};
        if (his !== undefined) {
            updates.his_mood = his.mood || his.emoji || existing.his_mood;
        }
        if (her !== undefined) {
            updates.her_mood = her.mood || her.emoji || existing.her_mood;
        }
        db.prepare(`UPDATE daily_moods SET
            his_mood = COALESCE(?, his_mood),
            her_mood = COALESCE(?, her_mood),
            updated_at = ? WHERE date = ?`)
            .run(updates.his_mood ?? null, updates.her_mood ?? null, now, date);
    } else {
        db.prepare(`INSERT INTO daily_moods (date, his_mood, her_mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
            .run(date, his?.mood || his?.emoji || '', her?.mood || her?.emoji || '', now, now);
    }

    const record = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(date);
    res.json({
        date: record.date,
        his: { mood: record.his_mood, imageUrl: record.his_image_url, thumbnailUrl: record.his_thumbnail_url },
        her: { mood: record.her_mood, imageUrl: record.her_image_url, thumbnailUrl: record.her_thumbnail_url },
        createdAt: record.created_at,
        updatedAt: record.updated_at
    });
});

// 上传心情图片
router.post('/image', authenticateUser, upload, async (req, res) => {
    try {
        const { date, user } = req.body;
        if (!date || !user || !['his', 'her'].includes(user)) {
            return res.status(400).json({ error: '日期和用户类型（his/her）不能为空' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '请上传图片' });
        }

        const file = req.files[0];
        const imageUrl = `/uploads/${file.filename}`;
        const thumbnail = await generateThumbnail(file.filename);
        const thumbnailUrl = thumbnail.startsWith('thumbnail-')
            ? `/uploads/thumbnails/${thumbnail}` : `/uploads/${thumbnail}`;
        const now = new Date().toISOString();

        const existing = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(date);
        if (existing) {
            const col_img = `${user}_image_url`;
            const col_thumb = `${user}_thumbnail_url`;
            db.prepare(`UPDATE daily_moods SET ${col_img} = ?, ${col_thumb} = ?, updated_at = ? WHERE date = ?`)
                .run(imageUrl, thumbnailUrl, now, date);
        } else {
            const data = { date, his_image_url: '', his_thumbnail_url: '', her_image_url: '', her_thumbnail_url: '' };
            data[`${user}_image_url`] = imageUrl;
            data[`${user}_thumbnail_url`] = thumbnailUrl;
            db.prepare(`INSERT INTO daily_moods (date, his_image_url, his_thumbnail_url, her_image_url, her_thumbnail_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
                .run(date, data.his_image_url, data.his_thumbnail_url, data.her_image_url, data.her_thumbnail_url, now, now);
        }

        const record = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(date);
        res.json({
            success: true,
            imageUrl,
            thumbnailUrl,
            record: {
                date: record.date,
                his: { mood: record.his_mood, imageUrl: record.his_image_url, thumbnailUrl: record.his_thumbnail_url },
                her: { mood: record.her_mood, imageUrl: record.her_image_url, thumbnailUrl: record.her_thumbnail_url }
            }
        });
    } catch (error) {
        console.error('上传图片失败:', error);
        res.status(500).json({ error: '上传图片失败' });
    }
});

// 查询指定日期心情
router.get('/query', (req, res) => {
    const { date } = req.query;
    const record = db.prepare('SELECT * FROM daily_moods WHERE date = ?').get(date);
    if (record) {
        res.json({
            date: record.date,
            his: { mood: record.his_mood, imageUrl: record.his_image_url, thumbnailUrl: record.his_thumbnail_url },
            her: { mood: record.her_mood, imageUrl: record.her_image_url, thumbnailUrl: record.her_thumbnail_url }
        });
    } else {
        res.json({ date, hisMood: '', herMood: '', hisImage: '', herImage: '' });
    }
});

module.exports = router;
