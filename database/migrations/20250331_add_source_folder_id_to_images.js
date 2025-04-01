"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../electron/services/database"));
// 向Images表添加sourceFolderId字段的迁移文件
async function up() {
    try {
        // 首先检查字段是否已存在
        try {
            // 尝试查询该字段
            await database_1.default.query("SELECT sourceFolderId FROM Images LIMIT 1");
            console.log('sourceFolderId字段已存在，跳过添加');
            return true;
        }
        catch (error) {
            // 字段不存在，继续添加
            console.log('sourceFolderId字段不存在，继续添加');
        }
        // 检查是否存在备份表，如果存在则删除
        try {
            await database_1.default.query("SELECT 1 FROM Images_backup LIMIT 1");
            console.log('发现备份表 Images_backup，将先删除');
            await database_1.default.query("DROP TABLE Images_backup");
            console.log('已删除备份表 Images_backup');
        }
        catch (error) {
            // 备份表不存在，可以安全添加
            console.log('没有发现备份表，可以安全执行');
        }
        await database_1.default.getQueryInterface().addColumn('Images', 'sourceFolderId', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            comment: '来源Google Drive文件夹ID'
        });
        console.log('成功添加sourceFolderId字段到Images表');
        return true;
    }
    catch (error) {
        console.error('添加sourceFolderId字段失败:', error);
        return false;
    }
}
// 回滚操作，移除sourceFolderId字段
async function down() {
    try {
        // 首先检查字段是否存在
        try {
            // 尝试查询该字段
            await database_1.default.query("SELECT sourceFolderId FROM Images LIMIT 1");
            // 字段存在，可以删除
        }
        catch (error) {
            // 字段不存在，无需删除
            console.log('sourceFolderId字段不存在，无需移除');
            return true;
        }
        // 检查是否存在备份表，如果存在则删除
        try {
            await database_1.default.query("SELECT 1 FROM Images_backup LIMIT 1");
            console.log('发现备份表 Images_backup，将先删除');
            await database_1.default.query("DROP TABLE Images_backup");
            console.log('已删除备份表 Images_backup');
        }
        catch (error) {
            // 备份表不存在，可以安全移除
            console.log('没有发现备份表，可以安全执行');
        }
        await database_1.default.getQueryInterface().removeColumn('Images', 'sourceFolderId');
        console.log('成功移除sourceFolderId字段');
        return true;
    }
    catch (error) {
        console.error('移除sourceFolderId字段失败:', error);
        return false;
    }
}
