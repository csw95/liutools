const fs = require('fs');
const path = require('path');

console.log('检查并修复预加载脚本...');

// 确保dist/electron/electron目录存在
const preloadDir = path.join(process.cwd(), 'dist', 'electron', 'electron');
if (!fs.existsSync(preloadDir)) {
  console.log(`创建目录: ${preloadDir}`);
  fs.mkdirSync(preloadDir, { recursive: true });
}

// 检查预加载脚本是否存在
const preloadPath = path.join(preloadDir, 'preload.js');
if (!fs.existsSync(preloadPath)) {
  console.log('预加载脚本不存在，尝试从源文件编译...');
  
  // 检查源文件是否存在
  const sourcePath = path.join(process.cwd(), 'electron', 'preload.ts');
  if (fs.existsSync(sourcePath)) {
    try {
      // 编译preload.ts
      const { execSync } = require('child_process');
      console.log('编译预加载脚本...');
      execSync('tsc -p electron/tsconfig.json', { stdio: 'inherit' });
      
      if (fs.existsSync(preloadPath)) {
        console.log('预加载脚本已成功编译');
      } else {
        console.log('编译成功但找不到预加载脚本，创建基本脚本...');
        createBasicPreload(preloadPath);
      }
    } catch (error) {
      console.error('编译预加载脚本失败:', error);
      console.log('创建基本的预加载脚本...');
      createBasicPreload(preloadPath);
    }
  } else {
    console.log('找不到源文件，创建基本的预加载脚本...');
    createBasicPreload(preloadPath);
  }
} else {
  console.log('预加载脚本已存在，检查内容是否完整...');
  
  // 读取现有内容
  const content = fs.readFileSync(preloadPath, 'utf8');
  
  // 检查是否包含基本API
  if (!content.includes('contextBridge') || !content.includes('ipcRenderer')) {
    console.log('预加载脚本不完整，更新内容...');
    createBasicPreload(preloadPath);
  } else {
    console.log('预加载脚本内容正常');
  }
}

console.log('预加载脚本修复完成');

// 创建基本的预加载脚本
function createBasicPreload(filePath) {
  const content = `const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 发送事件到主进程
  send: (channel, data) => {
    // 白名单频道列表
    const validChannels = [
      'app:ready', 'app:quit', 'db:query',
      'file:open', 'file:save', 'config:get', 'config:set'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // 从主进程接收事件
  receive: (channel, func) => {
    const validChannels = [
      'app:ready', 'db:result', 'file:opened', 'file:saved',
      'config:result', 'error:message'
    ];
    if (validChannels.includes(channel)) {
      // 删除旧监听器以避免内存泄漏
      ipcRenderer.removeAllListeners(channel);
      
      // 添加新监听器
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  
  // 调用主进程并等待结果
  invoke: async (channel, data) => {
    const validChannels = [
      'db:query', 'file:dialog', 'config:get',
      'file:readDir', 'process:platform', 'utils:uuid'
    ];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
    return null;
  }
});

// 通知主进程预加载脚本已准备就绪
ipcRenderer.send('preload:ready');
`;

  fs.writeFileSync(filePath, content);
  console.log(`已创建预加载脚本: ${filePath}`);
} 