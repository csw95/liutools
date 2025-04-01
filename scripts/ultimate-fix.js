'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 运行命令
function runCommand(command, description) {
  console.log(`\n===== ${description} =====`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`执行命令失败: ${command}`, error.message);
    return false;
  }
}

// 创建直接electron启动器
function createElectronRunner() {
  const filePath = path.join(rootDir, 'electron-runner.js');
  const content = `
'use strict';

// 设置环境变量
process.env.ELECTRON_IS_DEV = '1';

// 使用electron直接启动应用
const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('正在启动Electron...');

// 直接启动electron，不使用Node.js加载器
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
    FORCE_COLOR: '1'
  }
});

proc.on('close', (code) => {
  console.log(\`Electron进程已退出，退出码: \${code}\`);
  process.exit(code);
});
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`已创建电子启动器: ${filePath}`);

  // 添加到package.json
  try {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts.electron) {
      packageJson.scripts.electron = 'node electron-runner.js';
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('已添加electron命令到package.json');
    }
  } catch (error) {
    console.error('更新package.json失败:', error);
  }
}

// 强制修复electron-is-dev模块
function fixElectronIsDev() {
  const isDevPath = path.join(rootDir, 'node_modules', 'electron-is-dev', 'index.js');
  if (!fs.existsSync(isDevPath)) {
    console.log('electron-is-dev模块未找到，跳过修复');
    return;
  }

  // 备份原始文件
  if (!fs.existsSync(isDevPath + '.bak')) {
    fs.copyFileSync(isDevPath, isDevPath + '.bak');
  }

  // 写入新内容
  const fixedContent = `'use strict';

// 固定返回开发模式，避免在非Electron环境下出错
module.exports = true;
`;

  fs.writeFileSync(isDevPath, fixedContent, 'utf8');
  console.log('已强制修复electron-is-dev模块');
}

// 主函数
async function main() {
  console.log('开始终极修复...');

  // 1. 运行Node配置修复
  runCommand('npm run fix-node-options', '修复Node选项');

  // 2. 修复electron-is-dev模块
  fixElectronIsDev();

  // 3. 创建electron直接启动器
  createElectronRunner();

  // 4. 重建项目
  runCommand('npm run build', '重新编译项目');

  console.log('\n===== 修复完成 =====');
  console.log('请使用以下命令启动应用:');
  console.log('npm run electron');
  
  console.log('\n如果还有问题，请尝试重新打包应用:');
  console.log('npm run package:mac:no-icons');
}

// 运行主函数
main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
}); 