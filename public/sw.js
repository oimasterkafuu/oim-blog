// Service Worker - 处理 502 错误并显示更新页面

const OFFLINE_PAGE = '/updating.html';
const STATUS_502 = 502;

// 安装事件 - 缓存离线页面
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('updating-cache').then((cache) => {
      return cache.addAll([OFFLINE_PAGE]);
    })
  );
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 拦截 fetch 请求
self.addEventListener('fetch', (event) => {
  // 只处理导航请求（HTML 页面）
  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果返回 502，显示更新页面
        if (response.status === STATUS_502) {
          return caches.match(OFFLINE_PAGE).then((cachedResponse) => {
            return cachedResponse || response;
          });
        }
        return response;
      })
      .catch(() => {
        // 网络错误时也显示更新页面
        return caches.match(OFFLINE_PAGE).then((cachedResponse) => {
          return cachedResponse;
        });
      })
  );
});
