"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
// 确定数据库路径
const dbPath = process.env.NODE_ENV === 'development'
    ? path_1.default.join(__dirname, '../db.sqlite') // 开发环境使用项目根目录下的数据库
    : path_1.default.join(electron_1.app ? electron_1.app.getPath('userData') : __dirname, 'db.sqlite'); // 生产环境使用用户数据目录
// 创建连接实例
const sequelize = new sequelize_1.Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
});
exports.default = sequelize;
