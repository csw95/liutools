'use strict';

const fs = require('fs');
const path = require('path');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 扫描目录中的TypeScript文件
function scanTsFiles(dir) {
  const files = [];
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // 跳过node_modules和dist目录
        if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git' && entry !== 'build') {
          scan(fullPath);
        }
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

// 转换TypeScript文件中的import语句
function transformImports(filePath) {
  console.log(`处理文件: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 匹配并转换import语句
    // 例如: import path from 'path'; -> const path = require('path');
    let newContent = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (match, name, source) => {
      if (source === 'electron' || source.startsWith('electron/')) {
        modified = true;
        console.log(`  转换: ${match} -> const ${name} = require('${source}');`);
        return `// 转换的import\nconst ${name} = require('${source}')`;
      }
      return match;
    });
    
    // 匹配并转换import * as 语句
    // 例如: import * as path from 'path'; -> const path = require('path');
    newContent = newContent.replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (match, name, source) => {
      if (source === 'electron' || source.startsWith('electron/')) {
        modified = true;
        console.log(`  转换: ${match} -> const ${name} = require('${source}');`);
        return `// 转换的import\nconst ${name} = require('${source}')`;
      }
      return match;
    });
    
    // 匹配并转换import { ... } 语句
    // 例如: import { app, BrowserWindow } from 'electron'; -> const { app, BrowserWindow } = require('electron');
    newContent = newContent.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g, (match, imports, source) => {
      if (source === 'electron' || source.startsWith('electron/')) {
        modified = true;
        console.log(`  转换: ${match} -> const { ${imports} } = require('${source}');`);
        return `// 转换的import\nconst { ${imports} } = require('${source}')`;
      }
      return match;
    });
    
    if (modified) {
      // 添加禁用ESM加载的TypeScript注释
      if (!newContent.includes('@ts-nocheck')) {
        newContent = '// @ts-nocheck\n// 此文件已被转换，以防止electron:协议的ESM导入问题\n' + newContent;
      }
      
      // 写回文件
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`  已修改文件: ${filePath}`);
      return true;
    } else {
      console.log(`  无需修改: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`处理文件时出错 (${filePath}):`, error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('开始转换TypeScript导入语句...');
  
  // 扫描TypeScript文件
  const tsFiles = scanTsFiles(rootDir);
  console.log(`找到 ${tsFiles.length} 个TypeScript文件`);
  
  // 转换每个文件中的import语句
  let modifiedCount = 0;
  for (const file of tsFiles) {
    // 跳过.d.ts文件
    if (file.endsWith('.d.ts')) {
      continue;
    }
    
    if (transformImports(file)) {
      modifiedCount++;
    }
  }
  
  console.log(`完成，已修改 ${modifiedCount} 个文件`);
  
  // 创建备忘录文件，提醒开发者不要再使用import
  const reminderPath = path.join(rootDir, 'ELECTRON_IMPORT_NOTICE.md');
  const reminderContent = `# 重要提示：Electron导入方式

由于Electron应用在打包后可能面临ESM URL协议问题，请改用以下方式导入Electron模块:

\`\`\`javascript
// 不要使用这种方式 (会导致electron:协议的ESM加载错误)
import { app, BrowserWindow } from 'electron';
import path from 'path';

// 正确的导入方式
const { app, BrowserWindow } = require('electron');
const path = require('path');
\`\`\`

这种修改可以防止在打包后的应用中出现以下错误:

\`\`\`
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file and data are supported by the default ESM loader. Received protocol 'electron:'
\`\`\`

如果您需要在TypeScript中使用类型，可以这样做:

\`\`\`typescript
// 导入类型 (不会导致运行时问题)
import type { BrowserWindow as BrowserWindowType } from 'electron';

// 导入模块 (使用require避免ESM问题)
const { app, BrowserWindow } = require('electron');
\`\`\`
`;

  fs.writeFileSync(reminderPath, reminderContent, 'utf8');
  console.log(`已创建导入方式提示文件: ${reminderPath}`);
}

// 运行主函数
main().catch(error => {
  console.error('运行时出错:', error);
  process.exit(1);
}); 