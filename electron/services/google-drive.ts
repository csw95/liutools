// @ts-nocheck
import { google } from 'googleapis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Order, FolderDownloadStatus, Image } from './data';
const config = require('../config');
import logger from './logger';
import { GaxiosResponse } from 'gaxios';
import { drive_v3 } from 'googleapis';
import { applyGoogleCookiesToRequest, ensureValidToken } from './google-auth';

// 从Google Drive共享链接中提取文件夹ID
const extractFolderId = (url: string): string | null => {
  // 处理标准格式链接 https://drive.google.com/drive/folders/{FOLDER_ID}
  const standardMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1];
  }
  
  // 处理短链接格式 https://drive.google.com/open?id={FOLDER_ID}
  const shortMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }
  
  return null;
};

// 判断URL是否为Google Drive文件夹链接
const isGoogleDriveFolderLink = (url: string): boolean => {
  const pattern = /drive\.google\.com.*folders/i;
  return pattern.test(url);
};

// 导出函数供其他模块使用
export const isGoogleDriveFolder = isGoogleDriveFolderLink;

// 获取文件夹元数据
const getFolderMetadata = async (folderId: string, retryCount = 0): Promise<any> => {
  try {
    // 确保有效的访问令牌
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      throw new Error('无法获取有效的访问令牌，请重新授权Google Drive');
    }
    
    // 尝试直接使用axios带cookie和令牌获取，而不是使用Google API客户端
    const headers = await applyGoogleCookiesToRequest();
    logger.info(`正在获取文件夹元数据: ${folderId}`);
    
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,shared,permissions`,
      { 
        headers,
        timeout: 10000
      }
    );
    
    if (!response.data) {
      throw new Error('无法获取文件夹元数据');
    }
    
    logger.info(`成功获取文件夹元数据: ${folderId} - ${response.data.name}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error(`获取文件夹元数据失败 (Status: ${status}):`, data);
      
      // 对于401错误(未授权)，尝试重新刷新令牌并重试一次
      if (status === 401 && retryCount === 0) {
        logger.info('尝试刷新令牌并重试请求...');
        const refreshResult = await ensureValidToken();
        if (refreshResult) {
          return getFolderMetadata(folderId, retryCount + 1);
        } else {
          throw new Error('授权失败，请重新授权Google Drive');
        }
      } else if (status === 401) {
        throw new Error('授权失败，请重新授权Google Drive');
      } else if (status === 404) {
        throw new Error('找不到指定的文件夹，请检查链接是否正确');
      } else if (status === 403) {
        throw new Error('没有权限访问此文件夹，请确认文件夹已公开共享或您有访问权限');
      }
    }
    
    logger.error('获取文件夹元数据失败:', error);
    throw error;
  }
};

