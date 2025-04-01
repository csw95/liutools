import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../electron/services/database';
import Order from './order';
import Image from './image';

// 定义接口
interface FolderDownloadStatusAttributes {
  id: string;
  folderId: string;
  orderId: string;
  originalUrl: string;
  type: string;
  status: string;
  startTime: Date;
  completedTime?: Date;
  completedCount: number;
  totalCount: number;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 使用类型交叉来确保模型实例包含所需属性
export interface FolderDownloadStatusInstance extends Model, FolderDownloadStatusAttributes {}

// 使用sequelize.define定义模型而不是类继承
const FolderDownloadStatus = sequelize.define<FolderDownloadStatusInstance>('FolderDownloadStatus', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  folderId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id',
    },
  },
  originalUrl: {
    type: DataTypes.STRING(1024),
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('processing', 'in_progress', 'completed', 'failed'),
    defaultValue: 'processing',
    allowNull: false,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  completedTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  totalCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  errorMessage: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
}, {
  tableName: 'folder_download_status',
  timestamps: true,
});

// 关联关系
FolderDownloadStatus.belongsTo(Order, { foreignKey: 'orderId' });

export default FolderDownloadStatus;
