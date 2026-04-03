// 全局变量
let currentUser = null;
let memories = [];
let photos = [];
let messages = [];
let currentPhotoIndex = 0;
let currentPage = 1;
let memoriesCurrentPage = 1;
let messagesCurrentPage = 1;
let totalMessagesPages = 1;
let totalMemoriesPages = 1;
const photosPerPage = 8;
const memoriesPageSize = 5;
const messagesPageSize = 5;
const maxVisibleComments = 3;
const API_BASE_URL = '';

// XSS 防护：转义 HTML 特殊字符
// 切换用户（登出后跳转登录页）
async function switchUser() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 通过JWT认证获取当前用户身份
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
            // 未登录，兼容旧的URL参数模式
            const params = new URLSearchParams(window.location.search);
            const user = params.get('user');
            if (user === 'his' || user === 'her') {
                currentUser = user;
            } else {
                window.location.href = '/login';
                return;
            }
        } else {
            const data = await res.json();
            currentUser = data.user.username;
        }
    } catch (e) {
        // 网络错误时降级到URL参数
        const params = new URLSearchParams(window.location.search);
        const user = params.get('user');
        if (user === 'his' || user === 'her') {
            currentUser = user;
        } else {
            window.location.href = '/login';
            return;
        }
    }

    initUserInterface();
    // 初始化事件监听
    initEventListeners();
    initNewFeatureListeners();

    // 加载数据
    loadAllData();
    loadNewFeatures();
});
// 初始化用户界面
function initUserInterface() {
    const userText = document.getElementById('user-text');
    const userIndicator = document.getElementById('user-indicator');

    // 设置用户显示文本和主题emoji
    userText.textContent = currentUser === 'his' ? '他的视角 💙' : '她的视角 💗';

    // 设置主题颜色
    document.documentElement.style.setProperty('--user-color', currentUser === 'his' ? '#4F9EFD' : '#FF75A0');

    // 应用主题 class 到 body
    document.body.classList.add(currentUser === 'his' ? 'theme-his' : 'theme-her');

    // 添加CSS类设置颜色
    userIndicator.classList.add(currentUser === 'his' ? 'bg-his-primary' : 'bg-her-primary');

    // 更新导航链接颜色
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.add('text-primary');
    });

    // 为CSS变量设置颜色
    const root = document.documentElement;
    root.style.setProperty('--primary-color', currentUser === 'his' ? '#4F9EFD' : '#FF75A0');

    // 设置 meta theme-color
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', currentUser === 'his' ? '#4F9EFD' : '#FF75A0');

    // 初始化滚动入场动画
    initScrollAnimations();
}

