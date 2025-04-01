
'use strict';

// 强制替换electron-is-dev模块
const Module = require('module');
const originalRequire = Module.prototype.require;

// 拦截require调用
Module.prototype.require = function(id) {
  // 拦截electron-is-dev
  if (id === 'electron-is-dev') {
    // 直接返回true，而不是加载模块
    console.log('[拦截器] 拦截了electron-is-dev模块');
    return true;
  }
  
  // 其他情况正常加载
  return originalRequire.apply(this, arguments);
};

// 启动electron
console.log('正在启动Electron应用（带拦截器）...');
const { spawn } = require('child_process');
const electron = require('electron');

// 设置环境变量指示开发模式
process.env.ELECTRON_IS_DEV = '1';
process.env.NODE_ENV = 'development';
process.env.FORCE_COLOR = '1';

// 启动Electron
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
  }
});

proc.on('close', (code) => {
  console.log(`Electron进程已退出，退出码: ${code}`);
  process.exit(code);
});
