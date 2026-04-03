const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

// 确保上传目录存在
[UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer 配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件（JPEG, PNG, GIF, WebP）'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }
}).any();

// 生成缩略图
const generateThumbnail = async (filename) => {
    try {
        const originalPath = path.join(UPLOADS_DIR, filename);
        const thumbnailFilename = `thumbnail-${filename}`;
        const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

        await sharp(originalPath)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbnailPath);

        return thumbnailFilename;
    } catch (error) {
        console.error('生成缩略图失败:', error);
        return filename;
    }
};

// 删除上传文件及缩略图
const deleteUploadedFile = (filename, thumbnailUrl) => {
    try {
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        if (thumbnailUrl && thumbnailUrl.includes('/thumbnails/')) {
            const thumbnailPath = path.join(__dirname, '..', thumbnailUrl);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
        }
    } catch (err) {
        console.warn('删除文件失败:', err);
    }
};

module.exports = { UPLOADS_DIR, THUMBNAILS_DIR, upload, generateThumbnail, deleteUploadedFile };