// 递归获取文件夹内的所有图片
const getImagesFromFolder = async (folderId: string, depth = 0, maxDepth = 3, retryCount = 0): Promise<any[]> => {
  if (depth > maxDepth) {
    logger.warn(`达到最大遍历深度(${maxDepth})，停止遍历文件夹(${folderId})`);
    return [];
  }

  try {
    // 确保有效的访问令牌
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      throw new Error('无法获取有效的访问令牌，请重新授权Google Drive');
    }
    
    let allImages: any[] = [];
    let pageToken: string | null | undefined = null;
    
    do {
      // 使用axios带cookie和令牌获取文件列表
      const headers = await applyGoogleCookiesToRequest();
      let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,webContentLink,thumbnailLink)&pageSize=1000`;
      
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }
      
      logger.info(`正在获取文件夹内容，页码: ${pageToken ? pageToken : '首页'}`);
      const response = await axios.get(url, { 
        headers,
        timeout: 30000 
      });
      
      const files = response.data.files || [];
      pageToken = response.data.nextPageToken;
      
      const imageCount = files.filter((f: any) => f.mimeType?.startsWith('image/')).length;
      logger.info(`获取到 ${files.length} 个文件，${imageCount} 个图片`);
      
      // 分类处理文件
      for (const file of files) {
        if (file.mimeType?.startsWith('image/')) {
          // 收集图片文件
          allImages.push(file);
        } else if (file.mimeType === 'application/vnd.google-apps.folder') {
          // 递归处理子文件夹
          logger.info(`发现子文件夹: ${file.name} (${file.id}), 开始递归处理...`);
          const subFolderImages = await getImagesFromFolder(file.id, depth + 1, maxDepth);
          allImages = allImages.concat(subFolderImages);
        }
      }
    } while (pageToken);
    
    logger.info(`文件夹 ${folderId} 总共包含 ${allImages.length} 张图片`);
    return allImages;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error(`读取文件夹内容失败 (Status: ${status}):`, data);
      
      // 对于401错误(未授权)，尝试重新刷新令牌并重试一次
      if (status === 401 && retryCount === 0) {
        logger.info('尝试刷新令牌并重试获取文件夹内容...');
        const refreshResult = await ensureValidToken();
        if (refreshResult) {
          return getImagesFromFolder(folderId, depth, maxDepth, retryCount + 1);
        } else {
          throw new Error('授权失败，请重新授权Google Drive');  
        }
      } else if (status === 401) {
        throw new Error('授权失败，请重新授权Google Drive');
      } else if (status === 404) {
        throw new Error('找不到指定的文件夹，请检查链接是否正确');
      } else if (status === 403) {
        throw new Error('没有权限访问此文件夹，请确认文件夹已公开共享或您有访问权限');
      }
    }
    
    logger.error(`读取文件夹内容失败 (folderId: ${folderId}):`, error);
    throw error;
  }
};

// 处理Google Drive文件夹下载
export const processGoogleDriveFolder = async (
  orderId: string, 
  folderUrl: string, 
  imageType: string
): Promise<{ success: boolean; error?: string; folderId?: string; }> => {
  try {
    // 验证输入
    if (!orderId || !folderUrl) {
      return { success: false, error: '订单ID和文件夹链接不能为空' };
    }
    
    // 验证链接格式
    if (!isGoogleDriveFolderLink(folderUrl)) {
      return { success: false, error: '无效的Google Drive文件夹链接' };
    }
    
    // 提取文件夹ID
    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return { success: false, error: '无法从链接中提取文件夹ID' };
    }
    
    // 检查授权状态
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      return { success: false, error: '未授权或授权已过期，请在设置中重新授权Google Drive' };
    }
    
    // 检查订单是否存在
    const order = await Order.findByPk(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    // 检查是否已存在相同文件夹的下载记录
    const existingFolder = await FolderDownloadStatus.findOne({
      where: {
        folderId,
        orderId
      }
    });
    
    if (existingFolder) {
      // 如果存在且已完成，返回成功
      if (existingFolder.status === 'completed') {
        return { 
          success: true, 
          folderId: existingFolder.folderId,
          error: '文件夹已处理完成' 
        };
      }
      
      // 如果存在但失败了，重置状态
      if (existingFolder.status === 'failed') {
        await existingFolder.update({
          status: 'processing',
          startTime: new Date(),
          completedTime: undefined,
          errorMessage: undefined
        });
        
        // 启动异步处理
        downloadGoogleDriveFolder(existingFolder.id, folderId, orderId, folderUrl, imageType)
          .catch(err => logger.error(`处理文件夹下载时出错 (异步): ${err.message}`));
        
        return { 
          success: true, 
          folderId: existingFolder.folderId
        };
      }
      
      // 如果正在处理中，返回信息
      return { 
        success: true, 
        folderId: existingFolder.folderId,
        error: '文件夹处理任务已存在' 
      };
    }
    
    // 获取文件夹元数据
    try {
      await getFolderMetadata(folderId);
    } catch (error) {
      return { 
        success: false, 
        error: '无法访问此文件夹，请确认链接正确且已公开共享'
      };
    }
    
    // 创建新的文件夹下载状态记录
    const folderDownloadStatus = await FolderDownloadStatus.create({
      folderId,
      orderId,
      originalUrl: folderUrl,
      type: imageType,
      status: 'processing',
      startTime: new Date(),
      completedCount: 0,
      totalCount: 0
    });
    
    // 启动异步处理
    downloadGoogleDriveFolder(folderDownloadStatus.id, folderId, orderId, folderUrl, imageType)
      .catch(err => logger.error(`处理文件夹下载时出错 (异步): ${err.message}`));
    
    return { 
      success: true, 
      folderId
    };
  } catch (error) {
    logger.error('处理Google Drive文件夹时出错:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '处理时出现未知错误' 
    };
  }
};

// 异步下载Google Drive文件夹中的图片
const downloadGoogleDriveFolder = async (
  statusId: string,
  folderId: string,
  orderId: string,
  folderUrl: string,
  imageType: string
): Promise<void> => {
  try {
    // 获取所有图片文件
    const allImages = await getImagesFromFolder(folderId);
    const totalCount = allImages.length;
    
    // 更新文件夹状态为下载中并更新总数
    await FolderDownloadStatus.update(
      {
        status: 'in_progress',
        totalCount
      },
      { where: { id: statusId } }
    );
    
    // 为每个图片创建下载记录
    for (const image of allImages) {
      // 生成图片文件名
      const fileName = `${uuidv4()}_${image.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // 创建图片记录
      await Image.create({
        id: uuidv4(),
        orderId,
        originalUrl: image.webContentLink || `https://drive.google.com/uc?id=${image.id}`,
        localPath: fileName, // 只保存文件名，不包含路径信息
        fileName,
        downloadStatus: 'pending',
        downloadAttempts: 0,
        type: imageType,
        sourceFolderId: folderId,
        sourceId: image.id
      });
    }
    
    // 开始下载图片
    await processNextBatchOfImages({ id: statusId, folderId, orderId });
    
    logger.info(`已创建 ${totalCount} 个图片下载任务，开始下载`);
  } catch (error) {
    // 更新文件夹状态为失败
    await FolderDownloadStatus.update(
      {
        status: 'failed',
        completedTime: new Date(),
        errorMessage: error instanceof Error ? error.message.substring(0, 1000) : '处理过程发生未知错误'
      },
      { where: { id: statusId } }
    );
    
    logger.error(`处理文件夹 ${folderId} 时出错:`, error);
    throw error;
  }
};

