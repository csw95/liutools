'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

function checkAndFixFiles() {
  const files = [
    path.join(rootDir, 'dist', 'electron', 'main.js'), 
    path.join(rootDir, 'dist', 'electron', 'electron', 'main.js')
  ];
  
  let fixed = false;
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`文件不存在: ${file}`);
      continue;
    }
    
    console.log(`检查文件: ${file}`);
    let content = fs.readFileSync(file, 'utf8');
    
    // 修复 ESM 导入
    const esmImports = content.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g);
    if (esmImports) {
      console.log(`发现 ${esmImports.length} 个 ESM 导入`);
      for (const match of esmImports) {
        const [, name, source] = match.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
        const requireStr = `const ${name} = require('${source}')`;
        content = content.replace(match, requireStr);
        console.log(`   将 "${match}" 替换为 "${requireStr}"`);
      }
      fixed = true;
    }
    
    // 修复动态导入
    const dynamicImports = content.match(/await\s+import\s*\(['"](.*)['"]\)/g);
    if (dynamicImports) {
      console.log(`发现 ${dynamicImports.length} 个动态导入`);
      for (const match of dynamicImports) {
        const [, source] = match.match(/await\s+import\s*\(['"](.*)['"]\)/);
        const requireStr = `require('${source}')`;
        content = content.replace(match, requireStr);
        console.log(`   将 "${match}" 替换为 "${requireStr}"`);
      }
      fixed = true;
    }
    
    // 修复 Promise.resolve().then(() => __importStar(require(...)))
    const promiseImports = content.match(/await\s+Promise\.resolve\(\)\.then\(\(\)\s+=>\s+__importStar\(require\(['"](.+)['"]\)\)\)/g);
    if (promiseImports) {
      console.log(`发现 ${promiseImports.length} 个 Promise 导入`);
      for (const match of promiseImports) {
        const [, source] = match.match(/await\s+Promise\.resolve\(\)\.then\(\(\)\s+=>\s+__importStar\(require\(['"](.+)['"]\)\)\)/);
        const requireStr = `require('${source}')`;
        content = content.replace(match, requireStr);
        console.log(`   将 "${match}" 替换为 "${requireStr}"`);
      }
      fixed = true;
    }
    
    if (fixed) {
      console.log(`写入修改后的文件: ${file}`);
      fs.writeFileSync(file, content, 'utf8');
    } else {
      console.log(`文件不需要修改: ${file}`);
    }
  }
  
  return fixed;
}

function createDirectStartupScript() {
  const startScriptPath = path.join(rootDir, 'start.js');
  
  const script = `
'use strict';

const electron = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// 禁用所有警告
process.env.NODE_NO_WARNINGS = '1';

// 直接启动应用，绕过 Node.js 模块系统
console.log('正在启动 Electron 应用...');
const electronProcess = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1'
  }
});

electronProcess.on('close', (code) => {
  console.log(\`Electron 进程已退出，退出码: \${code}\`);
  process.exit(code);
});
  `;
  
  fs.writeFileSync(startScriptPath, script, 'utf8');
  console.log(`创建了直接启动脚本: ${startScriptPath}`);
  
  // 修改 package.json 中的 start 脚本
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.scripts.start = 'node start.js';
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('已更新 package.json 中的 start 脚本');
    } catch (error) {
      console.error('更新 package.json 失败:', error);
    }
  }
}

// 主函数
function main() {
  console.log('开始修复 ESM 相关问题...');
  
  // 检查并修复 JS 文件中的 ESM 导入
  const fixed = checkAndFixFiles();
  
  // 创建直接启动脚本
  createDirectStartupScript();
  
  console.log('\n修复完成！');
  console.log('请使用以下命令启动应用:');
  console.log('npm start');
}

// 运行主函数
main(); 