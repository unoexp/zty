const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { authenticateUser, signToken } = require('../middleware/auth');

// 注册（仅允许 his/her）
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!['his', 'her'].includes(username)) {
            return res.status(400).json({ success: false, message: '仅支持 his/her 账号' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: '密码长度不能少于6位' });
        }

        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(409).json({ success: false, message: '账号已存在' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const displayName = username === 'his' ? '他' : '她';

        db.prepare('INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)')
            .run(username, passwordHash, username, displayName);

        res.json({ success: true, message: '注册成功' });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ success: false, message: '注册失败' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        const token = signToken({
            username: user.username,
            role: user.role === 'admin' ? 'admin' : 'user',
            displayName: user.display_name
        });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            user: { username: user.username, displayName: user.display_name, role: user.role }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

// 登出
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: '已退出登录' });
});

// 获取当前用户信息
router.get('/me', authenticateUser, (req, res) => {
    res.json({
        success: true,
        user: {
            username: req.user.username,
            displayName: req.user.displayName,
            role: req.user.role
        }
    });
});

// 检查是否已初始化
router.get('/check-setup', (req, res) => {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('his', 'her')").get();
    res.json({ initialized: userCount.count >= 2 });
});

// 初始化设置（首次使用时创建账号）
router.post('/setup', async (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role IN (?, ?)').get('his', 'her');
        if (userCount.count >= 2) {
            return res.status(400).json({ success: false, message: '账号已初始化，无需重复设置' });
        }

        const { hisPassword, herPassword } = req.body;
        if (!hisPassword || !herPassword || hisPassword.length < 6 || herPassword.length < 6) {
            return res.status(400).json({ success: false, message: '密码长度不能少于6位' });
        }

        const hisHash = await bcrypt.hash(hisPassword, 10);
        const herHash = await bcrypt.hash(herPassword, 10);

        const insert = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)');
        const setupTransaction = db.transaction(() => {
            insert.run('his', hisHash, 'his', '他');
            insert.run('her', herHash, 'her', '她');
        });
        setupTransaction();

        res.json({ success: true, message: '账号初始化成功' });
    } catch (error) {
        console.error('初始化失败:', error);
        res.status(500).json({ success: false, message: '初始化失败' });
    }
});

module.exports = router;
