const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { upload, deleteUploadedFile } = require('../utils/upload');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有音频
router.get('/', optionalAuth, (req, res) => {
    const audios = db.prepare('SELECT * FROM audios ORDER BY timestamp DESC').all();
    const result = audios.map(a => ({
        ...a,
        visible: !!a.visible
    }));
    res.json({ success: true, data: result });
});

// 上传音频
router.post('/', authenticateUser, upload, (req, res) => {
    try {
        const { caption } = req.body;
        const author = req.user.username;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: '请上传音频文件' });
        }
        const file = req.files[0];
        const timestamp = Date.now();

        const id = uuidv4();
        const date = new Date(timestamp).toISOString();
        const duration = parseFloat(req.body.duration) || 0;

        db.prepare(`INSERT INTO audios (id, caption, author, filename, originalname, url, duration, date, timestamp, visible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
            .run(id, caption || '', author, file.filename, file.originalname, `/uploads/${file.filename}`, duration, date, timestamp);

        const newAudio = db.prepare('SELECT * FROM audios WHERE id = ?').get(id);
        res.json({ success: true, data: { ...newAudio, visible: true } });
    } catch (error) {
        console.error('音频上传失败:', error);
        res.status(500).json({ success: false, message: `上传失败: ${error.message}` });
    }
});

// 删除音频
router.delete('/:audioId', authenticateUser, (req, res) => {
    const { audioId } = req.params;
    const audio = db.prepare('SELECT * FROM audios WHERE id = ?').get(audioId);
    if (!audio) {
        return res.status(404).json({ success: false, message: '未找到该音频' });
    }

    db.prepare('DELETE FROM audios WHERE id = ?').run(audioId);
    deleteUploadedFile(audio.filename, null);

    res.json({ success: true, message: '音频已成功删除' });
});

// 切换音频可见性
router.patch('/:audioId', authenticateUser, (req, res) => {
    const { audioId } = req.params;
    const { visible } = req.body;
    if (visible === undefined) {
        return res.status(400).json({ success: false, message: '请提供可见性参数' });
    }

    const result = db.prepare('UPDATE audios SET visible = ? WHERE id = ?').run(visible ? 1 : 0, audioId);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '未找到该音频' });
    }
    res.json({ success: true, message: `音频已${visible ? '显示' : '隐藏'}`, visible });
});

// 按日期查询音频
router.get('/query', (req, res) => {
    const { date } = req.query;
    if (date) {
        const audios = db.prepare("SELECT * FROM audios WHERE date(date) = date(?) ORDER BY timestamp DESC").all(date);
        return res.json(audios.map(a => ({ ...a, visible: !!a.visible })));
    }
    const audios = db.prepare('SELECT * FROM audios ORDER BY timestamp DESC').all();
    res.json(audios.map(a => ({ ...a, visible: !!a.visible })));
});

module.exports = router;
