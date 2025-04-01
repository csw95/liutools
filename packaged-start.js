
'use strict';

// 这个文件是打包后的应用入口点
process.env.PACKAGED = 'true';
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';

// 加载主程序
require('./dist/electron/electron/main.js');
