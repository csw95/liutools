'use strict';

// 设置环境变量
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_NO_WARNINGS = '1';

// 拦截electron:协议URL
const originalURL = global.URL;
global.URL = function(url, base) {
  if (typeof url === 'string' && url.startsWith('electron:')) {
    console.log('[简单启动器] 转换electron:协议URL:', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 复制URL原型方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

// 拦截require.resolve
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('electron:')) {
    console.log('[简单启动器] 拦截electron:协议require:', request);
    request = request.replace('electron:', 'electron');
  }
  return originalResolveFilename(request, parent, isMain, options);
};

// 使用Electron的方式启动应用
console.log('[简单启动器] 正在启动Electron应用...');

// 使用child_process启动Electron
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// 直接用Electron启动当前目录
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // 关键: 设置模拟Electron环境的变量
    ELECTRON_RUN_AS_NODE: '0',
    ELECTRON_NO_ASAR: '1'
  }
});

proc.on('close', (code) => {
  console.log(`[简单启动器] Electron进程已退出，退出码: ${code}`);
  process.exit(code);
}); 