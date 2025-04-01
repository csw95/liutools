// @ts-nocheck
// 此文件已被转换，以防止electron:协议的ESM导入问题
// 转换的import
const { BrowserWindow  } = require('electron');
// 转换的import
const { session  } = require('electron');
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { GoogleAuth } from './data'; // 导入数据库模型

// Google OAuth 配置
// ===== 在这里添加你的 Google Cloud API 凭据 =====
// const CLIENT_ID = '58588700512-ftfec3rq0md257ii0v5dag4n2m0toi86.apps.googleusercontent.com';  // 从 Google Cloud Console 获取: https://console.cloud.google.com/apis/credentials
// const CLIENT_SECRET = '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';  // 从 Google Cloud Console 获取
const CLIENT_ID = '58588700512-n2srhq1o9djclmqcdulsa9lhke2vm0gr.apps.googleusercontent.com';  // 从 Google Cloud Console 获取: https://console.cloud.google.com/apis/credentials
const CLIENT_SECRET = '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';  // 从 Google Cloud Console 获取

const REDIRECT_URI = 'https://localhost';
// =================================================

// 从数据库获取令牌信息
const getAuthTokensFromDB = async () => {
  try {
    const authRecord = await GoogleAuth.findByPk('default');
    return authRecord;
  } catch (error) {
    console.error('从数据库获取Google授权信息出错:', error);
    return null;
  }
};

// 保存令牌信息到数据库
const saveAuthTokensToDB = async (tokenData: any, cookies?: any) => {
  try {
    const authValues = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      token_type: tokenData.token_type || 'Bearer',
      expires_in: tokenData.expires_in || 3600,
      issued_at: tokenData.issued_at || Date.now(),
      cookies: cookies ? JSON.stringify(cookies) : '',
      is_configured: true,
      last_updated: new Date()
    };

    // 使用upsert确保只有一条记录
    const [authRecord, created] = await GoogleAuth.upsert({
      id: 'default',
      ...authValues
    });

    console.log(created ? '创建新的Google授权记录' : '更新已有的Google授权记录');
    return authRecord;
  } catch (error) {
    console.error('保存Google授权信息到数据库失败:', error);
    throw error;
  }
};

// 清除数据库中的授权信息
const clearAuthTokensFromDB = async () => {
  try {
    const authRecord = await GoogleAuth.findByPk('default');
    if (authRecord) {
      await authRecord.update({
        access_token: '',
        refresh_token: '',
        cookies: '',
        is_configured: false,
        last_updated: new Date()
      });
      console.log('已清除数据库中的Google授权信息');
    }
  } catch (error) {
    console.error('清除数据库中的Google授权信息出错:', error);
  }
};

// 构建完整的授权URL
const buildAuthUrl = () => {
  // 使用更多权限范围以确保能访问所有需要的资源
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly');
  // 添加更多参数以确保获取刷新令牌并强制用户重新同意
  return `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true`;
};

