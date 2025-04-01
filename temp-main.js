// 临时主入口文件
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const originalMainPath = path.join(__dirname, './dist/electron/electron/main.js');

// 在主进程中设置环境变量
console.log('强制跳过数据库迁移');
process.env.SKIP_DB_MIGRATIONS = "true";
process.env.NODE_NO_ESM_MODULE_LOADING = '1';

// 加载原始主模块
try {
  require(originalMainPath);
} catch (err) {
  console.error('加载主程序时出错:', err);
  app.quit();
} 