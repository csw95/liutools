import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { StyleProvider } from '@ant-design/cssinjs'
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout/AppLayout';
import { loadConfig } from './services/config';

// 页面组件导入
import HomePage from './pages/Home';
import OrdersPage from './pages/Orders';
import BatchesPage from './pages/Batches';
import SettingsPage from './pages/Settings';
import ImageDownloadsPage from './pages/ImageDownloads';
import FolderDownloads from './pages/FolderDownloads';

const baseUrl = (window as any).BASE_URL || '';

function App() {
  // 在应用启动时加载配置
  useEffect(() => {
    loadConfig().catch(error => {
      console.error('初始化配置失败:', error);
    });
  }, []);

  return (
    <ConfigProvider locale={zhCN}>
      <StyleProvider hashPriority="high">
        <Router>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/home" />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/images" element={<ImageDownloadsPage />} />
              <Route path="/folder-downloads" element={<FolderDownloads />} />
              {/* 404 页面 */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AppLayout>
        </Router>
      </StyleProvider>
    </ConfigProvider>
  );
}

export default App; 