import { Sequelize } from 'sequelize';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// 确保数据库目录存在
const getUserDataPath = () => {
  try {
    return app.getPath('userData');
  } catch (error) {
    // 回退方案：如果app.getPath失败
    console.error('无法获取app.getPath(userData)，使用回退路径', error);
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    if (process.platform === 'darwin') {
      return path.join(userHome, 'Library', 'Application Support', 'poderp');
    } else if (process.platform === 'win32') {
      return path.join(userHome, 'AppData', 'Roaming', 'poderp');
    } else {
      return path.join(userHome, '.config', 'poderp');
    }
  }
};

const dbDir = path.join(getUserDataPath(), 'database');
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`创建数据库目录: ${dbDir}`);
  }
} catch (error) {
  console.error(`创建数据库目录失败: ${dbDir}`, error);
}

// 初始化SQLite数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(dbDir, 'poderp.sqlite'),
  logging: false
});

// 测试数据库连接
export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 尝试同步模型，但为了安全起见，捕获可能的错误
    try {
      // 如果设置了环境变量，跳过数据库同步
      if (process.env.SKIP_DB_MIGRATIONS === 'true') {
        console.log('跳过数据库模型同步');
        return true;
      }
      
      // 同步所有模型，使用 alter 选项保留数据的同时更新结构
      await sequelize.sync({ alter: true });
      console.log('数据库模型同步完成');
    } catch (syncError) {
      console.error('数据库模型同步失败，但将继续运行:', syncError);
      // 即使同步失败，也返回true以便应用程序继续运行
    }
    
    return true;
  } catch (error) {
    console.error('无法连接到数据库:', error);
    // 返回false表示数据库初始化失败，但应用可能仍然会继续运行
    return false;
  }
};

export default sequelize; 