// 批量处理图片下载
const processNextBatchOfImages = async (folder: { id: string, folderId: string, orderId: string }): Promise<void> => {
  try {
    // 获取最多10张待下载的图片
    const pendingImages = await Image.findAll({
      where: {
        orderId: folder.orderId,
        sourceFolderId: folder.folderId,
        downloadStatus: 'pending'
      },
      limit: 10
    });
    
    if (pendingImages.length === 0) {
      // 检查是否所有图片都已处理完成
      const totalImagesCount = await Image.count({
        where: {
          orderId: folder.orderId,
          sourceFolderId: folder.folderId
        }
      });
      
      const completedImagesCount = await Image.count({
        where: {
          orderId: folder.orderId,
          sourceFolderId: folder.folderId,
          downloadStatus: 'completed'
        }
      });
      
      // 如果所有图片都已处理，更新文件夹状态
      if (totalImagesCount > 0 && completedImagesCount === totalImagesCount) {
        await FolderDownloadStatus.update(
          {
            status: 'completed',
            completedTime: new Date(),
            completedCount: completedImagesCount
          },
          { where: { id: folder.id } }
        );
        logger.info(`文件夹 ${folder.folderId} 处理完成，共 ${completedImagesCount} 张图片`);
      } else {
        // 检查失败图片数
        const failedImagesCount = await Image.count({
          where: {
            orderId: folder.orderId,
            sourceFolderId: folder.folderId,
            downloadStatus: 'failed'
          }
        });
        
        // 如果有失败的图片但没有待处理的，更新文件夹状态为失败
        if (failedImagesCount > 0) {
          await FolderDownloadStatus.update(
            {
              status: 'failed',
              completedTime: new Date(),
              completedCount: completedImagesCount,
              errorMessage: `${failedImagesCount} 张图片下载失败`
            },
            { where: { id: folder.id } }
          );
          logger.warn(`文件夹 ${folder.folderId} 下载部分失败，${completedImagesCount}/${totalImagesCount} 张完成，${failedImagesCount} 张失败`);
        }
      }
      
      return;
    }
    
    // 下载每个图片
    const downloadPromises = pendingImages.map(image => downloadImageAndUpdateStatus(image, image.type));
    await Promise.all(downloadPromises);
    
    // 更新完成计数
    const completedCount = await Image.count({
      where: {
        orderId: folder.orderId,
        sourceFolderId: folder.folderId,
        downloadStatus: 'completed'
      }
    });
    
    await FolderDownloadStatus.update(
      { completedCount },
      { where: { id: folder.id } }
    );
    
    // 继续处理下一批
    setTimeout(() => {
      processNextBatchOfImages(folder).catch(err => 
        logger.error(`处理下一批图片时出错: ${err.message}`)
      );
    }, 1000);
  } catch (error) {
    logger.error('处理图片批次时出错:', error);
    throw error;
  }
};

