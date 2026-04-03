const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { authenticateAdmin, signToken } = require('../middleware/auth');

// 管理员登录
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();

        if (!admin) {
            // 兼容：如果还没迁移，检查旧的 admin.json
            const fs = require('fs');
            const path = require('path');
            const adminFile = path.join(__dirname, '..', 'data', 'admin.json');
            if (fs.existsSync(adminFile)) {
                const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
                if (adminData.password === password) {
                    const token = signToken({ username: 'admin', role: 'admin' }, true);
                    res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 2 * 60 * 60 * 1000 });
                    return res.json({ success: true });
                }
            }
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        if (!(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        const token = signToken({ username: 'admin', role: 'admin' }, true);
        res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 2 * 60 * 60 * 1000 });
        res.json({ success: true });
    } catch (error) {
        console.error('管理员登录失败:', error);
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

// 修改密码
router.post('/change-password', authenticateAdmin, async (req, res) => {
    const { password, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '新密码长度不能少于6位' });
    }

    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
        return res.status(401).json({ success: false, message: '当前密码不正确' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE role = ?')
        .run(newHash, new Date().toISOString(), 'admin');

    res.json({ success: true, message: '密码修改成功' });
});

module.exports = router;
