"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../electron/services/database"));
// 定义GoogleAuth模型
const GoogleAuth = database_1.default.define('GoogleAuth', {
    id: {
        type: sequelize_1.DataTypes.STRING,
        primaryKey: true,
        defaultValue: 'default' // 只使用一个授权记录
    },
    access_token: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    refresh_token: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    token_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Bearer'
    },
    expires_in: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    issued_at: {
        type: sequelize_1.DataTypes.BIGINT,
        allowNull: false
    },
    cookies: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: '序列化的cookies'
    },
    is_configured: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    last_updated: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    tableName: 'google_auth',
    timestamps: true
});
exports.default = GoogleAuth;
