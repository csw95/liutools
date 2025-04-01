import { contextBridge, ipcRenderer } from 'electron';

// 使用export {}将文件标记为外部模块
export {};

// 禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';

// 定义全局类型扩展
declare global {
  interface Window {
    electron: {
      exit: () => Promise<any>;
      minimize: () => Promise<any>;
      maximize: () => Promise<any>;
      importExcel: (filePath: string) => Promise<any>;
      exportExcel: (batchId: string, template: string, excludeShipped: boolean) => Promise<any>;
      downloadTemplate: () => Promise<any>;
      getOrders: (query: any) => Promise<any>;
      getOrderById: (id: string) => Promise<any>;
      shipOrder: (id: string) => Promise<any>;
      unshipOrder: (id: string) => Promise<any>;
      updateOrder: (id: string, data: any) => Promise<any>;
      getBatches: (query: any) => Promise<any>;
      deleteBatch: (id: string) => Promise<any>;
      getOrdersByBatchId: (batchId: string) => Promise<any>;
      getAppConfig: () => Promise<any>;
      saveAppConfig: (config: any) => Promise<any>;
      resetAppConfig: () => Promise<any>;
      openExternalLink: (url: string) => Promise<any>;
      showInFolder: (filePath: string) => Promise<any>;
      // 导入订单相关
      selectExcelFile: () => Promise<any>;
      importOrders: (data: { customerName: string; amount: number; filePath: string }) => Promise<any>;
      // 下载相关API
      downloadImagesByBatch: (batchId: string) => Promise<any>;
      retryDownloadImage: (imageId: string) => Promise<any>;
      getDownloadStats: () => Promise<any>;
      getFailedDownloads: (limit?: number, offset?: number) => Promise<any>;
      getSuccessfulDownloads: (limit?: number, offset?: number) => Promise<any>;
      getAutoRetryQueue: () => Promise<any>;
      getImageDownloadLog: (imageId: string) => Promise<any>;
      // 导出相关API
      exportBatchImages: (batchId: string) => Promise<any>;
      // Google Drive相关API
      authorizeGoogleDrive: () => Promise<any>;
      setupGoogleAuth: () => Promise<any>;
      saveGoogleCookies: (cookies: string) => Promise<any>;
      // 文件夹下载状态相关API
      getFolderDownloadStatus: (limit?: number, offset?: number) => Promise<any>;
      getFolderDownloadDetail: (folderId: string, orderId: string) => Promise<any>;
      retryFolderImages: (folderId: string, orderId: string) => Promise<any>;
      processGoogleDriveFolder: (orderId: string, url: string, type: string) => Promise<any>;
    };
  }
}

// 向渲染进程暴露API
contextBridge.exposeInMainWorld('electron', {
  exit: () => ipcRenderer.invoke('exit'),
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  importExcel: (filePath: string) => ipcRenderer.invoke('import-excel', filePath),
  exportExcel: (batchId: string, template: string, excludeShipped: boolean) => 
    ipcRenderer.invoke('export-excel', batchId, template, excludeShipped),
  downloadTemplate: () => ipcRenderer.invoke('download-template'),
  getOrders: (query: any) => ipcRenderer.invoke('get-orders', query),
  getOrderById: (id: string) => ipcRenderer.invoke('get-order-by-id', id),
  shipOrder: (id: string) => ipcRenderer.invoke('ship-order', id),
  unshipOrder: (id: string) => ipcRenderer.invoke('unship-order', id),
  updateOrder: (id: string, data: any) => ipcRenderer.invoke('update-order', id, data),
  getBatches: (query: any) => ipcRenderer.invoke('get-batches', query),
  deleteBatch: (id: string) => ipcRenderer.invoke('delete-batch', id),
  getOrdersByBatchId: (batchId: string) => ipcRenderer.invoke('get-orders-by-batch-id', batchId),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  saveAppConfig: (config: any) => ipcRenderer.invoke('save-app-config', config),
  resetAppConfig: () => ipcRenderer.invoke('reset-app-config'),
  openExternalLink: (url: string) => ipcRenderer.invoke('open-external-link', url),
  showInFolder: (filePath: string) => ipcRenderer.invoke('show-in-folder', filePath),
  
  // 导入相关API
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  importOrders: (data: { customerName: string; amount: number; filePath: string }) => 
    ipcRenderer.invoke('import-orders', data),
  
  // 下载相关API
  downloadImagesByBatch: (batchId: string) => ipcRenderer.invoke('download-images-by-batch', batchId),
  retryDownloadImage: (imageId: string) => ipcRenderer.invoke('retry-download-image', imageId),
  getDownloadStats: () => ipcRenderer.invoke('get-download-stats'),
  getFailedDownloads: (limit = 100, offset = 0) => ipcRenderer.invoke('get-failed-downloads', limit, offset),
  getSuccessfulDownloads: (limit = 100, offset = 0) => ipcRenderer.invoke('get-successful-downloads', limit, offset),
  getAutoRetryQueue: () => ipcRenderer.invoke('get-auto-retry-queue'),
  getImageDownloadLog: (imageId: string) => ipcRenderer.invoke('get-image-download-log', imageId),
  
  // 文件夹下载状态相关API
  getFolderDownloadStatus: (limit = 100, offset = 0) => ipcRenderer.invoke('get-folder-download-status', limit, offset),
  getFolderDownloadDetail: (folderId: string, orderId: string) => ipcRenderer.invoke('get-folder-download-detail', folderId, orderId),
  retryFolderImages: (folderId: string, orderId: string) => ipcRenderer.invoke('retry-folder-images', folderId, orderId),
  processGoogleDriveFolder: (orderId: string, url: string, type: string) => 
    ipcRenderer.invoke('process-google-drive-folder', orderId, url, type),
  
  // 导出相关API
  exportBatchImages: (batchId: string) => ipcRenderer.invoke('export-batch-images', batchId),
  
  // Google Drive相关API
  authorizeGoogleDrive: () => ipcRenderer.invoke('authorize-google-drive'),
  setupGoogleAuth: () => ipcRenderer.invoke('setup-google-auth'),
  saveGoogleCookies: (cookies: string) => ipcRenderer.invoke('save-google-cookies', cookies),
}); 