// 交换授权码获取访问令牌
const exchangeCodeForTokens = async (code: string, cookies: any[]) => {
  try {
    console.log('开始交换授权码获取令牌...');
    
    const tokenData = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    };
    
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams(tokenData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (response.data && response.data.access_token) {
      console.log('成功获取访问令牌');
      
      // 添加issued_at时间戳以便后续计算过期时间
      const tokensWithTimestamp = {
        ...response.data,
        issued_at: Date.now()
      };
      
      // 存储到数据库
      await saveAuthTokensToDB(tokensWithTimestamp, cookies);
      
      return { success: true, tokens: tokensWithTimestamp };
    } else {
      console.error('令牌响应格式不正确:', response.data);
      return { success: false, error: '无法获取访问令牌，响应格式不正确' };
    }
  } catch (error) {
    console.error('交换授权码失败:', error);
    let errorMsg = '获取令牌失败';
    
    if (axios.isAxiosError(error) && error.response) {
      errorMsg += `: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error instanceof Error) {
      errorMsg += `: ${error.message}`;
    }
    
    return { success: false, error: errorMsg };
  }
};

// 管理 Google Drive 授权
export const authorizeGoogleDrive = async () => {
  try {
    // 清除之前的授权信息
    await clearAuthTokensFromDB();
    
    // 验证 API 凭据是否已配置
    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('未配置Google API凭据');
      return { 
        success: false, 
        error: '未配置Google API凭据，请在 electron/services/google-auth.ts 文件中添加您的 CLIENT_ID 和 CLIENT_SECRET' 
      };
    }
    
    // 创建一个新的浏览器窗口用于 Google 登录
    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'google-auth' // 使用独立会话
      }
    });

    // 添加开发者工具以便调试
    authWindow.webContents.openDevTools({ mode: 'detach' });

    // 打印调试信息
    authWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error(`页面加载失败: ${errorCode} - ${errorDescription}`);
    });

    // 防止窗口导航到其他网站
    authWindow.webContents.on('will-navigate', (event, url) => {
      console.log('导航到:', url);
    });

    // 使用 Promise 处理窗口关闭和重定向
    try {
      const result = await new Promise((resolve, reject) => {
        // 处理窗口关闭事件
        authWindow.on('closed', () => {
          // 用户主动关闭窗口，返回一个明确的错误对象
          reject({ success: false, error: '授权窗口已关闭' });
        });

        // 监听所有重定向
        authWindow.webContents.on('will-redirect', async (event, url) => {
          console.log('重定向到:', url);
          
          // 检查重定向的 URL 是否包含授权码
          if (url.startsWith(REDIRECT_URI)) {
            try {
              // 提取授权码
              const urlObj = new URL(url);
              const code = urlObj.searchParams.get('code');
              const error = urlObj.searchParams.get('error');
              
              if (error) {
                console.error(`授权错误: ${error}`);
                authWindow.close();
                reject({ success: false, error: `Google授权错误: ${error}` });
                return;
              }
              
              if (code) {
                console.log('获取到授权码:', code);
                
                try {
                  // 先保存会话cookie
                  const cookies = await saveGoogleSession(authWindow.webContents.session);
                  
                  // 然后交换授权码获取令牌
                  const tokenResult = await exchangeCodeForTokens(code, cookies);
                  
                  authWindow.close();
                  
                  if (tokenResult.success) {
                    resolve({ success: true });
                  } else {
                    reject({ success: false, error: tokenResult.error });
                  }
                } catch (sessionError) {
                  console.error('处理会话或令牌交换时出错:', sessionError);
                  authWindow.close();
                  reject({ 
                    success: false, 
                    error: `获取授权令牌失败: ${sessionError instanceof Error ? sessionError.message : '未知错误'}`
                  });
                }
              } else {
                console.error('授权码不存在');
                authWindow.close();
                reject({ success: false, error: '未获取到授权码' });
              }
            } catch (redirectError) {
              console.error('处理授权回调时出错:', redirectError);
              authWindow.close();
              reject({ 
                success: false, 
                error: `处理授权过程中出错: ${redirectError instanceof Error ? redirectError.message : '未知错误'}`
              });
            }
          }
        });

        // 加载 Google 登录页面
        const authUrl = buildAuthUrl();
        console.log('加载授权页面:', authUrl);
        authWindow.loadURL(authUrl).catch(loadError => {
          console.error('加载授权页面失败:', loadError);
          authWindow.close();
          reject({ success: false, error: `加载Google登录页面失败: ${loadError.message || '网络错误'}` });
        });
      });
      
      return result as { success: boolean, error?: string };
    } catch (promiseError) {
      // 处理 Promise 拒绝
      console.error('授权过程被拒绝:', promiseError);
      // 确保返回一个格式化的错误对象
      if (promiseError && typeof promiseError === 'object' && 'success' in promiseError) {
        return promiseError as { success: false, error: string };
      }
      return { 
        success: false, 
        error: promiseError instanceof Error ? promiseError.message : (
          typeof promiseError === 'string' ? promiseError : '授权过程中断'
        )
      };
    }
  } catch (error) {
    console.error('Google Drive 授权失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '授权失败' };
  }
};

// 保存 Google 会话 cookies
const saveGoogleSession = async (sess: Electron.Session) => {
  try {
    // 获取 Google 域名的所有 cookies
    const cookies = await sess.cookies.get({ domain: '.google.com' });
    console.log(`获取到 ${cookies.length} 个 Google Cookies`);

    if (cookies.length === 0) {
      throw new Error('未获取到任何Google Cookie');
    }

    // 返回cookies供保存使用
    return cookies;
  } catch (error) {
    console.error('保存 Google 会话失败:', error);
    throw error;
  }
};

// 刷新访问令牌
const refreshAccessToken = async () => {
  try {
    const authRecord = await getAuthTokensFromDB();
    
    if (!authRecord || !authRecord.refresh_token) {
      console.error('没有可用的刷新令牌');
      return { success: false, error: '没有可用的刷新令牌' };
    }
    
    console.log('开始刷新访问令牌...');
    
    const tokenData = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: authRecord.refresh_token,
      grant_type: 'refresh_token'
    };
    
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams(tokenData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (response.data && response.data.access_token) {
      console.log('成功刷新访问令牌');
      
      // 更新令牌但保留刷新令牌
      const updatedTokens = {
        ...response.data,
        refresh_token: authRecord.refresh_token, // 保留原来的刷新令牌
        issued_at: Date.now() // 添加刷新时间戳
      };
      
      // 存储到数据库
      await saveAuthTokensToDB(updatedTokens);
      return { success: true, tokens: updatedTokens };
    } else {
      console.error('令牌响应格式不正确:', response.data);
      return { success: false, error: '无法刷新访问令牌，响应格式不正确' };
    }
  } catch (error) {
    console.error('刷新访问令牌失败:', error);
    let errorMsg = '刷新令牌失败';
    
    if (axios.isAxiosError(error) && error.response) {
      errorMsg += `: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error instanceof Error) {
      errorMsg += `: ${error.message}`;
    }
    
    return { success: false, error: errorMsg };
  }
};

