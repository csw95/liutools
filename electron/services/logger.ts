/**
 * 简单的日志服务
 */

const logger = {
  info: (message: string, ...optionalParams: any[]) => {
    console.log(`[INFO] ${message}`, ...optionalParams);
  },
  
  error: (message: string, ...optionalParams: any[]) => {
    console.error(`[ERROR] ${message}`, ...optionalParams);
  },
  
  warn: (message: string, ...optionalParams: any[]) => {
    console.warn(`[WARN] ${message}`, ...optionalParams);
  },
  
  debug: (message: string, ...optionalParams: any[]) => {
    console.debug(`[DEBUG] ${message}`, ...optionalParams);
  }
};

export default logger; 