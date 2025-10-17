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
const photosPerPage = 4; // 每页显示4张照片
const memoriesPageSize = 5; // 每页显示5条回忆
const messagesPageSize = 5; // 每页显示5条悄悄话
const maxVisibleComments = 3; // 最多显示3条评论，超过则折叠
const API_BASE_URL = 'http://106.15.93.94:3000'; // 服务器API基础URL

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
    
    // 加载数据
    loadAllData();
});
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
    fetch(`${API_BASE_URL}/api/memories`)
        .then(response => {
            if (!response.ok) {
                throw new Error('加载回忆失败');
            }
            return response.json();
        })
        .then(data => {
            // 只显示可见的回忆
            memories = data.filter(memory => memory.visible !== false);
            memories.forEach(memory => {
                memory.comments.sort((a, b) => new Date(a.date) - new Date(b.date));
            });
            memoriesCurrentPage = 1; // 重置为第一页
            renderMemories();
        })
        .catch(error => {
            console.error('加载回忆失败:', error);
            document.getElementById('memories-list').innerHTML = `
                <div class="bg-white rounded-xl shadow-md p-6 text-center text-red-500">
                    加载回忆失败: ${error.message}
                </div>
            `;
        });
}

// 加载照片
function loadPhotos() {
    initPhotoModule();
    // fetch(`${API_BASE_URL}/api/photos`)
    //     .then(response => {
    //         if (!response.ok) {
    //             throw new Error('加载照片失败');
    //         }
    //         return response.json();
    //     })
    //     .then(data => {
    //         // 只显示可见的照片
    //         photos = data.filter(photo => photo.visible !== false);
    //         renderPhotos();
    //     })
    //     .catch(error => {
    //         console.error('加载照片失败:', error);
    //         document.getElementById('photos-grid').innerHTML = `
    //             <div class="col-span-full text-center text-red-500 py-16">
    //                 加载照片失败: ${error.message}
    //             </div>
    //         `;
    //     });
}
function initPhotoModule() {
    loadPhotosFromServer();
}
// 加载消息
function loadMessages() {
    fetch(`${API_BASE_URL}/api/messages`)
        .then(response => {
            if (!response.ok) {
                throw new Error('加载消息失败');
            }
            return response.json();
        })
        .then(data => {
            // 只显示可见的消息
            messages = data.filter(message => message.visible !== false);
            messagesCurrentPage = 1; // 重置为第一页
            renderMessages();
        })
        .catch(error => {
            console.error('加载消息失败:', error);
            document.getElementById('messages-list').innerHTML = `
                <div class="bg-white rounded-xl shadow-md p-6 text-center text-red-500">
                    加载消息失败: ${error.message}
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
                        <p class="text-sm text-gray-700">${comment.content}</p>
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
                                    <p class="text-sm text-gray-700">${comment.content}</p>
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
            <h3 class="text-xl font-semibold text-gray-800">${memory.title}</h3>
            <span class="text-sm px-2 py-1 rounded-full ${memory.author === 'his' ? 'bg-his-light text-his-dark' : 'bg-her-light text-her-dark'}">${memory.author === 'his' ? '他的回忆' : '她的回忆'}</span>
        </div>
        <p class="text-gray-600 text-sm mb-3">${formatDate(memory.date)}</p>
        <p class="text-gray-700 mb-4">${memory.content}</p>
        
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
        body: JSON.stringify(comment)
    }).catch(error => {
        console.error('添加评论失败:', error);
    });
    
    // 重新渲染该回忆
    const memoryElement = document.querySelector(`[data-memory-id="${memoryId}"]`);
    if (memoryElement) {
        memoryElement.remove();
    }
    addMemoryToDOM(memory);
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
        body: JSON.stringify(memory)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('保存回忆失败');
        }
        return response.json();
    })
    .then(savedMemory => {
        // 添加到数组
        memories.unshift(savedMemory);
        
        // 添加到页面
        addMemoryToDOM(savedMemory);
        
        // 重置表单
        document.getElementById('memory-form').reset();
        document.getElementById('memory-form-container').classList.add('hidden');
    })
    .catch(error => {
        console.error('添加回忆失败:', error);
        alert('添加回忆失败: ' + error.message);
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

// 压缩图片函数
function compressImage(file, maxSizeMB = 5) {
    return new Promise((resolve, reject) => {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        // 如果文件小于目标大小，直接返回
        if (file.size <= maxSizeBytes) {
            resolve(file);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算压缩比例
                const ratio = Math.sqrt(maxSizeBytes / file.size);
                width *= ratio;
                height *= ratio;
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制图像
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('压缩图片失败'));
                            return;
                        }
                        // 创建新文件
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    },
                    file.type || 'image/jpeg',
                    0.9 // 质量参数
                );
            };
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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
        if (!data.photos || !Array.isArray(data.photos)) {
            throw new Error('服务器返回格式不正确');
        }
        
        // 处理返回的照片URL，确保完整
        const newPhotos = data.photos.map(photo => ({
            ...photo,
            url: photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`,
            thumbnailUrl: photo.thumbnailUrl 
                ? (photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : `${API_BASE_URL}${photo.thumbnailUrl}`)
                : (photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`)
        }));
        
        // 添加到相册并重新渲染
        photos = [...newPhotos, ...photos];
        savePhotosToLocalStorage(); // 本地备份
        renderPhotos();
        
        // 重置上传组件
        cancelPhotoUpload();
        
        // 显示成功提示
        showNotification(`成功上传 ${newPhotos.length} 张照片`, 'success');
    })
    .catch(error => {
        console.error('照片上传失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
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
        timeout: 10000
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`加载失败: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success || !Array.isArray(data.photos)) {
            throw new Error('服务器返回数据格式不正确');
        }
        
        // 处理照片URL
        photos = data.photos.map(photo => ({
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
        
        // 保存到本地存储作为备份
        savePhotosToLocalStorage();
        
        // 渲染相册
        renderPhotos();
    })
    .catch(error => {
        console.error('加载照片失败:', error);
        
        // 尝试从本地存储加载备份
        const savedPhotos = localStorage.getItem('couplePhotos');
        if (savedPhotos) {
            photos = JSON.parse(savedPhotos);
            renderPhotos();
            showNotification(`加载失败，显示本地备份 (${error.message})`, 'warning');
        } else {
            photosGrid.innerHTML = `
                <div class="col-span-full text-center text-red-500 py-16">
                    <i class="fa fa-exclamation-circle text-2xl mb-3"></i>
                    <p>加载相册失败: ${error.message}</p>
                    <button onclick="loadPhotosFromServer()" class="mt-3 text-primary hover:underline">重试</button>
                </div>
            `;
        }
    });
}
// 保存照片到本地存储
function savePhotosToLocalStorage() {
    localStorage.setItem('couplePhotos', JSON.stringify(photos));
}
// 从本地存储加载照片
function loadPhotosFromLocalStorage() {
    const saved = localStorage.getItem('couplePhotos');
    if (saved) {
        photos = JSON.parse(saved);
    }
}
// 生成缩略图
function generateThumbnail(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxDimension = 200;
                
                // 计算缩略图尺寸
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxDimension) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制缩略图
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL(file.type || 'image/jpeg'));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
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
        photoElement.className = 'rounded-xl overflow-hidden shadow-md cursor-pointer transform hover:scale-[1.02] transition aspect-square bg-gray-100';
        
        // 确保使用正确的图片URL
        const imageUrl = photo.thumbnailUrl 
            ? (photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : `${API_BASE_URL}${photo.thumbnailUrl}`)
            : (photo.url.startsWith('http') ? photo.url : `${API_BASE_URL}${photo.url}`);
        
        // 照片卡片内容，包含缩略信息
        photoElement.innerHTML = `
            <img src="${imageUrl}" alt="相册照片" class="w-full h-full object-cover">
            ${photo.description ? `
                <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-xs mask-gradient">
                    ${photo.description.substring(0, 20)}${photo.description.length > 20 ? '...' : ''}
                </div>
            ` : ''}
        `;
        
        // 点击查看大图
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
// 添加照片到网格
function addPhotoToGrid(photo) {
    const photosGrid = document.getElementById('photos-grid');
    
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item group relative cursor-pointer aspect-square bg-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition fade-in';
    photoItem.innerHTML = `
        <img src="${photo.thumbnail || photo.url}" alt="${photo.caption || '照片'}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <i class="fa fa-search-plus text-white text-xl"></i>
        </div>
        <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <p>${photo.caption || '无描述'}</p>
        </div>
        <span class="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded ${photo.author === 'his' ? 'bg-his-primary/80' : 'bg-her-primary/80'} text-white">${photo.author === 'his' ? '他' : '她'}</span>
    `;
    
    // 添加点击查看大图事件
    photoItem.addEventListener('click', () => {
        const index = photos.findIndex(p => p.id === photo.id);
        if (index !== -1) {
            openPhotoViewer(index);
        }
    });
    
    photosGrid.appendChild(photoItem);
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
                <p class="text-sm">${comment.content}</p>
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
        
        // 保存到本地并刷新评论显示
        savePhotosToLocalStorage();
        loadPhotoComments(currentPhoto.id);
        
        // 清空输入
        commentInput.value = '';
    })
    .catch(error => {
        console.error('添加评论失败:', error);
        showNotification(`评论失败: ${error.message}`, 'error');
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
        body: JSON.stringify(message)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('发送消息失败');
        }
        return response.json();
    })
    .then(savedMessage => {
        // 添加到数组
        messages.unshift(savedMessage);
        
        // 添加到页面
        addMessageToDOM(savedMessage);
        
        // 重置表单
        document.getElementById('message-form').reset();
        document.getElementById('message-form-container').classList.add('hidden');
    })
    .catch(error => {
        console.error('添加消息失败:', error);
        alert('添加消息失败: ' + error.message);
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
            ${message.content}
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