// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
import axios from 'axios';
import fs from 'fs';
import path from 'path';
// 转换的import
const { app  } = require('electron');
import { v4 as uuidv4 } from 'uuid';
import Image from '../../database/models/image';
import Order from '../../database/models/order';
import { Op } from 'sequelize';
import { applyGoogleCookiesToRequest } from './google-auth';
import { JSDOM } from 'jsdom';
import FolderDownloadStatus from '../../database/models/folderDownloadStatus';
import { processGoogleDriveFolder, isGoogleDriveFolder } from './google-drive';
// 转换的import
const config = require('../config');

// 下载设置
const DEFAULT_DOWNLOAD_PATH = config.downloadPath; // 使用配置文件中的路径
const MAX_CONCURRENT_DOWNLOADS = config.maxConcurrentDownloads || 3;
const DOWNLOAD_TIMEOUT = config.downloadTimeout || 30 * 60 * 1000; // 30分钟
const MAX_RETRY_ATTEMPTS = config.maxRetryAttempts || 3;
const RETRY_DELAY = 3 * 60 * 1000; // 重试延迟，3分钟

// 自动重试队列
const autoRetryQueue: {imageId: string, retryTime: number}[] = [];

// 确保下载目录存在
if (!fs.existsSync(DEFAULT_DOWNLOAD_PATH)) {
  fs.mkdirSync(DEFAULT_DOWNLOAD_PATH, { recursive: true });
  console.log(`创建下载目录: ${DEFAULT_DOWNLOAD_PATH}`);
}

// 下载队列
const downloadQueue: string[] = [];
let activeDownloads = 0;

// 创建重试定时器
setInterval(() => {
  const now = Date.now();
  const readyToRetry = autoRetryQueue.filter(item => item.retryTime <= now);
  
  if (readyToRetry.length > 0) {
    console.log(`准备自动重试 ${readyToRetry.length} 个下载任务`);
    
    // 将到期的重试项移出队列，加入下载队列
    for (const item of readyToRetry) {
      const index = autoRetryQueue.findIndex(q => q.imageId === item.imageId);
      if (index !== -1) {
        autoRetryQueue.splice(index, 1);
        
        // 添加到下载队列
        if (!downloadQueue.includes(item.imageId)) {
          downloadQueue.push(item.imageId);
        }
      }
    }
    
    // 处理下载队列
    processDownloadQueue();
  }
}, 30000); // 每30秒检查一次重试队列

// 定义详细的下载状态枚举类型
export enum DownloadStatusEnum {
  PENDING = 'pending',      // 待下载（初始状态）
  DOWNLOADING = 'downloading', // 下载中
  COMPLETED = 'completed',  // 下载完成
  FAILED = 'failed'         // 下载失败
}

// 定义文件夹下载状态枚举类型
export enum FolderStatusEnum {
  PROCESSING = 'processing',  // 初始处理（解析文件夹内容）
  IN_PROGRESS = 'in_progress', // 下载进行中
  COMPLETED = 'completed',    // 下载完成
  FAILED = 'failed'          // 下载失败
}

// 下载批次中的所有图片
export const downloadImages = async (batchId: string) => {
  try {
    // 查找批次中所有订单
    const orders = await Order.findAll({ where: { batchId } });
    
    // 查找所有需要下载的图片
    const orderIds = orders.map(order => order.id);
    const images = await Image.findAll({
      where: {
        orderId: { [Op.in]: orderIds },
        downloadStatus: { [Op.in]: ['pending', 'failed'] },
        downloadAttempts: { [Op.lt]: MAX_RETRY_ATTEMPTS }
      }
    });
    
    // 将图片加入下载队列
    for (const image of images) {
      if (!downloadQueue.includes(image.id)) {
        downloadQueue.push(image.id);
      }
    }
    
    // 开始下载
    processDownloadQueue();
    
    return { 
      success: true, 
      message: `已将 ${images.length} 张图片加入下载队列` 
    };
  } catch (error) {
    console.error('初始化图片下载失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '下载初始化失败' 
    };
  }
};

// 重试下载图片
export const retryDownloadImage = async (imageId: string) => {
  try {
    const image = await Image.findByPk(imageId);
    if (!image) {
      throw new Error('图片记录不存在');
    }
    
    // 重置下载状态
    await image.update({
      downloadStatus: 'pending',
    });
    
    // 添加到下载队列
    if (!downloadQueue.includes(imageId)) {
      downloadQueue.push(imageId);
    }
    
    // 开始下载
    processDownloadQueue();
    
    return { success: true };
  } catch (error) {
    console.error('重试下载图片失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '重试下载失败' 
    };
  }
};

