const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { UPLOADS_DIR } = require('./utils/upload');

// 初始化数据库（建表）
require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态文件
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/public', express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/memories', require('./routes/memories'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/daily-moods', require('./routes/moods'));
app.use('/api/anniversaries', require('./routes/anniversaries'));
app.use('/api/couple-tasks', require('./routes/couple-tasks'));
app.use('/api/wishes', require('./routes/wishes'));
app.use('/api/daily-questions', require('./routes/daily-questions'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/locations', require('./routes/locations'));

// 兼容旧的 *-query 端点
app.get('/api/memories-query', (req, res) => res.redirect(307, `/api/memories/query?${new URLSearchParams(req.query)}`));
app.get('/api/photos-query', (req, res) => res.redirect(307, `/api/photos/query?${new URLSearchParams(req.query)}`));
app.get('/api/messages-query', (req, res) => res.redirect(307, `/api/messages/query?${new URLSearchParams(req.query)}`));
app.get('/api/daily-moods-query', (req, res) => res.redirect(307, `/api/daily-moods/query?${new URLSearchParams(req.query)}`));

// 前端页面
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/timeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

app.get('/map', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

// 启动服务器（监听所有网卡，支持外网访问）
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`服务器运行在 http://${HOST}:${PORT}`);
    // 显示本机 IP 方便外网访问
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`局域网访问: http://${net.address}:${PORT}`);
            }
        }
    }
});
