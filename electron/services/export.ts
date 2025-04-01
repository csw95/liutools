// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
import * as ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
// 转换的import
const { app, dialog  } = require('electron');
import Order from '../../database/models/order';
import Batch from '../../database/models/batch';
import Image from '../../database/models/image';
import { formatDate } from '../utils/dateUtils';
import { Op } from 'sequelize';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
// 转换的import
const config = require('../config');
import { getConfig } from '../services/config';

// 导出设置
const DEFAULT_EXPORT_PATH = path.join(app.getPath('userData'), 'exports');

// 确保导出目录存在
if (!fs.existsSync(DEFAULT_EXPORT_PATH)) {
  fs.mkdirSync(DEFAULT_EXPORT_PATH, { recursive: true });
}

// 获取图片的完整路径
const getFullImagePath = (image: any): string => {
  // 如果有绝对路径，直接使用
  if (image.absolutePath && fs.existsSync(image.absolutePath)) {
    return image.absolutePath;
  }
  
  // 如果只有相对路径，使用下载路径拼接
  if (image.localPath) {
    const downloadPath = getConfig('downloadPath');
    const fullPath = path.join(downloadPath, image.localPath);
    
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // 返回原始路径，后续会检查文件是否存在
  return image.localPath || '';
};

// 导出订单
export const exportOrders = async (batchId?: string, orderIds?: string[]) => {
  try {
    let orders: any[] = [];
    let exportName = '订单导出';
    
    // 查询条件
    const whereCondition: any = {};
    
    if (orderIds && orderIds.length > 0) {
      // 导出指定订单
      whereCondition.id = { [Op.in]: orderIds };
      exportName = `选中订单导出-${formatDate(new Date())}`;
    } else if (batchId) {
      // 导出批次订单
      whereCondition.batchId = batchId;
      const batch = await Batch.findByPk(batchId);
      exportName = `${batch?.name || '批次'}-发货单-${formatDate(new Date())}`;
    } else {
      // 导出所有订单
      exportName = `全部订单导出-${formatDate(new Date())}`;
    }
    
    // 查询订单数据
    orders = await Order.findAll({
      where: whereCondition,
      include: [
        {
          model: Image,
          as: 'Images',
          where: {
            type: 'mockup',
            downloadStatus: 'completed'
          },
          required: false
        }
      ]
    });
    
    if (orders.length === 0) {
      return {
        success: false,
        error: '没有找到符合条件的订单'
      };
    }
    
    // 选择保存路径
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存发货单',
      defaultPath: path.join(DEFAULT_EXPORT_PATH, `${exportName}.xlsx`),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }
    
    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('发货单');
    
    // 设置表头
    worksheet.columns = [
      { header: '客户订单号', key: 'customerNo', width: 20 },
      { header: '客户SKU', key: 'customerSku', width: 20 },
      { header: 'SPU', key: 'spu', width: 15 },
      { header: '尺码', key: 'size', width: 10 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '图片', key: 'image', width: 40 }
    ];
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // 添加数据行
    for (const order of orders) {
      // 添加基本数据
      const rowData = {
        customerNo: order.customerNo,
        customerSku: order.customerSku,
        spu: order.spu,
        size: order.size,
        quantity: order.quantity
      };
      
      const row = worksheet.addRow(rowData);
      
      // 设置行高以适应图片
      row.height = 120;
      
      // 获取图片单元格
      const imageCell = row.getCell('image');
      
      // 插入图片
      if (order.Images && order.Images.length > 0) {
        // 最多插入4张图片
        const imagesToInsert = order.Images.slice(0, 4);
        
        // 创建图片的HTML表示
        let imageHtml = '<div style="display:flex;flex-wrap:wrap;">';
        
        for (const image of imagesToInsert) {
          const imagePath = getFullImagePath(image);
          if (imagePath && fs.existsSync(imagePath)) {
            try {
              // 读取图片并插入到单元格
              const ext = path.extname(imagePath).substring(1);
              const fixedExt = ext === 'jpg' ? 'jpeg' : ext;
              
              const imageId = workbook.addImage({
                filename: imagePath,
                extension: (fixedExt as 'jpeg' | 'png' | 'gif'),
              });
              
              // 计算图片位置 (每行最多2张图片，每列最多2张图片)
              const imageIndex = imagesToInsert.indexOf(image);
              const col = imageIndex % 2;
              const rowIndex = Math.floor(imageIndex / 2);
              
              // 在单元格中插入图片
              worksheet.addImage(imageId, `F${row.number}:G${row.number}`);
            } catch (error) {
              console.error('插入图片失败:', error);
            }
          }
        }
        
        imageHtml += '</div>';
        
        // 通过HTML插入图片(备用方案)
        // imageCell.value = { hyperlink: '#', text: imageHtml };
        // imageCell.alignment = { wrapText: true };
      }
    }
    
    // 保存工作簿
    await workbook.xlsx.writeFile(filePath);
    
    return {
      success: true,
      filePath,
      message: `已成功导出 ${orders.length} 条订单数据`
    };
  } catch (error) {
    console.error('导出订单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出过程出错'
    };
  }
};

/**
 * 导出批次中的图片为ZIP文件
 * 按SKU分组图片到不同文件夹
 */
