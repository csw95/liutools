'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 打包前的准备工作
console.log('准备打包...');

// 确保目录存在
const directories = ['build', 'dist', 'assets'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
});

// 创建 packaged-start.js 文件 - 用于打包后的应用启动
const packagedStartPath = path.join(__dirname, '..', 'packaged-start.js');
fs.writeFileSync(packagedStartPath, `
'use strict';

// 这个文件是打包后的应用入口点
process.env.PACKAGED = 'true';
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';

// 加载主程序
require('./dist/electron/electron/main.js');
`);

console.log('创建了打包启动文件');

// 修改临时主入口文件的路径
const tempMainPath = path.join(__dirname, '..', 'temp-bootstrap.js');
fs.writeFileSync(tempMainPath, `
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
`);

console.log('创建了临时引导文件');

// 创建一个图标文件，如果不存在
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 检查是否存在图标文件
const iconMacPath = path.join(assetsDir, 'icon.icns');
const iconWinPath = path.join(assetsDir, 'icon.ico');

if (!fs.existsSync(iconMacPath) || !fs.existsSync(iconWinPath)) {
  console.log('图标文件不存在，使用默认图标');
  // 这里可以添加代码来创建默认图标或从其他位置复制
}

// 确保 package.json 中的 main 指向正确的位置
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 打包时使用 packaged-start.js 作为入口点
packageJson.main = 'packaged-start.js';
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('更新了 package.json');
console.log('准备完成，开始打包...'); 