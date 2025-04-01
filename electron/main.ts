// @ts-nocheck
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { initDatabase } = require('./services/database');
const { runMigrations } = require('./services/migrations');
const { importOrders } = require('./services/import');
const { 
  downloadImages, 
  retryDownloadImage, 
  getDownloadStats, 
  getFailedDownloads,
  getSuccessfulDownloads,
  getAutoRetryQueueInfo,
  getImageDownloadLog
} = require('./services/download');
const { exportOrders, exportBatchImages } = require('./services/export');
const fs = require('fs');
const { createTemplateFile } = require('./services/template');
const { authorizeGoogleDrive } = require('./services/google-auth');
const {
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  markOrderAsShipped,
  FolderDownloadStatus
} = require('./services/data');
const { initConfig, checkRequiredConfig, getConfig, setConfig, saveConfig, markGoogleDriveConfigured, resetConfig } = require('./services/config');
const { 
  getFolderDownloadStatusList, 
  getFolderDetail, 
  retryFailedImagesInFolder,
  processGoogleDriveFolder
} = require('./services/google-drive');
const { Model, Sequelize } = require('sequelize');

// 在应用开始时就禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';

let mainWindow: typeof BrowserWindow | null = null;

// 创建主窗口
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, 'preload.js'),
      devTools: isDev,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  // 设置 CSP 头
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file:;"
        ]
      }
    });
  });

  // 加载前端页面
  const indexPath = isDev 
    ? path.resolve(process.cwd(), 'build', 'index.html')
    : path.resolve(__dirname, '../../build/index.html');

  console.log(`尝试加载前端页面: ${indexPath}`);
  console.log(`文件是否存在: ${fs.existsSync(indexPath)}`);
    
  const startUrl = `file://${indexPath}`;
  console.log(`完整URL: ${startUrl}`);
    
  mainWindow.loadURL(startUrl);

  // 开发模式下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  return startUrl;
};

// 初始化数据库表
const initDatabaseTables = async () => {
  try {
    await FolderDownloadStatus.sync({ force: false });
    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库表初始化失败:', error);
  }
};

// 应用准备就绪时创建窗口
app.whenReady().then(async () => {
  try {
    // 先初始化数据库
    await initDatabaseTables();
    
    // 检查是否需要跳过数据库迁移
    const skipMigrations = process.env.SKIP_DB_MIGRATIONS === 'true';
    
    // 尝试初始化数据库并执行迁移，但如果失败也继续启动应用
    if (!skipMigrations) {
      try {
        await initDatabaseTables();
        await runMigrations();
      } catch (error) {
        console.error('数据库初始化或迁移失败:', error);
        console.log('继续启动应用...');
      }
    } else {
      console.log('已跳过数据库迁移');
    }
    
    // 初始化配置
    initConfig();
    
    // 确保下载目录存在
    const downloadPath = getConfig('downloadPath');
    console.log(`当前配置的下载路径: ${downloadPath}`);
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
      try {
        fs.mkdirSync(downloadPath, { recursive: true });
        console.log(`创建下载目录成功: ${downloadPath}`);
      } catch (error) {
        console.error(`创建下载目录失败 (${downloadPath}):`, error);
      }
    } else {
      console.log(`下载目录已存在: ${downloadPath}`);
    }
    
    // 检查配置
    const configCheck = checkRequiredConfig();
    
    const startUrl = createWindow();
    
    // 如果配置有问题并且主窗口创建成功，显示配置警告
    if (!configCheck.isConfigured && mainWindow) {
      const options = {
        type: 'warning' as const,
        title: '配置检查',
        message: '系统配置不完整',
        detail: `检测到以下配置问题:\n${configCheck.issues.join('\n')}\n\n请先完成相关配置再使用图片下载功能。`,
        buttons: ['现在配置', '稍后配置'],
        defaultId: 0
      };
      
      // 显示警告对话框
      dialog.showMessageBox(mainWindow, options).then(response => {
        if (response.response === 0) {
          // 导航到设置页面
          mainWindow?.loadURL(`${startUrl}#/settings`);
        }
      });
    }
  } catch (error) {
    console.error('应用初始化失败:', error);
    
    // 即使初始化失败，也尝试创建窗口
    try {
      createWindow();
    } catch (windowError) {
      console.error('创建窗口失败:', windowError);
      app.quit();
    }
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 处理窗口关闭事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 消息处理
// 订单导入
ipcMain.handle('import-orders', async (event, data) => {
  try {
    const importModule = require('./services/import');
    return await importModule.importOrders(data.customerName, data.amount, data.filePath);
  } catch (error) {
    console.error('导入订单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '导入过程发生未知错误'
    };
  }
});

// 选择Excel文件
ipcMain.handle('select-excel-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    return {
      canceled,
      filePath: canceled ? null : filePaths[0]
    };
  } catch (error) {
    console.error('选择文件失败:', error);
    return { 
      canceled: true, 
      error: error instanceof Error ? error.message : '选择文件失败'
    };
  }
});