export const exportBatchImages = async (batchId: string) => {
  try {
    // 确认批次存在
    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return {
        success: false,
        error: '批次不存在'
      };
    }

    // 查询批次下所有订单及已下载完成的图片
    const orders = await Order.findAll({
      where: { batchId },
      include: [{
        model: Image,
        as: 'Images',
        where: { downloadStatus: 'completed' },
        required: false
      }]
    });

    if (orders.length === 0) {
      return {
        success: false,
        error: '该批次没有订单'
      };
    }

    // 创建一个Map按SKU分组
    const skuMap = new Map<string, {order: any, images: any[]}[]>();
    // 添加一个Set记录已处理过的原始URL，用于去重
    const processedUrls = new Set<string>();
    // 添加一个Map记录sourceFolderId和originalUrl的关系，用于更好地分组文件夹下载的图片
    const folderImageMap = new Map<string, Map<string, any[]>>();
    
    let totalImagesCount = 0;

    // 按SKU分组订单和图片
    for (const order of orders) {
      // 手动类型转换，因为TS不认识动态关联
      const typedOrder = order as any;
      if (!typedOrder.Images || typedOrder.Images.length === 0) continue;
      
      // 使用customerSku作为分组键
      const sku = typedOrder.customerSku || 'unknown_sku';
      
      // 确保SKU存在于Map中
      if (!skuMap.has(sku)) {
        skuMap.set(sku, []);
      }
      
      // 筛选未处理过的图片（根据URL去重）
      const uniqueImages = typedOrder.Images.filter((image: any) => {
        if (processedUrls.has(image.originalUrl)) {
          // 如果已经处理过该URL，跳过
          return false;
        }
        
        // 将该URL标记为已处理
        processedUrls.add(image.originalUrl);
        
        // 如果来自文件夹，记录到folderImageMap中
        if (image.sourceFolderId) {
          if (!folderImageMap.has(image.sourceFolderId)) {
            folderImageMap.set(image.sourceFolderId, new Map());
          }
          const urlMap = folderImageMap.get(image.sourceFolderId)!;
          if (!urlMap.has(image.originalUrl)) {
            urlMap.set(image.originalUrl, []);
          }
          urlMap.get(image.originalUrl)!.push(image);
        }
        
        return true;
      });
      
      // 添加当前订单到对应SKU组，只包含去重后的图片
      skuMap.get(sku)?.push({
        order: typedOrder,
        images: uniqueImages
      });
      
      totalImagesCount += uniqueImages.length;
    }

    if (totalImagesCount === 0) {
      return {
        success: false,
        error: '没有找到已下载的图片'
      };
    }

    // 选择保存路径
    const exportName = `${batch.name || '批次'}-图片导出-${formatDate(new Date())}`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存图片ZIP包',
      defaultPath: path.join(DEFAULT_EXPORT_PATH, `${exportName}.zip`),
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // 创建ZIP文件
    const zip = new AdmZip();
    const processedPaths = new Set<string>(); // 用于记录已处理过的图片路径，避免重复

    // 按SKU分组创建文件夹并添加图片
    // 将Map.entries()转换为数组后再遍历，避免TypeScript迭代器兼容性问题
    Array.from(skuMap.entries()).forEach(([sku, orderGroup]) => {
      // 创建该SKU的文件夹
      const folderName = sanitizeFolderName(sku);
      
      for (const { order, images } of orderGroup) {
        for (const image of images) {
          const imagePath = getFullImagePath(image);
          
          if (imagePath && fs.existsSync(imagePath)) {
            try {
              // 获取文件扩展名
              const ext = path.extname(imagePath);
              
              // 如果已经处理过该图片，则跳过
              if (processedPaths.has(imagePath)) {
                continue;
              }
              
              // 根据图片类型和来源生成文件名
              let fileName: string;
              if (image.sourceFolderId) {
                // 如果是来自文件夹的图片，使用特殊命名规则
                const folderUrlMap = folderImageMap.get(image.sourceFolderId);
                const imagesWithSameUrl = folderUrlMap?.get(image.originalUrl) || [];
                const imageIndex = imagesWithSameUrl.indexOf(image);
                
                if (image.type === 'mockup') {
                  fileName = `Mockup_Folder_${image.sourceFolderId.substring(0, 8)}_${imageIndex}${ext}`;
                } else if (image.type === 'material') {
                  fileName = `Material_Folder_${image.sourceFolderId.substring(0, 8)}_${imageIndex}${ext}`;
                } else {
                  fileName = `Image_Folder_${image.sourceFolderId.substring(0, 8)}_${imageIndex}${ext}`;
                }
              } else {
                // 非文件夹图片使用原来的命名规则
                if (image.type === 'mockup') {
                  fileName = `Mockup_${order.customerNo || order.id}${ext}`;
                } else if (image.type === 'material') {
                  fileName = `Material_${order.customerNo || order.id}${ext}`;
                } else {
                  fileName = `Image_${uuidv4().substring(0, 8)}${ext}`;
                }
              }
              
              // 将图片添加到ZIP中对应的SKU文件夹
              zip.addLocalFile(imagePath, folderName, fileName);
              
              // 标记该图片已处理
              processedPaths.add(imagePath);
            } catch (error) {
              console.error(`添加图片到ZIP失败: ${imagePath}`, error);
              // 继续处理其他图片
            }
          }
        }
      }
    });

    // 写入ZIP文件
    zip.writeZip(filePath);

    return {
      success: true,
      filePath,
      message: `已成功导出 ${processedPaths.size} 张图片，包含 ${skuMap.size} 个SKU分组`
    };
  } catch (error) {
    console.error('导出批次图片失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出过程出错'
    };
  }
};

/**
 * 清理文件夹名称，移除不安全字符
 */
const sanitizeFolderName = (name: string): string => {
  // 替换不安全的文件夹名称字符
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'unnamed';
}; 