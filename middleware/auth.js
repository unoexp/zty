const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zty-couple-app-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d';
const ADMIN_TOKEN_EXPIRY = '2h';

// 用户认证中间件
function authenticateUser(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '')
        || req.cookies?.token;

    if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { username: 'his'|'her', role: 'user'|'admin' }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'token 无效或已过期' });
    }
}

// 管理员认证中间件
function authenticateAdmin(req, res, next) {
    authenticateUser(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无管理员权限' });
        }
        next();
    });
}

// 可选认证（不强制，但如果有 token 则解析）
function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '')
        || req.cookies?.token;

    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            // token 无效但不阻断请求
        }
    }
    next();
}

function signToken(payload, isAdmin = false) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: isAdmin ? ADMIN_TOKEN_EXPIRY : TOKEN_EXPIRY
    });
}

module.exports = { authenticateUser, authenticateAdmin, optionalAuth, signToken, JWT_SECRET };
