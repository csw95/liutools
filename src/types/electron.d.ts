interface ElectronAPI {
  importOrders: (data: { customerName: string; amount: number; filePath: string }) => Promise<any>;
  selectExcelFile: () => Promise<any>;
  exportOrders: (data: { batchId?: string; orderIds?: string[] }) => Promise<any>;
  exportExcel: (batchId: string, template: string, excludeShipped: boolean) => Promise<any>;
  downloadTemplate: () => Promise<any>;
  retryDownloadImage: (imageId: string) => Promise<any>;
  getBatches: () => Promise<any>;
  getBatchById: (id: string) => Promise<any>;
  updateBatch: (batch: any) => Promise<any>;
  deleteBatch: (id: string) => Promise<any>;
  getOrders: (batchId?: string) => Promise<any>;
  getOrderById: (id: string) => Promise<any>;
  updateOrder: (order: any) => Promise<any>;
  deleteOrder: (id: string) => Promise<any>;
  markOrderAsShipped: (id: string, trackingNo?: string) => Promise<any>;
  getDownloadStats: () => Promise<any>;
  getFailedDownloads: (limit?: number, offset?: number) => Promise<any>;
  getSuccessfulDownloads: (limit?: number, offset?: number) => Promise<any>;
  getAutoRetryQueue: () => Promise<any>;
  getImageDownloadLog: (imageId: string) => Promise<any>;
  showInFolder: (filePath: string) => Promise<any>;
  authorizeGoogleDrive: () => Promise<any>;
  getAppConfig: () => Promise<any>;
  saveAppConfig: (config: any) => Promise<any>;
  resetAppConfig: () => Promise<any>;
  exportBatchImages: (batchId: string) => Promise<any>;
  getFolderDownloadStatus: (limit?: number, offset?: number) => Promise<any>;
  getFolderDownloadDetail: (folderId: string, orderId: string) => Promise<any>;
  processGoogleDriveFolder: (orderId: string, url: string, type: string) => Promise<any>;
  retryFolderImages: (folderId: string, orderId: string) => Promise<any>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    electronAPI: ElectronAPI;
  }
}

export {}; 