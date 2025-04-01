import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Typography, 
  Table, 
  Space, 
  Tag, 
  Tooltip, 
  Progress,
  Statistic,
  Modal,
  message,
  Divider,
  Alert,
  Switch,
  Tabs,
  Image as AntImage
} from 'antd';
import { 
  ReloadOutlined, 
  DownloadOutlined, 
  WarningOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  SyncOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { getConfig } from '../services/config';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface DownloadStats {
  total: number;
  counts: {
    downloadStatus: string;
    count: number;
  }[];
}

interface FailedDownload {
  id: string;
  orderId: string;
  originalUrl: string;
  type: string;
  downloadStatus: string;
  downloadAttempts: number;
  lastAttemptAt: string;
  errorMessage: string;
  orderInfo?: {
    customerNo: string;
    customerSku: string;
    name: string;
  };
}

interface SuccessfulDownload {
  id: string;
  orderId: string;
  originalUrl: string;
  localPath: string;
  absolutePath?: string;
  type: string;
  downloadStatus: string;
  downloadAttempts: number;
  lastAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  orderInfo?: {
    customerNo: string;
    customerSku: string;
    name: string;
  };
}

interface RetryQueueItem {
  imageId: string;
  retryTime: number;
}

const ImageDownloadsPage: React.FC = () => {
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [failedDownloads, setFailedDownloads] = useState<{total: number, items: FailedDownload[]}>({
    total: 0,
    items: []
  });
  const [successfulDownloads, setSuccessfulDownloads] = useState<{total: number, items: SuccessfulDownload[]}>({
    total: 0,
    items: []
  });
  const [autoRetryQueue, setAutoRetryQueue] = useState<RetryQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [successLoading, setSuccessLoading] = useState(false);
  const [retryQueueLoading, setRetryQueueLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [failedPage, setFailedPage] = useState(1);
  const [failedPageSize, setFailedPageSize] = useState(10);
  const [successPage, setSuccessPage] = useState(1);
  const [successPageSize, setSuccessPageSize] = useState(10);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 加载下载统计数据
  const loadStats = async () => {
    try {
      const result = await window.electron.getDownloadStats();
      // 转换为组件需要的格式
      const statsData: DownloadStats = {
        total: result.total || 0,
        counts: [
          { downloadStatus: 'pending', count: result.pending || 0 },
          { downloadStatus: 'downloading', count: result.downloading || 0 },
          { downloadStatus: 'completed', count: result.completed || 0 },
          { downloadStatus: 'failed', count: result.failed || 0 }
        ]
      };
      setStats(statsData);
    } catch (error) {
      console.error('加载统计数据出错:', error);
      message.error('加载统计数据失败');
    }
  };
  
  // 加载失败的下载
  const loadFailedDownloads = async () => {
    try {
      setLoading(true);
      const limit = failedPageSize;
      const offset = (failedPage - 1) * failedPageSize;
      
      const result = await window.electron.getFailedDownloads(limit, offset);
      if (result && typeof result === 'object') {
        // 确保 items 总是数组
        const items = Array.isArray(result.items) ? result.items : [];
        setFailedDownloads({
          total: result.total || 0,
          items
        });
      } else {
        // 防御性编程，处理没有正确格式的响应
        setFailedDownloads({
          total: 0,
          items: []
        });
      }
    } catch (error) {
      console.error('加载失败下载记录出错:', error);
      message.error('加载失败下载记录失败');
      setFailedDownloads({
        total: 0,
        items: []
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 加载成功的下载
  const loadSuccessfulDownloads = async () => {
    try {
      setSuccessLoading(true);
      const limit = successPageSize;
      const offset = (successPage - 1) * successPageSize;
      
      const result = await window.electron.getSuccessfulDownloads(limit, offset);
      if (result && typeof result === 'object') {
        // 确保 items 总是数组
        const items = Array.isArray(result.items) ? result.items : [];
        setSuccessfulDownloads({
          total: result.total || 0,
          items
        });
      } else {
        // 防御性编程，处理没有正确格式的响应
        setSuccessfulDownloads({
          total: 0,
          items: []
        });
      }
    } catch (error) {
      console.error('加载成功下载记录出错:', error);
      message.error('加载成功下载记录失败');
      setSuccessfulDownloads({
        total: 0,
        items: []
      });
    } finally {
      setSuccessLoading(false);
    }
  };
  
  // 加载自动重试队列
  const loadAutoRetryQueue = async () => {
    try {
      setRetryQueueLoading(true);
      const result = await window.electron.getAutoRetryQueue();
      if (result && result.success && Array.isArray(result.data)) {
        setAutoRetryQueue(result.data);
      } else {
        // 防御性编程，设置为空数组
        setAutoRetryQueue([]);
      }
    } catch (error) {
      console.error('加载自动重试队列出错:', error);
      setAutoRetryQueue([]); // 错误时设置为空数组
    } finally {
      setRetryQueueLoading(false);
    }
  };
  
  // 刷新所有数据
  const refreshData = () => {
    loadStats();
    loadAutoRetryQueue();
    if (activeTab === '1') {
      loadFailedDownloads();
    } else if (activeTab === '2') {
      loadSuccessfulDownloads();
    }
  };
  
  // 初始加载
  useEffect(() => {
    refreshData();
    
    // 清理函数
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);
  
  // 标签页变化时加载相应数据
  useEffect(() => {
    if (activeTab === '1') {
      loadFailedDownloads();
    } else if (activeTab === '2') {
      loadSuccessfulDownloads();
    }
  }, [activeTab]);
  
  // 失败下载翻页时重新加载
  useEffect(() => {
    if (activeTab === '1') {
      loadFailedDownloads();
    }
  }, [failedPage, failedPageSize]);
  
  // 成功下载翻页时重新加载
  useEffect(() => {
    if (activeTab === '2') {
      loadSuccessfulDownloads();
    }
  }, [successPage, successPageSize]);
  
  // 自动刷新控制
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshData, 10000); // 每10秒刷新一次
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, activeTab]);
  
  // 重试下载图片
  const handleRetryDownload = async (imageId: string) => {
    try {
      const result = await window.electron.retryDownloadImage(imageId);
      if (result.success) {
        message.success('已将图片加入下载队列');
        // 延迟刷新数据，等待下载状态更新
        setTimeout(refreshData, 1000);
      } else {
        message.error(`重试下载失败: ${result.error}`);
      }
    } catch (error) {
      console.error('重试下载出错:', error);
      message.error('重试过程出错');
    }
  };
  
  // 批量重试下载
  const handleBatchRetry = async () => {
    try {
      if (selectedRowKeys.length === 0) {
        message.info('请先选择需要重试的图片');
        return;
      }
      
      let successCount = 0;
      let failCount = 0;
      
      // 逐个重试选中的图片
      for (const key of selectedRowKeys) {
        const imageId = key.toString();
        const result = await window.electron.retryDownloadImage(imageId);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        message.success(`成功将 ${successCount} 张图片加入下载队列`);
      }
      
      if (failCount > 0) {
        message.error(`${failCount} 张图片重试失败`);
      }
      
      // 清空选择
      setSelectedRowKeys([]);
      
      // 延迟刷新数据，等待下载状态更新
      setTimeout(refreshData, 1000);
    } catch (error) {
      console.error('批量重试下载出错:', error);
      message.error('批量重试过程出错');
    }
  };
  
  // 查看图片详情
  const handleViewDetail = async (imageId: string) => {
    try {
      const result = await window.electron.getImageDownloadLog(imageId);
      if (result && result.image) {
        // 确保我们使用正确的数据格式
        const imageData = result.image;
        // 如果有 Order 数据，添加 orderInfo
        if (result.order) {
          imageData.orderInfo = {
            customerNo: result.order.customerNo,
            customerSku: result.order.customerSku,
            name: result.order.name
          };
        }
        setCurrentImage(imageData);
        setDetailModalVisible(true);
      } else {
        message.error('获取图片详情失败: 未找到图片');
      }
    } catch (error) {
      console.error('获取图片详情出错:', error);
      message.error('获取图片详情失败');
    }
  };
  
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
  
  // 打开图片预览
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
  
  // 统计数据计算
  const getStatusCount = (status: string) => {
    if (!stats || !stats.counts) return 0;
    const found = stats.counts.find(c => c.downloadStatus === status);
    return found ? found.count : 0;
  };
  
  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    }
  };
  
  const completedCount = getStatusCount('completed');
  const pendingCount = getStatusCount('pending');
  const failedCount = getStatusCount('failed');
  const downloadingCount = getStatusCount('downloading');
  const totalCount = completedCount + pendingCount + failedCount + downloadingCount;
  const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  // 失败下载表格列配置
  const failedColumns = [
    {
      title: '订单号',
      dataIndex: ['orderInfo', 'customerNo'],
      key: 'customerNo',
      render: (text: string, record: FailedDownload) => 
        record.orderInfo ? record.orderInfo.customerNo : '-'
    },
    {
      title: '图片类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => 
        type === 'mockup' ? <Tag color="blue">效果图</Tag> : <Tag color="green">素材图</Tag>
    },
    {
      title: '原始URL',
      dataIndex: 'originalUrl',
      key: 'originalUrl',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text style={{ width: 250 }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '尝试次数',
      dataIndex: 'downloadAttempts',
      key: 'downloadAttempts',
    },
    {
      title: '最后尝试时间',
      dataIndex: 'lastAttemptAt',
      key: 'lastAttemptAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '自动重试状态',
      key: 'autoRetry',
      render: (_: any, record: FailedDownload) => {
        const retryItem = autoRetryQueue.find(item => item.imageId === record.id);
        if (retryItem) {
          const retryTime = new Date(retryItem.retryTime);
          return (
            <Tag color="processing" icon={<SyncOutlined spin />}>
              {retryTime.toLocaleString()} 自动重试
            </Tag>
          );
        }
        return record.downloadAttempts >= 3 ? 
          <Tag color="error">已达最大重试次数</Tag> : 
          <Tag color="default">未在队列中</Tag>;
      }
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (error: string) => (
        <Tooltip title={error}>
          <Text type="danger" style={{ width: 200 }} ellipsis>
            {error}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FailedDownload) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small" 
            icon={<DownloadOutlined />}
            onClick={() => handleRetryDownload(record.id)}
          >
            立即重试
          </Button>
          <Button 
            size="small" 
            onClick={() => handleViewDetail(record.id)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];
  
  // 成功下载表格列配置
  const successColumns = [
    {
      title: '订单号',
      dataIndex: ['orderInfo', 'customerNo'],
      key: 'customerNo',
      render: (text: string, record: SuccessfulDownload) => 
        record.orderInfo ? record.orderInfo.customerNo : '-'
    },
    {
      title: '图片类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => 
        type === 'mockup' ? <Tag color="blue">效果图</Tag> : <Tag color="green">素材图</Tag>
    },
    {
      title: '图片预览',
      dataIndex: 'localPath',
      key: 'preview',
      render: (localPath: string, record: SuccessfulDownload) => (
        <div 
          className="image-thumbnail" 
          onClick={() => handlePreview(localPath, record.absolutePath)}
          style={{ cursor: 'pointer' }}
        >
          <AntImage 
            src={`file://${getFullPath(localPath, record.absolutePath)}`}
            width={60}
            height={60}
            style={{ objectFit: 'cover' }}
            placeholder={<div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
            preview={false}
          />
        </div>
      )
    },
    {
      title: '存储地址',
      dataIndex: 'localPath',
      key: 'localPath',
      ellipsis: true,
      render: (path: string, record: SuccessfulDownload) => (
        <Tooltip title={record.absolutePath || path}>
          <Text style={{ width: 200 }} ellipsis>
            {record.absolutePath || path}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '下载时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '原始URL',
      dataIndex: 'originalUrl',
      key: 'originalUrl',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text style={{ width: 200 }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SuccessfulDownload) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<FolderOpenOutlined />}
            onClick={() => handleOpenFolder(record.localPath, record.absolutePath)}
          >
            打开文件夹
          </Button>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.localPath, record.absolutePath)}
          >
            查看图片
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>图片下载管理</Title>
      
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={refreshData}
          loading={loading || successLoading || retryQueueLoading}
        >
          刷新数据
        </Button>
        <Button 
          type={autoRefresh ? 'default' : 'primary'} 
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
        </Button>
        {selectedRowKeys.length > 0 && (
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleBatchRetry}
          >
            批量重试 ({selectedRowKeys.length})
          </Button>
        )}
      </Space>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总图片数"
              value={totalCount}
              suffix="张"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="下载成功"
              value={completedCount}
              valueStyle={{ color: '#3f8600' }}
              suffix="张"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="下载失败"
              value={failedCount}
              valueStyle={{ color: '#cf1322' }}
              suffix="张"
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="等待下载"
              value={pendingCount + downloadingCount}
              valueStyle={{ color: '#1890ff' }}
              suffix="张"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
      
      <Card title="下载进度" style={{ marginBottom: 16 }}>
        <Progress 
          percent={successRate} 
          status={successRate === 100 ? "success" : "active"}
          format={percent => `${percent}% 完成`}
        />
        <Divider />
        <Space>
          <Text>当前下载中: {downloadingCount} 张</Text>
          <Text>等待下载: {pendingCount} 张</Text>
          <Text type="success">已完成: {completedCount} 张</Text>
          <Text type="danger">失败: {failedCount} 张</Text>
          {autoRetryQueue.length > 0 && (
            <Text type="warning">
              <SyncOutlined spin /> 自动重试队列: {autoRetryQueue.length} 张
            </Text>
          )}
        </Space>
      </Card>
      
      {autoRetryQueue.length > 0 && (
        <Alert
          message="自动重试进行中"
          description={
            <div>
              <p>系统将自动重试失败的下载，最多重试3次，每次间隔3分钟。</p>
              <p>当前队列中有 {autoRetryQueue.length} 个图片等待自动重试。下次重试时间: {
                autoRetryQueue.length > 0 
                ? new Date(Math.min(...autoRetryQueue.map(item => item.retryTime))).toLocaleString() 
                : '无'
              }</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="下载失败的图片" key="1">
          <Table
            rowKey="id"
            rowSelection={rowSelection}
            columns={failedColumns}
            dataSource={failedDownloads.items}
            loading={loading}
            pagination={{
              current: failedPage,
              pageSize: failedPageSize,
              total: failedDownloads.total,
              onChange: (page, pageSize) => {
                setFailedPage(page);
                if (pageSize !== failedPageSize) {
                  setFailedPageSize(pageSize);
                }
              },
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条记录`
            }}
          />
        </TabPane>
        <TabPane tab="下载成功的图片" key="2">
          <Table
            rowKey="id"
            columns={successColumns}
            dataSource={successfulDownloads.items}
            loading={successLoading}
            pagination={{
              current: successPage,
              pageSize: successPageSize,
              total: successfulDownloads.total,
              onChange: (page, pageSize) => {
                setSuccessPage(page);
                if (pageSize !== successPageSize) {
                  setSuccessPageSize(pageSize);
                }
              },
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条记录`
            }}
          />
        </TabPane>
      </Tabs>
      
      {/* 图片详情弹窗 */}
      <Modal
        title="图片下载详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          currentImage && currentImage.downloadStatus === 'failed' && (
            <Button 
              key="retry" 
              type="primary" 
              onClick={() => {
                handleRetryDownload(currentImage.id);
                setDetailModalVisible(false);
              }}
            >
              立即重试下载
            </Button>
          )
        ]}
        width={700}
      >
        {currentImage && (
          <div>
            <Paragraph>
              <Text strong>图片ID:</Text> {currentImage.id}
            </Paragraph>
            <Paragraph>
              <Text strong>订单信息:</Text> {currentImage.orderInfo ? 
                `${currentImage.orderInfo.customerNo} - ${currentImage.orderInfo.name}` : '未关联订单'}
            </Paragraph>
            <Paragraph>
              <Text strong>图片类型:</Text> {currentImage.type === 'mockup' ? '效果图' : '素材图'}
            </Paragraph>
            <Paragraph>
              <Text strong>下载状态:</Text> 
              {currentImage.downloadStatus === 'completed' ? 
                <Tag color="success">下载成功</Tag> : 
                currentImage.downloadStatus === 'failed' ? 
                  <Tag color="error">下载失败</Tag> : 
                  currentImage.downloadStatus === 'downloading' ? 
                    <Tag color="processing">下载中</Tag> : 
                    <Tag color="warning">等待下载</Tag>}
              {currentImage.downloadStatus === 'failed' && (
                <>
                  {autoRetryQueue.find(item => item.imageId === currentImage.id) ? (
                    <Tag color="processing" icon={<SyncOutlined spin />}>
                      自动重试队列中
                    </Tag>
                  ) : currentImage.downloadAttempts >= 3 ? (
                    <Tag color="error">已达到最大自动重试次数</Tag>
                  ) : null}
                </>
              )}
            </Paragraph>
            <Paragraph>
              <Text strong>尝试次数:</Text> {currentImage.downloadAttempts}
            </Paragraph>
            {currentImage.lastAttemptAt && (
              <Paragraph>
                <Text strong>最后尝试时间:</Text> {new Date(currentImage.lastAttemptAt).toLocaleString()}
              </Paragraph>
            )}
            <Paragraph>
              <Text strong>原始URL:</Text> <br />
              <a href={currentImage.originalUrl} target="_blank" rel="noopener noreferrer">
                {currentImage.originalUrl}
              </a>
            </Paragraph>
            {currentImage.localPath && (
              <Paragraph>
                <Text strong>本地路径:</Text> <br />
                {currentImage.localPath}
                <Button 
                  icon={<FolderOpenOutlined />} 
                  size="small" 
                  style={{ marginLeft: 8 }}
                  onClick={() => handleOpenFolder(currentImage.localPath)}
                >
                  打开文件夹
                </Button>
              </Paragraph>
            )}
            {currentImage.errorMessage && (
              <Paragraph>
                <Text strong>错误信息:</Text> <br />
                <Text type="danger">{currentImage.errorMessage}</Text>
              </Paragraph>
            )}
            {currentImage.localPath && (
              <div style={{ marginTop: 16 }}>
                <Text strong>图片预览:</Text>
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <AntImage 
                    src={`file://${currentImage.localPath}`}
                    style={{ maxWidth: '100%', maxHeight: '300px' }}
                  />
                </div>
              </div>
            )}
          </div>
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

export default ImageDownloadsPage; 