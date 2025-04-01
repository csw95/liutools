
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
            /import\s+(?:\{\s*([^}]+)\s*\}|([\w*]+))\s+from\s+['"]electron(?:\/([^'"]+))?['"]/g,
            (match, namedImports, defaultImport, subPath) => {
              modified = true;
              if (namedImports) {
                return `const { ${namedImports} } = require('electron${subPath ? '/' + subPath : ''}');`;
              } else if (defaultImport) {
                return `const ${defaultImport} = require('electron${subPath ? '/' + subPath : ''}');`;
              }
              return match;
            }
          );
        }
        
        // 替换 electron: 协议
        if (content.includes('electron:')) {
          content = content.replace(/['"]electron:([^'"]+)['"]/g, (match, path) => {
            modified = true;
            return `'electron/${path}'`;
          });
        }
        
        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`已修复文件: ${fullPath}`);
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
