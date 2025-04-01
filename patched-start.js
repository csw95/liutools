
'use strict';

// 设置环境变量
process.env.PACKAGED = 'true';
process.env.NODE_NO_ESM_MODULE_LOADING = '1';
process.env.NODE_OPTIONS = '--no-warnings';

// 预加载ESM补丁
require('./patches/esm-patch.js');

// 重新定义require.resolve钩子以拦截electron:协议
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('electron:')) {
    console.log('拦截到electron:协议的require:', request);
    request = request.replace('electron:', 'electron');
  }
  return originalResolveFilename(request, parent, isMain, options);
};

// 加载主程序
try {
  require('./dist/electron/electron/main.js');
} catch (err) {
  console.error('加载主程序时出错:', err);
  process.exit(1);
}
