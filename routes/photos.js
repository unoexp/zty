const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { upload, generateThumbnail, generateVideoThumbnail, deleteUploadedFile, getMediaType } = require('../utils/upload');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

// 获取所有照片
router.get('/', optionalAuth, (req, res) => {
    const photos = db.prepare('SELECT * FROM photos ORDER BY timestamp DESC').all();
    const commentStmt = db.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY date ASC');
    const result = photos.map(p => ({
        ...p,
        thumbnailUrl: p.thumbnail_url,
        mediaType: p.media_type || 'image',
        visible: !!p.visible,
        comments: commentStmt.all('photo', p.id)
    }));
    res.json({ success: true, data: result });
});

// 单张照片/视频上传
router.post('/', authenticateUser, upload, async (req, res) => {
    try {
        const { caption } = req.body;
        const author = req.user.username;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: '请上传文件' });
        }
        const file = req.files[0];
        const timestamp = Date.now();
        const mediaType = getMediaType(file.mimetype);

        let thumbnailUrl = '';
        if (mediaType === 'image') {
            const thumbnail = await generateThumbnail(file.filename);
            thumbnailUrl = thumbnail.startsWith('thumbnail-')
                ? `/uploads/thumbnails/${thumbnail}` : `/uploads/${thumbnail}`;
        } else if (mediaType === 'video') {
            await generateVideoThumbnail(file.filename);
        }

        const id = uuidv4();
        const date = new Date(timestamp).toISOString();

        db.prepare(`INSERT INTO photos (id, caption, author, filename, originalname, url, thumbnail_url, date, timestamp, visible, media_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
            .run(id, caption || '', author, file.filename, file.originalname, `/uploads/${file.filename}`, thumbnailUrl, date, timestamp, mediaType);

        const newPhoto = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
        res.json({ success: true, data: { ...newPhoto, thumbnailUrl: newPhoto.thumbnail_url, mediaType: newPhoto.media_type, visible: true, comments: [] } });
    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ success: false, message: `上传失败: ${error.message}` });
    }
});

// 批量上传照片/视频
router.post('/batch', authenticateUser, upload, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: '没有上传任何文件' });
        }

        const author = req.user.username;
        const description = req.body.description || '';
        const timestamp = Date.now();
        const date = new Date(timestamp).toISOString();

        const insertStmt = db.prepare(`INSERT INTO photos (id, caption, description, author, filename, originalname, url, thumbnail_url, date, timestamp, visible, media_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);

        const newPhotos = [];
        for (const file of req.files) {
            const mediaType = getMediaType(file.mimetype);
            let thumbnailUrl = '';
            if (mediaType === 'image') {
                const thumbnail = await generateThumbnail(file.filename);
                thumbnailUrl = thumbnail.startsWith('thumbnail-')
                    ? `/uploads/thumbnails/${thumbnail}` : `/uploads/${thumbnail}`;
            } else if (mediaType === 'video') {
                await generateVideoThumbnail(file.filename);
            }
            const id = uuidv4();

            insertStmt.run(id, '', description, author, file.filename, file.originalname, `/uploads/${file.filename}`, thumbnailUrl, date, timestamp, mediaType);

            newPhotos.push({ id, filename: file.filename, url: `/uploads/${file.filename}`, thumbnailUrl, mediaType, author, description, date, timestamp, visible: true, comments: [] });
        }

        res.json({ success: true, message: `成功上传 ${newPhotos.length} 个文件`, data: newPhotos });
    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ success: false, message: `上传失败: ${error.message}` });
    }
});

// 更新照片信息
router.put('/:photoId', authenticateUser, (req, res) => {
    const photoId = req.params.photoId;
    const existing = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
    if (!existing) {
        return res.status(404).json({ success: false, message: '照片不存在' });
    }

    const { caption, description, author, visible } = req.body;
    db.prepare(`UPDATE photos SET
        caption = COALESCE(?, caption),
        description = COALESCE(?, description),
        author = COALESCE(?, author),
        visible = COALESCE(?, visible)
        WHERE id = ?`)
        .run(caption ?? null, description ?? null, author ?? null,
            visible !== undefined ? (visible ? 1 : 0) : null, photoId);

    const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
    res.json({ success: true, data: { ...updated, thumbnailUrl: updated.thumbnail_url, visible: !!updated.visible } });
});

// 删除照片
router.delete('/:photoId', authenticateUser, (req, res) => {
    const { photoId } = req.params;
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
    if (!photo) {
        return res.status(404).json({ success: false, message: '未找到该照片' });
    }

    db.prepare('DELETE FROM comments WHERE entity_type = ? AND entity_id = ?').run('photo', photoId);
    db.prepare('DELETE FROM photos WHERE id = ?').run(photoId);
    deleteUploadedFile(photo.filename, photo.thumbnail_url);

    res.json({ success: true, message: '照片已成功删除' });
});

// 切换照片可见性
router.patch('/:photoId', authenticateUser, (req, res) => {
    const { photoId } = req.params;
    const { visible } = req.body;
    if (visible === undefined) {
        return res.status(400).json({ success: false, message: '请提供可见性参数' });
    }

    const result = db.prepare('UPDATE photos SET visible = ? WHERE id = ?').run(visible ? 1 : 0, photoId);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '未找到该照片' });
    }
    res.json({ success: true, message: `照片已${visible ? '显示' : '隐藏'}`, visible });
});

// 添加照片评论
router.post('/:photoId/comments', authenticateUser, (req, res) => {
    const { photoId } = req.params;
    const { content } = req.body;
    const author = req.user.username;

    if (!content) {
        return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    const photo = db.prepare('SELECT id FROM photos WHERE id = ?').get(photoId);
    if (!photo) {
        return res.status(404).json({ success: false, message: '未找到该照片' });
    }

    const comment = {
        id: uuidv4(),
        content,
        author,
        date: new Date().toISOString(),
        timestamp: Date.now()
    };

    db.prepare('INSERT INTO comments (id, entity_type, entity_id, content, author, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(comment.id, 'photo', photoId, comment.content, comment.author, comment.date);

    res.json({ success: true, comment });
});

// 获取照片评论
router.get('/:photoId/comments', (req, res) => {
    const { photoId } = req.params;
    const photo = db.prepare('SELECT id FROM photos WHERE id = ?').get(photoId);
    if (!photo) {
        return res.status(404).json({ success: false, message: '未找到该照片' });
    }
    const comments = db.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY date ASC')
        .all('photo', photoId);
    res.json({ success: true, comments });
});

// 按日期查询照片
router.get('/query', (req, res) => {
    const { date } = req.query;
    if (date) {
        const photos = db.prepare("SELECT * FROM photos WHERE date(date) = date(?) ORDER BY timestamp DESC").all(date);
        return res.json(photos.map(p => ({ ...p, thumbnailUrl: p.thumbnail_url, visible: !!p.visible })));
    }
    const photos = db.prepare('SELECT * FROM photos ORDER BY timestamp DESC').all();
    res.json(photos.map(p => ({ ...p, thumbnailUrl: p.thumbnail_url, visible: !!p.visible })));
});

module.exports = router;
