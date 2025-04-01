// 多层次防护补丁 - 解决Electron ESM URL协议问题

// 阻止Node.js使用electron:协议的多种方式
if (typeof process !== 'undefined') {
  // 环境变量
  process.env.NODE_NO_ESM_MODULE_LOADING = '1';
  process.env.NODE_OPTIONS = '--no-warnings';
  
  // 拦截URL构造函数
  if (typeof global !== 'undefined' && global.URL) {
    const originalURL = global.URL;
    global.URL = function(url, base) {
      // 替换URL中的electron:协议
      if (typeof url === 'string' && url.startsWith('electron:')) {
        console.log('[超级补丁] 转换electron:协议URL:', url);
        url = 'file:' + url.slice(9);
      }
      return new originalURL(url, base);
    };
    
    // 复制原始方法
    for (const prop in originalURL) {
      if (originalURL.hasOwnProperty(prop)) {
        global.URL[prop] = originalURL[prop];
      }
    }
  }
  
  // 拦截require.resolve (如果在Node.js环境)
  if (typeof require !== 'undefined' && require.resolve) {
    try {
      const Module = require('module');
      if (Module && Module._resolveFilename) {
        const originalResolveFilename = Module._resolveFilename;
        Module._resolveFilename = function(request, parent, isMain, options) {
          if (typeof request === 'string' && request.startsWith('electron:')) {
            console.log('[超级补丁] 转换electron:协议require:', request);
            request = request.replace('electron:', 'electron');
          }
          return originalResolveFilename(request, parent, isMain, options);
        };
      }
    } catch (e) {
      console.error('[超级补丁] 无法拦截require.resolve:', e);
    }
  }
}

console.log('[超级补丁] 多层次防护补丁已加载');
