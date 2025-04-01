import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Tooltip, 
  Progress, 
  Modal,
  Typography,
  Divider,
  message,
  Image as AntImage
} from 'antd';
import { 
  ReloadOutlined, 
  FolderOpenOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getConfig } from '../services/config';

const { Title, Text, Paragraph } = Typography;

interface FolderDownload {
  id: string;
  folderId: string;
  orderId: string;
  originalUrl: string;
  type: string;
  status: string;
  startTime: string;
  completedTime?: string;
  completedCount: number;
  totalCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  statsSummary?: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    downloading: number;
  };
  Order?: {
    id: string;
    customerNo: string;
    customerSku: string;
    name: string;
  };
}

interface FolderImage {
  id: string;
  orderId: string;
  sourceFolderId: string;
  originalUrl: string;
  fileName?: string;
  type: string;
  downloadStatus: string;
  downloadAttempts: number;
  localPath?: string;
  absolutePath?: string;
  errorMessage?: string;
  lastAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

const FolderDownloadsPage: React.FC = () => {
  const [folderDownloads, setFolderDownloads] = useState<{ total: number, items: FolderDownload[] }>({
    total: 0,
    items: []
  });
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<any>(null);
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const navigate = useNavigate();
  
  // 加载文件夹下载列表
  const loadFolderDownloads = async () => {
    try {
      setLoading(true);
      const limit = pagination.pageSize;
      const offset = (pagination.current - 1) * pagination.pageSize;
      
      const result = await window.electron.getFolderDownloadStatus(limit, offset);
      if (result?.success) {
        setFolderDownloads({
          total: result.total || 0,
          items: Array.isArray(result.items) ? result.items : []
        });
        setPagination({
          ...pagination,
          total: result.total || 0
        });
      } else {
        message.error('加载文件夹下载列表失败');
        setFolderDownloads({
          total: 0,
          items: []
        });
      }
    } catch (error) {
      console.error('加载文件夹下载列表失败:', error);
      message.error('加载文件夹下载列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 加载文件夹详情
  const loadFolderDetail = async (folderId: string, orderId: string) => {
    try {
      setDetailLoading(true);
      const result = await window.electron.getFolderDownloadDetail(folderId, orderId);
      if (result?.success) {
        setCurrentFolder(result.folder);
        setFolderImages(Array.isArray(result.images) ? result.images : []);
        setDetailModalVisible(true);
      } else {
        message.error(`获取文件夹详情失败: ${result?.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('获取文件夹详情失败:', error);
      message.error('获取文件夹详情失败');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // 重试文件夹中失败的图片
  const handleRetryFolderImages = async (folderId: string, orderId: string) => {
    try {
      // 检查Google Drive授权状态
      const configResult = await window.electron.getAppConfig();
      if (configResult.success && configResult.data && !configResult.data.googleDriveConfigured) {
        Modal.confirm({
          title: 'Google Drive未授权',
          content: '重试需要Google Drive授权。是否前往设置页面进行授权？',
          okText: '前往授权',
          cancelText: '取消',
          onOk: () => {
            navigate('/settings');
          }
        });
        return;
      }
      
      const result = await window.electron.retryFolderImages(folderId, orderId);
      if (result?.success) {
        message.success(`已将 ${result.retryCount} 张图片加入重试队列`);
        // 刷新文件夹详情
        loadFolderDetail(folderId, orderId);
        // 延迟刷新列表
        setTimeout(loadFolderDownloads, 1000);
      } else {
        if (result?.error && result.error.includes('授权')) {
          // 处理授权错误
          Modal.confirm({
            title: 'Google Drive授权问题',
            content: result.error,
            okText: '前往授权',
            cancelText: '取消',
            onOk: () => {
              navigate('/settings');
            }
          });
        } else {
          message.error(`重试失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('重试文件夹图片失败:', error);
      message.error('重试文件夹图片失败');
    }
  };
  
  // 初始加载
  useEffect(() => {
    // 首先检查Google Drive授权状态
    const checkGoogleDriveAuth = async () => {
      try {
        const configResult = await window.electron.getAppConfig();
        
        if (configResult.success && configResult.data) {
          // 检查是否已授权Google Drive
          if (!configResult.data.googleDriveConfigured) {
            // 未授权，提示用户先授权
            Modal.warning({
              title: 'Google Drive未授权',
              content: '您尚未授权Google Drive，这可能导致文件夹内容无法正常下载。建议先在设置页面进行授权。',
              okText: '前往授权',
              onOk: () => {
                // 导航到设置页面
                navigate('/settings');
              }
            });
          }
        }
      } catch (error) {
        console.error('检查Google Drive授权状态时出错:', error);
      }
    };

    checkGoogleDriveAuth();
    loadFolderDownloads();
  }, []);
  
  // 分页变化时重新加载
  useEffect(() => {
    loadFolderDownloads();
  }, [pagination.current, pagination.pageSize]);
  
  // 获取完整的文件路径
  const getFullPath = (localPath: string, absolutePath?: string) => {
    // 使用绝对路径（如果存在）
    if (absolutePath) {
      return absolutePath;
    }
    
    // 使用配置的下载路径 + 相对路径
    try {
      const downloadPath = getConfig('downloadPath');
      return `${downloadPath}/${localPath}`;
    } catch (error) {
      console.error('获取下载路径失败:', error);
      return localPath;
    }
  };
  
  // 预览图片
  const handlePreview = (localPath: string, absolutePath?: string) => {
    const imagePath = getFullPath(localPath, absolutePath);
    setPreviewImage(`file://${imagePath}`);
    setPreviewVisible(true);
  };
  
  // 打开图片所在文件夹
  const handleOpenFolder = (localPath: string, absolutePath?: string) => {
    // 由于主进程会处理相对路径，无需特殊处理
    if (absolutePath) {
      window.electron.showInFolder(absolutePath);
    } else {
      window.electron.showInFolder(localPath);
    }
  };
  
  // 文件夹状态标签
  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'processing':
        return <Tag icon={<SyncOutlined spin />} color="processing">处理中</Tag>;
      case 'in_progress':
        return <Tag icon={<SyncOutlined spin />} color="blue">下载中</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>;
      case 'failed':
        return <Tag icon={<ExclamationCircleOutlined />} color="error">失败</Tag>;
      default:
        return <Tag icon={<ClockCircleOutlined />} color="default">{status}</Tag>;
    }
  };
  
  // 图片下载状态标签
  const renderImageStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<ClockCircleOutlined />} color="warning">待下载</Tag>;
      case 'downloading':
        return <Tag icon={<SyncOutlined spin />} color="processing">下载中</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>;
      case 'failed':
        return <Tag icon={<ExclamationCircleOutlined />} color="error">失败</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };
  
  // 文件夹下载进度
  const renderProgress = (folder: FolderDownload) => {
    if (!folder.statsSummary) return null;
    
    const { completed, total } = folder.statsSummary;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const status = percent === 100 ? 'success' : folder.status === 'failed' ? 'exception' : 'active';
    
    return (
      <Progress 
        percent={percent} 
        status={status as any} 
        size="small" 
        format={percent => `${percent}%`}
      />
    );
  };
  
  // 表格列定义
  const columns = [
    {
      title: '订单信息',
      dataIndex: ['Order', 'customerNo'],
      key: 'customerNo',
      render: (_: string, record: FolderDownload) => (
        <span>
          {record.Order ? (
            <>
              <div><Text strong>{record.Order.customerNo}</Text></div>
              <div><Text type="secondary">{record.Order.name}</Text></div>
              <div><Text type="secondary">SKU: {record.Order.customerSku}</Text></div>
            </>
          ) : '未关联订单'}
        </span>
      )
    },
    {
      title: '文件夹链接',
      dataIndex: 'originalUrl',
      key: 'originalUrl',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Text ellipsis style={{ width: 250 }}>{url}</Text>
          </a>
        </Tooltip>
      )
    },
    {
      title: '图片类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => 
        type === 'mockup' ? <Tag color="blue">效果图</Tag> : <Tag color="green">素材图</Tag>
    },
    {
      title: '下载状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => renderStatusTag(status)
    },
    {
      title: '下载进度',
      key: 'progress',
      render: (_: any, record: FolderDownload) => renderProgress(record)
    },
    {
      title: '图片数量',
      key: 'images',
      render: (_: any, record: FolderDownload) => {
        if (!record.statsSummary) return '-';
        
        return (
          <>
            <div>总数: {record.statsSummary.total}</div>
            <div>
              <Text type="success">成功: {record.statsSummary.completed}</Text>
              {record.statsSummary.failed > 0 && (
                <Text type="danger"> 失败: {record.statsSummary.failed}</Text>
              )}
            </div>
            {(record.statsSummary.pending > 0 || record.statsSummary.downloading > 0) && (
              <div>
                <Text type="warning">
                  待下载: {record.statsSummary.pending}, 下载中: {record.statsSummary.downloading}
                </Text>
              </div>
            )}
          </>
        );
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FolderDownload) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            onClick={() => loadFolderDetail(record.folderId, record.orderId)}
          >
            详情
          </Button>
          {record.status === 'failed' || (record.statsSummary && record.statsSummary.failed > 0) ? (
            <Button
              size="small"
              danger
              onClick={() => handleRetryFolderImages(record.folderId, record.orderId)}
            >
              重试失败图片
            </Button>
          ) : null}
        </Space>
      )
    }
  ];
  
