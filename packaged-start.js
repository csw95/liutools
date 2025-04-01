'use strict';

// 禁用ESM加载
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';
process.env.PACKAGED = 'true';

// 直接加载主文件
console.log('在打包环境中启动应用...');
require('./main.js');
