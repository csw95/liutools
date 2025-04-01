'use strict';

// 禁用警告
process.env.NODE_NO_WARNINGS = '1';

// 拦截和重写所有electron协议的URL
const originalURL = global.URL;
global.URL = function(url, base) {
  if (typeof url === 'string' && url.startsWith('electron:')) {
    console.log('[直接启动器] 拦截到electron:协议URL:', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 复制原始URL的静态方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

// 无需模块加载器，直接使用child_process启动Electron
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('[直接启动器] 正在直接启动Electron进程...');

const electronProcess = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
    NODE_OPTIONS: '--no-warnings'
  }
});

electronProcess.on('close', (code) => {
  console.log(`[直接启动器] Electron进程已退出，退出码: ${code}`);
  process.exit(code);
});
