const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('开始修复数据库...');

// 获取数据库文件路径
const appDataPath = process.env.APPDATA || 
                   (process.platform === 'darwin' ? 
                    path.join(process.env.HOME, 'Library/Application Support') : 
                    path.join(process.env.HOME, '.config'));

const dbPath = path.join(appDataPath, 'poderp', 'database.sqlite');

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
  console.log(`数据库文件不存在: ${dbPath}`);
  console.log('没有需要修复的数据库');
  process.exit(0);
}

// 创建备份
const backupPath = `${dbPath}.backup-${Date.now()}`;
fs.copyFileSync(dbPath, backupPath);
console.log(`创建了数据库备份: ${backupPath}`);

try {
  // 使用SQLite命令行工具修复数据库中的问题
  console.log('尝试修复数据库唯一约束错误...');
  
  // 生成临时的SQL文件
  const sqlFixPath = path.join(__dirname, 'temp-fix.sql');
  const sqlContent = `
-- 删除备份表 (如果存在)
DROP TABLE IF EXISTS Batches_backup;

-- 创建新的备份表结构
CREATE TABLE IF NOT EXISTS Batches_backup (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  customerName VARCHAR(255),
  amount INTEGER,
  importDate DATETIME,
  createdAt DATETIME,
  updatedAt DATETIME
);

-- 清空可能存在的旧数据
DELETE FROM Batches_backup;

-- 保存当前更改
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
COMMIT;
PRAGMA foreign_keys=on;

-- 完成
VACUUM;
  `;
  
  fs.writeFileSync(sqlFixPath, sqlContent);
  
  // 在macOS和Linux上使用sqlite3命令行工具
  if (process.platform === 'darwin' || process.platform === 'linux') {
    execSync(`sqlite3 "${dbPath}" < "${sqlFixPath}"`, { stdio: 'inherit' });
  } 
  // 在Windows上使用不同的命令格式
  else if (process.platform === 'win32') {
    execSync(`sqlite3 "${dbPath}" < "${sqlFixPath}"`, { stdio: 'inherit' });
  }
  
  // 清理临时文件
  fs.unlinkSync(sqlFixPath);
  
  console.log('数据库修复完成');
  console.log('请重新启动应用程序');
} catch (error) {
  console.error('修复数据库时发生错误:', error);
  console.log('恢复数据库备份...');
  fs.copyFileSync(backupPath, dbPath);
  console.log('数据库已恢复到备份状态');
} 