// 应用保存的 cookies 和令牌到请求
export const applyGoogleCookiesToRequest = async (): Promise<Record<string, string>> => {
  try {
    const authRecord = await getAuthTokensFromDB();
    
    // 标准请求头
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    // 添加cookie
    if (authRecord && authRecord.cookies) {
      try {
        const cookies = JSON.parse(authRecord.cookies);
        if (Array.isArray(cookies) && cookies.length > 0) {
          console.log(`应用 ${cookies.length} 个 Cookies 到请求头`);
          const cookieHeader = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
          headers['Cookie'] = cookieHeader;
        }
      } catch (error) {
        console.error('解析cookies字符串失败:', error);
      }
    } else {
      console.log('没有找到已保存的 Google Cookies');
    }
    
    // 添加令牌
    if (authRecord && authRecord.access_token) {
      console.log('应用访问令牌到请求头');
      headers['Authorization'] = `Bearer ${authRecord.access_token}`;
    } else {
      console.error('错误: 没有访问令牌可用，API 调用可能会失败');
    }
    
    return headers;
  } catch (error) {
    console.error('应用授权到请求头时出错:', error);
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }
};

// 检查令牌是否需要刷新，如果需要则刷新
export const ensureValidToken = async (): Promise<boolean> => {
  try {
    const authRecord = await getAuthTokensFromDB();
    
    if (!authRecord || !authRecord.access_token) {
      console.error('没有找到访问令牌，授权未完成或已失效');
      return false;
    }
    
    // 检查令牌是否已过期
    const tokenExpiry = authRecord.expires_in ? authRecord.issued_at + authRecord.expires_in * 1000 : 0;
    const now = Date.now();
    const isExpired = tokenExpiry < now;
    
    // 如果令牌已过期且有刷新令牌，尝试刷新
    if ((isExpired || !tokenExpiry) && authRecord.refresh_token) {
      console.log('访问令牌已过期或即将过期，正在刷新...');
      const refreshResult = await refreshAccessToken();
      return refreshResult.success;
    } else if (isExpired && !authRecord.refresh_token) {
      console.error('访问令牌已过期，但没有刷新令牌，需要重新授权');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('确保令牌有效性时出错:', error);
    return false;
  }
}; 