  // 图片列表列定义
  const imageColumns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (fileName: string, record: FolderImage) => 
        fileName || `图片_${record.id.substring(0, 8)}`
    },
    {
      title: '图片类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => 
        type === 'mockup' ? <Tag color="blue">效果图</Tag> : <Tag color="green">素材图</Tag>
    },
    {
      title: '下载状态',
      dataIndex: 'downloadStatus',
      key: 'downloadStatus',
      render: (status: string) => renderImageStatusTag(status)
    },
    {
      title: '尝试次数',
      dataIndex: 'downloadAttempts',
      key: 'downloadAttempts'
    },
    {
      title: '最后尝试时间',
      dataIndex: 'lastAttemptAt',
      key: 'lastAttemptAt',
      render: (date?: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '图片预览',
      key: 'preview',
      render: (_: any, record: FolderImage) => {
        if (record.downloadStatus === 'completed' && record.localPath) {
          return (
            <div 
              className="image-thumbnail" 
              onClick={() => handlePreview(record.localPath!, record.absolutePath)}
              style={{ cursor: 'pointer' }}
            >
              <AntImage 
                src={`file://${getFullPath(record.localPath!, record.absolutePath)}`}
                width={60}
                height={60}
                style={{ objectFit: 'cover' }}
                placeholder={<div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                preview={false}
              />
            </div>
          );
        }
        return <Text type="secondary">无预览</Text>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FolderImage) => (
        <Space size="small">
          {record.downloadStatus === 'completed' && record.localPath && (
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => handleOpenFolder(record.localPath!, record.absolutePath)}
            >
              打开文件夹
            </Button>
          )}
          {record.downloadStatus === 'failed' && (
            <Button
              size="small"
              danger
              onClick={() => window.electron.retryDownloadImage(record.id)}
            >
              重试
            </Button>
          )}
        </Space>
      )
    }
  ];
  
  return (
    <div>
      <Title level={2}>Google Drive 文件夹下载管理</Title>
      
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={loadFolderDownloads}
          loading={loading}
        >
          刷新数据
        </Button>
      </Space>
      
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={folderDownloads.items}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => {
              setPagination({
                ...pagination,
                current: page,
                pageSize: pageSize || pagination.pageSize
              });
            },
            showSizeChanger: true,
            showTotal: total => `共 ${total} 个文件夹`
          }}
        />
      </Card>
      
      {/* 文件夹详情弹窗 */}
      <Modal
        title="文件夹下载详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          currentFolder && (currentFolder.status === 'failed' || 
            (currentFolder.statsSummary && currentFolder.statsSummary.failed > 0)) && (
            <Button
              key="retry"
              type="primary"
              danger
              onClick={() => handleRetryFolderImages(currentFolder.folderId, currentFolder.orderId)}
            >
              重试失败图片
            </Button>
          )
        ]}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <SyncOutlined spin style={{ fontSize: 24 }} />
            <p>加载中...</p>
          </div>
        ) : currentFolder ? (
          <div>
            <Paragraph>
              <Text strong>文件夹ID:</Text> {currentFolder.folderId}
            </Paragraph>
            <Paragraph>
              <Text strong>原始链接:</Text> <a href={currentFolder.originalUrl} target="_blank" rel="noopener noreferrer">{currentFolder.originalUrl}</a>
            </Paragraph>
            <Paragraph>
              <Text strong>图片类型:</Text> {currentFolder.type === 'mockup' ? '效果图' : '素材图'}
            </Paragraph>
            <Paragraph>
              <Text strong>状态:</Text> {renderStatusTag(currentFolder.status)}
            </Paragraph>
            <Paragraph>
              <Text strong>开始时间:</Text> {new Date(currentFolder.startTime).toLocaleString()}
            </Paragraph>
            {currentFolder.completedTime && (
              <Paragraph>
                <Text strong>完成时间:</Text> {new Date(currentFolder.completedTime).toLocaleString()}
              </Paragraph>
            )}
            <Paragraph>
              <Text strong>下载进度:</Text> {currentFolder.completedCount}/{currentFolder.totalCount}
            </Paragraph>
            {currentFolder.errorMessage && (
              <Paragraph>
                <Text strong>错误信息:</Text> <Text type="danger">{currentFolder.errorMessage}</Text>
              </Paragraph>
            )}
            
            <Divider />
            <Title level={4}>图片列表</Title>
            
            <Table
              rowKey="id"
              columns={imageColumns}
              dataSource={folderImages}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 张图片`
              }}
            />
          </div>
        ) : (
          <div>未找到文件夹详情</div>
        )}
      </Modal>
      
      {/* 图片预览弹窗 */}
      <AntImage.PreviewGroup preview={{
        visible: previewVisible,
        onVisibleChange: vis => setPreviewVisible(vis)
      }}>
        <div style={{ display: 'none' }}>
          <AntImage src={previewImage} />
        </div>
      </AntImage.PreviewGroup>
    </div>
  );
};

export default FolderDownloadsPage; 