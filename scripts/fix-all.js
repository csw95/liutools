const path = require('path');
const { execSync } = require('child_process');

console.log('开始全面修复应用程序...');

// 1. 修复数据库问题
try {
  console.log('\n=== 修复数据库 ===');
  require('./fix-database.js');
} catch (err) {
  console.error('修复数据库时出错:', err);
}

// 2. 修复预加载脚本
try {
  console.log('\n=== 修复预加载脚本 ===');
  // 创建fix-preload.js并调用
  require('./fix-preload.js');
} catch (err) {
  console.error('修复预加载脚本时出错:', err);
}

// 3. 重新构建应用
try {
  console.log('\n=== 重新构建应用 ===');
  execSync('npm run build', { stdio: 'inherit' });
} catch (err) {
  console.error('重新构建应用时出错:', err);
}

console.log('\n全面修复完成，请重新启动应用程序。'); 