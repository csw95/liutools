// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
import { Sequelize } from 'sequelize';
import path from 'path';
// 转换的import
const { app  } = require('electron');

// 确定数据库路径
const dbPath = process.env.NODE_ENV === 'development' 
  ? path.join(__dirname, '../db.sqlite') // 开发环境使用项目根目录下的数据库
  : path.join(app ? app.getPath('userData') : __dirname, 'db.sqlite'); // 生产环境使用用户数据目录

// 创建连接实例
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

export default sequelize;