// 下载单张图片并更新状态
const downloadImageAndUpdateStatus = async (image: any, imageType: string, retryCount = 0): Promise<void> => {
  try {
    // 更新图片状态为下载中
    await image.update({
      downloadStatus: 'downloading',
      downloadAttempts: image.downloadAttempts + 1,
      lastAttemptAt: new Date()
    });
    
    // 创建下载目录 - 使用配置中的下载路径
    const downloadDir = path.join(config.downloadPath, image.orderId, imageType);
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // 准备下载URL和本地路径
    // 对于Google Drive文件，使用更可靠的下载链接方式
    const fileId = image.sourceId || image.originalUrl.match(/id=([^&]+)/)?.[1];
    
    let downloadUrl;
    // 检查授权状态并使用适当的下载链接
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      throw new Error('无法获取有效的访问令牌，请重新授权Google Drive');
    }
    
    if (fileId) {
      // 尝试使用API下载链接
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    } else {
      // 退回到原始URL
      downloadUrl = image.originalUrl;
    }
    
    logger.info(`开始下载图片: ${image.fileName} 从 ${downloadUrl}`);
    
    // 确保文件名存在，如果不存在则生成一个基于文件ID或URL的临时文件名
    let fileName = image.fileName;
    if (!fileName) {
      // 生成临时文件名 - 使用文件ID或时间戳加扩展名
      const fileExtension = getFileExtensionFromUrl(image.originalUrl);
      fileName = fileId ? `${fileId}${fileExtension}` : `temp_${Date.now()}${fileExtension}`;
      logger.info(`文件名不存在，生成临时文件名: ${fileName}`);
      
      // 更新图片记录的文件名
      await image.update({ fileName });
    }
    
    const localPath = path.join(downloadDir, fileName);
    
    // 下载图片 - 使用带cookie和令牌的请求
    const headers = await applyGoogleCookiesToRequest();
    
    try {
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 60000, // 60秒超时
        headers
      });
      
      // 写入文件
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);
      
      // 处理结果
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', async () => {
          // 更新图片状态为已完成
          // 保存相对路径，包含orderId/imageType/fileName结构
          const relativePath = path.join(image.orderId, imageType, fileName);
          
          await image.update({
            downloadStatus: 'completed',
            localPath: relativePath,
            downloadedAt: new Date()
          });
          logger.info(`图片下载成功: ${fileName}，保存到相对路径：${relativePath}`);
          resolve();
        });
        
        writer.on('error', async (err) => {
          // 更新图片状态为失败
          await image.update({
            downloadStatus: 'failed',
            errorMessage: err.message
          });
          logger.error(`写入图片文件失败: ${err.message}`);
          reject(err);
        });
      });
    } catch (downloadError) {
      // 对于401错误(未授权)，尝试重新刷新令牌并重试一次
      if (axios.isAxiosError(downloadError) && 
          downloadError.response?.status === 401 && 
          retryCount === 0) {
        logger.info(`尝试刷新令牌并重试下载图片: ${image.fileName}...`);
        const refreshResult = await ensureValidToken();
        if (refreshResult) {
          return downloadImageAndUpdateStatus(image, imageType, retryCount + 1);
        } else {
          throw new Error('授权失败，请重新授权Google Drive');
        }
      } else {
        throw downloadError;
      }
    }
  } catch (error) {
    // 详细记录错误信息
    let errorMessage = '下载过程中出现未知错误';
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      errorMessage = `下载失败 (状态码: ${status}): ${JSON.stringify(data)}`;
      logger.error(errorMessage);
      
      if (status === 401) {
        errorMessage = '授权失败，请重新授权Google Drive';
      } else if (status === 403) {
        errorMessage = '没有权限访问此文件，请确认您有访问权限';
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // 更新图片状态为失败
    await image.update({
      downloadStatus: 'failed',
      errorMessage
    });
    
    logger.error(`下载图片失败 (ID: ${image.id}):`, error);
  }
};

// 添加一个从URL中提取文件扩展名的辅助函数
const getFileExtensionFromUrl = (url: string): string => {
  if (!url) return '.jpg'; // 默认为jpg
  
  try {
    // 移除URL查询参数
    const urlWithoutParams = url.split('?')[0];
    
    // 尝试从路径中提取扩展名
    const extMatch = urlWithoutParams.match(/\.([a-zA-Z0-9]{2,4})$/i);
    if (extMatch && extMatch[1]) {
      return `.${extMatch[1].toLowerCase()}`;
    }
    
    // 如果没有文件扩展名，检查内容类型
    if (url.includes('image/jpeg') || url.includes('image/jpg')) {
      return '.jpg';
    } else if (url.includes('image/png')) {
      return '.png';
    } else if (url.includes('image/gif')) {
      return '.gif';
    } else if (url.includes('image/webp')) {
      return '.webp';
    } else if (url.includes('image/tiff')) {
      return '.tiff';
    }
    
    // 默认返回jpg扩展名
    return '.jpg';
  } catch (error) {
    logger.error('从URL提取文件扩展名失败:', error);
    return '.jpg';
  }
};

