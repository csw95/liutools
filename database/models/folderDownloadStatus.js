"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../electron/services/database"));
const order_1 = __importDefault(require("./order"));
// 使用sequelize.define定义模型而不是类继承
const FolderDownloadStatus = database_1.default.define('FolderDownloadStatus', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    folderId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    orderId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'orders',
            key: 'id',
        },
    },
    originalUrl: {
        type: sequelize_1.DataTypes.STRING(1024),
        allowNull: false,
    },
    type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('processing', 'in_progress', 'completed', 'failed'),
        defaultValue: 'processing',
        allowNull: false,
    },
    startTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    completedTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    completedCount: {
        type: sequelize_1.DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    totalCount: {
        type: sequelize_1.DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    errorMessage: {
        type: sequelize_1.DataTypes.STRING(1024),
        allowNull: true,
    },
}, {
    tableName: 'folder_download_status',
    timestamps: true,
});
// 关联关系
FolderDownloadStatus.belongsTo(order_1.default, { foreignKey: 'orderId' });
exports.default = FolderDownloadStatus;
