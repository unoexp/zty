const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 确保数据目录和上传目录存在
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

[DATA_DIR, UPLOADS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 提供静态文件访问
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 初始化数据文件
const initDataFile = (filename, initialData) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
};

// 初始化所有数据文件
initDataFile('memories.json', []);
initDataFile('photos.json', []);
initDataFile('messages.json', []);
initDataFile('admin.json', { password: '232323' }); // 默认管理员密码
initDataFile('comments.json', []);

// 数据操作函数（统一使用这组，避免重复）
const readData = (filename) => {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取${filename}失败:`, error);
        return [];
    }
};

const writeData = (filename, data) => {
    try {
        const filePath = path.join(DATA_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`写入${filename}失败:`, error);
        return false;
    }
};

// 配置Multer用于文件上传（统一配置，避免重复）
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

// 文件过滤 - 只允许图片
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // 接受文件
    } else {
        // 关键修复：使用cb传递错误，而非直接throw
        cb(new Error('只允许上传图片文件（JPEG, PNG, GIF, WebP）'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 限制文件大小为50MB
    }
}).any();

// 生成缩略图路径（实际项目中应该使用sharp等库生成真正的缩略图）
const generateThumbnail = async (filename) => {
    try {
        // 原文件路径
        const originalPath = path.join(UPLOADS_DIR, filename);
        // 缩略图文件名（添加前缀区分）
        const thumbnailFilename = `thumbnail-${filename}`;
        // 缩略图保存路径
        const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
        
        // 使用sharp生成缩略图（宽高最大200px，保持比例）
        await sharp(originalPath)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbnailPath);
        
        // 返回缩略图文件名
        return thumbnailFilename;
    } catch (error) {
        console.error('生成缩略图失败:', error);
        // 失败时返回原文件（降级处理）
        return filename;
    }
};

// 管理员密码验证
const verifyAdminPassword = (password) => {
    const adminData = readData('admin.json');
    return adminData.password === password;
};

// 管理员路由
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (verifyAdminPassword(password)) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '密码错误' });
    }
});

app.post('/api/admin/change-password', (req, res) => {
    const { password, newPassword } = req.body;
    
    if (!verifyAdminPassword(password)) {
        return res.status(401).json({ success: false, message: '当前密码不正确' });
    }
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '新密码长度不能少于6位' });
    }
    
    const adminData = readData('admin.json');
    adminData.password = newPassword;
    writeData('admin.json', adminData);
    
    res.json({ success: true, message: '密码修改成功' });
});

// 回忆路由
app.get('/api/memories', (req, res) => {
    const memories = readData('memories.json');
    res.json(memories);
});

app.post('/api/memories', (req, res) => {
    const memories = readData('memories.json');
    const newMemory = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    
    memories.push(newMemory);
    writeData('memories.json', memories);
    
    res.json(newMemory);
});

app.put('/api/memories/:id', (req, res) => {
    const memories = readData('memories.json');
    const id = parseInt(req.params.id);
    const index = memories.findIndex(memory => memory.id === id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }
    
    memories[index] = { ...memories[index], ...req.body };
    writeData('memories.json', memories);
    
    res.json({ success: true, data: memories[index] });
});

app.delete('/api/memories/:id', (req, res) => {
    let memories = readData('memories.json');
    const id = parseInt(req.params.id);
    memories = memories.filter(memory => memory.id !== id);
    
    writeData('memories.json', memories);
    res.json({ success: true });
});

app.patch('/api/memories/:id/visibility', (req, res) => {
    const memories = readData('memories.json');
    const id = parseInt(req.params.id);
    const { visible } = req.body;
    
    const index = memories.findIndex(memory => memory.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '回忆不存在' });
    }
    
    memories[index].visible = visible;
    writeData('memories.json', memories);
    
    res.json({ success: true });
});

// 照片路由
app.get('/api/photos', (req, res) => {
    try {
        const photos = readData('photos.json');
        res.json({
            success: true,
            photos: photos
        });
    } catch (error) {
        console.error('获取照片失败:', error);
        res.status(500).json({
            success: false,
            message: `获取照片失败: ${error.message}`
        });
    }
});

// 单张照片上传接口（同步修改）
app.post('/api/photos', upload, async (req, res) => {  // 添加async
    try {
        const photos = readData('photos.json');
        const { caption, author } = req.body;
        
        if (!req.files || req.files.length === 0) {  // 注意：使用upload.any()时文件在req.files中
            return res.status(400).json({ success: false, message: '请上传照片' });
        }
        const file = req.files[0];  // 取第一个文件
        
        const timestamp = Date.now();
        // 生成缩略图
        const thumbnail = await generateThumbnail(file.filename);  // 添加await
        
        const newPhoto = {
            id: uuidv4(),
            caption: caption || '',
            author: author || 'his',
            filename: file.filename,
            originalname: file.originalname,
            url: `/uploads/${file.filename}`,
            thumbnailUrl: thumbnail.startsWith('thumbnail-') 
                ? `/uploads/thumbnails/${thumbnail}` 
                : `/uploads/${thumbnail}`,
            date: new Date(timestamp).toISOString(),
            timestamp: timestamp,
            visible: true,
            comments: []
        };
        
        photos.push(newPhoto);
        writeData('photos.json', photos);
        
        res.json(newPhoto);
    } catch (error) {
        console.error('照片上传失败:', error);
        res.status(500).json({
            success: false,
            message: `上传失败: ${error.message}`
        });
    }
});

// 批量上传照片接口（修改为支持异步生成缩略图）
app.post('/api/photos/batch', upload, async (req, res) => {  // 添加async
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有上传任何照片'
            });
        }

        const photos = readData('photos.json');
        const author = req.body.author || 'unknown';
        const description = req.body.description || '';
        const timestamp = Date.now();
        const date = new Date(timestamp).toISOString();

        // 处理上传的照片（使用map+Promise.all处理异步生成缩略图）
        const newPhotos = [];
        for (const file of req.files) {  // 使用for循环+await确保顺序执行
            // 异步生成缩略图
            const thumbnail = await generateThumbnail(file.filename);  // 添加await
            
            const photo = {
                id: uuidv4(),
                filename: file.filename,
                originalname: file.originalname,
                url: `/uploads/${file.filename}`,
                // 修复缩略图URL路径：如果生成了缩略图则指向thumbnails目录，否则指向原文件
                thumbnailUrl: thumbnail.startsWith('thumbnail-') 
                    ? `/uploads/thumbnails/${thumbnail}` 
                    : `/uploads/${thumbnail}`,
                author: author,
                description: description,
                date: date,
                timestamp: timestamp,
                visible: true,
                comments: []
            };
            
            newPhotos.push(photo);
            photos.push(photo);
        }

        // 保存照片数据
        const saved = writeData('photos.json', photos);
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: '保存照片数据失败'
            });
        }

        res.json({
            success: true,
            message: `成功上传 ${newPhotos.length} 张照片`,
            photos: newPhotos
        });
    } catch (error) {
        console.error('照片上传失败:', error);
        res.status(500).json({
            success: false,
            message: `上传失败: ${error.message}`
        });
    }
});

// 更新照片信息
app.put('/api/photos/:photoId', (req, res) => {
    try {
        const photos = readData('photos.json');
        const photoId = req.params.photoId;
        const index = photos.findIndex(photo => photo.id === photoId);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: '照片不存在' });
        }
        
        photos[index] = { ...photos[index], ...req.body };
        const saved = writeData('photos.json', photos);
        
        if (!saved) {
            return res.status(500).json({ success: false, message: '更新照片失败' });
        }
        
        res.json({ success: true, data: photos[index] });
    } catch (error) {
        console.error('更新照片失败:', error);
        res.status(500).json({
            success: false,
            message: `更新失败: ${error.message}`
        });
    }
});

// 删除照片
app.delete('/api/photos/:photoId', (req, res) => {
    try {
        const { photoId } = req.params;
        let photos = readData('photos.json');
        const photoIndex = photos.findIndex(p => p.id === photoId);

        if (photoIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '未找到该照片'
            });
        }

        // 获取要删除的照片信息
        const photoToDelete = photos[photoIndex];

        // 从数组中移除照片
        photos = photos.filter(p => p.id !== photoId);
        
        // 保存更新后的照片列表
        const saved = writeData('photos.json', photos);
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: '删除照片数据失败'
            });
        }

        // 实际删除文件
        try {
            const filePath = path.join(UPLOADS_DIR, photoToDelete.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // 删除缩略图
            if (photoToDelete.thumbnailUrl && photoToDelete.thumbnailUrl !== photoToDelete.url) {
                const thumbnailPath = path.join(__dirname, photoToDelete.thumbnailUrl);
                if (fs.existsSync(thumbnailPath)) {
                    fs.unlinkSync(thumbnailPath);
                }
            }
        } catch (err) {
            console.warn('删除照片文件失败:', err);
            // 即使文件删除失败，仍返回成功，因为数据库记录已删除
        }

        res.json({
            success: true,
            message: '照片已成功删除'
        });
    } catch (error) {
        console.error('删除照片失败:', error);
        res.status(500).json({
            success: false,
            message: `删除照片失败: ${error.message}`
        });
    }
});

// 切换照片可见性
app.patch('/api/photos/:photoId', (req, res) => {
    try {
        const { photoId } = req.params;
        const { visible } = req.body;
        
        if (visible === undefined) {
            return res.status(400).json({
                success: false,
                message: '请提供可见性参数'
            });
        }

        const photos = readData('photos.json');
        const photoIndex = photos.findIndex(p => p.id === photoId);

        if (photoIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '未找到该照片'
            });
        }

        // 更新可见性
        photos[photoIndex].visible = visible;

        // 保存更新
        const saved = writeData('photos.json', photos);
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: '更新照片可见性失败'
            });
        }

        res.json({
            success: true,
            message: `照片已${visible ? '显示' : '隐藏'}`,
            visible: visible
        });
    } catch (error) {
        console.error('更新照片可见性失败:', error);
        res.status(500).json({
            success: false,
            message: `更新失败: ${error.message}`
        });
    }
});

// 为照片添加评论
app.post('/api/photos/:photoId/comments', (req, res) => {
    try {
        const { photoId } = req.params;
        const { content, author } = req.body;

        if (!content || !author) {
            return res.status(400).json({
                success: false,
                message: '评论内容和作者不能为空'
            });
        }

        const photos = readData('photos.json');
        const photoIndex = photos.findIndex(p => p.id === photoId);

        if (photoIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '未找到该照片'
            });
        }

        // 创建新评论
        const comment = {
            id: uuidv4(),
            content: content,
            author: author,
            date: new Date().toISOString(),
            timestamp: Date.now()
        };

        // 添加评论到照片
        if (!photos[photoIndex].comments) {
            photos[photoIndex].comments = [];
        }
        photos[photoIndex].comments.push(comment);

        // 保存更新后的照片数据
        const saved = writeData('photos.json', photos);
        if (!saved) {
            return res.status(500).json({
                success: false,
                message: '保存评论失败'
            });
        }

        res.json({
            success: true,
            comment: comment
        });
    } catch (error) {
        console.error('添加评论失败:', error);
        res.status(500).json({
            success: false,
            message: `添加评论失败: ${error.message}`
        });
    }
});

// 获取照片的评论
app.get('/api/photos/:photoId/comments', (req, res) => {
    try {
        const { photoId } = req.params;
        const photos = readData('photos.json');
        const photo = photos.find(p => p.id === photoId);

        if (!photo) {
            return res.status(404).json({
                success: false,
                message: '未找到该照片'
            });
        }

        res.json({
            success: true,
            comments: photo.comments || []
        });
    } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({
            success: false,
            message: `获取评论失败: ${error.message}`
        });
    }
});

// 消息路由
app.get('/api/messages', (req, res) => {
    const messages = readData('messages.json');
    res.json(messages);
});

app.post('/api/messages', (req, res) => {
    const messages = readData('messages.json');
    const newMessage = {
        id: Date.now(),
        ...req.body,
        date: new Date().toISOString(),
        visible: true,
        createdAt: new Date().toISOString()
    };
    
    messages.push(newMessage);
    writeData('messages.json', messages);
    
    res.json(newMessage);
});

app.put('/api/messages/:id', (req, res) => {
    const messages = readData('messages.json');
    const id = parseInt(req.params.id);
    const index = messages.findIndex(message => message.id === id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: '消息不存在' });
    }
    
    messages[index] = { ...messages[index], ...req.body };
    writeData('messages.json', messages);
    
    res.json({ success: true, data: messages[index] });
});

app.delete('/api/messages/:id', (req, res) => {
    let messages = readData('messages.json');
    const id = parseInt(req.params.id);
    messages = messages.filter(message => message.id !== id);
    
    writeData('messages.json', messages);
    res.json({ success: true });
});

app.patch('/api/messages/:id/visibility', (req, res) => {
    const messages = readData('messages.json');
    const id = parseInt(req.params.id);
    const { visible } = req.body;
    
    const index = messages.findIndex(message => message.id === id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '消息不存在' });
    }
    
    messages[index].visible = visible;
    writeData('messages.json', messages);
    
    res.json({ success: true });
});

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 管理员页面路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`照片上传目录: ${UPLOADS_DIR}`);
    console.log(`数据存储目录: ${DATA_DIR}`);
});
