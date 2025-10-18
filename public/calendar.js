// 全局变量
let currentUser = null;
let currentDate = new Date();
// const API_BASE_URL = 'http://106.15.93.94:3000'; // 服务器API基础URL
const API_BASE_URL = ''; // 服务器API基础URL
let calendarData = {}; // 存储日历数据 { 'YYYY-MM-DD': { his: {}, her: {} } }
const moods = {
    love: { icon: 'fa-heart', name: '心动', color: 'bg-mood-love' },
    angry: { icon: 'fa-fire', name: '生气', color: 'bg-mood-angry' },
    calm: { icon: 'fa-leaf', name: '平静', color: 'bg-mood-calm' },
    sad: { icon: 'fa-tint', name: '伤心', color: 'bg-mood-sad' },
    happy: { icon: 'fa-smile-o', name: '开心', color: 'bg-mood-happy' },
    upset: { icon: 'fa-meh-o', name: '烦躁', color: 'bg-mood-upset' }
};
let memories = [];
let photos = [];
let messages = [];
// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 解析URL参数确定用户视角
    const params = new URLSearchParams(window.location.search);
    const user = params.get('user');
    
    if (user === 'his' || user === 'her') {
        currentUser = user;
        initUserInterface();
    } else {
        // 默认重定向到his视角
        window.location.search = 'user=his';
    }
    
    // 初始化事件监听
    initEventListeners();
    
    // 加载日历数据
    loadCalendarData();
    
    // 渲染日历
    renderCalendar();

    initCalendarSelection();
});

// 日历格子选择功能
function initCalendarSelection() {
    const calendarCells = document.querySelectorAll('.day-cell');
    // 为每个格子添加点击事件
    calendarCells.forEach(cell => {
        cell.addEventListener('click', function() {
            // 移除其他格子的选中状态
            calendarCells.forEach(c => c.classList.remove('selected'));
            // 添加当前格子的选中状态
            this.classList.add('selected');
            
            // 获取选中的日期（现在可以正确获取 data-date 属性了）
            const selectedDate = this.getAttribute('data-date');
            
            // 显示日期详情模块
            showDateDetails(selectedDate);
            
            // 同时更新隐藏表单中的选中日期
            document.getElementById('selected-date').value = selectedDate;
        });
    });
    
    // 初始化心情提交表单
    initMoodForm();
}

// 初始化心情提交表单
function initMoodForm() {
    const moodForm = document.getElementById('mood-form');
    moodForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const date = document.getElementById('selected-date').value;
        const hisMood = document.getElementById('his-mood').value;
        const herMood = document.getElementById('her-mood').value;
        const hisImageInput = document.getElementById('his-image');
        const herImageInput = document.getElementById('her-image');
        
        // 处理文字心情提交
        saveMoods(date, hisMood, herMood);
        
        // 处理图片上传
        if (hisImageInput.files.length > 0) {
            uploadMoodImage(date, 'his', hisImageInput.files[0]);
        }
        if (herImageInput.files.length > 0) {
            uploadMoodImage(date, 'her', herImageInput.files[0]);
        }
        
        // 重置表单
        moodForm.reset();
    });
}

// 保存心情数据到服务器
function saveMoods(date, hisMood, herMood) {
    const moodData = {
        date: date,
        hisMood: hisMood,
        herMood: herMood,
        updatedAt: new Date().toISOString()
    };
    
    fetch(`${API_BASE_URL}/api/daily-moods`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(moodData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('保存心情失败');
        }
        return response.json();
    })
    .then(data => {
        console.log('心情保存成功', data);
        // 重新加载当前日期数据
        showDateDetails(date);
    })
    .catch(error => {
        console.error('保存心情失败:', error);
        alert('保存心情失败: ' + error.message);
    });
}

// 上传心情图片
function uploadMoodImage(date, user, file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('date', date);
    formData.append('user', user);
    
    fetch(`${API_BASE_URL}/api/daily-moods/image`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('上传图片失败');
        }
        return response.json();
    })
    .then(data => {
        console.log('图片上传成功', data);
        // 重新加载当前日期数据
        showDateDetails(date);
    })
    .catch(error => {
        console.error('上传图片失败:', error);
        alert('上传图片失败: ' + error.message);
    });
}

// 显示日期详情模块
function showDateDetails(date) {
    const detailsContainer = document.getElementById('date-details');
    detailsContainer.classList.remove('hidden');
    
    // 更新标题为选中的日期
    document.getElementById('details-date').textContent = formatDateDay(date);
    
    // 加载该日期的所有数据
    loadDateData(date);
}

