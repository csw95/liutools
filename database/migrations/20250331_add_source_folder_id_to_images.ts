import { DataTypes } from 'sequelize';
import sequelize from '../../electron/services/database';

// 向Images表添加sourceFolderId字段的迁移文件
export async function up() {
  try {
    // 首先检查字段是否已存在
    try {
      // 尝试查询该字段
      await sequelize.query("SELECT sourceFolderId FROM Images LIMIT 1");
      console.log('sourceFolderId字段已存在，跳过添加');
      return true;
    } catch (error) {
      // 字段不存在，继续添加
      console.log('sourceFolderId字段不存在，继续添加');
    }
    
    // 检查是否存在备份表，如果存在则删除
    try {
      await sequelize.query("SELECT 1 FROM Images_backup LIMIT 1");
      console.log('发现备份表 Images_backup，将先删除');
      await sequelize.query("DROP TABLE Images_backup");
      console.log('已删除备份表 Images_backup');
    } catch (error) {
      // 备份表不存在，可以安全添加
      console.log('没有发现备份表，可以安全执行');
    }
    
    await sequelize.getQueryInterface().addColumn('Images', 'sourceFolderId', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '来源Google Drive文件夹ID'
    });
    console.log('成功添加sourceFolderId字段到Images表');
    return true;
  } catch (error) {
    console.error('添加sourceFolderId字段失败:', error);
    return false;
  }
}

// 回滚操作，移除sourceFolderId字段
export async function down() {
  try {
    // 首先检查字段是否存在
    try {
      // 尝试查询该字段
      await sequelize.query("SELECT sourceFolderId FROM Images LIMIT 1");
      // 字段存在，可以删除
    } catch (error) {
      // 字段不存在，无需删除
      console.log('sourceFolderId字段不存在，无需移除');
      return true;
    }
    
    // 检查是否存在备份表，如果存在则删除
    try {
      await sequelize.query("SELECT 1 FROM Images_backup LIMIT 1");
      console.log('发现备份表 Images_backup，将先删除');
      await sequelize.query("DROP TABLE Images_backup");
      console.log('已删除备份表 Images_backup');
    } catch (error) {
      // 备份表不存在，可以安全移除
      console.log('没有发现备份表，可以安全执行');
    }
    
    await sequelize.getQueryInterface().removeColumn('Images', 'sourceFolderId');
    console.log('成功移除sourceFolderId字段');
    return true;
  } catch (error) {
    console.error('移除sourceFolderId字段失败:', error);
    return false;
  }
} 