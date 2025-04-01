// 全局配置状态
let configCache: any = null;

// 获取缓存的配置或从后端获取
export const getConfig = (key?: string) => {
  if (!configCache) {
    throw new Error('配置未加载，请先调用loadConfig()');
  }
  
  if (key) {
    return configCache[key];
  }
  
  return configCache;
};

// 从后端加载配置
export const loadConfig = async () => {
  try {
    const result = await window.electron.getAppConfig();
    if (result.success) {
      configCache = result.data;
      return result.data;
    } else {
      console.error('加载配置失败:', result.error);
      return null;
    }
  } catch (error) {
    console.error('加载配置异常:', error);
    return null;
  }
};

// 保存配置
export const saveConfig = async (config: any) => {
  try {
    const result = await window.electron.saveAppConfig(config);
    if (result.success) {
      // 更新缓存
      configCache = await loadConfig();
      return true;
    }
    return false;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
}; 