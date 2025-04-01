'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== 全面解决Electron ESM URL协议问题 ===');

// 检查环境
console.log('检查Node.js版本...');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`Node.js版本: ${nodeVersion}`);
} catch (error) {
  console.error('无法检查Node.js版本:', error.message);
}

// 函数：运行脚本
function runScript(scriptName, description) {
  console.log(`\n=== ${description} ===`);
  try {
    execSync(`npm run ${scriptName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`运行${scriptName}失败:`, error.message);
    return false;
  }
}

// 执行所有修复步骤
async function main() {
  // 1. 转换TypeScript导入语句
  runScript('fix-ts-imports', '修复TypeScript导入语句');
  
  // 2. 修复TypeScript编译错误
  runScript('fix-ts-errors', '修复TypeScript编译错误');
  
  // 3. 修复NODE_OPTIONS参数问题
  runScript('fix-node-options', '修复NODE_OPTIONS参数问题');
  
  // 4. 直接修复运行时环境
  runScript('fix-esm-direct', '直接修复运行时ESM问题');
  
  // 5. 重新编译项目
  console.log('\n=== 重新编译项目 ===');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('编译项目失败:', error.message);
    console.log('继续执行下一步...');
  }
  
  // 6. 创建包含所有修复的特殊补丁包
  console.log('\n=== 创建特殊补丁文件 ===');
  const patchDir = path.join(process.cwd(), 'patches');
  if (!fs.existsSync(patchDir)) {
    fs.mkdirSync(patchDir, { recursive: true });
  }
  
  // 创建多层次防护补丁
  const superPatchPath = path.join(patchDir, 'super-patch.js');
  const superPatchCode = `
// 多层次防护补丁 - 解决Electron ESM URL协议问题

// 阻止Node.js使用electron:协议的多种方式
if (typeof process !== 'undefined') {
  // 环境变量
  process.env.NODE_NO_ESM_MODULE_LOADING = '1';
  process.env.NODE_OPTIONS = '--no-warnings --no-experimental-loader';
  
  // 拦截URL构造函数
  if (typeof global !== 'undefined' && global.URL) {
    const originalURL = global.URL;
    global.URL = function(url, base) {
      // 替换URL中的electron:协议
      if (typeof url === 'string' && url.startsWith('electron:')) {
        console.log('[超级补丁] 转换electron:协议URL:', url);
        url = 'file:' + url.slice(9);
      }
      return new originalURL(url, base);
    };
    
    // 复制原始方法
    for (const prop in originalURL) {
      if (originalURL.hasOwnProperty(prop)) {
        global.URL[prop] = originalURL[prop];
      }
    }
  }
  
  // 拦截require.resolve (如果在Node.js环境)
  if (typeof require !== 'undefined' && require.resolve) {
    try {
      const Module = require('module');
      if (Module && Module._resolveFilename) {
        const originalResolveFilename = Module._resolveFilename;
        Module._resolveFilename = function(request, parent, isMain, options) {
          if (typeof request === 'string' && request.startsWith('electron:')) {
            console.log('[超级补丁] 转换electron:协议require:', request);
            request = request.replace('electron:', 'electron');
          }
          return originalResolveFilename(request, parent, isMain, options);
        };
      }
    } catch (e) {
      console.error('[超级补丁] 无法拦截require.resolve:', e);
    }
  }
}

console.log('[超级补丁] 多层次防护补丁已加载');
`;

  fs.writeFileSync(superPatchPath, superPatchCode, 'utf8');
  console.log(`已创建多层次防护补丁: ${superPatchPath}`);
  
  // 创建打包前的自我修复脚本
  const selfFixPath = path.join(process.cwd(), 'self-fix.js');
  const selfFixCode = `
'use strict';

// 自我修复脚本 - 在打包前运行

const fs = require('fs');
const path = require('path');

console.log('开始自我修复...');

// 寻找并修复ESM模块问题
const patchDist = () => {
  const distDir = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distDir)) {
    console.log('dist目录不存在，跳过修复');
    return;
  }
  
  // 递归处理所有JS文件
  const processDir = (dir) => {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      
      if (fs.statSync(fullPath).isDirectory()) {
        processDir(fullPath);
      } else if (entry.endsWith('.js')) {
        // 处理JS文件
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;
        
        // 替换import语句
        if (content.includes('import') && 
            (content.includes('electron') || content.includes('electron/'))) {
          
          // 替换 import ... from 'electron'
          content = content.replace(
            /import\\s+(?:\\{\\s*([^}]+)\\s*\\}|([\\w*]+))\\s+from\\s+['"]electron(?:\\/([^'"]+))?['"]/g,
            (match, namedImports, defaultImport, subPath) => {
              modified = true;
              if (namedImports) {
                return \`const { \${namedImports} } = require('electron\${subPath ? '/' + subPath : ''}');\`;
              } else if (defaultImport) {
                return \`const \${defaultImport} = require('electron\${subPath ? '/' + subPath : ''}');\`;
              }
              return match;
            }
          );
        }
        
        // 替换 electron: 协议
        if (content.includes('electron:')) {
          content = content.replace(/['"]electron:([^'"]+)['"]/g, (match, path) => {
            modified = true;
            return \`'electron/\${path}'\`;
          });
        }
        
        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(\`已修复文件: \${fullPath}\`);
        }
      }
    }
  };
  
  processDir(distDir);
  console.log('完成dist目录修复');
};

// 应用补丁
patchDist();

console.log('自我修复完成');
`;

  fs.writeFileSync(selfFixPath, selfFixCode, 'utf8');
  console.log(`已创建自我修复脚本: ${selfFixPath}`);
  
  // 更新package.json添加自我修复脚本到prepare-package中
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts['prepare-package']) {
      packageJson.scripts['prepare-package'] = 'node self-fix.js && ' + packageJson.scripts['prepare-package'];
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('已更新prepare-package脚本，添加自我修复步骤');
    }
  } catch (error) {
    console.error('更新package.json失败:', error.message);
  }
  
  // 7. 建议下一步操作
  console.log('\n=== 修复完成! ===');
  console.log('请按照以下步骤操作:');
  console.log('1. 重新编译项目:');
  console.log('   npm run build');
  console.log('2. 使用直接启动模式测试应用:');
  console.log('   npm run start_direct');
  console.log('3. 如果正常工作，重新打包应用:');
  console.log('   npm run package:mac');
  console.log('\n如果仍然有问题，请尝试无图标打包:');
  console.log('   npm run package:mac:no-icons');
}

// 执行主函数
main().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
}); 