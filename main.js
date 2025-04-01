
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

// 使用require，避免ESM
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 设置环境变量，禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
// 关键修复：禁用electron:协议的ESM加载
process.env.NODE_OPTIONS = '--no-warnings';

// 检查是否是开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 确保使用CommonJS模式
process.env.NODE_OPTIONS = '';

// 创建中间启动文件 - 这样可以避免直接加载可能有ESM语法的模块
const tempFile = path.join(__dirname, 'temp-bootstrap.js');
const bootstrapCode = `
// 临时启动文件
const path = require('path');
// 设置环境变量，禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';

// 确保使用纯CommonJS模式加载
const mainPath = path.join(__dirname, ${isDev ? "'./electron/main.ts'" : "'./dist/electron/main.js'"});

try {
  require(mainPath);
} catch (err) {
  console.error('加载主程序时出错:', err);
  if (typeof process.exit === 'function') {
    process.exit(1);
  }
}
`;

try {
  // 创建临时文件
  fs.writeFileSync(tempFile, bootstrapCode);
  
  // 使用require加载临时文件
  console.log(`正在加载主程序...`);
  require(tempFile);
} catch (err) {
  console.error('加载主程序时出错:', err);
} finally {
  // 清理临时文件
  try {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  } catch (e) {
    console.error('清理临时文件时出错:', e);
  }
} 