// 获取文件夹下载状态列表
export const getFolderDownloadStatusList = async (
  limit = 100, 
  offset = 0
): Promise<{ success: boolean; total: number; items: any[]; error?: string; }> => {
  try {
    const { count, rows } = await FolderDownloadStatus.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Order,
          attributes: ['id', 'customerNo', 'customerSku', 'name']
        }
      ]
    });
    
    // 添加统计信息到每个文件夹
    const foldersWithStats = await Promise.all(rows.map(async (folder) => {
      const stats = await getImageStatistics(folder.folderId, folder.orderId);
      const folderWithStats = folder.toJSON() as any;
      folderWithStats.statsSummary = stats;
      return folderWithStats;
    }));
    
    return {
      success: true,
      total: count,
      items: foldersWithStats
    };
  } catch (error) {
    logger.error('获取文件夹下载状态列表时出错:', error);
    return { 
      success: false, 
      total: 0, 
      items: [], 
      error: error instanceof Error ? error.message : '获取列表时出现未知错误' 
    };
  }
};

// 获取文件夹详情
export const getFolderDetail = async (
  folderId: string, 
  orderId: string
): Promise<{ success: boolean; folder?: any; images?: any[]; error?: string; }> => {
  try {
    // 获取文件夹状态
    const folder = await FolderDownloadStatus.findOne({
      where: {
        folderId,
        orderId
      },
      include: [
        {
          model: Order,
          attributes: ['id', 'customerNo', 'customerSku', 'name']
        }
      ]
    });
    
    if (!folder) {
      return { success: false, error: '找不到文件夹下载记录' };
    }
    
    // 获取文件夹中的图片
    const images = await Image.findAll({
      where: {
        orderId,
        sourceFolderId: folderId
      },
      order: [['createdAt', 'DESC']]
    });
    
    // 获取图片统计
    const stats = await getImageStatistics(folderId, orderId);
    
    // 将模型转换为纯对象并添加统计信息
    const folderObj = folder.toJSON() as any;
    folderObj.statsSummary = stats;
    
    return {
      success: true,
      folder: folderObj,
      images: images.map(img => img.toJSON())
    };
  } catch (error) {
    logger.error('获取文件夹详情失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '获取文件夹详情失败' 
    };
  }
};

// 获取图片统计
const getImageStatistics = async (folderId: string, orderId: string) => {
  const total = await Image.count({
    where: {
      sourceFolderId: folderId,
      orderId
    }
  });
  
  const completed = await Image.count({
    where: {
      sourceFolderId: folderId,
      orderId,
      downloadStatus: 'completed'
    }
  });
  
  const failed = await Image.count({
    where: {
      sourceFolderId: folderId,
      orderId,
      downloadStatus: 'failed'
    }
  });
  
  const pending = await Image.count({
    where: {
      sourceFolderId: folderId,
      orderId,
      downloadStatus: 'pending'
    }
  });
  
  const downloading = await Image.count({
    where: {
      sourceFolderId: folderId,
      orderId,
      downloadStatus: 'downloading'
    }
  });
  
  return {
    total,
    completed,
    failed,
    pending,
    downloading
  };
};

// 重试失败的图片
export const retryFailedImagesInFolder = async (
  folderId: string, 
  orderId: string
): Promise<{ success: boolean; retryCount: number; error?: string; }> => {
  try {
    // 检查文件夹记录是否存在
    const folder = await FolderDownloadStatus.findOne({
      where: {
        folderId,
        orderId
      }
    });
    
    if (!folder) {
      return { success: false, retryCount: 0, error: '找不到文件夹下载记录' };
    }
    
    // 查找失败的图片
    const failedImages = await Image.findAll({
      where: {
        orderId,
        sourceFolderId: folderId,
        downloadStatus: 'failed'
      }
    });
    
    if (failedImages.length === 0) {
      return { success: true, retryCount: 0, error: '没有需要重试的失败图片' };
    }
    
    // 重置图片状态
    await Promise.all(failedImages.map(async (image) => {
      await image.update({
        downloadStatus: 'pending',
        downloadAttempts: 0,
        errorMessage: undefined
      });
    }));
    
    // 更新文件夹状态
    if (folder.status === 'failed') {
      await folder.update({
        status: 'in_progress',
        errorMessage: undefined
      });
    }
    
    // 重新开始处理图片
    setTimeout(() => {
      processNextBatchOfImages(folder).catch(err => 
        logger.error(`重试处理图片时出错: ${err.message}`)
      );
    }, 1000);
    
    return { success: true, retryCount: failedImages.length };
  } catch (error) {
    logger.error('重试文件夹中的失败图片时出错:', error);
    return { 
      success: false, 
      retryCount: 0, 
      error: error instanceof Error ? error.message : '重试图片失败' 
    };
  }
}; 