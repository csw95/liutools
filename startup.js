
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// 设置环境变量
process.env.NODE_OPTIONS = '--no-warnings';

// 启动 Electron 应用
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: Object.assign({}, process.env, {
    NODE_OPTIONS: '--no-warnings',
    ELECTRON_RUN_AS_NODE: '0'
  })
});

child.on('close', (code) => {
  process.exit(code);
});
