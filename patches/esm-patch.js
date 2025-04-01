
// ESM URL协议补丁
// 此文件用于处理electron:协议的ESM导入问题

// 保存原始的URL构造函数
const originalURL = global.URL;

// 替换URL构造函数
global.URL = function(url, base) {
  // 如果URL使用electron:协议，将其转换为file:协议
  if (url.startsWith('electron:')) {
    console.log('检测到electron:协议的URL，已转换为file:协议', url);
    url = 'file:' + url.slice(9);
  }
  return new originalURL(url, base);
};

// 复制原始URL的静态方法
for (const prop in originalURL) {
  if (originalURL.hasOwnProperty(prop)) {
    global.URL[prop] = originalURL[prop];
  }
}

console.log('ESM URL协议补丁已应用');
