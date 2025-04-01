"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../electron/services/database"));
const order_1 = __importDefault(require("./order"));
// 定义Image模型
const Image = database_1.default.define('Image', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    orderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Orders',
            key: 'id'
        }
    },
    originalUrl: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    localPath: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    absolutePath: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        comment: '图片的完整绝对路径'
    },
    type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    downloadStatus: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending' // pending, downloading, completed, failed
    },
    downloadAttempts: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    lastAttemptAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    errorMessage: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    sourceFolderId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        comment: '来源Google Drive文件夹ID'
    }
}, {
    tableName: 'Images'
});
// 定义关联关系
Image.belongsTo(order_1.default, { foreignKey: 'orderId', as: 'Order' });
order_1.default.hasMany(Image, { foreignKey: 'orderId', as: 'Images' });
exports.default = Image;
