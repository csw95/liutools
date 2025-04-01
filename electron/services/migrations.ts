// @ts-nocheck
import { initDatabase } from './database';
import * as AddSourceFolderIdToImages from '../../database/migrations/20250331_add_source_folder_id_to_images';

// 定义迁移接口
interface Migration {
  up: () => Promise<boolean>;
  down: () => Promise<boolean>;
}

// 定义迁移映射对象，便于后续扩展
const migrations: Record<string, Migration> = {
  'add_source_folder_id_to_images': AddSourceFolderIdToImages
};

// 执行所有迁移
export const runMigrations = async () => {
  console.log('开始执行数据库迁移...');
  
  try {
    // 初始化数据库连接
    const dbInitialized = await initDatabase();
    if (!dbInitialized) {
      console.error('数据库初始化失败，无法执行迁移');
      return false;
    }
    
    // 执行所有迁移的up方法
    for (const [name, migration] of Object.entries(migrations)) {
      try {
        console.log(`执行迁移: ${name}`);
        const result = await migration.up();
        if (result) {
          console.log(`迁移 ${name} 成功`);
        } else {
          console.error(`迁移 ${name} 失败，但继续执行其他迁移`);
        }
      } catch (error) {
        console.error(`迁移 ${name} 出错，跳过此迁移:`, error);
        // 继续执行其他迁移
      }
    }
    
    console.log('所有迁移执行完成');
    return true;
  } catch (error) {
    console.error('迁移过程中发生严重错误，中止所有迁移:', error);
    return false;
  }
};

// 回滚特定迁移
export const rollbackMigration = async (name: string) => {
  if (!migrations[name]) {
    console.error(`未找到迁移: ${name}`);
    return false;
  }
  
  try {
    console.log(`回滚迁移: ${name}`);
    const result = await migrations[name].down();
    if (result) {
      console.log(`迁移 ${name} 已回滚`);
      return true;
    } else {
      console.error(`迁移 ${name} 回滚失败`);
      return false;
    }
  } catch (error) {
    console.error(`迁移 ${name} 回滚出错:`, error);
    return false;
  }
}; 