// 加载指定日期的所有数据
function loadDateData(date) {
    // 加载心情数据
    fetch(`${API_BASE_URL}/api/daily-moods-query?date=${date}`)
        .then(response => response.json())
        .then(moodData => {
            renderMoods(moodData);
        })
        .catch(error => {
            console.error('加载心情数据失败:', error);
        });
    
    // 加载当天的回忆
    fetch(`${API_BASE_URL}/api/memories-query?date=${date}`)
        .then(response => response.json())
        .then(memories => {
            renderDateMemories(memories);
        })
        .catch(error => {
            console.error('加载回忆数据失败:', error);
        });
    
    // 加载当天的照片
    fetch(`${API_BASE_URL}/api/photos-query?date=${date}`)
        .then(response => response.json())
        .then(photos => {
            renderDatePhotos(photos);
        })
        .catch(error => {
            console.error('加载照片数据失败:', error);
        });
    
    // 加载当天的悄悄话
    fetch(`${API_BASE_URL}/api/messages?date=${date}`)
        .then(response => response.json())
        .then(messages => {
            renderDateMessages(messages);
        })
        .catch(error => {
            console.error('加载悄悄话数据失败:', error);
        });
}


// 初始化用户界面
function initUserInterface() {
    const userText = document.getElementById('user-text');
    const userIndicator = document.getElementById('user-indicator');
    
    // 设置用户显示文本
    userText.textContent = currentUser === 'his' ? '他的视角' : '她的视角';
    
    // 设置主题颜色
    document.documentElement.style.setProperty('--user-color', currentUser === 'his' ? '#4F9EFD' : '#FF75A0');
    
    // 添加CSS类设置颜色
    userIndicator.classList.add(currentUser === 'his' ? 'bg-his-primary' : 'bg-her-primary');
    
    // 更新导航链接颜色
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.add('text-primary');
    });
    
    // 为CSS变量设置颜色
    const root = document.documentElement;
    root.style.setProperty('--primary-color', currentUser === 'his' ? '#4F9EFD' : '#FF75A0');
}

// 初始化事件监听
function initEventListeners() {
    // 月份导航
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById('today-btn').addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });
    
    // 模态框控制
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);
    
    // 心情选择
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2'));
            this.classList.add('ring-2', 'ring-offset-2', 'ring-primary');
        });
    });
    
    // 保存记录
    document.getElementById('save-entry').addEventListener('click', saveDiaryEntry);
    
    // 图片上传预览
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
}
// 按日期渲染照片
function renderDatePhotos(filteredPhotos) {
    const photosGrid = document.getElementById('date-photos-grid');
    photosGrid.innerHTML = '';
    photos = filteredPhotos;
    if (filteredPhotos.length === 0) {
        photosGrid.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-16">
                该日期暂无照片
            </div>
        `;
        // document.getElementById('date-photos-grid').classList.add('hidden');
        return;
    }
    
    // 按日期倒序排列当天照片
    const sortedPhotos = [...filteredPhotos].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedPhotos.forEach(photo => {
        const photoElement = document.createElement('div');
        photoElement.className = 'relative group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition transform hover:-translate-y-1';
        
        const thumbnailSrc = photo.thumbnailUrl || photo.url;
        photoElement.innerHTML = `
            <img src="${thumbnailSrc}" 
                 alt="${photo.description || '照片'}" 
                 class="w-full aspect-square object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p class="text-white text-sm font-medium truncate">${photo.description || '无描述'}</p>
                <p class="text-white/80 text-xs">${new Date(photo.date).toLocaleString('zh-CN')}</p>
            </div>
        `;
        
        // 添加点击查看大图事件
        photoElement.addEventListener('click', () => {
            openPhotoViewer(sortedPhotos.indexOf(photo));
        });
        
        photosGrid.appendChild(photoElement);
    });
    
    // 隐藏分页控件（按日期筛选时不需要分页）
    // document.getElementById('photo-pagination').classList.add('hidden');
}

// 按日期渲染回忆
function renderDateMemories(date) {
    const memoriesList = document.getElementById('memories-list');
    memoriesList.innerHTML = '';
    
    // 筛选指定日期的回忆
    const filteredMemories = memories.filter(memory => {
        const memoryDate = new Date(memory.date);
        return memoryDate.toDateString() === date.toDateString();
    });
    
    if (filteredMemories.length === 0) {
        memoriesList.innerHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                该日期暂无回忆
            </div>
        `;
        return;
    }
    
    // 按日期倒序排列当天回忆
    const sortedMemories = [...filteredMemories].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedMemories.forEach(memory => {
        addMemoryToDOM(memory);
    });
}

