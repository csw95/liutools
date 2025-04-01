'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 需要检查的文件列表
const filesToCheck = [
  'packaged-start.js',
  'start.js',
  'main.js',
  'temp-bootstrap.js',
  'direct-launcher.js',
  'patched-start.js',
  'self-fix.js',
  path.join('patches', 'runtime-patch.js'),
  path.join('patches', 'super-patch.js'),
  path.join('dist', 'electron', 'electron', 'main.js')
];

// 修复NODE_OPTIONS参数
function fixNodeOptions() {
  let fixedCount = 0;
  
  for (const relativeFilePath of filesToCheck) {
    const filePath = path.join(rootDir, relativeFilePath);
    
    if (!fs.existsSync(filePath)) {
      console.log(`文件不存在，跳过: ${filePath}`);
      continue;
    }
    
    console.log(`检查文件: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 删除--no-experimental-loader参数
    if (content.includes('--no-experimental-loader')) {
      console.log(`找到无效参数在: ${filePath}`);
      
      // 替换NODE_OPTIONS赋值
      content = content.replace(
        /NODE_OPTIONS\s*=\s*['"]([^'"]*?)--no-experimental-loader([^'"]*?)['"]/g,
        'NODE_OPTIONS = \'$1$2\''
      );
      
      // 清理多余空格
      content = content.replace(
        /NODE_OPTIONS\s*=\s*['"]\s+([^'"]*)['"]/g,
        'NODE_OPTIONS = \'$1\''
      );
      
      // 修复结尾空格
      content = content.replace(
        /NODE_OPTIONS\s*=\s*['"]([^'"]*?)\s+['"]/g,
        'NODE_OPTIONS = \'$1\''
      );
      
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`已修复文件: ${filePath}`);
      fixedCount++;
    } else {
      console.log(`文件无需修改: ${filePath}`);
    }
  }
  
  return fixedCount;
}

// 主函数
async function main() {
  console.log('开始修复NODE_OPTIONS参数问题...');
  
  // 修复NODE_OPTIONS参数
  const fixedCount = fixNodeOptions();
  
  console.log(`\n完成！已修复 ${fixedCount} 个文件`);
  console.log('\n请重新尝试启动应用:');
  console.log('npm run start_direct');
}

// 运行主函数
main().catch(error => {
  console.error('修复时出错:', error);
  process.exit(1);
}); 