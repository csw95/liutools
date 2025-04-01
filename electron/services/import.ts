import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import Batch from '../../database/models/batch';
import Order from '../../database/models/order';
import Image from '../../database/models/image';
import { formatDate } from '../utils/dateUtils';
import sequelize from './database';
import { Transaction } from 'sequelize';
import { processImageUrl, processBatchImageUrls } from './download';

// 添加一个安全的值提取方法
const safeGetCellValue = (row: ExcelJS.Row, columnIndex: number, defaultValue: string = ''): string => {
  if (!columnIndex) return defaultValue;
  
  try {
    const cell = row.getCell(columnIndex);
    
    // 单元格为空
    if (!cell || cell.type === ExcelJS.ValueType.Null || cell.type === ExcelJS.ValueType.Merge) {
      return defaultValue;
    }
    
    // 获取单元格的值
    const value = cell.value;
    
    // 处理不同类型的值
    if (value === null || value === undefined) {
      return defaultValue;
    } else if (typeof value === 'string') {
      return value.trim();
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (typeof value === 'object') {
      // 处理富文本和其他复杂类型
      if ('text' in value && typeof value.text === 'string') {
        return value.text.trim();
      } else if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((rt: any) => rt.text || '').join('').trim();
      } else {
        console.warn(`未知的对象类型单元格值:`, value);
        return JSON.stringify(value);
      }
    } else {
      console.warn(`未知类型的单元格值: ${typeof value}`);
      return String(value);
    }
  } catch (error) {
    console.error(`获取单元格值出错 (列 ${columnIndex}):`, error);
    return defaultValue;
  }
};

// 定义图片处理信息接口
interface ImageToProcess {
  orderId: string;
  url: string;
  type: string;
}

