'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

function checkAndFixFiles() {
  const files = [
    path.join(rootDir, 'packaged-start.js'),
    path.join(rootDir, 'temp-bootstrap.js'),
    path.join(rootDir, 'main.js'),
    path.join(rootDir, 'dist', 'electron', 'electron', 'main.js'),
    path.join(rootDir, 'dist', 'electron', 'main.js')
  ];
  
  let fixed = false;
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`文件不存在: ${file}`);
      continue;
    }
    
    console.log(`检查文件: ${file}`);
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // 检查是否已经包含禁用electron:协议的ESM加载的设置
    if (!content.includes('--no-experimental-loader')) {
      // 在设置NODE_OPTIONS的地方添加--no-experimental-loader参数
      if (content.includes('NODE_OPTIONS')) {
        content = content.replace(
          /process\.env\.NODE_OPTIONS\s*=\s*['"]([^'"]*)['"]/g, 
          (match, p1) => {
            // 确保只添加一次
            if (!p1.includes('no-experimental-loader')) {
              return `process.env.NODE_OPTIONS = '${p1.trim()} --no-experimental-loader'`;
            }
            return match;
          }
        );
      } else {
        // 在设置NODE_NO_ESM_MODULE_LOADING后添加NODE_OPTIONS设置
        if (content.includes('NODE_NO_ESM_MODULE_LOADING')) {
          content = content.replace(
            /process\.env\.NODE_NO_ESM_MODULE_LOADING\s*=\s*['"]1['"]/g,
            `process.env.NODE_NO_ESM_MODULE_LOADING = '1';\n// 关键修复：禁用electron:协议的ESM加载\nprocess.env.NODE_OPTIONS = '--no-warnings --no-experimental-loader'`
          );
        } else {
          // 在文件开头添加设置
          const insertIndex = content.indexOf('use strict') > -1 ? 
            content.indexOf('use strict') + 'use strict'.length + 2 : 0;
          content = 
            content.slice(0, insertIndex) +
            `// 关键修复：禁用electron:协议的ESM加载\nprocess.env.NODE_NO_ESM_MODULE_LOADING = '1';\nprocess.env.NODE_OPTIONS = '--no-warnings --no-experimental-loader';\n\n` +
            content.slice(insertIndex);
        }
      }
      
      modified = true;
      fixed = true;
    }
    
    if (modified) {
      console.log(`修改文件: ${file}`);
      fs.writeFileSync(file, content, 'utf8');
    } else {
      console.log(`文件无需修改: ${file}`);
    }
  }
  
  return fixed;
}

// 主函数
function main() {
  console.log('开始修复Electron ESM URL方案错误...');
  
  // 检查并修复文件
  const fixed = checkAndFixFiles();
  
  if (fixed) {
    console.log('\n修复完成！已禁用electron:协议的ESM加载');
  } else {
    console.log('\n所有文件已经包含了必要的修复，无需更改');
  }
  
  console.log('\n请重新打包应用并测试');
}

// 运行主函数
main(); 