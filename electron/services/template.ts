// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
// 转换的import
const { app  } = require('electron');

export const createTemplateFile = async () => {
  try {
    const templateDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }
    
    const templatePath = path.join(templateDir, 'template.xlsx');
    
    // 创建工作簿和工作表
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('订单模板');
    
    // 添加表头
    worksheet.columns = [
      { header: '客户订单号', key: 'customerNo', width: 15 },
      { header: '客户SKU', key: 'customerSku', width: 15 },
      { header: 'SPU', key: 'spu', width: 15 },
      { header: '尺码', key: 'size', width: 10 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '收件人', key: 'name', width: 15 },
      { header: '电话', key: 'phone', width: 15 },
      { header: '地址', key: 'address', width: 30 },
      { header: '城市', key: 'city', width: 15 },
      { header: '省份', key: 'province', width: 15 },
      { header: '国家', key: 'country', width: 15 },
      { header: '邮编', key: 'zipCode', width: 15 },
      { header: '素材图链接', key: 'materialImage', width: 30 },
      { header: '效果图链接', key: 'mockupImage', width: 30 }
    ];
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // 保存工作簿
    await workbook.xlsx.writeFile(templatePath);
    
    return {
      success: true,
      path: templatePath
    };
  } catch (error) {
    console.error('创建模板文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建模板文件失败'
    };
  }
}; 