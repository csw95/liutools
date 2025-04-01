
// 临时启动文件
const path = require('path');
// 设置环境变量，禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';

// 确保使用纯CommonJS模式加载
const mainPath = path.join(__dirname, './dist/electron/electron/main.js');

try {
  require(mainPath);
} catch (err) {
  console.error('加载主程序时出错:', err);
  if (typeof process.exit === 'function') {
    process.exit(1);
  }
}
