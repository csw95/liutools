'use strict';
import { QueryInterface, DataTypes as SequelizeDataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface, DataTypes: typeof SequelizeDataTypes) {
    try {
      // 检查字段是否已存在
      const tableInfo = await queryInterface.describeTable('Images');
      if (!tableInfo.absolutePath) {
        // 字段不存在，添加它
        await queryInterface.addColumn('Images', 'absolutePath', {
          type: DataTypes.STRING,
          allowNull: true,
          comment: '图片的完整绝对路径'
        });
        console.log('成功添加 absolutePath 字段到 Images 表');
      } else {
        console.log('Images 表中已存在 absolutePath 字段，跳过添加');
      }
    } catch (error) {
      console.error('执行迁移时出错:', error);
      // 如果表不存在，这里会抛出错误，我们可以忽略它
      console.log('表可能不存在或者有其他问题，跳过迁移');
    }
  },

  async down(queryInterface: QueryInterface) {
    try {
      const tableInfo = await queryInterface.describeTable('Images');
      if (tableInfo.absolutePath) {
        await queryInterface.removeColumn('Images', 'absolutePath');
        console.log('成功移除 absolutePath 字段');
      }
    } catch (error) {
      console.error('回滚迁移时出错:', error);
    }
  }
}; 