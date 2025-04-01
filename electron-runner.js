
'use strict';

// 设置环境变量
process.env.ELECTRON_IS_DEV = '1';

// 使用electron直接启动应用
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('正在启动Electron...');

// 直接启动electron，不使用Node.js加载器
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
    FORCE_COLOR: '1'
  }
});

proc.on('close', (code) => {
  console.log(`Electron进程已退出，退出码: ${code}`);
  process.exit(code);
});
