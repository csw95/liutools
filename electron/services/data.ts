import Batch from '../../database/models/batch';
import Order from '../../database/models/order';
import Image from '../../database/models/image';
import FolderDownloadStatus from '../../database/models/folderDownloadStatus';
import GoogleAuth from '../../database/models/googleAuth';
import { Op } from 'sequelize';
import sequelize from './database';

// 导出模型以便其他模块可以使用
export { Batch, Order, Image, FolderDownloadStatus, GoogleAuth };

// 批次相关
export const getBatches = async () => {
  try {
    const batches = await Batch.findAll({
      order: [['importDate', 'DESC']],
      include: [{ model: Order, as: 'Orders' }]
    });
    
    console.log(`获取到 ${batches.length} 个批次`);
    
    // 使用toJSON方法将Sequelize模型实例转换为纯JSON对象
    const batchesJSON = batches.map(batch => {
      const batchData = batch.toJSON();
      // 确保Orders是数组
      if (!Array.isArray(batchData.Orders)) {
        batchData.Orders = [];
      }
      return batchData;
    });
    
    return { success: true, data: batchesJSON };
  } catch (error) {
    console.error('获取批次列表失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '获取批次失败' };
  }
};

export const getBatchById = async (id: string) => {
  try {
    const batch = await Batch.findByPk(id, {
      include: [{ model: Order, as: 'Orders' }]
    });
    
    if (!batch) {
      return { success: false, error: '批次不存在' };
    }
    
    // 将模型实例转换为纯JSON对象
    const batchJSON = batch.toJSON();
    
    return { success: true, data: batchJSON };
  } catch (error) {
    console.error(`获取批次 ${id} 失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '获取批次失败' };
  }
};

export const updateBatch = async (batchData: any) => {
  try {
    const batch = await Batch.findByPk(batchData.id);
    if (!batch) {
      return { success: false, error: '批次不存在' };
    }
    
    await batch.update(batchData);
    return { success: true, data: batch.toJSON() };
  } catch (error) {
    console.error('更新批次失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '更新批次失败' };
  }
};

export const deleteBatch = async (id: string) => {
  try {
    console.log('正在尝试删除批次，ID:', id, 'ID类型:', typeof id);
    
    if (!id) {
      console.error('删除批次失败: ID为空');
      return { success: false, error: '批次ID不能为空' };
    }
    
    // 使用事务确保数据一致性
    const transaction = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(id, { transaction });
      console.log('查询到的批次:', batch ? '存在' : '不存在');
      
      if (!batch) {
        await transaction.rollback();
        return { success: false, error: '批次不存在' };
      }
      
      // 查询批次下的所有订单
      const orders = await Order.findAll({ 
        where: { batchId: id },
        transaction
      });
      
      console.log(`删除批次前，正在删除批次下的 ${orders.length} 个订单`);
      
      // 对每个订单，先删除其关联的文件夹状态和图片，再删除订单
      for (const order of orders) {
        // 先删除与订单关联的所有文件夹下载状态
        await FolderDownloadStatus.destroy({
          where: { orderId: order.id },
          transaction
        });
        
        // 然后删除与订单关联的所有图片
        await Image.destroy({
          where: { orderId: order.id },
          transaction
        });
        
        // 最后删除订单
        await order.destroy({ transaction });
      }
      
      // 删除批次
      await batch.destroy({ transaction });
      
      // 提交事务
      await transaction.commit();
      
      return { success: true };
    } catch (error) {
      // 出错时回滚事务
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`删除批次 ${id} 失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '删除批次失败' };
  }
};

// 订单相关
export const getOrders = async (batchId?: string) => {
  try {
    const where = batchId ? { batchId } : {};
    const orders = await Order.findAll({
      where,
      include: [{
        model: Image,
        as: 'Images',
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // 将模型实例转换为纯JSON对象
    const ordersJSON = orders.map(order => order.toJSON());
    
    return { success: true, data: ordersJSON };
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '获取订单失败' };
  }
};

export const getOrderById = async (id: string) => {
  try {
    console.log(`正在获取订单，ID: ${id}`);
    
    // 检查ID有效性
    if (!id) {
      console.error('无效的订单ID: 为空');
      return { success: false, error: '无效的订单ID' };
    }
    
    // 获取订单及其图片
    const order = await Order.findByPk(id, {
      include: [
        {
          model: Image,
          as: 'Images', // 确保使用正确的关联名称
          required: false // 让JOIN是LEFT JOIN，即使没有图片也能返回订单
        }
      ]
    });
    
    // 检查订单是否存在
    if (!order) {
      console.error(`订单不存在，ID: ${id}`);
      return { success: false, error: '订单不存在' };
    }
    
    // 将模型实例转换为纯JSON对象
    const orderJSON = order.toJSON();
    console.log(`成功获取到订单 ${id}，包含图片数: ${orderJSON.Images?.length || 0}`);
    
    return { success: true, data: orderJSON };
  } catch (error) {
    console.error(`获取订单 ${id} 失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '获取订单失败' };
  }
};

export const updateOrder = async (orderData: any) => {
  try {
    const order = await Order.findByPk(orderData.id);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    await order.update(orderData);
    return { success: true, data: order.toJSON() };
  } catch (error) {
    console.error('更新订单失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '更新订单失败' };
  }
};

export const deleteOrder = async (id: string) => {
  try {
    if (!id) {
      return { success: false, error: '订单ID不能为空' };
    }
    
    // 使用事务确保数据一致性
    const transaction = await sequelize.transaction();
    
    try {
      const order = await Order.findByPk(id, { transaction });
      if (!order) {
        await transaction.rollback();
        return { success: false, error: '订单不存在' };
      }
      
      console.log(`正在删除订单 ID: ${id}`);
      
      // 先删除与订单关联的所有文件夹下载状态
      await FolderDownloadStatus.destroy({
        where: { orderId: id },
        transaction
      });
      
      // 然后删除与订单关联的所有图片
      await Image.destroy({
        where: { orderId: id },
        transaction
      });
      
      // 最后删除订单本身
      await order.destroy({ transaction });
      
      // 提交事务
      await transaction.commit();
      
      return { success: true };
    } catch (error) {
      // 出错时回滚事务
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`删除订单 ${id} 失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '删除订单失败' };
  }
};

export const markOrderAsShipped = async (id: string, trackingNo?: string) => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    await order.update({
      isShipped: true,
      trackingNo: trackingNo || undefined,
      shippedDate: new Date()
    });
    
    return { success: true, data: order.toJSON() };
  } catch (error) {
    console.error(`标记订单 ${id} 为已发货失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '标记订单失败' };
  }
};

// 获取下载状态统计
export const getDownloadStats = async () => {
  try {
    // 获取各种下载状态的数量
    const counts = await Image.findAll({
      attributes: [
        'downloadStatus',
        [sequelize.fn('COUNT', sequelize.col('downloadStatus')), 'count']
      ],
      group: ['downloadStatus']
    });
    
    // 最近失败的下载
    const recentFailures = await Image.findAll({
      where: {
        downloadStatus: 'failed'
      },
      order: [['lastAttemptAt', 'DESC']],
      limit: 10
    });
    
    // 转换为可序列化的JSON
    const statsData = {
      counts: counts.map(c => c.toJSON()),
      recentFailures: recentFailures.map(f => f.toJSON())
    };
    
    return { success: true, data: statsData };
  } catch (error) {
    console.error('获取下载统计信息失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '获取下载统计失败' };
  }
};

// 获取失败的图片下载记录
export const getFailedDownloads = async (limit = 50, offset = 0) => {
  try {
    const result = await Image.findAndCountAll({
      where: {
        downloadStatus: 'failed'
      },
      order: [['lastAttemptAt', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: Order,
          as: 'Order',
          attributes: ['id', 'customerNo', 'customerSku', 'name']
        }
      ]
    });
    
    return { 
      success: true, 
      data: {
        total: result.count,
        items: result.rows.map(r => r.toJSON())
      } 
    };
  } catch (error) {
    console.error('获取失败下载记录失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '获取失败下载记录失败' };
  }
};

// 获取图片下载日志统计
export const getImageDownloadLog = async (imageId: string) => {
  try {
    const image = await Image.findByPk(imageId, {
      include: [
        {
          model: Order,
          as: 'Order',
          attributes: ['id', 'customerNo', 'customerSku', 'name']
        }
      ]
    });
    
    if (!image) {
      return { success: false, error: '图片记录不存在' };
    }
    
    // 图片下载详情
    const imageJson = image.toJSON() as any; // 使用 any 类型避免 TypeScript 错误
    const details = {
      id: image.id,
      orderId: image.orderId,
      orderInfo: imageJson.Order ? {
        customerNo: imageJson.Order.customerNo,
        customerSku: imageJson.Order.customerSku,
        name: imageJson.Order.name
      } : null,
      originalUrl: image.originalUrl,
      localPath: image.localPath,
      type: image.type,
      downloadStatus: image.downloadStatus,
      downloadAttempts: image.downloadAttempts,
      lastAttemptAt: image.lastAttemptAt,
      errorMessage: image.errorMessage,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt
    };
    
    return { success: true, data: details };
  } catch (error) {
    console.error(`获取图片 ${imageId} 下载日志失败:`, error);
    return { success: false, error: error instanceof Error ? error.message : '获取图片下载日志失败' };
  }
};

// 获取已成功下载的图片列表
export const getSuccessfulDownloads = async (limit = 10, offset = 0) => {
  try {
    const count = await Image.count({
      where: {
        downloadStatus: 'completed',
        localPath: {
          [Op.not]: null
        }
      }
    });
    
    const images = await Image.findAll({
      where: {
        downloadStatus: 'completed',
        localPath: {
          [Op.not]: null
        }
      },
      include: [
        {
          model: Order,
          as: 'Order',
          attributes: ['id', 'customerNo', 'customerSku', 'name']
        }
      ],
      limit,
      offset,
      order: [['updatedAt', 'DESC']]
    });
    
    const formattedImages = images.map(image => {
      const imageJson = image.toJSON() as any;
      return {
        id: image.id,
        orderId: image.orderId,
        orderInfo: imageJson.Order ? {
          customerNo: imageJson.Order.customerNo,
          customerSku: imageJson.Order.customerSku,
          name: imageJson.Order.name
        } : null,
        originalUrl: image.originalUrl,
        localPath: image.localPath,
        type: image.type,
        downloadStatus: image.downloadStatus,
        downloadAttempts: image.downloadAttempts,
        lastAttemptAt: image.lastAttemptAt,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt
      };
    });
    
    return { 
      success: true, 
      data: {
        total: count,
        items: formattedImages
      }
    };
  } catch (error) {
    console.error('获取成功下载图片列表失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '获取成功下载图片列表失败' 
    };
  }
}; 