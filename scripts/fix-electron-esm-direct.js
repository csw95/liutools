'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 查找所有可能包含 electron:// 协议的文件
function findElectronImports() {
  try {
    console.log('搜索可能包含electron:协议的文件...');
    
    // 在dist目录中搜索
    const distDir = path.join(rootDir, 'dist');
    let foundFiles = [];
    
    if (fs.existsSync(distDir)) {
      foundFiles = scanDirectory(distDir, foundFiles);
    } else {
      console.log('dist目录不存在，跳过搜索');
    }
    
    return foundFiles;
  } catch (error) {
    console.error('搜索文件时出错:', error);
    return [];
  }
}

// 递归扫描目录，查找JS文件
function scanDirectory(dir, foundFiles = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 递归扫描子目录
      scanDirectory(fullPath, foundFiles);
    } else if (file.endsWith('.js')) {
      // 检查JS文件是否包含electron:协议
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('electron:') || 
          content.includes('from "electron"') || 
          content.includes("from 'electron'")) {
        foundFiles.push(fullPath);
      }
    }
  }
  
  return foundFiles;
}

// 创建直接替换的启动器文件
function createDirectLauncher() {
  const launcherPath = path.join(rootDir, 'direct-launcher.js');
  
  // 直接启动器代码
  const launcherCode = `
'use strict';

// 禁用警告
process.env.NODE_NO_WARNINGS = '1';

// 拦截和重写所有electron协议的URL
const originalURL = global.URL;
global.URL = function(url, base) {
  if (typeof url === 'string' && url.startsWith('electron:')) {
    console.log('[直接启动器] 拦截到electron:协议URL:', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 复制原始URL的静态方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

// 无需模块加载器，直接使用child_process启动Electron
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('[直接启动器] 正在直接启动Electron进程...');

const electronProcess = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
    NODE_OPTIONS: '--no-warnings --no-experimental-loader'
  }
});

electronProcess.on('close', (code) => {
  console.log(\`[直接启动器] Electron进程已退出，退出码: \${code}\`);
  process.exit(code);
});
`;

  fs.writeFileSync(launcherPath, launcherCode, 'utf8');
  console.log(`已创建直接启动器: ${launcherPath}`);
  
  return launcherPath;
}

// 创建补丁文件，将在运行时动态替换Node.js中的ESM加载行为
function createRuntimePatch() {
  const patchDir = path.join(rootDir, 'patches');
  if (!fs.existsSync(patchDir)) {
    fs.mkdirSync(patchDir, { recursive: true });
  }
  
  const patchFile = path.join(patchDir, 'runtime-patch.js');
  const patchCode = `
// Node.js ESM加载器运行时补丁

// 拦截并修复基于URL的模块加载
const originalURL = global.URL;
global.URL = function(url, base) {
  // 将electron:协议转换为file:协议
  if (typeof url === 'string' && url.startsWith('electron:')) {
    console.log('[运行时补丁] 转换electron:协议的URL:', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 将补丁扩展到所有其他URL相关方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

// 拦截require.resolve
if (typeof require !== 'undefined' && require.resolve) {
  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('electron:')) {
      console.log('[运行时补丁] 转换electron:协议的require:', request);
      request = request.replace('electron:', 'electron');
    }
    return originalResolveFilename(request, parent, isMain, options);
  };
}

console.log('[运行时补丁] Node.js ESM加载器补丁已应用');
`;

  fs.writeFileSync(patchFile, patchCode, 'utf8');
  console.log(`已创建运行时补丁: ${patchFile}`);
  
  return patchFile;
}