// 滚动入场动画
function initScrollAnimations() {
    document.querySelectorAll('section, #days-together-card, #daily-section, .grid').forEach(el => {
        el.classList.add('animate-on-scroll');
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    // 初始化特效
    initECG();
    initParticles();
}

// ---- 粒子系统 ----
// ---- 心电图动画（监护仪风格：逐点绘制，从左到右） ----
function initECG() {
    const canvas = document.getElementById('ecg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isHer = currentUser === 'her';
    const color = isHer ? '#FF75A0' : '#4F9EFD';
    const dpr = window.devicePixelRatio || 1;

    let w, h;
    let points = new Array(2000);

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        w = Math.floor(rect.width);
        h = 100;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (let i = 0; i < points.length; i++) points[i] = undefined;
    }
    resize();
    window.addEventListener('resize', resize);
    let cursor = 0;         // 当前绘制位置
    let waveQueue = [];     // 待绘制的波形数据
    let waveIdx = 0;        // 波形数据中的当前位置

    // 生成一个完整心跳周期的波形
    function generateBeat() {
        const pts = [];
        // 心跳前的平静线（较长，模拟真实心率 60-80bpm）
        const restLen = 120 + Math.floor(Math.random() * 80);
        for (let i = 0; i < restLen; i++) {
            pts.push((Math.random() - 0.5) * 0.8);
        }
        // P波（小圆拱）
        const pH = 3 + Math.random() * 2;
        for (let i = 0; i < 14; i++) {
            pts.push(-Math.sin(i / 14 * Math.PI) * pH);
        }
        // PR段
        for (let i = 0; i < 5; i++) pts.push((Math.random() - 0.5) * 0.5);
        // Q小谷
        pts.push(2 + Math.random() * 2);
        pts.push(4 + Math.random() * 2);
        // R大尖峰
        const rH = 25 + Math.random() * 15;
        pts.push(-rH * 0.6);
        pts.push(-rH);
        pts.push(-rH * 0.7);
        // S谷
        const sH = 8 + Math.random() * 6;
        pts.push(sH);
        pts.push(sH * 0.4);
        // ST段
        for (let i = 0; i < 8; i++) pts.push((Math.random() - 0.5) * 0.8);
        // T波
        const tH = 5 + Math.random() * 4;
        for (let i = 0; i < 20; i++) {
            pts.push(-Math.sin(i / 20 * Math.PI) * tH);
        }
        // 心跳后短平线
        for (let i = 0; i < 10; i++) {
            pts.push((Math.random() - 0.5) * 0.6);
        }
        return pts;
    }

    // 确保队列里有足够数据
    function ensureWave() {
        while (waveQueue.length - waveIdx < 400) {
            waveQueue = waveQueue.concat(generateBeat());
        }
        // 回收已用数据防止内存增长
        if (waveIdx > 1000) {
            waveQueue = waveQueue.slice(waveIdx);
            waveIdx = 0;
        }
    }
    ensureWave();

    const speed = 1.2; // 每帧前进像素数
    let subPixel = 0;

    function draw() {
        const midY = h / 2;
        const eraseWidth = 20; // 光标前方擦除宽度

        // 前进
        subPixel += speed;
        const steps = Math.floor(subPixel);
        subPixel -= steps;

        for (let s = 0; s < steps; s++) {
            const val = waveQueue[waveIdx] || 0;
            waveIdx++;
            ensureWave();

            points[cursor] = midY + val;

            // 擦除光标前方的区域
            const eraseStart = cursor + 1;
            for (let e = 0; e < eraseWidth; e++) {
                const ei = (eraseStart + e) % w;
                points[ei] = undefined;
            }

            cursor = (cursor + 1) % w;
        }

        // 绘制
        ctx.clearRect(0, 0, w, h);

        // 发光层
        ctx.save();
        ctx.filter = 'blur(4px)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.08;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        drawTrace(ctx);
        ctx.restore();

        // 主线
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.35;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        drawTrace(ctx);

        // 光标亮点
        if (points[cursor > 0 ? cursor - 1 : w - 1] !== undefined) {
            const cy = points[cursor > 0 ? cursor - 1 : w - 1];
            const cx = cursor > 0 ? cursor - 1 : w - 1;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(draw);
    }

    function drawTrace(c) {
        c.beginPath();
        let moved = false;
        for (let x = 0; x < w; x++) {
            if (points[x] === undefined) {
                if (moved) { c.stroke(); c.beginPath(); moved = false; }
                continue;
            }
            if (!moved) {
                c.moveTo(x, points[x]);
                moved = true;
            } else {
                c.lineTo(x, points[x]);
            }
        }
        if (moved) c.stroke();
    }

    draw();
}

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    const isHer = currentUser === 'her';

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // 粒子配置：他 → 蓝色星星 + 光点，她 → 粉色爱心 + 花瓣
    const count = Math.min(35, Math.floor(w * h / 30000));

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: 3 + Math.random() * 8,
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: -0.15 - Math.random() * 0.3,
            opacity: 0.08 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2,
            type: Math.random() > 0.4 ? 'shape' : 'dot'
        });
    }

    function drawHeart(x, y, size, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = isHer ? '#FF75A0' : '#4F9EFD';
        ctx.translate(x, y);
        ctx.beginPath();
        const s = size * 0.5;
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.8, s * 0.3, 0, s * 1.5);
        ctx.bezierCurveTo(s * 1.8, s * 0.3, s, -s * 0.5, 0, s * 0.3);
        ctx.fill();
        ctx.restore();
    }

    function drawStar(x, y, size, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = isHer ? '#FF75A0' : '#4F9EFD';
        ctx.translate(x, y);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = size * 0.45;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawDot(x, y, size, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity * 0.6;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, isHer ? 'rgba(255,117,160,0.6)' : 'rgba(79,158,253,0.6)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, w, h);
        frame++;

        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.phase += 0.01;

            // 漂浮摆动
            p.x += Math.sin(p.phase) * 0.2;

            // 越界重置
            if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
            if (p.x < -20) p.x = w + 20;
            if (p.x > w + 20) p.x = -20;

            // 呼吸般的透明度变化
            const breathe = 0.5 + 0.5 * Math.sin(p.phase * 2);
            const alpha = p.opacity * (0.6 + 0.4 * breathe);

            if (p.type === 'shape') {
                if (isHer) drawHeart(p.x, p.y, p.size, alpha);
                else drawStar(p.x, p.y, p.size, alpha);
            } else {
                drawDot(p.x, p.y, p.size * 1.5, alpha);
            }
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// 初始化事件监听
function initEventListeners() {
    // 回忆表单相关
    document.getElementById('add-memory-btn').addEventListener('click', () => {
        document.getElementById('memory-form-container').classList.remove('hidden');
        setNowTime();
    });
    
    document.getElementById('cancel-memory').addEventListener('click', () => {
        document.getElementById('memory-form-container').classList.add('hidden');
        document.getElementById('memory-form').reset();
    });
    
    document.getElementById('memory-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addNewMemory();
    });
    document.getElementById('calendar-link').addEventListener('click', function() {
        window.location.href = 'calendar.html';
    });
    // 回忆分页事件
    document.getElementById('memories-prev-page').addEventListener('click', () => {
        if (memoriesCurrentPage > 1) {
            memoriesCurrentPage--;
            renderMemories();
            const targetElement = document.querySelector("#memories");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
    
    document.getElementById('memories-next-page').addEventListener('click', () => {
        if (memoriesCurrentPage < totalMemoriesPages) {
            memoriesCurrentPage++;
            renderMemories();
            const targetElement = document.querySelector("#memories");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
    
    // 悄悄话分页事件
    document.getElementById('messages-prev-page').addEventListener('click', () => {
        if (messagesCurrentPage > 1) {
            messagesCurrentPage--;
            renderMessages();
            const targetElement = document.querySelector("#messages");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
    
    document.getElementById('messages-next-page').addEventListener('click', () => {
        if (messagesCurrentPage < totalMessagesPages) {
            messagesCurrentPage++;
            renderMessages();
            const targetElement = document.querySelector("#messages");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });

    // 照片上传相关
    document.getElementById('photo-upload').addEventListener('change', handlePhotoSelection);
    document.getElementById('cancel-upload').addEventListener('click', cancelPhotoUpload);
    document.getElementById('confirm-upload').addEventListener('click', uploadPhotos);
    
    // 相册分页相关
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPhotos();
            const targetElement = document.querySelector("#photos");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < getTotalPages()) {
            currentPage++;
            renderPhotos();
            const targetElement = document.querySelector("#photos");
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
    
    // 悄悄话相关
    document.getElementById('add-message-btn').addEventListener('click', () => {
        document.getElementById('message-form-container').classList.remove('hidden');
    });
    
    document.getElementById('cancel-message').addEventListener('click', () => {
        document.getElementById('message-form-container').classList.add('hidden');
        document.getElementById('message-form').reset();
    });
    
    document.getElementById('message-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addNewMessage();
    });
    
    // 图片查看器相关
    document.getElementById('photo-viewer-backdrop').addEventListener('click', closePhotoViewer);
    document.getElementById('close-viewer').addEventListener('click', closePhotoViewer);
    document.getElementById('prev-photo').addEventListener('click', showPrevPhoto);
    document.getElementById('next-photo').addEventListener('click', showNextPhoto);
    document.getElementById('add-comment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addPhotoComment();
    });
    
    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        });
    });
}

// 加载所有数据
function loadAllData() {
    loadMemories();
    loadPhotos();
    loadMessages();
}

// 加载回忆
function loadMemories() {
    fetch(`${API_BASE_URL}/api/memories`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) throw new Error('加载回忆失败');
            return response.json();
        })
        .then(result => {
            const data = result.data || result;
            memories = (Array.isArray(data) ? data : []).filter(memory => memory.visible !== false);
            memories.forEach(memory => {
                if (memory.comments) {
                    memory.comments.sort((a, b) => new Date(a.date) - new Date(b.date));
                } else {
                    memory.comments = [];
                }
            });
            memoriesCurrentPage = 1;
            renderMemories();
        })
        .catch(error => {
            console.error('加载回忆失败:', error);
            document.getElementById('memories-list').innerHTML = `
                <div class="bg-white rounded-xl shadow-md p-6 text-center text-red-500">
                    加载回忆失败: ${escapeHtml(error.message)}
                </div>
            `;
        });
}

// 加载照片
function loadPhotos() {
    loadPhotosFromServer();
}
// 加载消息
function loadMessages() {
    fetch(`${API_BASE_URL}/api/messages`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) throw new Error('加载消息失败');
            return response.json();
        })
        .then(result => {
            const data = result.data || result;
            messages = (Array.isArray(data) ? data : []).filter(message => message.visible !== false);
            messagesCurrentPage = 1;
            renderMessages();
        })
        .catch(error => {
            console.error('加载消息失败:', error);
            document.getElementById('messages-list').innerHTML = `
                <div class="bg-white rounded-xl shadow-md p-6 text-center text-red-500">
                    加载消息失败: ${escapeHtml(error.message)}
                </div>
            `;
        });
}

// 渲染回忆列表（带分页）
function renderMemories() {
    const memoriesList = document.getElementById('memories-list');
    memoriesList.innerHTML = '';
    
    if (memories.length === 0) {
        memoriesList.innerHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                暂无回忆，点击"添加回忆"开始记录你们的故事吧
            </div>
        `;
        document.getElementById('memories-pagination').classList.add('hidden');
        return;
    }
    
    // 按日期倒序排列
    const sortedMemories = [...memories].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 计算总页数
    totalMemoriesPages = Math.ceil(sortedMemories.length / memoriesPageSize);
    
    // 计算当前页数据的起始和结束索引
    const startIndex = (memoriesCurrentPage - 1) * memoriesPageSize;
    const endIndex = startIndex + memoriesPageSize;
    const currentPageMemories = sortedMemories.slice(startIndex, endIndex);
    const currentPageMemoriesRe = currentPageMemories.reverse();
    // 渲染当前页的回忆
    currentPageMemoriesRe.forEach(memory => {
        addMemoryToDOM(memory);
    });
    
    // 更新分页控件
    updatePaginationControls(
        'memories', 
        memoriesCurrentPage, 
        totalMemoriesPages, 
        sortedMemories.length
    );
}

// 添加回忆到DOM
function addMemoryToDOM(memory) {
    const memoriesList = document.getElementById('memories-list');
    
    // 创建评论HTML
    let commentsHtml = '';
    let commentsContainerClass = 'memory-comments mt-4 space-y-3';
    
    // 确定是否需要折叠评论
    const hasMoreComments = memory.comments && memory.comments.length > maxVisibleComments;
    const visibleComments = hasMoreComments 
        ? memory.comments.slice(0, maxVisibleComments) // 只显示最后3条
        : memory.comments;
    
    if (visibleComments && visibleComments.length > 0) {
        visibleComments.forEach(comment => {
            const date = new Date(comment.date);
            const formattedDate = date.toLocaleString('zh-CN');
            
            commentsHtml += `
                <div class="flex gap-2 p-3 bg-gray-50 rounded-lg">
                    <div class="w-8 h-8 rounded-full ${comment.author === 'his' ? 'bg-his-primary' : 'bg-her-primary'} flex items-center justify-center text-white text-xs flex-shrink-0">
                        ${comment.author === 'his' ? '他' : '她'}
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-xs font-medium ${comment.author === 'his' ? 'text-his-dark' : 'text-her-dark'}">${comment.author === 'his' ? '他' : '她'}</span>
                            <span class="text-xs text-gray-400">${formattedDate}</span>
                        </div>
                        <p class="text-sm text-gray-700">${escapeHtml(comment.content)}</p>
                    </div>
                </div>
            `;
        });

        // 添加折叠/展开按钮
        if (hasMoreComments) {
            const hiddenCount = memory.comments.length - maxVisibleComments;
            commentsHtml += `
                <div class="more-comments-btn space-y-3">
                    <button class="toggle-comments w-full text-center text-sm text-primary hover:text-primary/80 transition">
                        显示全部 ${memory.comments.length} 条评论
                    </button>
                </div>
                <div class="hidden more-comments space-y-3">
                    ${memory.comments.slice(maxVisibleComments, memory.comments.length).map(comment => {
                        const date = new Date(comment.date);
                        const formattedDate = date.toLocaleString('zh-CN');
                        return `
                            <div class="flex gap-2 p-3 bg-gray-50 rounded-lg">
                                <div class="w-8 h-8 rounded-full ${comment.author === 'his' ? 'bg-his-primary' : 'bg-her-primary'} flex items-center justify-center text-white text-xs flex-shrink-0">
                                    ${comment.author === 'his' ? '他' : '她'}
                                </div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-xs font-medium ${comment.author === 'his' ? 'text-his-dark' : 'text-her-dark'}">${comment.author === 'his' ? '他' : '她'}</span>
                                        <span class="text-xs text-gray-400">${formattedDate}</span>
                                    </div>
                                    <p class="text-sm text-gray-700">${escapeHtml(comment.content)}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <button class="toggle-comments w-full text-center text-sm text-primary hover:text-primary/80 transition">
                        收起评论
                    </button>
                </div>
            `;
        }
    } else {
        commentsHtml = '<p class="text-gray-500 text-sm italic text-center py-2">暂无评论，来发表第一条评论吧~</p>';
    }
    
    // 评论输入框
    const commentInputHtml = `
        <div class="mt-4">
            <form class="add-memory-comment flex gap-2" data-memory-id="${memory.id}">
                <textarea placeholder="添加评论..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition text-sm"
                rows="2"
                style="resize: vertical; overflow-y: auto;"></textarea>
                <button type="submit" class="bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 transition text-sm">发送</button>
            </form>
        </div>
    `;
    
    // 创建回忆元素
    const memoryElement = document.createElement('div');
    memoryElement.className = 'bg-white rounded-xl shadow-md p-6 transform hover:shadow-lg transition opacity-0 translate-y-4';
    memoryElement.setAttribute('data-memory-id', memory.id);
    memoryElement.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <h3 class="text-xl font-semibold text-gray-800">${escapeHtml(memory.title)}</h3>
            <span class="text-sm px-2 py-1 rounded-full ${memory.author === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">${memory.author === 'his' ? '他的回忆' : '她的回忆'}</span>
        </div>
        <p class="text-gray-600 text-sm mb-3">${formatDate(memory.date)}</p>
        <p class="text-gray-700 mb-4">${escapeHtml(memory.content)}</p>
        
        <div class="${commentsContainerClass}">
            ${commentsHtml}
        </div>
        
        ${commentInputHtml}
    `;
    
    memoriesList.prepend(memoryElement);
    
    // 添加动画效果
    setTimeout(() => {
        memoryElement.classList.remove('opacity-0', 'translate-y-4');
        memoryElement.classList.add('transition-all', 'duration-500');
    }, 10);
    
    // 添加评论提交事件
    memoryElement.querySelector('.add-memory-comment').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = this.querySelector('textarea');
        const content = input.value.trim();
        
        if (content) {
            addMemoryComment(memory.id, content);
            input.value = '';
        }
    });
    
    // 添加评论折叠/展开事件
    memoryElement.querySelectorAll('.toggle-comments').forEach(button => {
        button.addEventListener('click', function() {
            const moreComments = this.parentElement.parentElement.querySelector('.more-comments') || this.nextElementSibling;
            moreComments.classList.toggle('hidden');
            const moreCommentsBtn = this.parentElement.parentElement.querySelector('.more-comments-btn') || this.nextElementSibling;
            moreCommentsBtn.classList.toggle('hidden');
        });
    });
}

// 添加回忆评论
function addMemoryComment(memoryId, content) {
    // 找到对应的回忆
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return;
    
    // 创建评论对象
    const comment = {
        id: Date.now(),
        content: content,
        author: currentUser,
        date: new Date().toISOString()
    };
    
    // 添加到回忆评论
    if (!memory.comments) {
        memory.comments = [];
    }
    memory.comments.push(comment);
    
    // 更新服务器
    fetch(`${API_BASE_URL}/api/memories/${memoryId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(comment)
    }).catch(error => {
        console.error('添加评论失败:', error);
        showNotification('添加评论失败:', true);
    });
    
    // 重新渲染该回忆
    const memoryElement = document.querySelector(`[data-memory-id="${memoryId}"]`);
    if (memoryElement) {
        memoryElement.remove();
    }
    addMemoryToDOM(memory);
    showNotification("评论成功！");
}

// 添加新回忆
function addNewMemory() {
    const titleInput = document.getElementById('memory-title');
    const dateInput = document.getElementById('memory-date');
    const contentInput = document.getElementById('memory-content');
    
    const title = titleInput.value.trim();
    const date = dateInput.value;
    const content = contentInput.value.trim();
    
    if (!title || !date || !content) {
        alert('请填写完整的回忆信息');
        return;
    }
    
    // 创建回忆对象
    const memory = {
        id: Date.now(),
        title: title,
        date: date,
        content: content,
        author: currentUser,
        createdAt: new Date().toISOString(),
        comments: [],
        visible: true
    };
    
    // 保存到服务器
    fetch(`${API_BASE_URL}/api/memories`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(memory)
    })
    .then(response => {
        if (!response.ok) {
            showNotification("保存回忆失败", true);
            throw new Error('保存回忆失败');
        }
        return response.json();
    })
    .then(result => {
        const savedMemory = result.data || result;
        memories.unshift(savedMemory);
        renderMemories();

        document.getElementById('memory-form').reset();
        document.getElementById('memory-form-container').classList.add('hidden');
        showNotification("保存回忆成功！");
    })
    .catch(error => {
        console.error('添加回忆失败:', error);
        showNotification('添加回忆失败: ' + error.message, true);
    });
}

// 更新选中照片数量
function updateSelectedPhotoCount() {
    const previews = document.getElementById('photo-previews').children.length;
    document.getElementById('selected-photos-count').textContent = previews;
}
// 照片选择处理
function handlePhotoSelection(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    const photoPreviews = document.getElementById('photo-previews');
    const selectedCount = document.getElementById('selected-photos-count');
    
    // 清空现有预览
    photoPreviews.innerHTML = '';
    
    // 显示预览
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'relative w-20 h-20 rounded-md overflow-hidden bg-gray-100';
            
            previewContainer.innerHTML = `
                <img src="${e.target.result}" alt="预览图" class="w-full h-full object-cover">
                <button type="button" class="absolute top-1 right-1 w-5 h-5 bg-white/80 rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 transition" 
                        onclick="this.closest('.relative').remove(); updateSelectedPhotoCount()">
                    <i class="fa fa-times text-xs"></i>
                </button>
            `;
            
            photoPreviews.appendChild(previewContainer);
        };
        
        reader.readAsDataURL(file);
    });
    
    // 更新计数
    selectedCount.textContent = files.length;
    
    // 显示上传配置面板
    document.getElementById('photo-upload-config').classList.remove('hidden');
}

