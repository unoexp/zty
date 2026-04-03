const CACHE_NAME = 'couple-app-v1';

const PRECACHE_URLS = [
  '/',
  '/public/index.html',
  '/public/styles.css',
  '/public/index.js',
  '/public/calendar.html',
  '/public/calendar.js',
  '/public/admin.html',
  '/public/login.html',
  '/public/game1.html',
  '/public/game2.html',
  '/public/game3.html'
];

// install: 预缓存主要资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// activate: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch: network-first 策略
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  // 跳过 API 请求（不缓存动态数据）
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 请求成功，更新缓存
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存返回
        return caches.match(event.request);
      })
  );
});
