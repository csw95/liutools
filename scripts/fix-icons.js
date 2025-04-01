'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 检查assets目录是否存在
function checkAssetsDirectory() {
  const assetsDir = path.join(rootDir, 'assets');
  
  if (!fs.existsSync(assetsDir)) {
    console.log('创建assets目录...');
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  return assetsDir;
}

// 检查并创建默认图标
function checkAndCreateIcons(assetsDir) {
  const macIconPath = path.join(assetsDir, 'icon.icns');
  const winIconPath = path.join(assetsDir, 'icon.ico');
  
  // 检查Mac图标
  if (!fs.existsSync(macIconPath)) {
    console.log('Mac图标不存在，正在创建默认图标...');
    try {
      // 使用npm模块查找默认Electron图标位置
      const electronPath = require.resolve('electron');
      const electronDir = path.dirname(electronPath);
      const defaultIconPath = path.join(electronDir, '..', 'dist', 'electron.icns');
      
      if (fs.existsSync(defaultIconPath)) {
        // 复制默认图标
        fs.copyFileSync(defaultIconPath, macIconPath);
        console.log(`已创建默认Mac图标: ${macIconPath}`);
      } else {
        console.log('找不到默认的Electron图标，将尝试下载一个基本图标');
        // 这里可以添加代码来下载一个基本图标
      }
    } catch (error) {
      console.error('创建Mac图标出错:', error);
    }
  } else {
    console.log(`Mac图标已存在: ${macIconPath}`);
  }
  
  // 检查Windows图标
  if (!fs.existsSync(winIconPath)) {
    console.log('Windows图标不存在，正在创建默认图标...');
    try {
      // 使用npm模块查找默认Electron图标位置
      const electronPath = require.resolve('electron');
      const electronDir = path.dirname(electronPath);
      const defaultIconPath = path.join(electronDir, '..', 'dist', 'electron.ico');
      
      if (fs.existsSync(defaultIconPath)) {
        // 复制默认图标
        fs.copyFileSync(defaultIconPath, winIconPath);
        console.log(`已创建默认Windows图标: ${winIconPath}`);
      } else {
        console.log('找不到默认的Electron图标，将尝试下载一个基本图标');
        // 这里可以添加代码来下载一个基本图标
      }
    } catch (error) {
      console.error('创建Windows图标出错:', error);
    }
  } else {
    console.log(`Windows图标已存在: ${winIconPath}`);
  }
}

// 清除打包的临时文件
function cleanBuildFiles() {
  const tempDirs = [
    path.join(rootDir, 'release'),
    path.join(rootDir, 'dist')
  ];
  
  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      console.log(`清理目录: ${dir}`);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`已清理: ${dir}`);
      } catch (error) {
        console.error(`清理目录时出错 (${dir}):`, error);
      }
    }
  }
}

// 主函数
async function main() {
  console.log('开始修复应用图标...');
  
  // 检查assets目录
  const assetsDir = checkAssetsDirectory();
  
  // 检查并创建图标
  checkAndCreateIcons(assetsDir);
  
  // 询问是否清理构建文件
  console.log('\n是否要清理打包临时文件？(yes/no)');
  process.stdin.once('data', (data) => {
    const answer = data.toString().trim().toLowerCase();
    
    if (answer === 'yes' || answer === 'y') {
      cleanBuildFiles();
      console.log('\n清理完成！');
    } else {
      console.log('\n跳过清理步骤');
    }
    
    console.log('\n修复完成！请重新尝试打包应用:');
    console.log('npm run package:mac');
    
    process.exit(0);
  });
}

// 运行主函数
main().catch(error => {
  console.error('运行时出错:', error);
  process.exit(1);
}); 