
// ===== Electron ESM URL协议修复 =====
// 启用CommonJS模式，禁用ESM
if (typeof process !== 'undefined') {
  // 禁用ESM加载
  process.env.NODE_NO_ESM_MODULE_LOADING = '1';
  
  // 禁用实验性加载器
  process.env.NODE_OPTIONS = '--no-warnings';
  
  // 加载运行时补丁
  try {
    require('./patches/runtime-patch.js');
  } catch (e) {
    console.error('加载ESM补丁失败:', e);
  }
}
// ===== Electron ESM URL协议修复结束 =====


'use strict';// 禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
// 禁用electron:协议的ESM加载
process.env.NODE_OPTIONS = '--no-warnings';


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