// 取消照片上传
function cancelPhotoUpload() {
    document.getElementById('photo-upload').value = '';
    document.getElementById('photo-previews').innerHTML = '';
    document.getElementById('selected-photos-count').textContent = '0';
    document.getElementById('photo-description').value = ''; // 清空描述
    document.getElementById('photo-upload-config').classList.add('hidden');
}

// 上传照片
async function uploadPhotos() {
    const fileInput = document.getElementById('photo-upload');
    const files = fileInput.files;
    const uploadOriginal = document.getElementById('upload-original').checked;
    const description = document.getElementById('photo-description').value.trim();
    
    if (!files.length) return;
    
    // 显示上传状态
    const confirmBtn = document.getElementById('confirm-upload');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>上传中...';
    confirmBtn.disabled = true;
    
    // 创建FormData对象
    const formData = new FormData();
    
    // 添加文件
    Array.from(files).forEach((file, index) => {
        formData.append(`photos`, file);
    });
    
    // 添加其他表单数据
    formData.append('uploadOriginal', uploadOriginal);
    formData.append('author', currentUser);
    formData.append('description', description);
    formData.append('timestamp', new Date().getTime());
    
    // 发送到服务器
    fetch(`${API_BASE_URL}/api/photos/batch`, {
        method: 'POST',
        headers: {
            // 不要设置Content-Type，浏览器会自动处理multipart/form-data
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: formData,
        timeout: 60000 // 60秒超时
    })
    .then(response => {
        // 处理HTTP错误状态
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // 处理服务器返回的JSON数据
        if (!data.success) {
            throw new Error(data.message || '上传失败，服务器返回错误');
        }
        
        // 检查是否有返回的照片数据
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('服务器返回格式不正确');
        }

        // 处理返回的照片URL，确保完整
        const newPhotos = data.data.map(photo => ({
            ...photo,
            url: photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`,
            thumbnailUrl: photo.thumbnailUrl 
                ? (photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : `${API_BASE_URL}${photo.thumbnailUrl}`)
                : (photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`)
        }));
        
        // 添加到相册并重新渲染
        photos = [...newPhotos, ...photos];
        renderPhotos();
        
        // 重置上传组件
        cancelPhotoUpload();
        
        // 显示成功提示
        showNotification(`成功上传 ${newPhotos.length} 张照片`);
    })
    .catch(error => {
        console.error('照片上传失败:', error);
        showNotification(`上传失败: ${error.message}`, true);
    })
    .finally(() => {
        // 恢复按钮状态
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    });
}