// 修改主启动文件，强制禁用ESM模块
function updateMainEntryFile() {
  const entryFiles = [
    'packaged-start.js',
    'start.js', 
    'main.js'
  ];
  
  for (const fileName of entryFiles) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`跳过不存在的文件: ${filePath}`);
      continue;
    }
    
    console.log(`更新启动文件: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 增加必要的环境变量设置，确保禁用ESM和electron:协议
    const patchCode = `
// ===== Electron ESM URL协议修复 =====
// 启用CommonJS模式，禁用ESM
if (typeof process !== 'undefined') {
  // 禁用ESM加载
  process.env.NODE_NO_ESM_MODULE_LOADING = '1';
  
  // 禁用实验性加载器
  process.env.NODE_OPTIONS = '--no-warnings --no-experimental-loader';
  
  // 加载运行时补丁
  try {
    require('./patches/runtime-patch.js');
  } catch (e) {
    console.error('加载ESM补丁失败:', e);
  }
}
// ===== Electron ESM URL协议修复结束 =====

`;
    
    // 在文件开头插入补丁代码
    if (!content.includes('Electron ESM URL协议修复')) {
      content = patchCode + content;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`已更新启动文件: ${filePath}`);
    } else {
      console.log(`文件已包含修复代码: ${filePath}`);
    }
  }
}

// 修改package.json为直接启动模式
function updatePackageJson(launcherPath) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('找不到package.json文件');
    return false;
  }
  
  try {
    const packageJson = require(packageJsonPath);
    
    // 备份原始main字段
    packageJson._originalMain = packageJson.main;
    
    // 更新main字段为直接启动器
    packageJson.main = path.basename(launcherPath);
    
    // 确保类型为CommonJS
    packageJson.type = 'commonjs';
    
    // 添加新的直接启动命令
    if (!packageJson.scripts.start_direct) {
      packageJson.scripts.start_direct = `node ${path.basename(launcherPath)}`;
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`已更新package.json，使用直接启动模式: ${packageJson.main}`);
    return true;
  } catch (error) {
    console.error('更新package.json失败:', error);
    return false;
  }
}

// 更新electron-builder配置，确保补丁文件被打包
function updateElectronBuilderConfig() {
  const configPaths = [
    path.join(rootDir, 'electron-builder.yml'),
    path.join(rootDir, 'electron-builder.json')
  ];
  
  let configPath = null;
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }
  
  if (!configPath) {
    console.log('找不到electron-builder配置文件，跳过更新');
    return false;
  }
  
  try {
    if (configPath.endsWith('.yml')) {
      // 处理YAML配置
      let content = fs.readFileSync(configPath, 'utf8');
      
      // 添加patches目录到files
      if (!content.includes('patches/')) {
        const filesMatch = content.match(/files:\s*(\n|$)/);
        if (filesMatch) {
          const insertPos = filesMatch.index + filesMatch[0].length;
          content = 
            content.slice(0, insertPos) +
            '  - patches/**/*\n  - direct-launcher.js\n' +
            content.slice(insertPos);
        }
      }
      
      fs.writeFileSync(configPath, content, 'utf8');
      console.log(`已更新electron-builder配置: ${configPath}`);
    } else {
      // 处理JSON配置
      const config = require(configPath);
      
      // 确保files数组存在
      if (!config.files) {
        config.files = [];
      }
      
      // 添加patches目录和启动器
      if (!config.files.includes('patches/**/*')) {
        config.files.push('patches/**/*');
      }
      
      if (!config.files.includes('direct-launcher.js')) {
        config.files.push('direct-launcher.js');
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`已更新electron-builder配置: ${configPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('更新electron-builder配置失败:', error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('开始直接修复Electron ESM URL协议问题...');
  
  // 1. 查找可能包含electron:协议的文件
  const files = findElectronImports();
  console.log(`找到 ${files.length} 个可能含有electron:协议的文件:`);
  files.forEach(file => console.log(` - ${file}`));
  
  // 2. 创建运行时补丁文件
  const patchFile = createRuntimePatch();
  
  // 3. 创建直接启动器
  const launcherPath = createDirectLauncher();
  
  // 4. 更新主入口文件
  updateMainEntryFile();
  
  // 5. 更新package.json
  updatePackageJson(launcherPath);
  
  // 6. 更新electron-builder配置
  updateElectronBuilderConfig();
  
  // 创建patches目录包含的README文件
  const readmePath = path.join(rootDir, 'patches', 'README.md');
  fs.writeFileSync(readmePath, `# Electron ESM URL协议补丁\n\n这个目录包含修复electron:协议ESM加载问题的补丁文件。\n\n**请勿删除此目录，否则可能导致应用崩溃。**\n`, 'utf8');
  
  console.log('\n===== 修复完成! =====');
  console.log('请按照以下步骤操作:');
  console.log('1. 重新编译项目:');
  console.log('   npm run build');
  console.log('2. 使用直接启动模式测试:');
  console.log('   npm run start_direct');
  console.log('3. 重新打包应用:');
  console.log('   npm run package:mac');
}

// 运行主函数
main().catch(error => {
  console.error('运行时出错:', error);
  process.exit(1);
}); 