import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { 
  HomeOutlined, 
  ShoppingCartOutlined, 
  AppstoreOutlined, 
  SettingOutlined,
  PictureOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页'
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: '订单管理'
    },
    {
      key: '/batches',
      icon: <AppstoreOutlined />,
      label: '批次管理'
    },
    {
      key: '/images',
      icon: <PictureOutlined />,
      label: '图片下载'
    },
    {
      key: '/folder-downloads',
      icon: <FolderOutlined />,
      label: '文件夹下载'
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={value => setCollapsed(value)}
      >
        <div className="logo">
          {!collapsed && <Title level={4} style={{ color: 'white', margin: '16px' }}>PODERP</Title>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, paddingLeft: 16 }}>
          <Title level={3}>POD订单ERP系统</Title>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout; 