// 加载服务器上的所有照片
function loadPhotosFromServer() {
    // 显示加载状态
    const photosGrid = document.getElementById('photos-grid');
    photosGrid.innerHTML = `
        <div class="col-span-full text-center text-gray-500 py-16">
            <i class="fa fa-spinner fa-spin text-2xl mb-3"></i>
            <p>加载相册中...</p>
        </div>
    `;
    
    fetch(`${API_BASE_URL}/api/photos`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        timeout: 10000
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`加载失败: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success || !Array.isArray(data.data)) {
            throw new Error('服务器返回数据格式不正确');
        }

        // 处理照片URL
        photos = data.data.map(photo => ({
            ...photo,
            url: photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`,
            thumbnailUrl: photo.thumbnailUrl 
                ? (photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : `${API_BASE_URL}${photo.thumbnailUrl}`)
                : (photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`)
        }))
        .sort((a, b) => {
            // 按timestamp降序排序，确保新照片在前面
            return b.timestamp - a.timestamp;
        });
        
        // 渲染相册
        renderPhotos();
    })
    .catch(error => {
        console.error('加载照片失败:', error);
        photosGrid.innerHTML = `
            <div class="col-span-full text-center text-red-500 py-16">
                <i class="fa fa-exclamation-circle text-2xl mb-3"></i>
                <p>加载相册失败: ${escapeHtml(error.message)}</p>
                <button onclick="loadPhotosFromServer()" class="mt-3 text-primary hover:underline">重试</button>
            </div>
        `;
    });
}

// 获取总页数
function getTotalPages() {
    return Math.ceil(photos.length / photosPerPage);
}

// 渲染当前页照片
function renderPhotos() {
    const photosGrid = document.getElementById('photos-grid');
    photosGrid.innerHTML = '';
    
    if (photos.length === 0) {
        photosGrid.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-16">
                暂无照片，点击"上传照片"添加你们的美好瞬间吧
            </div>
        `;
        document.getElementById('photo-pagination').classList.add('hidden');
        return;
    }
    
    // 计算当前页显示的照片
    const startIndex = (currentPage - 1) * photosPerPage;
    const endIndex = startIndex + photosPerPage;
    const currentPhotos = photos.slice(startIndex, endIndex);
    
    currentPhotos.forEach((photo, index) => {
        const photoElement = document.createElement('div');
        photoElement.className = 'group relative rounded-xl overflow-hidden shadow-md cursor-pointer aspect-square bg-gray-100';

        const imageUrl = photo.thumbnailUrl
            ? (photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : `${API_BASE_URL}${photo.thumbnailUrl}`)
            : (photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`);

        photoElement.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(photo.description || '照片')}" loading="lazy" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <i class="fa fa-search-plus text-white text-xl"></i>
            </div>
            <span class="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded ${photo.author === 'his' ? 'bg-his-primary/80' : 'bg-her-primary/80'} text-white">${photo.author === 'his' ? '他' : '她'}</span>
            ${photo.description ? `
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    ${escapeHtml(photo.description.substring(0, 30))}${photo.description.length > 30 ? '...' : ''}
                </div>
            ` : ''}
        `;

        photoElement.addEventListener('click', () => {
            openPhotoViewer(startIndex + index);
        });

        photosGrid.appendChild(photoElement);
    });
    
    // 更新分页
    updatePagination();
}
function updatePagination() {
    const totalPages = getTotalPages();
    const pageIndicators = document.getElementById('page-indicators');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    // 清空现有指示器
    pageIndicators.innerHTML = '';
    
    // 添加页码指示器
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `w-8 h-8 rounded-full flex items-center justify-center transition ${i === currentPage ? 'bg-primary text-white' : 'border border-gray-300 hover:bg-gray-100'}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderPhotos();
        });
        pageIndicators.appendChild(pageBtn);
    }
    
    // 更新按钮状态
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // 显示分页控件
    document.getElementById('photo-pagination').classList.remove('hidden');
}
// 更新分页控件状态
function updatePaginationControls(type, currentPage, totalPages, totalItems) {
    const paginationContainer = document.getElementById(`${type}-pagination`);
    const prevBtn = document.getElementById(`${type}-prev-page`);
    const nextBtn = document.getElementById(`${type}-next-page`);
    const pageIndicators = document.getElementById(`${type}-page-indicators`);
    
    // 只有当数据超过一页时才显示分页控件
    if (totalItems <= (type === 'memories' ? memoriesPageSize : messagesPageSize)) {
        paginationContainer.classList.add('hidden');
        return;
    }
    
    paginationContainer.classList.remove('hidden');
    
    // 更新上一页/下一页按钮状态
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // 生成页码指示器
    pageIndicators.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `w-10 h-10 rounded-full flex items-center justify-center transition ${
            i === currentPage ? 'bg-primary text-white' : 'border border-gray-300 hover:bg-gray-100'
        }`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            if (type === 'memories') {
                memoriesCurrentPage = i;
                renderMemories();
                const targetElement = document.querySelector("#memories");
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            } else {
                messagesCurrentPage = i;
                renderMessages();
                const targetElement = document.querySelector("#messages");
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
        pageIndicators.appendChild(pageBtn);
    }
}
// 打开图片查看器
function openPhotoViewer(index) {
    if (!photos[index]) return;

    currentPhotoIndex = index;
    const photo = photos[index];
    const viewer = document.getElementById('photo-viewer');
    const viewerImage = document.getElementById('viewer-image');
    
    // 确保原图URL正确
    const originalUrl = photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`;
    viewerImage.src = originalUrl;
    viewerImage.alt = photo.description || '照片大图';
    
    document.getElementById('photo-caption').textContent = photo.description || '无描述';
    document.getElementById('photo-desc-text').textContent = photo.description || '暂无描述';
    document.getElementById('photo-author-date').textContent = 
        `${photo.author === 'his' ? '他' : '她'} · ${formatDate(photo.date)}`;
    
    // 加载评论
    loadPhotoComments(photo.id);
    
    // 显示查看器
    viewer.classList.remove('hidden');
    viewer.classList.add('fade-in');
    document.body.style.overflow = 'hidden';
}

// 关闭图片查看器
function closePhotoViewer() {
    document.getElementById('photo-viewer').classList.add('hidden');
    document.getElementById('photo-viewer').classList.remove('fade-in');
    document.body.style.overflow = '';
}

// 显示上一张图片
function showPrevPhoto() {
    if (currentPhotoIndex > 0) {
        openPhotoViewer(currentPhotoIndex - 1);
    }
}

// 显示下一张图片
function showNextPhoto() {
    if (currentPhotoIndex < photos.length - 1) {
        openPhotoViewer(currentPhotoIndex + 1);
    }
}

// 加载照片评论
function loadPhotoComments(photoId) {
    const commentsContainer = document.getElementById('photo-comments');
    const photo = photos.find(p => p.id === photoId);
    
    if (!photo || !photo.comments) {
        commentsContainer.innerHTML = '<p class="text-sm text-gray-500">暂无评论</p>';
        return;
    }
    
    commentsContainer.innerHTML = '';
    
    photo.comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.className = 'flex gap-2';
        commentElement.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <i class="fa fa-user"></i>
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-medium">${comment.author === 'his' ? '他' : '她'}</span>
                    <span class="text-xs text-gray-500">${formatRelativeTime(comment.date)}</span>
                </div>
                <p class="text-sm">${escapeHtml(comment.content)}</p>
            </div>
        `;
        commentsContainer.appendChild(commentElement);
    });
}

// 添加照片评论
function addPhotoComment() {
    const commentInput = document.getElementById('comment-content');
    const content = commentInput.value.trim();
    
    if (!content || currentPhotoIndex < 0 || !photos[currentPhotoIndex]) return;
    
    const currentPhoto = photos[currentPhotoIndex];
    const commentBtn = document.querySelector('#add-comment-form button[type="submit"]');
    const originalBtnText = commentBtn.innerHTML;
    
    // 禁用按钮并显示加载状态
    commentBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
    commentBtn.disabled = true;
    
    // 准备评论数据
    const commentData = {
        photoId: currentPhoto.id,
        content: content,
        author: currentUser,
        timestamp: new Date().getTime()
    };
    
    // 发送到服务器
    fetch(`${API_BASE_URL}/api/photos/${currentPhoto.id}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify(commentData),
        timeout: 10000
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`评论失败: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success || !data.comment) {
            throw new Error('服务器未能保存评论');
        }
        
        // 添加到本地数据并刷新
        if (!currentPhoto.comments) {
            currentPhoto.comments = [];
        }
        currentPhoto.comments.push(data.comment);
        
        loadPhotoComments(currentPhoto.id);
        
        // 清空输入
        commentInput.value = '';
        showNotification("评论成功！");
    })
    .catch(error => {
        console.error('添加评论失败:', error);
        showNotification(`评论失败: ${error.message}`, true);
    })
    .finally(() => {
        // 恢复按钮状态
        commentBtn.innerHTML = originalBtnText;
        commentBtn.disabled = false;
    });
}

// 渲染消息列表
function renderMessages() {
   const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '';
    
    if (messages.length === 0) {
        messagesList.innerHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                暂无悄悄话，点击"写悄悄话"开始给TA留言吧
            </div>
        `;
        document.getElementById('messages-pagination').classList.add('hidden');
        return;
    }
    
    // 按日期倒序排列
    const sortedMessages = [...messages].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 计算总页数
    totalMessagesPages = Math.ceil(sortedMessages.length / messagesPageSize);
    
    // 计算当前页数据的起始和结束索引
    const startIndex = (messagesCurrentPage - 1) * messagesPageSize;
    const endIndex = startIndex + messagesPageSize;
    const currentPageMessages = sortedMessages.slice(startIndex, endIndex);
    const currentPageMessagesRe = currentPageMessages.reverse();
    // 渲染当前页的悄悄话（这里假设你有类似addMessageToDOM的函数）
    currentPageMessagesRe.forEach(message => {
        addMessageToDOM(message);
    });
    
    // 更新分页控件
    updatePaginationControls(
        'messages', 
        messagesCurrentPage, 
        totalMessagesPages, 
        sortedMessages.length
    );
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    // 定义时间单位和对应的秒数
    const timeUnits = [
        { unit: '年', seconds: 31536000 },
        { unit: '月', seconds: 2592000 },
        { unit: '天', seconds: 86400 },
        { unit: '小时', seconds: 3600 },
        { unit: '分钟', seconds: 60 },
        { unit: '秒', seconds: 1 }
    ];
    
    // 计算最合适的时间单位
    for (const { unit, seconds } of timeUnits) {
        const value = Math.floor(diffInSeconds / seconds);
        if (value >= 1) {
            return `${value}${unit}前`;
        }
    }
    
    return '刚刚';
}
// 添加新消息
function addNewMessage() {
    const contentInput = document.getElementById('message-content');
    const blurCheckbox = document.getElementById('blur-message');
    
    const content = contentInput.value.trim();
    const shouldBlur = blurCheckbox.checked;
    
    if (!content) {
        alert('请输入消息内容');
        return;
    }
    
    // 创建消息对象
    const message = {
        id: Date.now(),
        content: content,
        author: currentUser,
        shouldBlur: shouldBlur,
        date: new Date().toISOString(),
        visible: true
    };
    
    // 保存到服务器
    fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(message)
    })
    .then(response => {
        if (!response.ok) {
            showNotification("发送消息失败", true);
            throw new Error('发送消息失败');
        }
        return response.json();
    })
    .then(result => {
        const savedMessage = result.data || result;
        messages.unshift(savedMessage);
        renderMessages();

        document.getElementById('message-form').reset();
        document.getElementById('message-form-container').classList.add('hidden');
        showNotification("发送成功！");
    })
    .catch(error => {
        console.error('添加消息失败:', error);
        showNotification('添加消息失败: ' + error.message, true);
    });
}

