import { DataTypes, Model } from 'sequelize';
import sequelize from '../../electron/services/database';

// Google授权信息接口
interface GoogleAuthAttributes {
  id: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  issued_at: number;
  cookies: string;  // 序列化的cookies
  is_configured: boolean;
  last_updated: Date;
}

// 模型实例接口
export interface GoogleAuthInstance extends Model, GoogleAuthAttributes {}

// 定义GoogleAuth模型
const GoogleAuth = sequelize.define<GoogleAuthInstance>('GoogleAuth', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: 'default' // 只使用一个授权记录
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  token_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Bearer'
  },
  expires_in: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  issued_at: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  cookies: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '序列化的cookies'
  },
  is_configured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'google_auth',
  timestamps: true
});

export default GoogleAuth; 