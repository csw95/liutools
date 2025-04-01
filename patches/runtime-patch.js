
// Node.js ESM加载器运行时补丁

// 拦截并修复基于URL的模块加载
const originalURL = global.URL;
global.URL = function(url, base) {
  // 将electron:协议转换为file:协议
  if (typeof url === 'string' && url.startsWith('electron:')) {
    console.log('[运行时补丁] 转换electron:协议的URL:', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 将补丁扩展到所有其他URL相关方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

// 拦截require.resolve
if (typeof require !== 'undefined' && require.resolve) {
  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('electron:')) {
      console.log('[运行时补丁] 转换electron:协议的require:', request);
      request = request.replace('electron:', 'electron');
    }
    return originalResolveFilename(request, parent, isMain, options);
  };
}

console.log('[运行时补丁] Node.js ESM加载器补丁已应用');