// 添加消息到DOM
function addMessageToDOM(message) {
    const messagesList = document.getElementById('messages-list');
    
    const messageElement = document.createElement('div');
    messageElement.className = 'bg-white rounded-xl shadow-md p-6 transform hover:shadow-lg transition opacity-0 translate-y-4';
    messageElement.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <span class="text-sm px-2 py-1 rounded-full ${message.author === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">${message.author === 'his' ? '他的消息' : '她的消息'}</span>
            <span class="text-xs text-gray-500">${formatDate(message.date)}</span>
        </div>
        <div class="message-content ${message.shouldBlur ? 'blur-text cursor-pointer' : ''} transition-all duration-300">
            ${escapeHtml(message.content)}
        </div>
    `;
    
    messagesList.prepend(messageElement);
    
    // 添加点击显示效果
    if (message.shouldBlur) {
        messageElement.querySelector('.message-content').addEventListener('click', function() {
            this.classList.toggle('blur-text-reveal');
        });
    }
    
    // 添加动画效果
    setTimeout(() => {
        messageElement.classList.remove('opacity-0', 'translate-y-4');
        messageElement.classList.add('transition-all', 'duration-500');
    }, 10);
}
function setNowTime(){
    const dateInput = document.getElementById('memory-date');
    
    if (dateInput) {
        // 获取当前时间
        const now = new Date();
        
        // 格式化时间为datetime-local所需的格式 (YYYY-MM-DDThh:mm)
        // 月份和日期需要补零
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        // 拼接成格式字符串
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // 设置输入框的值
        dateInput.value = formattedDateTime;
    }
}
// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        // second: '2-digit'
    });
}
// 显示通知提示
function showNotification(message, isError = false) {
    // 获取通知元素，若不存在则创建
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform translate-y-20 opacity-0 transition-all duration-300 flex items-center max-w-sm z-50';
        document.body.appendChild(notification);
    }

    // 设置通知内容和样式
    notification.innerHTML = `
        <i class="fa ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'} mr-2"></i>
        <span>${message}</span>
    `;
    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 flex items-center max-w-sm z-50 ${
        isError ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
    }`;

    // 显示通知
    setTimeout(() => {
        notification.classList.remove('translate-y-20', 'opacity-0');
        notification.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    // 3秒后自动隐藏
    setTimeout(() => {
        notification.classList.remove('translate-y-0', 'opacity-100');
        notification.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// ============================================================
// 新功能模块：纪念日、愿望清单、情侣任务、每日问答
// ============================================================

function loadNewFeatures() {
    loadAnniversaries();
    loadWishes();
    loadTasks();
    loadDailyQuestion();
}

function initNewFeatureListeners() {
    // 纪念日管理
    document.getElementById('manage-anniversary-btn')?.addEventListener('click', showAnniversaryManager);

    // 愿望清单
    document.getElementById('add-wish-btn')?.addEventListener('click', () => {
        document.getElementById('wish-form-container').classList.toggle('hidden');
    });
    document.getElementById('cancel-wish')?.addEventListener('click', () => {
        document.getElementById('wish-form-container').classList.add('hidden');
        document.getElementById('wish-form').reset();
    });
    document.getElementById('wish-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        addWish();
    });

    // 情侣任务
    document.getElementById('add-task-btn')?.addEventListener('click', () => {
        document.getElementById('task-form-container').classList.toggle('hidden');
    });
    document.getElementById('cancel-task')?.addEventListener('click', () => {
        document.getElementById('task-form-container').classList.add('hidden');
        document.getElementById('task-form').reset();
    });
    document.getElementById('task-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });
}

// ---- 纪念日 ----
async function loadAnniversaries() {
    try {
        // 加载统计数据获取恋爱天数
        const statsRes = await fetch('/api/timeline/stats', { credentials: 'include' });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            if (stats.success && stats.data.daysTogether > 0) {
                document.getElementById('days-count').textContent = stats.data.daysTogether;
            }
        }

        // 加载即将到来的纪念日
        const res = await fetch('/api/anniversaries/upcoming', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('upcoming-anniversaries');
        if (!data.success || !data.data || data.data.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-400 text-sm py-2">还没有纪念日，点击下方管理添加</p>';
            return;
        }

        container.innerHTML = data.data.slice(0, 6).map(a => `
            <div class="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
                <div class="text-2xl mb-1">${a.icon || (a.type === 'birthday' ? '🎂' : '💕')}</div>
                <p class="text-sm font-medium text-gray-700 truncate">${escapeHtml(a.title)}</p>
                <p class="text-xs text-gray-400 mt-1">${a.nextDate}</p>
                <p class="text-lg font-bold ${a.daysUntil === 0 ? 'text-red-500' : 'text-primary'} mt-1">
                    ${a.daysUntil === 0 ? '就是今天!' : a.daysUntil + '天后'}
                </p>
            </div>
        `).join('');
    } catch (e) {
        console.error('加载纪念日失败:', e);
    }
}

function showAnniversaryManager() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 modal-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-medium">管理纪念日</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600"><i class="fa fa-times"></i></button>
            </div>
            <form id="anniversary-form" class="space-y-3 mb-6">
                <input type="text" id="anniv-title" placeholder="纪念日名称" required class="w-full px-3 py-2 border rounded-lg text-sm">
                <input type="date" id="anniv-date" required class="w-full px-3 py-2 border rounded-lg text-sm">
                <div class="flex gap-2">
                    <select id="anniv-type" class="flex-1 px-3 py-2 border rounded-lg text-sm">
                        <option value="anniversary">纪念日</option>
                        <option value="birthday">生日</option>
                        <option value="countdown">倒计时</option>
                    </select>
                    <select id="anniv-repeat" class="flex-1 px-3 py-2 border rounded-lg text-sm">
                        <option value="yearly">每年</option>
                        <option value="monthly">每月</option>
                        <option value="none">不重复</option>
                    </select>
                </div>
                <button type="submit" class="w-full py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition">添加纪念日</button>
            </form>
            <div id="anniv-list" class="space-y-2">加载中...</div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('anniversary-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch('/api/anniversaries', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: document.getElementById('anniv-title').value,
                date: document.getElementById('anniv-date').value,
                type: document.getElementById('anniv-type').value,
                repeat: document.getElementById('anniv-repeat').value
            })
        });
        document.getElementById('anniversary-form').reset();
        loadAnniversaryList();
        loadAnniversaries();
    });

    loadAnniversaryList();
}

