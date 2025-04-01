/**
 * 系统配置
 */
import path from 'path';
import { app } from 'electron';

const config = {
  // 下载设置
  downloadPath: path.join(app.getPath('userData'), 'downloads'),
  maxConcurrentDownloads: 3,
  downloadTimeout: 30 * 60 * 1000, // 30分钟
  maxRetryAttempts: 3,
  
  // Google Drive设置
  googleDriveEnabled: true,
};

export default config; 