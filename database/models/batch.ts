import { DataTypes, Model } from 'sequelize';
import sequelize from '../../electron/services/database';

// 声明模型接口
export interface BatchAttributes {
  id: string;
  name: string;
  customerName: string;
  amount: number;
  importDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// 使用类型交叉来确保模型实例包含所需属性
export interface BatchInstance extends Model, BatchAttributes {}

// 定义Batch模型
const Batch = sequelize.define<BatchInstance>('Batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  importDate: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Batches'
});

export default Batch; 