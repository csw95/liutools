'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// electron-is-dev模块的路径
const isDevModulePath = path.join(rootDir, 'node_modules', 'electron-is-dev', 'index.js');

// 检查模块是否存在
if (!fs.existsSync(isDevModulePath)) {
  console.log('electron-is-dev模块未找到，跳过修复');
  process.exit(0);
}

// 读取原始文件内容
const originalContent = fs.readFileSync(isDevModulePath, 'utf8');

// 创建备份
const backupPath = isDevModulePath + '.bak';
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, originalContent, 'utf8');
  console.log(`已创建备份: ${backupPath}`);
}

// 修改后的内容 - 使模块在非Electron环境下也能工作
const newContent = `'use strict';

// 修复过的electron-is-dev模块
// 即使在非Electron环境下也返回合理的值

let resolvedValue;

// 检查是否在Electron环境中运行
const isElectron = () => {
  try {
    return typeof process !== 'undefined' && 
           (process.versions.electron || 
            process.env.ELECTRON_RUN_AS_NODE === '0' || 
            process.env.ELECTRON_IS_DEV === '1' || 
            process.env.ELECTRON_IS_DEV === '0');
  } catch (e) {
    return false;
  }
};

// 如果不在Electron环境中，直接返回开发模式
if (!isElectron()) {
  console.log('[electron-is-dev修复] 检测到非Electron环境，使用开发模式');
  resolvedValue = process.env.ELECTRON_IS_DEV === '0' ? false : true;
  module.exports = resolvedValue;
} else {
  // 如果在Electron环境中，使用正常逻辑
  if (typeof process.env.ELECTRON_IS_DEV !== 'undefined') {
    resolvedValue = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
  } else {
    resolvedValue = (process.defaultApp || /node_modules[\\\\/]electron[\\\\/]/.test(process.execPath) === false);
  }
  
  module.exports = resolvedValue;
}
`;

// 写入修改后的内容
fs.writeFileSync(isDevModulePath, newContent, 'utf8');
console.log(`已修复electron-is-dev模块: ${isDevModulePath}`);

// 检查ESM版本
const esmVersionPath = path.join(rootDir, 'node_modules', 'electron-is-dev', 'index.mjs');
if (fs.existsSync(esmVersionPath)) {
  // 创建备份
  const esmBackupPath = esmVersionPath + '.bak';
  if (!fs.existsSync(esmBackupPath)) {
    fs.copyFileSync(esmVersionPath, esmBackupPath);
    console.log(`已创建ESM版本备份: ${esmBackupPath}`);
  }
  
  // 修改ESM版本
  const esmNewContent = `// 修复过的electron-is-dev模块 (ESM版本)
// 即使在非Electron环境下也返回合理的值

let resolvedValue;

// 检查是否在Electron环境中运行
const isElectron = () => {
  try {
    return typeof process !== 'undefined' && 
           (process.versions.electron || 
            process.env.ELECTRON_RUN_AS_NODE === '0' || 
            process.env.ELECTRON_IS_DEV === '1' || 
            process.env.ELECTRON_IS_DEV === '0');
  } catch (e) {
    return false;
  }
};

// 如果不在Electron环境中，直接返回开发模式
if (!isElectron()) {
  console.log('[electron-is-dev修复] 检测到非Electron环境，使用开发模式');
  resolvedValue = process.env.ELECTRON_IS_DEV === '0' ? false : true;
} else {
  // 如果在Electron环境中，使用正常逻辑
  if (typeof process.env.ELECTRON_IS_DEV !== 'undefined') {
    resolvedValue = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
  } else {
    resolvedValue = (process.defaultApp || /node_modules[\\\\/]electron[\\\\/]/.test(process.execPath) === false);
  }
}

export default resolvedValue;
`;
  
  fs.writeFileSync(esmVersionPath, esmNewContent, 'utf8');
  console.log(`已修复electron-is-dev ESM版本: ${esmVersionPath}`);
}

console.log('修复完成！');
console.log('现在electron-is-dev模块应该可以在任何环境下正常工作');
console.log('请重新启动应用: npm run start_simple');

// 修复package.json中的electron-is-dev依赖
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 检查是否使用了旧版本
    if (packageJson.dependencies && packageJson.dependencies['electron-is-dev'] === '^1.0.0') {
      console.log('发现旧版本的electron-is-dev，正在更新...');
      packageJson.dependencies['electron-is-dev'] = '^2.0.0';
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('已更新electron-is-dev版本');
    }
  } catch (error) {
    console.error('处理package.json时出错:', error);
  }
} 