// 导出订单
ipcMain.handle('export-orders', async (event, { batchId, orderIds }) => {
  try {
    const result = await exportOrders(batchId, orderIds);
    
    if (result.success && result.filePath) {
      // 打开导出的文件所在目录
      shell.showItemInFolder(result.filePath);
    }
    
    return result;
  } catch (error) {
    console.error('导出订单失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '导出过程出错' 
    };
  }
});

// 导出Excel表格
ipcMain.handle('export-excel', async (event, batchId, template, excludeShipped) => {
  try {
    console.log(`导出Excel，批次ID: ${batchId}, 模板: ${template}, 排除已发货: ${excludeShipped}`);
    
    // 使用exportOrders函数，但只传递batchId参数
    const result = await exportOrders(batchId);
    
    if (result.success && result.filePath) {
      // 打开导出的文件所在目录
      shell.showItemInFolder(result.filePath);
    }
    
    return result;
  } catch (error) {
    console.error('导出Excel失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '导出过程出错' 
    };
  }
});

// 下载模板
ipcMain.handle('download-template', async () => {
  try {
    // 检查模板路径
    const templatePath = isDev
      ? path.join(process.cwd(), 'public', 'template.xlsx')
      : path.join(process['resourcesPath'] as string, 'template.xlsx');
      
    // 如果模板不存在，创建一个
    if (!fs.existsSync(templatePath)) {
      console.log('模板文件不存在，创建新模板');
      const result = await createTemplateFile();
      if (!result.success) {
        throw new Error(result.error || '无法创建模板文件');
      }
    }
    
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'PODERP订单导入模板.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }
    
    fs.copyFileSync(templatePath, filePath);
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
  } catch (error) {
    console.error('模板下载失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
});

// 下载相关
ipcMain.handle('download-images-by-batch', async (event, batchId) => {
  return await downloadImages(batchId);
});

ipcMain.handle('retry-download-image', async (event, imageId) => {
  return await retryDownloadImage(imageId);
});

ipcMain.handle('get-download-stats', async () => {
  return await getDownloadStats();
});

ipcMain.handle('get-failed-downloads', async (event, limit, offset) => {
  return await getFailedDownloads(limit, offset);
});

ipcMain.handle('get-successful-downloads', async (event, limit, offset) => {
  return await getSuccessfulDownloads(limit, offset);
});

ipcMain.handle('get-auto-retry-queue', async () => {
  return await getAutoRetryQueueInfo();
});

ipcMain.handle('get-image-download-log', async (event, imageId) => {
  return await getImageDownloadLog(imageId);
});

// 文件夹下载状态相关API
ipcMain.handle('get-folder-download-status', async (event, limit, offset) => {
  try {
    const result = await getFolderDownloadStatusList(limit, offset);
    return result;
  } catch (error) {
    console.error('获取文件夹下载状态列表失败:', error);
    return { success: false, total: 0, items: [], error: error instanceof Error ? error.message : '未知错误' };
  }
});

ipcMain.handle('get-folder-download-detail', async (event, folderId, orderId) => {
  try {
    const result = await getFolderDetail(folderId, orderId);
    return result;
  } catch (error) {
    console.error('获取文件夹下载详情失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
});

ipcMain.handle('retry-folder-images', async (event, folderId, orderId) => {
  try {
    const result = await retryFailedImagesInFolder(folderId, orderId);
    return result;
  } catch (error) {
    console.error('重试文件夹图片失败:', error);
    return { success: false, retryCount: 0, error: error instanceof Error ? error.message : '未知错误' };
  }
});

ipcMain.handle('process-google-drive-folder', async (event, orderId, url, type) => {
  try {
    // 先检查是否存在授权错误
    const result = await processGoogleDriveFolder(orderId, url, type);
    return result;
  } catch (error) {
    // 打印详细的错误信息到日志
    console.error('处理Google Drive文件夹失败:', error);
    
    // 返回更友好的错误信息给前端
    let errorMessage = '未知错误';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // 检查特定错误类型并提供更明确的操作建议
      if (errorMessage.includes('授权失败') || errorMessage.includes('401')) {
        errorMessage = '授权失败，请先在设置中授权Google Drive，然后再尝试。';
      } else if (errorMessage.includes('找不到指定的文件夹') || errorMessage.includes('404')) {
        errorMessage = '找不到指定的文件夹，请检查链接是否正确。';
      } else if (errorMessage.includes('没有权限访问') || errorMessage.includes('403')) {
        errorMessage = '没有权限访问此文件夹，请确认文件夹已公开共享或您有访问权限。';
      }
    }
    
    return { success: false, error: errorMessage };
  }
});

// 授权 Google Drive
ipcMain.handle('authorize-google-drive', async () => {
  try {
    console.log('开始 Google Drive 授权流程...');
    const result = await authorizeGoogleDrive();
    
    if (result.success) {
      console.log('Google Drive 授权成功，标记为已配置');
      // 标记为已配置
      const marked = await markGoogleDriveConfigured();
      if (!marked) {
        console.error('标记Google Drive配置时出错');
        return { success: false, error: '标记Google Drive配置时出错，可能数据库中没有保存令牌' };
      }
    } else {
      console.error('Google Drive 授权失败', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Google Drive 授权过程中出现错误', error);
    return { success: false, error: `授权失败: ${error instanceof Error ? error.message : String(error)}` };
  }
});

// 批次相关 API
ipcMain.handle('get-batches', async () => {
  return await getBatches();
});

ipcMain.handle('get-batch-by-id', async (event, id) => {
  return await getBatchById(id);
});

ipcMain.handle('update-batch', async (event, batch) => {
  return await updateBatch(batch);
});

ipcMain.handle('delete-batch', async (event, id) => {
  return await deleteBatch(id);
});

// 订单相关 API
ipcMain.handle('get-orders', async (event, batchId) => {
  return await getOrders(batchId);
});

ipcMain.handle('get-order-by-id', async (event, id) => {
  return await getOrderById(id);
});

ipcMain.handle('update-order', async (event, order) => {
  return await updateOrder(order);
});

ipcMain.handle('delete-order', async (event, id) => {
  return await deleteOrder(id);
});

ipcMain.handle('mark-order-as-shipped', async (event, id, trackingNo) => {
  return await markOrderAsShipped(id, trackingNo);
});

// 系统配置API
ipcMain.handle('get-app-config', async () => {
  try {
    // 获取所有配置
    const config = {
      downloadPath: getConfig('downloadPath'),
      maxConcurrentDownloads: getConfig('maxConcurrentDownloads'),
      downloadTimeout: getConfig('downloadTimeout'),
      maxRetryAttempts: getConfig('maxRetryAttempts'),
      enableAutomaticDownload: getConfig('enableAutomaticDownload'),
      exportPath: getConfig('exportPath'),
      configured: getConfig('configured'),
      googleDriveConfigured: getConfig('googleDriveConfigured')
    };
    
    // 检查配置
    const configCheck = checkRequiredConfig();
    if (!configCheck.isConfigured) {
      return { 
        success: true, 
        data: { ...config, configIssues: configCheck.issues } 
      };
    }
    
    return { success: true, data: config };
  } catch (error) {
    console.error('获取配置失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '获取配置失败' 
    };
  }
});

// 打开文件所在文件夹
ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    let fullPath = filePath;
    
    // 检查是否为绝对路径
    if (!path.isAbsolute(filePath)) {
      // 如果是相对路径，则与下载路径拼接
      const downloadPath = getConfig('downloadPath');
      fullPath = path.join(downloadPath, filePath);
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.error(`文件不存在: ${fullPath}`);
      return { 
        success: false, 
        error: '文件不存在，请检查下载路径是否正确' 
      };
    }
    
    // 打开文件所在文件夹
    console.log(`打开文件夹: ${fullPath}`);
    shell.showItemInFolder(fullPath);
    return { success: true };
  } catch (error) {
    console.error('打开文件所在文件夹失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '打开文件夹失败' 
    };
  }
});

ipcMain.handle('save-app-config', async (event, config) => {
  try {
    // 保存配置
    saveConfig(config);
    return { success: true };
  } catch (error) {
    console.error('保存配置失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '保存配置失败' 
    };
  }
});

// 添加重置配置API
ipcMain.handle('reset-app-config', async () => {
  try {
    const result = await resetConfig();
    return result;
  } catch (error) {
    console.error('重置配置失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '重置配置失败' 
    };
  }
});

// 导入图片
ipcMain.handle('import-excel', async (event, filePath) => {
  try {
    // 不再直接导入，而是弹出选择对话框
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled) {
      return { canceled: true };
    }

    // 调用选择对话框后导入
    const selectedFile = filePaths[0];
    
    return {
      success: true,
      filePath: selectedFile
    };
  } catch (error) {
    console.error('Excel导入失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '导入过程发生未知错误'
    };
  }
});

// 批次导出为ZIP
ipcMain.handle('export-batch-images', async (event, batchId) => {
  try {
    const exportModule = require('./services/export');
    return await exportModule.exportBatchImages(batchId);
  } catch (error) {
    console.error('批次图片导出失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出过程发生未知错误'
    };
  }
});