// 处理下载队列
const processDownloadQueue = () => {
  // 同时下载的任务数不超过最大并行数
  while (activeDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const imageId = downloadQueue.shift();
    if (imageId) {
      downloadImage(imageId);
    }
  }
};

// 下载单个图片
const downloadImage = async (imageId: string) => {
  activeDownloads++;
  const startTime = Date.now();
  let downloadLog = {
    imageId,
    startTime,
    attempts: 0,
    stages: [] as {stage: string, time: number, message: string}[],
    error: null as string | null
  };
  
  const logStage = (stage: string, message = '') => {
    const time = Date.now();
    downloadLog.stages.push({
      stage,
      time,
      message
    });
    console.log(`[图片ID: ${imageId}] ${stage} - ${message} (耗时: ${time - startTime}ms)`);
  };
  
  try {
    logStage('开始处理', '从队列中取出图片');
    
    const image = await Image.findByPk(imageId);
    if (!image) {
      throw new Error('图片记录不存在');
    }
    
    downloadLog.attempts = image.downloadAttempts + 1;
    logStage('查找记录', `原始URL: ${image.originalUrl}, 尝试次数: ${downloadLog.attempts}`);
    
    // 更新状态为下载中
    await image.update({
      downloadStatus: 'downloading',
      downloadAttempts: image.downloadAttempts + 1,
      lastAttemptAt: new Date()
    });
    logStage('状态更新', '状态已更新为下载中');
    
    // 解析URL
    let url = image.originalUrl.trim();
    
    // 检查是否为Google Drive链接
    const isGoogleDriveLink = url.includes('drive.google.com');
    
    // 处理Google Drive链接
    if (isGoogleDriveLink) {
      const originalUrl = url;
      url = convertGoogleDriveUrl(url);
      if (originalUrl !== url) {
        logStage('链接转换', `Google Drive链接已转换: ${url}`);
      }
      
      // 直接使用带确认令牌的链接
      const fileId = url.match(/id=([^&]+)/)?.[1];
      if (fileId) {
        url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
        logStage('链接更新', `使用带确认令牌的链接: ${url}`);
      }
    }
    
    // 生成本地文件路径
    const ext = getFileExtension(url);
    const filename = `${uuidv4()}${ext}`;
    
    // 获取订单信息和图片类型
    const order = await Order.findByPk(image.orderId);
    if (!order) {
      throw new Error('所属订单不存在');
    }
    
    // 创建包含订单ID和图片类型的子目录
    const imageType = image.type || 'other';
    const relativeDir = path.join(image.orderId, imageType);
    const absoluteDir = path.join(DEFAULT_DOWNLOAD_PATH, relativeDir);
    const localPath = path.join(absoluteDir, filename);
    
    // 确保目录存在
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
    
    logStage('路径生成', `将下载到: ${localPath}`);
    
    // 下载文件
    let headers: Record<string, string> = {};
    
    // 为 Google Drive 链接添加特殊处理
    if (isGoogleDriveLink) {
      headers = {
        ...headers,
        ...await applyGoogleCookiesToRequest()
      };
      
      // 添加其他可能有助于绕过限制的头部
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      headers['Accept-Language'] = 'en-US,en;q=0.9';
      headers['Cache-Control'] = 'no-cache';
      headers['Pragma'] = 'no-cache';
      
      logStage('设置请求', '已应用Google Drive Cookie和额外请求头');
    }
    
    // 下载重试计数器
    let downloadAttempts = 0;
    const maxDownloadAttempts = 3;
    
    // 重试循环
    while (downloadAttempts < maxDownloadAttempts) {
      try {
        downloadAttempts++;
        logStage('开始下载', `尝试 ${downloadAttempts}/${maxDownloadAttempts}: ${url}`);
        
        // 直接下载请求
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          timeout: DOWNLOAD_TIMEOUT,
          maxRedirects: 5, // 增加允许重定向数
          headers
        });
        
        logStage('请求成功', `HTTP状态: ${response.status}, 开始写入文件`);
        
        // 创建写入流之前，确保目录存在
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        
        const writer = fs.createWriteStream(localPath);
        let bytesReceived = 0;
        let lastProgressLog = 0;
        
        response.data.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
          
          // 每10MB或10秒记录一次进度，以较早者为准
          const now = Date.now();
          if (bytesReceived - lastProgressLog >= 10 * 1024 * 1024 || now - lastProgressLog >= 10000) {
            lastProgressLog = bytesReceived;
            // logStage('下载进度', `已接收 ${(bytesReceived / (1024 * 1024)).toFixed(2)} MB`);
          }
        });
        
        response.data.pipe(writer);
        
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => {
            logStage('写入完成', `文件大小: ${bytesReceived} 字节`);
            resolve();
          });
          writer.on('error', (err) => {
            logStage('写入错误', err.message);
            reject(err);
          });
        });
        
        // 验证下载的文件
        if (bytesReceived === 0) {
          throw new Error('下载的文件大小为0');
        }
        
        // 检查文件是否是HTML而不是图片
        if (isGoogleDriveLink) {
          try {
            // 读取文件前几个字节来检测文件类型
            const fileBuffer = fs.readFileSync(localPath, { encoding: 'utf8', flag: 'r' }).slice(0, 1000);
            if (fileBuffer.includes('<!DOCTYPE html>') || fileBuffer.includes('<html')) {
              // 如果是HTML，尝试使用不同的下载方式
              const fileId = url.match(/id=([^&]+)/)?.[1];
              if (fileId) {
                url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
                logStage('链接更新', `检测到HTML响应，更新为直接下载链接: ${url}`);
                throw new Error('需要重试下载');
              }
            }
          } catch (validationError: unknown) {
            if (validationError instanceof Error && validationError.message.includes('HTML')) {
              throw validationError;
            }
            // 其他读取错误可以忽略
            const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
            logStage('验证警告', `文件验证时出错: ${errorMessage}`);
          }
        }
        
        // 下载成功，更新状态
        // 保存相对路径和绝对路径到数据库
        const relativePath = path.join(relativeDir, filename);
        const absolutePath = path.join(DEFAULT_DOWNLOAD_PATH, relativePath);

        try {
          // 构造更新对象，避免因为字段不存在导致的错误
          const updateObject: any = {
            downloadStatus: 'completed',
            localPath: relativePath,
            fileName: filename,
            errorMessage: null
          };
          
          // 尝试添加绝对路径
          try {
            updateObject.absolutePath = absolutePath;
          } catch (fieldError) {
            console.warn('无法设置 absolutePath 字段，可能数据库模型中不存在此字段:', fieldError);
          }
          
          await image.update(updateObject);
          
          logStage('下载完成', `总耗时: ${Date.now() - startTime}ms，保存到相对路径：${relativePath}，绝对路径：${absolutePath}`);
          // 下载成功，退出重试循环
          break;
        } catch (updateError) {
          logStage('更新错误', `更新数据库记录时出错: ${updateError instanceof Error ? updateError.message : '未知错误'}`);
          throw updateError;
        }
      } catch (downloadError) {
        const errorMessage = downloadError instanceof Error ? downloadError.message : '未知下载错误';
        logStage('下载失败', `尝试 ${downloadAttempts}/${maxDownloadAttempts} 失败: ${errorMessage}`);
        
        // 如果有创建的文件，删除它
        try {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            logStage('清理文件', `删除不完整的下载文件: ${localPath}`);
          }
        } catch (unlinkError) {
          logStage('清理错误', `无法删除不完整的文件: ${unlinkError instanceof Error ? unlinkError.message : '未知错误'}`);
        }
        
        // 如果是最后一次尝试，或错误是不可重试的，则抛出
        if (downloadAttempts >= maxDownloadAttempts) {
          throw downloadError;
        }
        
        // 如果错误是Google Drive确认页面，尝试处理
        if (errorMessage.includes('HTML') && isGoogleDriveLink) {
          // 重新获取确认令牌
          try {
            const fileId = url.match(/id=([^&]+)/)?.[1];
            if (fileId) {
              url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
              logStage('链接更新', `更新为带确认令牌的链接: ${url}`);
              // 继续重试
              continue;
            }
          } catch (tokenError) {
            logStage('token错误', `获取新token失败: ${tokenError instanceof Error ? tokenError.message : '未知错误'}`);
          }
        }
        
        // 短暂等待后重试
        const retryDelay = 5000; // 5秒
        logStage('重试延迟', `等待 ${retryDelay/1000} 秒后重试`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // 在图片下载完成后，如果来自文件夹，更新文件夹状态
    if (image.sourceFolderId) {
      await updateFolderDownloadStatus(image.sourceFolderId, image.orderId, true);
    }
  } catch (error) {
    // 详细记录错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    downloadLog.error = errorMessage;
    
    logStage('下载失败', errorMessage);
    
    // 记录详细错误栈
    if (error instanceof Error && error.stack) {
      console.error(`[图片ID: ${imageId}] 错误栈:`, error.stack);
    }
    
    // 记录请求和响应信息用于调试
    if (error && typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as any).response;
      if (response) {
        console.error(`[图片ID: ${imageId}] 响应状态:`, response.status);
        console.error(`[图片ID: ${imageId}] 响应头:`, JSON.stringify(response.headers));
        console.error(`[图片ID: ${imageId}] 响应数据:`, 
                     typeof response.data === 'string' 
                     ? response.data.substring(0, 200) 
                     : 'non-string response');
      }
    }
    
    // 处理下载失败
    try {
      const image = await Image.findByPk(imageId);
      if (image) {
        const failDetails = `尝试${image.downloadAttempts + 1}次失败: ${errorMessage}`;
        
        await image.update({
          downloadStatus: 'failed',
          errorMessage: errorMessage.substring(0, 255), // 确保不超过数据库字段长度
          lastAttemptAt: new Date()
        });
        
        logStage('状态更新', '已标记为下载失败');
        
        // 检查是否需要自动重试
        if (image.downloadAttempts < MAX_RETRY_ATTEMPTS) {
          const retryTime = Date.now() + RETRY_DELAY;
          // 确保不重复添加到自动重试队列
          if (!autoRetryQueue.some(item => item.imageId === imageId)) {
            autoRetryQueue.push({
              imageId: imageId,
              retryTime: retryTime
            });
            
            const retryDate = new Date(retryTime);
            logStage('自动重试', `计划在 ${retryDate.toLocaleString()} 重试下载`);
          }
        } else {
          logStage('自动重试', `已达到最大重试次数 ${MAX_RETRY_ATTEMPTS}，不再自动重试`);
        }

        // 在图片下载失败后，如果来自文件夹，更新文件夹状态
        if (image.sourceFolderId) {
          await updateFolderDownloadStatus(image.sourceFolderId, image.orderId, false, errorMessage);
        }
      }
    } catch (dbError) {
      console.error(`[图片ID: ${imageId}] 更新失败状态时出错:`, dbError);
    }
    
  } finally {
    // 记录完整下载日志
    const totalTime = Date.now() - startTime;
    console.log(`[图片下载日志] ID: ${imageId}, 总耗时: ${totalTime}ms, 结果: ${downloadLog.error ? '失败' : '成功'}`);
    
    activeDownloads--;
    
    // 继续处理队列
    processDownloadQueue();
  }
};

