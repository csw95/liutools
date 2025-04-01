'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 清除版本中的"^"前缀
function cleanDependency(packagePath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 删除electron-is-dev的脱字符号
    if (packageJson.dependencies && packageJson.dependencies['electron-is-dev']) {
      const version = packageJson.dependencies['electron-is-dev'].replace('^', '');
      packageJson.dependencies['electron-is-dev'] = version;
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log(`已修复依赖版本: electron-is-dev=${version}`);
    }
    
    return true;
  } catch (error) {
    console.error('修复package.json失败:', error);
    return false;
  }
}

// 修复所有依赖于electron-is-dev的文件
function fixAllElectronIsDevReferences() {
  console.log('查找所有使用electron-is-dev的文件...');
  
  const electronDir = path.join(rootDir, 'electron');
  const distDir = path.join(rootDir, 'dist');
  
  // 创建我们的自定义electron-is-dev.js
  const customIsDevPath = path.join(rootDir, 'electron-is-dev.js');
  const customIsDevCode = `
// 自定义的electron-is-dev替代品
// 简单返回true代表开发模式，避免所有问题

// CommonJS版本
if (typeof module !== 'undefined' && module.exports) {
  module.exports = true;
}

// ESM版本
export default true;

// 全局变量版本
if (typeof window !== 'undefined') {
  window.__ELECTRON_IS_DEV__ = true;
}

// 确保Node.js环境下也能使用
if (typeof global !== 'undefined') {
  global.__ELECTRON_IS_DEV__ = true;
}
`;
  
  fs.writeFileSync(customIsDevPath, customIsDevCode, 'utf8');
  console.log(`已创建自定义electron-is-dev: ${customIsDevPath}`);
  
  // 替换原始electron-is-dev模块
  const npmIsDevPath = path.join(rootDir, 'node_modules', 'electron-is-dev', 'index.js');
  if (fs.existsSync(npmIsDevPath)) {
    const backupPath = npmIsDevPath + '.original';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(npmIsDevPath, backupPath);
      console.log(`已备份原始electron-is-dev: ${backupPath}`);
    }
    
    const simpleIsDevCode = `
'use strict';

// 简化版electron-is-dev
// 始终返回true表示开发模式
module.exports = true;
`;
    
    fs.writeFileSync(npmIsDevPath, simpleIsDevCode, 'utf8');
    console.log(`已替换electron-is-dev模块`);
    
    // 检查ESM版本
    const mjs = path.join(rootDir, 'node_modules', 'electron-is-dev', 'index.mjs');
    if (fs.existsSync(mjs)) {
      if (!fs.existsSync(mjs + '.original')) {
        fs.copyFileSync(mjs, mjs + '.original');
      }
      
      const mjsCode = `// 简化版electron-is-dev (ESM)
export default true;
`;
      fs.writeFileSync(mjs, mjsCode, 'utf8');
      console.log(`已替换electron-is-dev ESM模块`);
    }
    
    // 检查package.json
    const isDevPackagePath = path.join(rootDir, 'node_modules', 'electron-is-dev', 'package.json');
    if (fs.existsSync(isDevPackagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(isDevPackagePath, 'utf8'));
        
        // 备份
        if (!fs.existsSync(isDevPackagePath + '.original')) {
          fs.writeFileSync(isDevPackagePath + '.original', JSON.stringify(packageJson, null, 2), 'utf8');
        }
        
        // 删除type: module以确保以CommonJS方式加载
        if (packageJson.type === 'module') {
          delete packageJson.type;
          console.log('已从electron-is-dev中移除type: module');
        }
        
        // 禁用exports字段，强制使用main
        if (packageJson.exports) {
          packageJson._exports = packageJson.exports;
          delete packageJson.exports;
          console.log('已禁用electron-is-dev的exports字段');
        }
        
        fs.writeFileSync(isDevPackagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      } catch (error) {
        console.error('修改electron-is-dev package.json失败:', error);
      }
    }
  }
  
  // 创建electron-runner-final.js
  const finalRunnerPath = path.join(rootDir, 'electron-runner-final.js');
  const finalRunnerCode = `
'use strict';

// 强制替换electron-is-dev模块
const Module = require('module');
const originalRequire = Module.prototype.require;

// 拦截require调用
Module.prototype.require = function(id) {
  // 拦截electron-is-dev
  if (id === 'electron-is-dev') {
    // 直接返回true，而不是加载模块
    console.log('[拦截器] 拦截了electron-is-dev模块');
    return true;
  }
  
  // 其他情况正常加载
  return originalRequire.apply(this, arguments);
};

// 启动electron
console.log('正在启动Electron应用（带拦截器）...');
const { spawn } = require('child_process');
const electron = require('electron');

// 设置环境变量指示开发模式
process.env.ELECTRON_IS_DEV = '1';
process.env.NODE_ENV = 'development';
process.env.FORCE_COLOR = '1';

// 启动Electron
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_NO_ASAR: '1',
    NODE_NO_ESM_MODULE_LOADING: '1',
  }
});

proc.on('close', (code) => {
  console.log(\`Electron进程已退出，退出码: \${code}\`);
  process.exit(code);
});
`;
  
  fs.writeFileSync(finalRunnerPath, finalRunnerCode, 'utf8');
  console.log(`已创建最终运行器: ${finalRunnerPath}`);
  
  // 更新package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.scripts['electron-final'] = 'node electron-runner-final.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('已添加electron-final命令到package.json');
  } catch (error) {
    console.error('更新package.json失败:', error);
  }
  
  return true;
}

// 主函数
async function main() {
  console.log('开始最终修复electron-is-dev...');
  
  // 1. 修复package.json中的依赖版本
  cleanDependency(path.join(rootDir, 'package.json'));
  
  // 2. 修复所有引用
  fixAllElectronIsDevReferences();
  
  console.log('\n修复完成!');
  console.log('请使用以下命令启动应用:');
  console.log('npm run electron-final');
}

// 运行
main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
}); 