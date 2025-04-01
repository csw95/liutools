// @ts-nocheck
/**
 * 系统配置
 */
// 转换import为require以避免ESM加载问题
const path = require('path');
const { app } = require('electron');

const config = {
  // 下载设置
  downloadPath: path.join(app.getPath('userData'), 'downloads'),
  maxConcurrentDownloads: 3,
  downloadTimeout: 30 * 60 * 1000, // 30分钟
  maxRetryAttempts: 3,
  
  // Google Drive设置
  googleDriveEnabled: true,
};

// 使用module.exports而不是export default
module.exports = config; 