/**
 * 将Google Drive共享链接转换为直接下载链接
 */
const convertGoogleDriveUrl = (url: string): string => {
  try {
    // 检查是否是Google Drive链接
    if (!url.includes('drive.google.com')) {
      return url;
    }
    
    console.log('处理Google Drive链接:', url);
    
    // 判断链接类型并提取文件ID
    let fileId = '';
    
    // 处理形如 https://drive.google.com/file/d/{fileId}/view 的链接
    if (url.includes('/file/d/')) {
      fileId = url.split('/file/d/')[1].split('/')[0];
    } 
    // 处理形如 https://drive.google.com/open?id={fileId} 的链接
    else if (url.includes('open?id=')) {
      fileId = new URL(url).searchParams.get('id') || '';
    }
    // 处理共享链接 https://drive.google.com/uc?export=view&id={fileId}
    else if (url.includes('uc?')) {
      fileId = new URL(url).searchParams.get('id') || '';
    }
    // 处理共享链接 https://drive.google.com/uc?id={fileId}
    else if (url.includes('uc?id=')) {
      fileId = new URL(url).searchParams.get('id') || '';
    }
    // 文件夹链接不进行转换，将在另一个函数中特殊处理
    else if (url.includes('/folders/')) {
      return url;
    }
    
    if (!fileId) {
      console.warn('无法从链接中提取Google Drive文件ID:', url);
      return url;
    }
    
    // 验证文件ID格式（基本的格式检查）
    if (fileId.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      console.warn(`提取的文件ID格式可能不正确: ${fileId}`);
    }
    
    // 优先使用Google API链接，这是最可靠的方法
    // 注意：使用此链接需要正确配置OAuth认证
    const apiLink = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    console.log('转换为Google API下载链接:', apiLink);
    
    // 传递文件ID作为自定义URL属性，便于后续处理
    Object.defineProperty(apiLink, 'googleDriveFileId', {
      value: fileId,
      enumerable: false,
      writable: false
    });
    
    return apiLink;
  } catch (error) {
    console.error('Google Drive链接转换失败:', error);
    return url;
  }
};

