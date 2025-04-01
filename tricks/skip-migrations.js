'use strict';

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// 设置环境变量，禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';

// 确定electron可执行文件路径
const electronPath = require('electron');

// 准备临时main.js文件
console.log('创建临时启动文件...');
const tempMainPath = path.join(__dirname, '..', 'temp-main.js');

// 创建一个绕过数据库迁移的临时入口文件
fs.writeFileSync(tempMainPath, `
// 临时主入口文件
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const originalMainPath = path.join(__dirname, './dist/electron/main.js');

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
`);

// 修改package.json中的类型
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let packageJson;
let originalMain;

try {
  // 读取原始的package.json
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  originalMain = packageJson.main;
  
  // 修改main指向临时文件
  packageJson.main = 'temp-main.js';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  
  console.log('正在以跳过数据库迁移的模式启动Electron应用...');
  
  // 添加跳过迁移的环境变量
  process.env.SKIP_DB_MIGRATIONS = 'true';
  
  // 在打包环境中，使用不同的启动方式
  if (process.env.PACKAGED === 'true') {
    // 在打包环境中，直接返回，由外部main.js处理
    console.log('在打包环境中，直接由外部启动...');
  } else {
    // 直接通过命令行启动electron，确保环境变量传递
    const cmd = process.platform === 'win32'
      ? `set SKIP_DB_MIGRATIONS=true && "${electronPath}" .`
      : `SKIP_DB_MIGRATIONS=true ${electronPath} .`;
      
    execSync(cmd, {
      stdio: 'inherit',
      env: {
        ...process.env,
        SKIP_DB_MIGRATIONS: 'true',
        NODE_NO_ESM_MODULE_LOADING: '1',
        ELECTRON_NO_ASAR: '1'
      },
      shell: true
    });
  }
} catch (error) {
  console.error('启动失败:', error);
} finally {
  // 恢复package.json
  if (packageJson && originalMain) {
    packageJson.main = originalMain;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('已恢复package.json');
  }
  
  // 清理临时文件
  if (fs.existsSync(tempMainPath)) {
    fs.unlinkSync(tempMainPath);
    console.log('已移除临时文件');
  }
} 