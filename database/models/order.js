"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../electron/services/database"));
const batch_1 = __importDefault(require("./batch"));
// 定义Order模型
const Order = database_1.default.define('Order', {
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    batchId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Batches',
            key: 'id'
        }
    },
    customerNo: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    customerSku: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    spu: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    size: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    quantity: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    address01: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    address02: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    province: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    country: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    zipCode: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    telephone: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    materialImage: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    mockupImage: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    isShipped: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    trackingNo: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    shippedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'Orders'
});
// 定义关联关系
Order.belongsTo(batch_1.default, { foreignKey: 'batchId' });
batch_1.default.hasMany(Order, { foreignKey: 'batchId' });
exports.default = Order;