// 从URL获取文件扩展名
const getFileExtension = (url: string): string => {
  // 移除URL参数
  const cleanUrl = url.split('?')[0];
  
  // 尝试从路径中获取扩展名
  const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
  if (match && match[1]) {
    return `.${match[1].toLowerCase()}`;
  }
  
  // 默认返回.jpg
  return '.jpg';
};

// 处理大型 Google Drive 文件的确认页面
const handleGoogleDriveConfirmPage = async (url: string): Promise<string> => {
  if (!url.includes('drive.google.com')) return url;
  
  try {
    // 提取文件ID
    const fileId = url.match(/id=([^&]+)/)?.[1];
    if (!fileId) return url;
    
    console.log(`处理Google Drive可能的确认页面, 文件ID: ${fileId}`);
    
    // 构建头部
    const headers = await applyGoogleCookiesToRequest();
    
    // 首先尝试使用直接文件下载URL（避免确认页面）
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&authuser=0`;
    
    try {
      console.log(`尝试直接使用确认令牌访问: ${directUrl}`);
      const directResponse = await axios.head(directUrl, {
        headers: await applyGoogleCookiesToRequest(),
        maxRedirects: 5,
        validateStatus: status => status < 400,
        timeout: 10000
      });
      
      // 如果HEAD请求成功，可以直接使用这个URL
      if (directResponse.status < 400) {
        console.log('直接使用确认令牌成功，使用直接链接');
        return directUrl;
      }
    } catch (headError) {
      console.log('直接使用确认令牌失败，尝试获取页面提取token');
    }
    
    // 尝试获取确认页面
    const response = await axios({
      method: 'GET',
      url: url,
      headers,
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400,
      timeout: 10000
    });
    
    // 如果是确认页面，提取确认 token
    if (response.data && typeof response.data === 'string') {
      const htmlData = response.data;
      
      // 查找确认token
      let confirmToken = '';
      
      // 尝试多种模式
      const confirmPatterns = [
        /confirm=([0-9A-Za-z]+)/,
        /confirm=([t0-9A-Za-z]+)/,
        /id=[\w-]+&confirm=([t0-9A-Za-z]+)/,
        /&confirm=([0-9A-Za-z]+)/,
        /download&confirm=([^&"]+)/
      ];
      
      for (const pattern of confirmPatterns) {
        const match = htmlData.match(pattern);
        if (match && match[1]) {
          confirmToken = match[1];
          break;
        }
      }
      
      if (confirmToken) {
        console.log(`找到确认token: ${confirmToken} 用于文件 ${fileId}`);
        // 构建新URL，包含authuser参数
        const newUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}&authuser=0`;
        return newUrl;
      }
      
      // 尝试通过按钮或表单查找
      if (htmlData.includes('form') || htmlData.includes('download')) {
        const dom = new JSDOM(htmlData);
        const document = dom.window.document;
        
        // 尝试找到确认下载的表单
        const form = document.querySelector('form[action*="download"]');
        if (form) {
          const formAction = form.getAttribute('action') || '';
          console.log('找到下载表单，动作:', formAction);
          
          if (formAction.includes('confirm=')) {
            const formTokenMatch = formAction.match(/confirm=([^&]+)/);
            if (formTokenMatch && formTokenMatch[1]) {
              confirmToken = formTokenMatch[1];
              console.log(`从表单获取确认token: ${confirmToken}`);
              
              // 构建完整URL，包含authuser参数
              return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}&authuser=0`;
            }
          }
        }
        
        // 尝试找到确认按钮
        const confirmButton = document.querySelector('a[href*="confirm"]') || document.querySelector('a[href*="download"]');
        if (confirmButton) {
          const buttonHref = confirmButton.getAttribute('href') || '';
          console.log('找到确认按钮，链接:', buttonHref);
          
          // 从按钮获取token或构建新URL
          if (buttonHref.includes('confirm=')) {
            const buttonTokenMatch = buttonHref.match(/confirm=([^&]+)/);
            if (buttonTokenMatch && buttonTokenMatch[1]) {
              confirmToken = buttonTokenMatch[1];
              console.log(`从按钮获取确认token: ${confirmToken}`);
              
              // 返回新的URL，确保包含authuser参数
              if (buttonHref.startsWith('http')) {
                // 已经是完整URL，检查并添加authuser参数
                const buttonUrl = new URL(buttonHref);
                if (!buttonUrl.searchParams.has('authuser')) {
                  buttonUrl.searchParams.append('authuser', '0');
                }
                return buttonUrl.toString();
              } else if (buttonHref.startsWith('/')) {
                // 相对URL，构建完整URL
                return `https://drive.google.com${buttonHref}${buttonHref.includes('?') ? '&' : '?'}authuser=0`;
              } else {
                // 构建标准格式URL
                return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}&authuser=0`;
              }
            }
          }
          
          // 如果按钮链接不包含confirm但包含download和id
          if (buttonHref.includes('download') && buttonHref.includes('id=')) {
            console.log('从按钮链接提取下载信息');
            return `https://drive.google.com${buttonHref.startsWith('/') ? '' : '/'}${buttonHref}${buttonHref.includes('?') ? '&' : '?'}authuser=0`;
          }
        }
      }
    }
    
    // 如果无法识别确认页面，添加标准确认参数
    console.log('未能识别确认页面，添加通用确认参数');
    
    if (url.includes('confirm=')) {
      // 确保URL包含authuser参数
      return url.includes('authuser=') ? url : `${url}&authuser=0`;
    } else {
      return `${url}&confirm=t&authuser=0`;
    }
    
  } catch (error: unknown) {
    console.error('处理确认页面出错:', error);
    // 出错时添加通用确认参数
    if (!url.includes('confirm=')) {
      url = `${url}&confirm=t`;
    }
    if (!url.includes('authuser=')) {
      url = `${url}&authuser=0`;
    }
    return url;
  }
};