// 按日期渲染消息
function renderDateMessages(date) {
    const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '';
    
    // 筛选指定日期的消息
    const filteredMessages = messages.filter(message => {
        const messageDate = new Date(message.date);
        return messageDate.toDateString() === date.toDateString();
    });
    
    if (filteredMessages.length === 0) {
        messagesList.innerHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                该日期暂无悄悄话
            </div>
        `;
        return;
    }
    
    // 按日期倒序排列当天消息
    const sortedMessages = [...filteredMessages].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedMessages.forEach(message => {
        addMessageToDOM(message);
    });
}
// 渲染日历
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 更新月份标题
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    document.getElementById('current-month').textContent = `${year}年 ${monthNames[month]}`;
    
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // 获取当月第一天是星期几 (0-6, 0是星期日)
    const firstDay = new Date(year, month, 1).getDay();
    
    // 获取当月的天数
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 添加上个月的占位符
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'bg-gray-50 rounded-lg border border-gray-100';
        calendarGrid.appendChild(emptyCell);
    }
    
    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = calendarData[dateStr] || {};
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell bg-white rounded-lg border border-gray-100 p-1 relative hover:shadow-md transition cursor-pointer';
        dayCell.dataset.date = dateStr;
        
        // 日期数字
        const dayNumber = document.createElement('div');
        dayNumber.className = 'text-xs font-medium mb-1';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);
        
        // 创建心情显示区域
        const moodContainer = document.createElement('div');
        moodContainer.className = 'half-cell';
        
        // 他的心情 (左半部分)
        if (dayData.his && dayData.his.mood) {
            const hisMood = document.createElement('div');
            hisMood.className = `half-left ${moods[dayData.his.mood].color} rounded-l-lg flex items-center justify-center`;
            hisMood.innerHTML = `<i class="fa ${moods[dayData.his.mood].icon} text-white mood-icon"></i>`;
            moodContainer.appendChild(hisMood);
        }
        
        // 她的心情 (右半部分)
        if (dayData.her && dayData.her.mood) {
            const herMood = document.createElement('div');
            herMood.className = `half-right ${moods[dayData.her.mood].color} rounded-r-lg flex items-center justify-center`;
            herMood.innerHTML = `<i class="fa ${moods[dayData.her.mood].icon} text-white mood-icon"></i>`;
            moodContainer.appendChild(herMood);
        }
        
        dayCell.appendChild(moodContainer);
        
        calendarGrid.appendChild(dayCell);
    }
    
    // 高亮今天
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) {
        const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayCell = document.querySelector(`[data-date="${todayStr}"]`);
        if (todayCell) {
            todayCell.classList.add('ring-2', 'ring-primary');
        }
    }
}

// 打开日期详情模态框
function openDayModal(dateStr) {
    const modal = document.getElementById('day-modal');
    const modalDate = document.getElementById('modal-date');
    const hisMoodDisplay = document.getElementById('his-mood-display');
    const herMoodDisplay = document.getElementById('her-mood-display');
    const diaryContent = document.getElementById('diary-content');
    
    // 重置模态框
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-primary'));
    document.getElementById('preview-images').innerHTML = '';
    
    // 设置日期标题
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    modalDate.textContent = date.toLocaleDateString('zh-CN', options);
    
    // 加载日期数据
    const dayData = calendarData[dateStr] || {};
    const userData = dayData[currentUser] || {};
    
    // 显示双方心情
    if (dayData.his && dayData.his.mood) {
        hisMoodDisplay.className = `h-12 rounded-lg flex items-center justify-center ${moods[dayData.his.mood].color} text-white`;
        hisMoodDisplay.innerHTML = `<i class="fa ${moods[dayData.his.mood].icon} mr-2"></i>${moods[dayData.his.mood].name}`;
    } else {
        hisMoodDisplay.className = 'h-12 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200';
        hisMoodDisplay.innerHTML = '<span class="text-gray-400 text-sm">未记录</span>';
    }
    
    if (dayData.her && dayData.her.mood) {
        herMoodDisplay.className = `h-12 rounded-lg flex items-center justify-center ${moods[dayData.her.mood].color} text-white`;
        herMoodDisplay.innerHTML = `<i class="fa ${moods[dayData.her.mood].icon} mr-2"></i>${moods[dayData.her.mood].name}`;
    } else {
        herMoodDisplay.className = 'h-12 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200';
        herMoodDisplay.innerHTML = '<span class="text-gray-400 text-sm">未记录</span>';
    }
    
    // 选中当前用户的心情
    if (userData.mood) {
        const moodBtn = document.querySelector(`.mood-btn[data-mood="${userData.mood}"]`);
        if (moodBtn) {
            moodBtn.classList.add('ring-2', 'ring-offset-2', 'ring-primary');
        }
    }
    
    // 加载日记内容
    diaryContent.value = userData.diary || '';
    
    // 存储当前日期到模态框
    modal.dataset.currentDate = dateStr;
    
    // 显示模态框
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
// 渲染心情记录列表
function renderMoods() {
    const moodsList = document.getElementById('moods-list');
    moodsList.innerHTML = '';
    
    // 检查是否有心情数据
    if (moods.length === 0) {
        moodsList.innerHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
                暂无心情记录，点击"记录心情"开始记录吧
            </div>
        `;
        return;
    }
    
    // 按日期倒序排列（最新的在前）
    const sortedMoods = [...moods].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedMoods.forEach(mood => {
        addMoodToDOM(mood);
    });
}

