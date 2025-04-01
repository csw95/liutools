
'use strict';

const electron = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// 禁用所有警告
process.env.NODE_NO_WARNINGS = '1';

// 直接启动应用，绕过 Node.js 模块系统
console.log('正在启动 Electron 应用...');
const electronProcess = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1'
  }
});

electronProcess.on('close', (code) => {
  console.log(`Electron 进程已退出，退出码: ${code}`);
  process.exit(code);
});