// 修改processImageUrl函数的返回类型
interface ProcessImageUrlResult {
  success: boolean;
  error?: string;
  data?: {
    imageId?: string;
    imagesCount?: number;
  };
}

// 判断URL是否为Google Drive文件夹链接
const isGoogleDriveFolderLink = (url: string): boolean => {
  const pattern = /drive\.google\.com.*folders/i;
  return pattern.test(url);
};

// 处理图片URL
export const processImageUrl = async (orderId: string, url: string, type: string): Promise<ProcessImageUrlResult> => {
  try {
    // 检查是否为Google Drive文件夹
    if (isGoogleDriveFolder(url)) {
      // 使用新的服务处理文件夹链接
      const folderResult = await processGoogleDriveFolder(orderId, url, type);
      if (folderResult.success) {
        // 将文件夹中的图片加入下载队列
        const folderId = folderResult.folderId;
        const images = await Image.findAll({
          where: {
            orderId,
            sourceFolderId: folderId
          }
        });
        
        for (const image of images) {
          if (!downloadQueue.includes(image.id)) {
            downloadQueue.push(image.id);
          }
        }
        
        processDownloadQueue();
        
        return {
          success: true,
          data: { imageId: folderId }
        };
      }
      return folderResult;
    }
    
    // 对于普通链接，创建图片记录（只保存必要信息，不设置localPath）
    const image = await Image.create({
      orderId: orderId,
      originalUrl: url,
      type: type,
      downloadStatus: 'pending',
      downloadAttempts: 0
    });
    
    // 将图片加入下载队列
    if (!downloadQueue.includes(image.id)) {
      downloadQueue.push(image.id);
    }
    
    // 处理队列，但控制并发数量
    processDownloadQueue();
    
    return { success: true, data: { imageId: image.id } };
  } catch (error) {
    console.error('处理图片URL失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '处理图片URL失败' 
    };
  }
};