// 添加心情记录到DOM
function addMoodToDOM(mood) {
    const moodsList = document.getElementById('moods-list');
    
    // 心情图标映射
    const moodIcons = {
        happy: '😊',
        sad: '😢',
        angry: '😠',
        calm: '😌',
        excited: '🥳'
    };
    
    // 创建心情元素
    const moodElement = document.createElement('div');
    moodElement.className = 'bg-white rounded-xl shadow-md p-6 transform hover:shadow-lg transition opacity-0 translate-y-4';
    moodElement.setAttribute('data-mood-id', mood.id);
    
    moodElement.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <h3 class="text-xl font-semibold text-gray-800 flex items-center">
                ${moodIcons[mood.type] || '😐'} ${getMoodText(mood.type)}
            </h3>
            <span class="text-sm px-2 py-1 rounded-full ${mood.author === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">
                ${mood.author === 'his' ? '他的心情' : '她的心情'}
            </span>
        </div>
        <p class="text-gray-600 text-sm mb-3">${formatDate(mood.date)}</p>
        ${mood.note ? `<p class="text-gray-700 mb-4">${mood.note}</p>` : ''}
    `;
    
    moodsList.prepend(moodElement);
    
    // 添加动画效果
    setTimeout(() => {
        moodElement.classList.remove('opacity-0', 'translate-y-4');
        moodElement.classList.add('transition-all', 'duration-500');
    }, 10);
}

// 获取心情文本描述
function getMoodText(type) {
    const moodTexts = {
        happy: '开心',
        sad: '难过',
        angry: '生气',
        calm: '平静',
        excited: '兴奋'
    };
    return moodTexts[type] || '未知心情';
}
// 关闭模态框
function closeModal() {
    const modal = document.getElementById('day-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// 处理图片上传预览
function handleImageUpload(e) {
    const previewContainer = document.getElementById('preview-images');
    previewContainer.innerHTML = '';
    
    const files = e.target.files;
    if (!files.length) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const preview = document.createElement('div');
            preview.className = 'relative w-20 h-20 rounded-md overflow-hidden border border-gray-200';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'w-full h-full object-cover';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/70 transition';
            removeBtn.innerHTML = '<i class="fa fa-times text-xs"></i>';
            removeBtn.onclick = function() {
                preview.remove();
            };
            
            preview.appendChild(img);
            preview.appendChild(removeBtn);
            previewContainer.appendChild(preview);
        };
        
        reader.readAsDataURL(file);
    }
}

// 保存日记记录
function saveDiaryEntry() {
    const dateStr = document.getElementById('day-modal').dataset.currentDate;
    if (!dateStr) return;
    
    // 获取选中的心情
    const selectedMood = document.querySelector('.mood-btn.ring-2')?.dataset.mood;
    
    // 获取日记内容
    const diaryContent = document.getElementById('diary-content').value.trim();
    
    // 获取图片（这里只是模拟，实际应用中需要上传到服务器）
    const images = []; // 实际应用中这里会存储图片URL
    
    // 更新日历数据
    if (!calendarData[dateStr]) {
        calendarData[dateStr] = { his: {}, her: {} };
    }
    
    calendarData[dateStr][currentUser] = {
        mood: selectedMood,
        diary: diaryContent,
        images: images,
        updatedAt: new Date().toISOString()
    };
    
    // 保存到本地存储（实际应用中应该保存到服务器）
    localStorage.setItem('calendarData', JSON.stringify(calendarData));
    
    // 刷新日历
    renderCalendar();
    
    // 关闭模态框
    closeModal();
    
    // 显示成功提示
    alert('记录已保存！');
}
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
    
    // 更新图片信息，包括描述
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
// 加载日历数据
function loadCalendarData() {
    // 从本地存储加载（实际应用中应该从服务器加载）
    const savedData = localStorage.getItem('calendarData');
    if (savedData) {
        calendarData = JSON.parse(savedData);
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
function formatDateDay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}