// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
import ElectronStore from 'electron-store';
import fs from 'fs';
import path from 'path';
// 转换的import
const { app  } = require('electron');
import { GoogleAuth } from './data';

// 定义配置类型
interface ConfigType {
  downloadPath: string;
  maxConcurrentDownloads: number;
  downloadTimeout: number;
  maxRetryAttempts: number;
  enableAutomaticDownload: boolean;
  exportPath: string;
  configured: boolean;
  googleDriveConfigured: boolean;
  [key: string]: any;
}

// 类型扩展，确保ElectronStore有需要的方法
interface TypedStore extends ElectronStore {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
}

// 配置存储
const configStore = new ElectronStore({
  name: 'app-config',
  encryptionKey: 'poderp-config-key'
}) as TypedStore;

// 默认配置
const DEFAULT_CONFIG: ConfigType = {
  // 下载设置
  downloadPath: path.join(app.getPath('userData'), 'downloads'),
  maxConcurrentDownloads: 3,
  downloadTimeout: 30, // 分钟
  maxRetryAttempts: 3,
  enableAutomaticDownload: true,
  
  // 导出设置
  exportPath: path.join(app.getPath('userData'), 'exports'),
  
  // 系统设置
  configured: false,
  googleDriveConfigured: false
};

// 初始化配置
export const initConfig = () => {
  try {
    // 检查是否已初始化
    if (!configStore.has('configured')) {
      console.log('初始化系统配置...');
      // 设置默认配置
      Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
        configStore.set(key, value);
      });
    }
    
    // 确保下载目录存在
    const downloadPath = getConfig('downloadPath');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    // 确保导出目录存在
    const exportPath = getConfig('exportPath');
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    return true;
  } catch (error) {
    console.error('初始化配置失败:', error);
    return false;
  }
};

// 获取配置项
export const getConfig = (key: string) => {
  return configStore.get(key, DEFAULT_CONFIG[key as keyof ConfigType]);
};

// 设置配置项
export const setConfig = (key: string, value: any) => {
  configStore.set(key, value);
  return true;
};

// 保存整个配置对象
export const saveConfig = (config: Partial<ConfigType>) => {
  try {
    // 保存所有提供的配置项
    Object.entries(config).forEach(([key, value]) => {
      configStore.set(key, value);
    });
    
    // 始终标记为已配置，无论config参数中是否包含此字段
    configStore.set('configured', true);
    
    console.log('配置已保存，系统已标记为已配置状态');
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
};

// 检查必要配置
export const checkRequiredConfig = () => {
  const issues: string[] = [];
  
  // 检查是否已配置
  if (!configStore.get('configured', false)) {
    issues.push('系统尚未完成初始配置');
  }
  
  // 检查Google Drive授权 - 仅当enableAutomaticDownload为true时检查
  const enableAutomaticDownload = configStore.get('enableAutomaticDownload', true);
  if (enableAutomaticDownload && !configStore.get('googleDriveConfigured', false)) {
    issues.push('Google Drive尚未授权，无法下载Google Drive图片');
  }
  
  // 检查下载路径
  const downloadPath = configStore.get('downloadPath', '');
  if (enableAutomaticDownload && (!downloadPath || !fs.existsSync(downloadPath))) {
    issues.push('下载路径不存在或未配置');
  }
  
  return {
    isConfigured: issues.length === 0,
    issues
  };
};

// 标记Google Drive已授权
export const markGoogleDriveConfigured = async () => {
  try {
    // 设置本地配置状态
    configStore.set('googleDriveConfigured', true);
    
    // 检查数据库中是否已经有授权记录
    const authRecord = await GoogleAuth.findOne();
    
    // 如果没有授权记录或授权记录不完整，返回false
    if (!authRecord || !authRecord.access_token || !authRecord.refresh_token) {
      console.error('标记Google Drive已配置失败：数据库中没有有效的授权记录');
      return false;
    }
    
    console.log('已成功标记Google Drive已配置');
    return true;
  } catch (error) {
    console.error('标记Google Drive已配置时出错:', error);
    return false;
  }
};

// 重置配置
export const resetConfig = () => {
  try {
    console.log('重置系统配置...');
    
    // 重置为默认配置
    Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
      configStore.set(key, value);
    });
    
    // 确保下载目录存在
    const downloadPath = getConfig('downloadPath');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    // 确保导出目录存在
    const exportPath = getConfig('exportPath');
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    return { success: true, message: '配置已重置为默认值' };
  } catch (error) {
    console.error('重置配置失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '重置配置失败' 
    };
  }
}; 