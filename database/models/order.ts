import { DataTypes, Model } from 'sequelize';
import sequelize from '../../electron/services/database';
import Batch from './batch';

// 声明模型接口
export interface OrderAttributes {
  id: string;
  batchId: string;
  customerNo: string;
  customerSku: string;
  spu: string;
  size: string;
  quantity: number;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  zipCode?: string;
  isShipped: boolean;
  trackingNo?: string;
  shippedDate?: Date;
  telephone?: string;
  address01?: string;
  address02?: string;
  materialImage?: string;
  mockupImage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 使用类型交叉来确保模型实例包含所需属性
export interface OrderInstance extends Model, OrderAttributes {}

// 定义Order模型
const Order = sequelize.define<OrderInstance>('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Batches',
      key: 'id'
    }
  },
  customerNo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customerSku: {
    type: DataTypes.STRING,
    allowNull: true
  },
  spu: {
    type: DataTypes.STRING,
    allowNull: true
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address01: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address02: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  province: {
    type: DataTypes.STRING,
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true
  },
  zipCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  materialImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mockupImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isShipped: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  trackingNo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  shippedDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Orders'
});

// 定义关联关系
Order.belongsTo(Batch, { foreignKey: 'batchId' });
Batch.hasMany(Order, { foreignKey: 'batchId' });

export default Order; 