// 批量处理多个图片URL
export const processBatchImageUrls = async (batchData: {orderId: string, url: string, type: string}[]): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: string[];
}> => {
  try {
    if (!batchData || batchData.length === 0) {
      return { success: false, processedCount: 0, failedCount: 0, errors: ['没有提供图片数据'] };
    }
    
    console.log(`批量处理 ${batchData.length} 个图片URL`);
    
    // 筛选出普通图片链接和文件夹链接
    const normalLinks = batchData.filter(item => !isGoogleDriveFolderLink(item.url));
    const folderLinks = batchData.filter(item => isGoogleDriveFolderLink(item.url));
    
    console.log(`其中普通链接 ${normalLinks.length} 个，文件夹链接 ${folderLinks.length} 个`);
    
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const processedRecords: string[] = []; // 记录处理成功的链接
    const failedRecords: string[] = []; // 记录处理失败的链接
    
    // 处理普通链接，批量创建记录
    if (normalLinks.length > 0) {
      try {
        // 准备批量创建的数据
        const imageDataToCreate = normalLinks.map(item => ({
          orderId: item.orderId,
          originalUrl: item.url,
          type: item.type,
          downloadStatus: 'pending',
          downloadAttempts: 0
        }));
        
        // 批量创建图片记录
        const images = await Image.bulkCreate(imageDataToCreate);
        
        // 将创建的图片ID添加到下载队列
        for (const image of images) {
          if (!downloadQueue.includes(image.id)) {
            downloadQueue.push(image.id);
          }
        }
        
        processedCount += images.length;
        // 记录成功处理的链接
        processedRecords.push(...normalLinks.map(item => item.url));
        console.log(`成功批量创建 ${images.length} 条普通图片记录`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '批量创建图片记录失败';
        console.error('批量创建图片记录失败:', error);
        failedCount += normalLinks.length;
        // 记录失败的链接
        failedRecords.push(...normalLinks.map(item => item.url));
        errors.push(`普通链接处理失败: ${errorMessage}`);
      }
    }
    
    // 处理文件夹链接，逐个处理，但增加延迟
    if (folderLinks.length > 0) {
      console.log(`开始处理 ${folderLinks.length} 个文件夹链接`);
      
      for (let i = 0; i < folderLinks.length; i++) {
        const item = folderLinks[i];
        console.log(`处理文件夹链接 ${i + 1}/${folderLinks.length}: ${item.url}`);
        
        try {
          // 每处理一个文件夹链接，都加一个短暂延迟减轻服务器压力
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          const result = await processGoogleDriveFolder(item.orderId, item.url, item.type);
          
          if (result.success) {
            // 获取文件夹中的图片数量
            const images = await Image.findAll({
              where: {
                orderId: item.orderId,
                sourceFolderId: result.folderId
              }
            });
            
            const count = images.length;
            processedCount += count;
            processedRecords.push(item.url); // 记录成功处理的文件夹链接
            console.log(`文件夹处理成功: ${item.url}, 创建了 ${count} 条图片记录`);
          } else {
            failedCount++;
            failedRecords.push(item.url); // 记录失败的文件夹链接
            const errorMsg = `文件夹链接处理失败 (${item.url}): ${result.error || '未知错误'}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '文件夹处理失败';
          console.error(`处理文件夹链接出错 (${item.url}):`, error);
          failedCount++;
          failedRecords.push(item.url); // 记录失败的文件夹链接
          errors.push(`文件夹链接处理异常 (${item.url}): ${errorMessage}`);
        }
      }
      
      console.log(`文件夹链接处理完成，成功: ${processedRecords.filter(url => url.includes('folders')).length}个, 失败: ${failedRecords.filter(url => url.includes('folders')).length}个`);
    }
    
    // 记录详细的成功失败统计
    console.log(`处理结果统计 - 总计: ${batchData.length}, 成功: ${processedCount}, 失败: ${failedCount}`);
    if (processedRecords.length > 0) {
      console.log(`成功处理的链接: ${processedRecords.length > 10 ? processedRecords.length + '个' : processedRecords.join(', ')}`);
    }
    if (failedRecords.length > 0) {
      console.log(`失败处理的链接: ${failedRecords.length > 10 ? failedRecords.length + '个' : failedRecords.join(', ')}`);
    }
    
    // 开始处理下载队列
    processDownloadQueue();
    
    return { 
      success: processedCount > 0, 
      processedCount, 
      failedCount, 
      errors: errors.length > 0 ? errors : undefined 
    };
  } catch (error) {
    console.error('批量处理图片URL失败:', error);
    return { 
      success: false, 
      processedCount: 0, 
      failedCount: batchData.length, 
      errors: [error instanceof Error ? error.message : '批量处理失败'] 
    };
  }
};

// 获取自动重试队列信息
export const getAutoRetryQueueInfo = (): { imageId: string, retryTime: number }[] => {
  return [...autoRetryQueue].map(item => ({
    imageId: item.imageId,
    retryTime: item.retryTime
  }));
};

/**
 * 获取下载统计信息
 */
export const getDownloadStats = async (): Promise<{
  pending: number;
  downloading: number;
  completed: number;
  failed: number;
  total: number;
  retryQueueSize: number;
}> => {
  try {
    // 获取各种状态的图片数量
    const [pending, downloading, completed, failed, total] = await Promise.all([
      Image.count({ where: { downloadStatus: 'pending' } }),
      Image.count({ where: { downloadStatus: 'downloading' } }),
      Image.count({ where: { downloadStatus: 'completed' } }),
      Image.count({ where: { downloadStatus: 'failed' } }),
      Image.count()
    ]);
    
    return {
      pending,
      downloading,
      completed,
      failed,
      total,
      retryQueueSize: autoRetryQueue.length
    };
  } catch (error) {
    console.error('获取下载统计信息失败:', error);
    return {
      pending: 0,
      downloading: 0,
      completed: 0,
      failed: 0,
      total: 0,
      retryQueueSize: autoRetryQueue.length
    };
  }
};

/**
 * 获取失败的下载列表
 */
export const getFailedDownloads = async (limit: number = 100, offset: number = 0): Promise<{
  total: number;
  items: any[];
}> => {
  try {
    const total = await Image.count({
      where: { downloadStatus: 'failed' }
    });
    
    const failedImages = await Image.findAll({
      where: { downloadStatus: 'failed' },
      order: [['lastAttemptAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: Order,
        attributes: ['id', 'customerNo', 'name', 'customerSku'],
        as: 'Order'
      }]
    });
    
    // 转换为前端需要的格式
    const items = failedImages.map(image => {
      const item = image.toJSON();
      // 添加orderInfo字段
      if (item.Order) {
        item.orderInfo = {
          customerNo: item.Order.customerNo,
          customerSku: item.Order.customerSku,
          name: item.Order.name
        };
      }
      return item;
    });
    
    return {
      total,
      items
    };
  } catch (error) {
    console.error('获取失败下载列表出错:', error);
    return {
      total: 0,
      items: []
    };
  }
};

/**
 * 获取成功的下载列表
 */
export const getSuccessfulDownloads = async (limit: number = 100, offset: number = 0): Promise<{
  total: number;
  items: any[];
}> => {
  try {
    const total = await Image.count({
      where: { downloadStatus: 'completed' }
    });
    
    const completedImages = await Image.findAll({
      where: { downloadStatus: 'completed' },
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: Order,
        attributes: ['id', 'customerNo', 'name', 'customerSku'],
        as: 'Order'
      }]
    });
    
    // 转换为前端需要的格式
    const items = completedImages.map(image => {
      const item = image.toJSON();
      // 添加orderInfo字段
      if (item.Order) {
        item.orderInfo = {
          customerNo: item.Order.customerNo,
          customerSku: item.Order.customerSku,
          name: item.Order.name
        };
      }
      return item;
    });
    
    return {
      total,
      items
    };
  } catch (error) {
    console.error('获取成功下载列表出错:', error);
    return {
      total: 0,
      items: []
    };
  }
};

/**
 * 获取图片下载详细日志
 */
export const getImageDownloadLog = async (imageId: string): Promise<{
  image: any;
  order: any;
} | null> => {
  try {
    const image = await Image.findByPk(imageId, {
      include: [{
        model: Order,
        attributes: ['id', 'customerNo', 'name', 'mockupImage', 'materialImage'],
        as: 'Order'
      }]
    });
    
    if (!image) {
      return null;
    }
    
    // 正确获取关联的订单对象
    const order = (image as any).Order;
    
    return {
      image,
      order
    };
  } catch (error) {
    console.error(`获取图片 ${imageId} 下载日志失败:`, error);
    return null;
  }
};

// 处理文件夹下载完成的函数
const updateFolderDownloadStatus = async (folderId: string, orderId: string, increment: boolean, error?: string) => {
  try {
    // 查找文件夹状态记录
    const folderStatus = await FolderDownloadStatus.findOne({
      where: { folderId, orderId }
    });
    
    if (!folderStatus) return; // 如果没有找到记录，直接返回
    
    if (increment) {
      // 增加已完成计数
      await folderStatus.increment('completedCount');
      
      // 检查是否所有文件都已下载完成
      const updated = await folderStatus.reload();
      if (updated.completedCount >= updated.totalCount) {
        // 更新为已完成状态
        await updated.update({
          status: 'completed',
          completedTime: new Date()
        });
        console.log(`文件夹 ${folderId} 下载已全部完成`);
      }
    } else if (error) {
      // 记录错误
      await folderStatus.update({
        status: 'failed',
        completedTime: new Date(),
        errorMessage: error
      });
      console.log(`文件夹 ${folderId} 下载失败: ${error}`);
    }
  } catch (err) {
    console.error('更新文件夹下载状态失败:', err);
  }
};

/**
 * 获取文件夹下载状态列表
 */
export const getFolderDownloadStatus = async (limit: number = 100, offset: number = 0): Promise<any[]> => {
  try {
    const folders = await FolderDownloadStatus.findAll({
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: Order,
        attributes: ['id', 'customerNo', 'customerSku', 'name'],
        as: 'Order'
      }]
    });
    
    return folders;
  } catch (error) {
    console.error('获取文件夹下载状态列表出错:', error);
    return [];
  }
};

/**
 * 获取特定文件夹的下载详情，包括其中的图片下载状态
 */
export const getFolderDownloadDetail = async (folderId: string, orderId: string): Promise<{
  folder: any;
  images: any[];
} | null> => {
  try {
    // 查询文件夹状态
    const folder = await FolderDownloadStatus.findOne({
      where: { folderId, orderId },
      include: [{
        model: Order,
        attributes: ['id', 'customerNo', 'customerSku', 'name'],
        as: 'Order'
      }]
    });
    
    if (!folder) {
      return null;
    }
    
    // 查询该文件夹下的所有图片
    const images = await Image.findAll({
      where: { 
        sourceFolderId: folderId,
        orderId
      },
      order: [['downloadStatus', 'ASC'], ['updatedAt', 'DESC']]
    });
    
    return {
      folder,
      images
    };
  } catch (error) {
    console.error(`获取文件夹 ${folderId} 下载详情失败:`, error);
    return null;
  }
}; 