// 导入订单
export const importOrders = async (customerName: string, amount: number, filePath: string) => {
  // 创建事务，确保数据一致性
  const transaction = await sequelize.transaction();
  
  try {
    // 创建新批次
    const batchName = `${customerName}-${amount}-${formatDate(new Date())}`;
    
    const batch = await Batch.create({
      name: batchName,
      customerName,
      amount,
      importDate: new Date()
    }, { transaction });
    
    // 读取Excel文件
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      await transaction.rollback();
      throw new Error('无法读取工作表');
    }
    
    // 获取表头行
    const headerRow = worksheet.getRow(1);
    const headers: { [key: number]: string } = {};
    
    // 解析表头
    headerRow.eachCell((cell, colNumber) => {
      // 将所有的表头转换为小写，并去除前后空格 
      const headerValue = cell.value?.toString() || '';
      headers[colNumber] = headerValue.toLowerCase().trim();
      console.log(`原始表头 ${colNumber}: "${headerValue}", 处理后: "${headers[colNumber]}"`);
    });
    
    // 检查必要的列是否存在
    const requiredColumns = [
      'customer no', 'customer sku', 'spu', 'size', 'quantity'
    ];
    
    // 添加列名别名支持
    const columnAliases: {[key: string]: string[]} = {
      'customer no': ['customer no', '客户订单号', '订单号', 'order no'],
      'customer sku': ['customer sku', '客户sku', 'sku'],
      'spu': ['spu', 'product code', '产品代码'],
      'size': ['size', '尺码', 'product size'],
      'quantity': ['quantity', '数量', 'qty'],
      'name': ['name', '收件人', '客户名称', 'customer name'],
      'country': ['country', '国家', 'ship to country'],
      'address01': ['address01', '地址', 'address', 'shipping address', '收件地址'],
      'province': ['province', 'state', '省份', '州'],
      'city': ['city', '城市'],
      'telephone': ['telephone', 'phone', '电话', '联系电话'],
      'address02': ['address02', '详细地址', 'address line 2'],
      'material image': ['material image', 'material', '素材图', '素材图链接'],
      'mockup image': ['mockup image', 'mockup', '效果图', '效果图链接']
    };
    
    // 检查每个必需的列
    const missingColumns: string[] = [];
    const columnMap: { [key: string]: number } = {};
    
    requiredColumns.forEach(requiredCol => {
      // 查找匹配的列（包括别名）
      const aliases = columnAliases[requiredCol] || [requiredCol];
      const foundColNumber = Object.entries(headers).find(([colNumber, header]) => 
        aliases.includes(header)
      )?.[0];
      
      if (foundColNumber) {
        columnMap[requiredCol] = parseInt(foundColNumber);
      } else {
        missingColumns.push(requiredCol);
      }
    });
    
    // 添加可选列
    Object.entries(headers).forEach(([colNumber, header]) => {
      const columnNumber = parseInt(colNumber);
      
      console.log(`处理列 ${colNumber}: "${header}"`);
      
      // 查找该列是否匹配任何别名
      for (const [key, aliases] of Object.entries(columnAliases)) {
        console.log(`- 检查是否匹配 ${key}, 别名:`, aliases);
        console.log(`- 是否包含: ${aliases.includes(header)}`);
        if (aliases.includes(header) && !Object.values(columnMap).includes(columnNumber)) {
          columnMap[key] = columnNumber;
          console.log(`✓ 匹配成功 ${key} = 列 ${columnNumber}`);
          break;
        }
      }
      
      // 如果没有匹配到别名，直接使用原始列名
      if (!Object.values(columnMap).includes(columnNumber)) {
        columnMap[header] = columnNumber;
        console.log(`使用原始列名 ${header} = 列 ${columnNumber}`);
      }
    });
    
    console.log('最终列映射:', columnMap);
    
    if (missingColumns.length > 0) {
      await transaction.rollback();
      throw new Error(`缺少必要的列: ${missingColumns.join(', ')}`);
    }
    
    // 批量创建订单
    const ordersData: any[] = [];
    const orderMap: { [key: string]: string } = {}; // 订单号 -> 订单ID映射
    const dataErrors: string[] = [];
    
    // 从第二行开始读取数据
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // 跳过空行
      if (row.cellCount === 0) {
        console.log(`第 ${rowNumber} 行: 跳过空行`);
        continue;
      }
      
      // 获取订单号
      const customerNoCell = row.getCell(columnMap['customer no']);
      console.log(`第 ${rowNumber} 行客户订单号单元格:`, 
                  `类型: ${customerNoCell.type}`, 
                  `原始值: ${JSON.stringify(customerNoCell.value)}`);
      
      const customerNo = safeGetCellValue(row, columnMap['customer no']);
      console.log(`第 ${rowNumber} 行客户订单号: "${customerNo}"`);
      
      if (!customerNo) {
        console.log(`第 ${rowNumber} 行: 跳过缺少订单号的行`);
        continue;
      }
      
      // 验证必填字段
      const validateField = (field: string, rowNum: number) => {
        const value = safeGetCellValue(row, columnMap[field]);
        if (!value || value.trim() === '') {
          dataErrors.push(`第 ${rowNum} 行的 "${field}" 字段为空`);
          return false;
        }
        return true;
      };
      
      // 验证必填字段
      const isValid = requiredColumns.every(column => validateField(column, rowNumber));
      
      if (!isValid) continue;
      
      // 检查是否为同一订单
      let orderId: string;
      if (orderMap[customerNo]) {
        orderId = orderMap[customerNo];
      } else {
        orderId = uuidv4();
        orderMap[customerNo] = orderId;
        
        // 获取并验证数量字段
        let quantity = 1;
        try {
          const qtyStr = safeGetCellValue(row, columnMap['quantity'], '1');
          quantity = parseInt(qtyStr);
          if (isNaN(quantity) || quantity <= 0) {
            dataErrors.push(`第 ${rowNumber} 行的数量值 "${qtyStr}" 无效，必须是正整数`);
            continue;
          }
        } catch (e) {
          dataErrors.push(`第 ${rowNumber} 行的数量解析失败`);
          continue;
        }
        
        // 创建新订单
        const orderData = {
          id: orderId,
          batchId: batch.id,
          customerNo,
          customerSku: safeGetCellValue(row, columnMap['customer sku']),
          spu: safeGetCellValue(row, columnMap['spu']),
          size: safeGetCellValue(row, columnMap['size']),
          quantity: quantity,
          name: safeGetCellValue(row, columnMap['name']),
          country: safeGetCellValue(row, columnMap['country']),
          province: safeGetCellValue(row, columnMap['province']),
          city: safeGetCellValue(row, columnMap['city']),
          telephone: safeGetCellValue(row, columnMap['telephone']),
          address01: safeGetCellValue(row, columnMap['address01']),
          address02: safeGetCellValue(row, columnMap['address02']),
          materialImage: safeGetCellValue(row, columnMap['material image']),
          mockupImage: safeGetCellValue(row, columnMap['mockup image']),
          isShipped: false
        };
        
        ordersData.push(orderData);
      }
    }
    
    // 如果有数据错误，回滚事务并返回错误信息
    if (dataErrors.length > 0) {
      await transaction.rollback();
      return { 
        success: false, 
        error: `Excel数据验证失败: ${dataErrors.join('; ')}` 
      };
    }
    
    // 如果没有有效订单数据，回滚并返回错误
    if (ordersData.length === 0) {
      await transaction.rollback();
      return { 
        success: false, 
        error: '未找到有效的订单数据' 
      };
    }
    
    // 批量创建订单
    await Order.bulkCreate(ordersData, { transaction });
    
    // 提交事务，释放数据库锁
    await transaction.commit();
    
    // 事务提交后再处理图片，避免长时间锁表
    // 收集所有需要处理的图片信息
    const imagesToProcess: ImageToProcess[] = [];
    
    // 收集所有图片处理任务
    for (const orderData of ordersData) {
      // 处理素材图
      if (orderData.materialImage) {
        // 确保图片链接是字符串
        const materialImage = typeof orderData.materialImage === 'object' 
          ? JSON.stringify(orderData.materialImage) 
          : String(orderData.materialImage);
        
        console.log(`处理素材图链接: ${materialImage}`);
        
        const urls = materialImage.split(',')
          .map((url: string) => url.trim())
          .filter(Boolean);
        
        console.log(`提取到 ${urls.length} 个素材图链接`);
        
        for (const url of urls) {
          // 确保URL是有效的
          if (!url || url === '[object Object]') {
            console.warn(`跳过无效的素材图URL: ${url}`);
            continue;
          }
          
          // 收集而不是立即处理
          imagesToProcess.push({
            orderId: orderData.id,
            url,
            type: 'material'
          });
        }
      }
      
      // 处理效果图
      if (orderData.mockupImage) {
        // 确保图片链接是字符串
        const mockupImage = typeof orderData.mockupImage === 'object' 
          ? JSON.stringify(orderData.mockupImage) 
          : String(orderData.mockupImage);
        
        console.log(`处理效果图链接: ${mockupImage}`);
        
        const urls = mockupImage.split(',')
          .map((url: string) => url.trim())
          .filter(Boolean);
        
        console.log(`提取到 ${urls.length} 个效果图链接`);
        
        for (const url of urls) {
          // 确保URL是有效的
          if (!url || url === '[object Object]') {
            console.warn(`跳过无效的效果图URL: ${url}`);
            continue;
          }
          
          // 收集而不是立即处理
          imagesToProcess.push({
            orderId: orderData.id,
            url,
            type: 'mockup'
          });
        }
      }
    }
    
    // 使用setTimeout异步处理图片，避免阻塞主流程
    setTimeout(async () => {
      try {
        console.log(`开始处理 ${imagesToProcess.length} 个图片URL`);
        
        // 设置处理批次大小
        const batchSize = 10;
        
        // 分批处理图片
        for (let i = 0; i < imagesToProcess.length; i += batchSize) {
          const batch = imagesToProcess.slice(i, i + batchSize);
          console.log(`处理图片批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(imagesToProcess.length/batchSize)}, 共 ${batch.length} 个图片`);
          
          // 使用批量处理功能
          const result = await processBatchImageUrls(batch);
          
          if (result.success) {
            console.log(`批次处理成功: 处理 ${result.processedCount} 个, 失败 ${result.failedCount} 个`);
          } else {
            console.error(`批次处理失败: ${result.errors?.join('; ')}`);
          }
          
          // 批次间短暂暂停，减轻数据库压力
          if (i + batchSize < imagesToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`所有图片处理完成，共处理 ${imagesToProcess.length} 个图片URL`);
      } catch (error) {
        console.error('图片处理主流程出错:', error);
      }
    }, 1000); // 延迟时间加长，确保事务完全提交
    
    return { 
      success: true, 
      batchId: batch.id,
      orderCount: ordersData.length 
    };
  } catch (error) {
    // 确保事务回滚
    await transaction.rollback();
    console.error('导入订单失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '导入过程出错' 
    };
  }
};