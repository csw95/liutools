import { DataTypes, Model } from 'sequelize';
import sequelize from '../../electron/services/database';
import Order from './order';

// 声明模型接口
export interface ImageAttributes {
  id: string;
  orderId: string;
  originalUrl: string;
  localPath?: string;
  absolutePath?: string; // 添加绝对路径字段
  type: string;
  downloadStatus: string;
  downloadAttempts: number;
  lastAttemptAt?: Date;
  errorMessage?: string;
  sourceFolderId?: string; // 来源Google Drive文件夹ID
  createdAt?: Date;
  updatedAt?: Date;
}

// 使用类型交叉来确保模型实例包含所需属性
export interface ImageInstance extends Model, ImageAttributes {}

// 定义Image模型
const Image = sequelize.define<ImageInstance>('Image', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'id'
    }
  },
  originalUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  localPath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  absolutePath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '图片的完整绝对路径'
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  downloadStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending' // pending, downloading, completed, failed
  },
  downloadAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastAttemptAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sourceFolderId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '来源Google Drive文件夹ID'
  }
}, {
  tableName: 'Images'
});

// 定义关联关系
Image.belongsTo(Order, { foreignKey: 'orderId', as: 'Order' });
Order.hasMany(Image, { foreignKey: 'orderId', as: 'Images' });

export default Image; 