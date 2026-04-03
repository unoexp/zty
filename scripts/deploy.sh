#!/bin/bash
# ============================================================
# 情侣回忆应用 - 一键部署脚本
# 用法: bash scripts/deploy.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo ""
echo "========================================="
echo "  情侣回忆应用 - 部署脚本"
echo "========================================="
echo ""
echo "项目目录: $APP_DIR"
echo ""

# ---- 1. 检查 Node.js ----
command -v node >/dev/null 2>&1 || error "未安装 Node.js，请先安装"
NODE_VER=$(node -v)
log "Node.js 版本: $NODE_VER"

# ---- 2. 备份旧数据 ----
if [ -d "$APP_DIR/data" ]; then
    BACKUP_NAME="data_backup_$(date +%Y%m%d_%H%M%S)"
    cp -r "$APP_DIR/data" "$APP_DIR/$BACKUP_NAME"
    log "旧数据已备份到 $BACKUP_NAME/"
else
    warn "未找到 data/ 目录，跳过备份"
fi

# ---- 3. 安装依赖 ----
log "安装依赖..."
npm install --production 2>&1 | tail -1
log "依赖安装完成"

# ---- 4. 运行数据迁移 ----
if [ -f "$APP_DIR/data/memories.json" ] || [ -f "$APP_DIR/data/photos.json" ]; then
    log "检测到 JSON 数据文件，开始迁移到 SQLite..."
    node scripts/migrate.js
    log "数据迁移完成"
else
    warn "未找到 JSON 数据文件，跳过迁移（新安装或已迁移）"
fi

# ---- 5. 验证数据库 ----
node -e "
const db = require('./utils/db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
const memories = db.prepare('SELECT COUNT(*) as c FROM memories').get().c;
const photos = db.prepare('SELECT COUNT(*) as c FROM photos').get().c;
const messages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
console.log('  表数量: ' + tables.length);
console.log('  回忆: ' + memories + ' 条');
console.log('  照片: ' + photos + ' 张');
console.log('  消息: ' + messages + ' 条');
console.log('  用户: ' + users + ' 个');
" 2>&1
log "数据库验证通过"

# ---- 6. 停止旧进程 ----
if command -v pm2 >/dev/null 2>&1; then
    # 使用 pm2
    pm2 stop zty 2>/dev/null && log "已停止旧 pm2 进程" || true
elif lsof -i :${PORT:-3000} -t >/dev/null 2>&1; then
    OLD_PID=$(lsof -i :${PORT:-3000} -t 2>/dev/null | head -1)
    if [ -n "$OLD_PID" ]; then
        kill "$OLD_PID" 2>/dev/null
        sleep 1
        log "已停止旧进程 (PID: $OLD_PID)"
    fi
fi

# ---- 7. 启动应用 ----
echo ""
echo "========================================="
echo "  选择启动方式"
echo "========================================="
echo ""
echo "  1) pm2 守护进程（推荐，自动重启）"
echo "  2) 后台运行（nohup）"
echo "  3) 前台运行（调试用）"
echo "  4) 不启动，仅完成部署"
echo ""

read -p "请选择 [1-4]: " CHOICE

case "$CHOICE" in
    1)
        if ! command -v pm2 >/dev/null 2>&1; then
            warn "pm2 未安装，正在安装..."
            npm install -g pm2
        fi
        pm2 start server.js --name zty --update-env
        pm2 save
        log "应用已通过 pm2 启动"
        echo ""
        pm2 status zty
        ;;
    2)
        nohup node server.js > "$APP_DIR/app.log" 2>&1 &
        NEW_PID=$!
        sleep 1
        if kill -0 "$NEW_PID" 2>/dev/null; then
            log "应用已在后台启动 (PID: $NEW_PID)"
            log "日志文件: $APP_DIR/app.log"
        else
            error "启动失败，请检查 app.log"
        fi
        ;;
    3)
        log "前台启动中... (Ctrl+C 停止)"
        node server.js
        ;;
    4)
        log "部署完成，未启动应用"
        ;;
    *)
        warn "无效选项，未启动应用"
        ;;
esac

# ---- 8. 部署完成 ----
echo ""
echo "========================================="
echo -e "  ${GREEN}部署完成！${NC}"
echo "========================================="
echo ""
echo "  访问地址: http://localhost:${PORT:-3000}"
echo "  登录页面: http://localhost:${PORT:-3000}/login"
echo "  管理后台: http://localhost:${PORT:-3000}/admin"
echo "  时间线:   http://localhost:${PORT:-3000}/timeline"
echo "  地图:     http://localhost:${PORT:-3000}/map"
echo ""
echo "  首次使用请访问登录页面初始化 his/her 账号"
echo ""
if [ -n "$BACKUP_NAME" ]; then
    echo "  数据备份: $APP_DIR/$BACKUP_NAME/"
    echo "  确认无误后可删除: rm -rf $BACKUP_NAME"
    echo ""
fi
echo "  提示:"
echo "  - 生产环境请设置: export JWT_SECRET=你的密钥"
echo "  - 地图功能需替换 public/map.html 中的高德地图 API key"
echo "  - PWA 图标需添加 public/icon-192.png 和 icon-512.png"
echo ""
