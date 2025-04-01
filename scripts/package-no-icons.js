'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取项目根目录
const rootDir = process.cwd();
console.log('项目根目录:', rootDir);

// 备份原始配置文件
function backupConfig() {
  const configPath = path.join(rootDir, 'electron-builder.yml');
  const backupPath = path.join(rootDir, 'electron-builder.yml.bak');
  
  if (fs.existsSync(configPath)) {
    console.log('备份原始electron-builder配置...');
    fs.copyFileSync(configPath, backupPath);
    return true;
  }
  
  return false;
}

// 修改配置文件，移除图标设置
function modifyConfig() {
  const configPath = path.join(rootDir, 'electron-builder.yml');
  
  if (fs.existsSync(configPath)) {
    console.log('修改electron-builder配置，移除图标设置...');
    let content = fs.readFileSync(configPath, 'utf8');
    
    // 移除Mac图标设置
    content = content.replace(/icon:\s*assets\/icon\.icns/g, '# icon: assets/icon.icns');
    
    // 移除Windows图标设置
    content = content.replace(/icon:\s*assets\/icon\.ico/g, '# icon: assets/icon.ico');
    
    fs.writeFileSync(configPath, content, 'utf8');
    return true;
  }
  
  return false;
}

// 还原配置文件
function restoreConfig() {
  const configPath = path.join(rootDir, 'electron-builder.yml');
  const backupPath = path.join(rootDir, 'electron-builder.yml.bak');
  
  if (fs.existsSync(backupPath)) {
    console.log('还原electron-builder配置...');
    fs.copyFileSync(backupPath, configPath);
    fs.unlinkSync(backupPath);
    return true;
  }
  
  return false;
}

// 执行打包命令
function runPackage(platform) {
  console.log(`开始打包应用，平台: ${platform || 'all'}...`);
  
  try {
    if (platform === 'mac') {
      execSync('electron-builder build --mac --publish never', { stdio: 'inherit' });
    } else if (platform === 'win') {
      execSync('electron-builder build --win --publish never', { stdio: 'inherit' });
    } else {
      execSync('electron-builder build --win --mac --publish never', { stdio: 'inherit' });
    }
    
    console.log('打包成功！');
    return true;
  } catch (error) {
    console.error('打包失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  const platform = args[0] || 'all'; // 默认打包所有平台
  
  console.log('开始无图标打包过程...');
  
  // 准备打包前置步骤
  try {
    execSync('npm run prepare-package', { stdio: 'inherit' });
  } catch (error) {
    console.error('准备打包步骤失败:', error.message);
    process.exit(1);
  }
  
  // 备份原始配置
  const hasBackup = backupConfig();
  
  try {
    // 修改配置
    modifyConfig();
    
    // 执行打包
    const success = runPackage(platform);
    
    if (success) {
      console.log('打包过程完成！应用已成功打包，没有图标设置。');
    } else {
      console.error('打包过程失败！');
    }
  } finally {
    // 还原配置
    if (hasBackup) {
      restoreConfig();
    }
  }
}

// 运行主函数
main().catch(error => {
  console.error('运行时出错:', error);
  process.exit(1);
}); 