
// 自定义的electron-is-dev替代品
// 简单返回true代表开发模式，避免所有问题

// CommonJS版本
if (typeof module !== 'undefined' && module.exports) {
  module.exports = true;
}

// ESM版本
export default true;

// 全局变量版本
if (typeof window !== 'undefined') {
  window.__ELECTRON_IS_DEV__ = true;
}

// 确保Node.js环境下也能使用
if (typeof global !== 'undefined') {
  global.__ELECTRON_IS_DEV__ = true;
}
