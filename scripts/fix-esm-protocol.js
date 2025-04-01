'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 检查并修改各种启动文件
function fixStartupFiles() {
  const files = [
    'packaged-start.js',
    'start.js',
    'main.js',
    'temp-bootstrap.js',
    'dist/electron/electron/main.js'
  ];
  
  let fixCount = 0;
  
  for (const filePath of files) {
    const fullPath = path.join(rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`文件不存在: ${fullPath}`);
      continue;
    }
    
    console.log(`修复文件: ${fullPath}`);
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // 检查并添加禁用electron协议的ESM加载的设置
    // 必须在文件最开头添加这些设置，防止Node.js在执行前就加载了模块
    
    // 检查是否已有设置
    if (!content.includes('NODE_NO_ESM_MODULE_LOADING')) {
      const insertPos = content.indexOf('use strict') > -1 ? 
        content.indexOf('use strict') + 'use strict'.length + 2 : 0;
        
      content = 
        content.slice(0, insertPos) + 
        "// 禁用ESM加载\nprocess.env.NODE_NO_ESM_MODULE_LOADING = '1';\n" +
        content.slice(insertPos);
      modified = true;
    }
    
    if (!content.includes('--no-experimental-loader')) {
      const insertPos = content.indexOf('NODE_NO_ESM_MODULE_LOADING') > -1 ?
        content.indexOf('NODE_NO_ESM_MODULE_LOADING') + 
        content.slice(content.indexOf('NODE_NO_ESM_MODULE_LOADING')).indexOf('\n') + 1 : 
        (content.indexOf('use strict') > -1 ? 
          content.indexOf('use strict') + 'use strict'.length + 2 : 0);
          
      content = 
        content.slice(0, insertPos) + 
        "// 禁用electron:协议的ESM加载\nprocess.env.NODE_OPTIONS = '--no-warnings --no-experimental-loader';\n" +
        content.slice(insertPos);
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`已修复文件: ${fullPath}`);
      fixCount++;
    } else {
      console.log(`文件已包含必要的配置: ${fullPath}`);
    }
  }
  
  return fixCount;
}

// 创建一个patch补丁文件，用于覆盖Node.js的ESM加载器
function createEsmPatchFile() {
  const patchDir = path.join(rootDir, 'patches');
  if (!fs.existsSync(patchDir)) {
    fs.mkdirSync(patchDir, { recursive: true });
  }
  
  const patchFile = path.join(patchDir, 'esm-patch.js');
  const patchCode = `
// ESM URL协议补丁
// 此文件用于处理electron:协议的ESM导入问题

// 保存原始的URL构造函数
const originalURL = global.URL;

// 替换URL构造函数
global.URL = function(url, base) {
  // 如果URL使用electron:协议，将其转换为file:协议
  if (url.startsWith('electron:')) {
    console.log('检测到electron:协议的URL，已转换为file:协议', url);
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

console.log('ESM URL协议补丁已应用');
`;

  fs.writeFileSync(patchFile, patchCode, 'utf8');
  console.log(`已创建ESM补丁文件: ${patchFile}`);
  
  return patchFile;
}

// 创建一个新的主入口点，预加载补丁并启动应用
function createPatchedEntry() {
  const entryFile = path.join(rootDir, 'patched-start.js');
  const entryCode = `
'use strict';

// 设置环境变量
process.env.PACKAGED = 'true';
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';

// 预加载ESM补丁
require('./patches/esm-patch.js');

// 重新定义require.resolve钩子以拦截electron:协议
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('electron:')) {
    console.log('拦截到electron:协议的require:', request);
    request = request.replace('electron:', 'electron');
  }
  return originalResolveFilename(request, parent, isMain, options);
};

// 加载主程序
try {
  require('./dist/electron/electron/main.js');
} catch (err) {
  console.error('加载主程序时出错:', err);
  process.exit(1);
}
`;

  fs.writeFileSync(entryFile, entryCode, 'utf8');
  console.log(`已创建补丁入口文件: ${entryFile}`);
  
  return entryFile;
}

// 修改package.json中的主入口点
function updatePackageJson(entryFile) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('找不到package.json文件');
    return false;
  }
  
  try {
    const packageJson = require(packageJsonPath);
    const originalMain = packageJson.main;
    packageJson.main = path.basename(entryFile);
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`已更新package.json主入口点: ${originalMain} -> ${packageJson.main}`);
    return true;
  } catch (error) {
    console.error('更新package.json失败:', error);
    return false;
  }
}

// 修改electron-builder.yml
function updateElectronBuilderConfig(entryFile) {
  const configPath = path.join(rootDir, 'electron-builder.yml');
  if (!fs.existsSync(configPath)) {
    console.error('找不到electron-builder.yml文件');
    return false;
  }
  
  try {
    let content = fs.readFileSync(configPath, 'utf8');
    
    // 确保入口文件在files列表中
    if (!content.includes(path.basename(entryFile))) {
      const filesIndex = content.indexOf('files:');
      if (filesIndex > -1) {
        const nextLineIndex = content.indexOf('\n', filesIndex);
        if (nextLineIndex > -1) {
          content = 
            content.slice(0, nextLineIndex + 1) +
            `  - ${path.basename(entryFile)}\n` +
            content.slice(nextLineIndex + 1);
        }
      }
    }
    
    // 确保patches目录在extraResources中
    if (!content.includes('patches')) {
      const extraResourcesIndex = content.indexOf('extraResources:');
      if (extraResourcesIndex > -1) {
        const nextLineIndex = content.indexOf('\n', extraResourcesIndex);
        if (nextLineIndex > -1) {
          content = 
            content.slice(0, nextLineIndex + 1) +
            `  - from: patches\n    to: patches\n` +
            content.slice(nextLineIndex + 1);
        }
      }
    }
    
    fs.writeFileSync(configPath, content, 'utf8');
    console.log('已更新electron-builder.yml配置');
    return true;
  } catch (error) {
    console.error('更新electron-builder.yml失败:', error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('开始全面修复Electron ESM URL协议问题...');
  
  // 1. 修复所有启动文件
  const fixCount = fixStartupFiles();
  console.log(`已修复 ${fixCount} 个启动文件`);
  
  // 2. 创建ESM补丁文件
  const patchFile = createEsmPatchFile();
  
  // 3. 创建使用补丁的新入口点
  const entryFile = createPatchedEntry();
  
  // 4. 更新package.json
  updatePackageJson(entryFile);
  
  // 5. 更新electron-builder配置
  updateElectronBuilderConfig(entryFile);
  
  console.log('\n修复完成! 请按照以下步骤操作:');
  console.log('1. 清理并重新编译项目:');
  console.log('   npm run build');
  console.log('2. 使用补丁后的配置重新打包:');
  console.log('   npm run package:mac');
  console.log('3. 如果还有问题，请尝试无图标打包:');
  console.log('   npm run package:mac:no-icons');
}

// 运行主函数
main().catch(error => {
  console.error('运行时出错:', error);
  process.exit(1);
}); 