async function loadAnniversaryList() {
    const res = await fetch('/api/anniversaries', { credentials: 'include' });
    const data = await res.json();
    const container = document.getElementById('anniv-list');
    if (!data.success || !data.data || data.data.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm">暂无纪念日</p>';
        return;
    }
    const typeLabels = { anniversary: '纪念日', birthday: '生日', countdown: '倒计时' };
    container.innerHTML = data.data.map(a => `
        <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div>
                <p class="text-sm font-medium">${escapeHtml(a.title)}</p>
                <p class="text-xs text-gray-400">${a.date} · ${typeLabels[a.type] || a.type}</p>
            </div>
            <button onclick="deleteAnniversary(${a.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fa fa-trash"></i></button>
        </div>
    `).join('');
}

async function deleteAnniversary(id) {
    await fetch('/api/anniversaries/' + id, { method: 'DELETE', credentials: 'include' });
    loadAnniversaryList();
    loadAnniversaries();
}

// ---- 愿望清单 ----
async function loadWishes() {
    try {
        const res = await fetch('/api/wishes', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('wishes-list');
        if (!data.success || !data.data || data.data.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8">还没有愿望，许一个吧</div>';
            return;
        }
        container.innerHTML = data.data.map(w => `
            <div class="flex items-center gap-3 bg-white rounded-xl shadow-sm p-4 transition hover:shadow-md ${w.completed ? 'opacity-60' : ''}">
                <button onclick="toggleWish(${w.id}, ${w.completed})" class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
                    ${w.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-primary'}">
                    ${w.completed ? '<i class="fa fa-check text-xs"></i>' : ''}
                </button>
                <div class="flex-1 min-w-0">
                    <p class="text-sm ${w.completed ? 'line-through text-gray-400' : 'text-gray-800'}">${escapeHtml(w.title)}</p>
                    ${w.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(w.description)}</p>` : ''}
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${w.author === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">
                    ${w.author === 'his' ? '他' : '她'}
                </span>
                <button onclick="deleteWish(${w.id})" class="text-gray-300 hover:text-red-400 flex-shrink-0"><i class="fa fa-times"></i></button>
            </div>
        `).join('');
    } catch (e) {
        console.error('加载愿望失败:', e);
    }
}

async function addWish() {
    const title = document.getElementById('wish-title').value.trim();
    if (!title) return;
    await fetch('/api/wishes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: document.getElementById('wish-desc').value.trim() })
    });
    document.getElementById('wish-form').reset();
    document.getElementById('wish-form-container').classList.add('hidden');
    loadWishes();
}

async function toggleWish(id, currentState) {
    await fetch('/api/wishes/' + id + '/complete', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentState })
    });
    loadWishes();
}

async function deleteWish(id) {
    await fetch('/api/wishes/' + id, { method: 'DELETE', credentials: 'include' });
    loadWishes();
}

// ---- 情侣任务 ----
async function loadTasks() {
    try {
        const res = await fetch('/api/couple-tasks', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('tasks-list');
        const preview = document.getElementById('tasks-preview');

        if (!data.success || !data.data || data.data.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8">还没有任务，创建一个吧</div>';
            preview.innerHTML = '<p class="text-gray-400 text-sm">暂无任务</p>';
            return;
        }

        const statusLabels = { pending: '待完成', in_progress: '进行中', done: '已完成' };
        const statusColors = { pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' };
        const assignLabels = { his: '他', her: '她', both: '一起' };

        // 任务预览（首页卡片中显示前3个未完成）
        const pending = data.data.filter(t => t.status !== 'done').slice(0, 3);
        preview.innerHTML = pending.length > 0
            ? pending.map(t => `<p class="text-sm text-gray-600 truncate">· ${escapeHtml(t.title)}</p>`).join('')
            : '<p class="text-green-500 text-sm">全部完成!</p>';

        // 完整任务列表
        container.innerHTML = data.data.map(t => `
            <div class="flex items-center gap-3 bg-white rounded-xl shadow-sm p-4 transition hover:shadow-md">
                <button onclick="cycleTaskStatus(${t.id}, '${t.status}')" class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
                    ${t.status === 'done' ? 'bg-green-500 border-green-500 text-white' : t.status === 'in_progress' ? 'bg-blue-400 border-blue-400 text-white' : 'border-gray-300 hover:border-primary'}">
                    ${t.status === 'done' ? '<i class="fa fa-check text-xs"></i>' : t.status === 'in_progress' ? '<i class="fa fa-ellipsis-h text-xs"></i>' : ''}
                </button>
                <div class="flex-1 min-w-0">
                    <p class="text-sm ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}">${escapeHtml(t.title)}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-xs px-1.5 py-0.5 rounded ${statusColors[t.status]}">${statusLabels[t.status]}</span>
                        <span class="text-xs text-gray-400">${assignLabels[t.assigned_to]}来做</span>
                        ${t.due_date ? `<span class="text-xs text-gray-400">${t.due_date}</span>` : ''}
                    </div>
                </div>
                <button onclick="deleteTask(${t.id})" class="text-gray-300 hover:text-red-400 flex-shrink-0"><i class="fa fa-times"></i></button>
            </div>
        `).join('');
    } catch (e) {
        console.error('加载任务失败:', e);
    }
}

async function addTask() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    await fetch('/api/couple-tasks', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title,
            description: document.getElementById('task-desc').value.trim(),
            assigned_to: document.getElementById('task-assigned').value,
            due_date: document.getElementById('task-due').value || null
        })
    });
    document.getElementById('task-form').reset();
    document.getElementById('task-form-container').classList.add('hidden');
    loadTasks();
}

async function cycleTaskStatus(id, current) {
    const next = current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'done' : 'pending';
    await fetch('/api/couple-tasks/' + id + '/status', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
    });
    loadTasks();
}

async function deleteTask(id) {
    await fetch('/api/couple-tasks/' + id, { method: 'DELETE', credentials: 'include' });
    loadTasks();
}

// ---- 每日问答 ----
async function loadDailyQuestion() {
    try {
        const res = await fetch('/api/daily-questions/today', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('daily-question-content');

        if (!data.success || !data.data) {
            container.innerHTML = `
                <p class="text-gray-400 text-sm mb-3">今天还没有问题</p>
                <div class="flex gap-2">
                    <input type="text" id="new-question-input" placeholder="写一个问题给TA..." class="flex-1 px-3 py-2 border rounded-lg text-sm">
                    <button onclick="createDailyQuestion()" class="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition">提问</button>
                </div>
            `;
            return;
        }

        const q = data.data;
        const myAnswer = currentUser === 'his' ? q.his_answer : q.her_answer;
        const theirAnswer = currentUser === 'his' ? q.her_answer : q.his_answer;

        container.innerHTML = `
            <p class="text-sm font-medium text-gray-800 mb-3">${escapeHtml(q.question)}</p>
            ${!myAnswer ? `
                <div class="flex gap-2">
                    <input type="text" id="answer-input" placeholder="写下你的回答..." class="flex-1 px-3 py-2 border rounded-lg text-sm">
                    <button onclick="answerQuestion(${q.id})" class="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition">回答</button>
                </div>
            ` : `
                <div class="space-y-2">
                    <div class="flex items-start gap-2">
                        <span class="text-xs px-1.5 py-0.5 rounded-full ${currentUser === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">我</span>
                        <p class="text-sm text-gray-600">${escapeHtml(myAnswer)}</p>
                    </div>
                    ${theirAnswer ? `
                        <div class="flex items-start gap-2">
                            <span class="text-xs px-1.5 py-0.5 rounded-full ${currentUser === 'his' ? 'bg-her-light text-her-dark' : 'bg-his-light text-his-dark'}">TA</span>
                            <p class="text-sm text-gray-600">${escapeHtml(theirAnswer)}</p>
                        </div>
                    ` : `<p class="text-xs text-gray-400">等待TA的回答...</p>`}
                </div>
            `}
        `;
    } catch (e) {
        console.error('加载每日问答失败:', e);
    }
}

async function createDailyQuestion() {
    const input = document.getElementById('new-question-input');
    const question = input?.value.trim();
    if (!question) return;
    await fetch('/api/daily-questions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
    });
    loadDailyQuestion();
}

async function answerQuestion(id) {
    const input = document.getElementById('answer-input');
    const answer = input?.value.trim();
    if (!answer) return;
    await fetch('/api/daily-questions/' + id + '/answer', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
    });
    loadDailyQuestion();
}