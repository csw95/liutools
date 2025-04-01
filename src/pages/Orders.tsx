import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Typography, 
  message, 
  Modal, 
  Select, 
  Form, 
  Drawer,
  Tabs,
  Card,
  Row,
  Col,
  Image,
  Popconfirm,
  Tooltip,
  Input as AntInput
} from 'antd';
import { 
  ReloadOutlined, 
  ExportOutlined, 
  SearchOutlined, 
  EditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  SendOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { getConfig } from '../services/config';

const { Title } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const OrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const batchId = searchParams.get('batchId');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState(batchId || '');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [driveUrlModalVisible, setDriveUrlModalVisible] = useState(false);
  const [driveUrlForm] = Form.useForm();
  const [currentFolderType, setCurrentFolderType] = useState<'mockup' | 'material'>('mockup');
  const navigate = useNavigate();
  
  // 加载订单数据
  const fetchOrders = async (batchId = '') => {
    try {
      setLoading(true);
      
      // 添加调试日志
      console.log('fetchOrders: batchId =', batchId);
      
      const result = await window.electron.getOrders(batchId);
      
      // 检查响应结构
      console.log('API Response:', result);
      
      if (result && result.success) {
        // 确保 result.data 是数组
        if (!Array.isArray(result.data)) {
          console.error('API返回的数据不是数组:', result.data);
          setOrders([]);
          message.error('获取订单失败: 数据格式错误');
          return;
        }
        
        // 处理每个订单项，确保所有需要的字段都存在
        const processedOrders = result.data.map((order: any) => {
          if (!order || typeof order !== 'object') return null;
          
          return {
            ...order,
            id: order.id || '',
            customerNo: order.customerNo || '',
            customerSku: order.customerSku || '',
            spu: order.spu || '',
            size: order.size || '',
            quantity: order.quantity || 0,
            name: order.name || '',
            country: order.country || '',
            isShipped: !!order.isShipped,
            Images: Array.isArray(order.Images) ? order.Images : []
          };
        }).filter(Boolean); // 移除无效项
        
        console.log('处理后的订单数据:', processedOrders);
        setOrders(processedOrders);
      } else {
        console.error('API error:', result);
        message.error(result?.error || '获取订单失败');
        setOrders([]); // 错误时重置为空数组
      }
    } catch (error) {
      console.error('获取订单失败:', error);
      message.error('获取订单数据失败');
      setOrders([]); // 错误时重置为空数组
    } finally {
      setLoading(false);
    }
  };
  
  // 加载批次数据
  const loadBatches = async () => {
    try {
      // 添加调试日志
      console.log('加载批次列表...');
      
      const result = await window.electron.getBatches();
      console.log('批次API返回:', result);
      
      // 更严格的结果处理
      if (result && result.success) {
        if (!Array.isArray(result.data)) {
          console.error('批次API返回的数据不是数组:', result.data);
          setBatches([]);
          message.error('获取批次失败: 数据格式错误');
          return;
        }
        
        // 处理每个批次项，确保所有需要的字段都存在
        const processedBatches = result.data.map((batch: any) => {
          if (!batch || typeof batch !== 'object') return null;
          
          return {
            ...batch,
            id: batch.id || '',
            name: batch.name || '',
            customerName: batch.customerName || '',
            amount: batch.amount || 0,
            importDate: batch.importDate || new Date().toISOString()
          };
        }).filter(Boolean); // 移除无效项
        
        console.log('处理后的批次数据:', processedBatches);
        setBatches(processedBatches);
      } else {
        console.error('批次API返回格式错误:', result);
        setBatches([]); // 重置为空数组
        message.error(result?.error || '获取批次失败');
      }
    } catch (error) {
      console.error('加载批次失败:', error);
      setBatches([]); // 在错误情况下也确保是数组
    }
  };
  
  useEffect(() => {
    loadBatches();
  }, []);
  
  useEffect(() => {
    // 使用 searchParams 而不是重新创建
    const batchId = searchParams.get('batchId') || '';
    setSelectedBatch(batchId);
    
    fetchOrders(batchId);
  }, [searchParams]);
  
  // 导出订单
  const handleExport = async () => {
    try {
      setLoading(true);
      // 使用exportExcel而不是exportOrders
      const result = await window.electron.exportExcel(
        selectedBatch || '', // batchId
        'shipping', // 模板类型
        false // 是否排除已发货
      );
      
      if (result.success) {
        message.success('订单导出成功！');
      } else {
        message.error(`导出失败: ${result.error}`);
      }
    } catch (error) {
      console.error('导出订单失败:', error);
      message.error('导出过程出错');
    } finally {
      setLoading(false);
    }
  };
  
  // 标记订单已发货
  const handleMarkShipped = async (id: string) => {
    try {
      const result = await window.electron.markOrderAsShipped(id);
      if (result.success) {
        message.success('订单已标记为已发货');
        fetchOrders(selectedBatch);
      } else {
        message.error(`操作失败: ${result.error}`);
      }
    } catch (error) {
      console.error('标记发货失败:', error);
      message.error('操作过程出错');
    }
  };
  
  // 查看订单详情
  const handleViewDetail = async (id: string) => {
    try {
      setLoading(true);
      const result = await window.electron.getOrderById(id);
      setLoading(false);
      
      console.log('获取到订单详情原始结果:', result);
      
      // 检查响应结构
      if (!result) {
        console.error('返回数据为空');
        message.error('获取订单详情失败: 返回数据为空');
        return;
      }
      
      // 检查API调用是否成功
      if (!result.success) {
        console.error('获取订单失败:', result.error);
        message.error(`获取订单详情失败: ${result.error || '未知错误'}`);
        return;
      }
      
      // 确保data字段存在
      if (!result.data) {
        console.error('返回数据中缺少data字段:', result);
        message.error('获取订单详情失败: 返回数据格式错误');
        return;
      }
      
      const response = result.data;
      console.log('订单详情数据:', response);
      
      // 检查数据有效性
      if (!response || !response.id) {
        console.error('获取订单详情失败: 无效的数据', response);
        message.error('获取订单详情失败: 无效的数据');
        return;
      }
      
      // 确保所有可能会在模板中使用的字段都存在
      const order = {
        ...response,
        // 确保必要字段有默认值
        customerNo: response.customerNo || '',
        customerSku: response.customerSku || '',
        spu: response.spu || '',
        size: response.size || '',
        quantity: response.quantity || 0,
        name: response.name || '',
        country: response.country || '',
        province: response.province || '',
        telephone: response.telephone || '',
        address01: response.address01 || '',
        address02: response.address02 || '',
        isShipped: !!response.isShipped,
        trackingNo: response.trackingNo || '',
        // 图片字段必须是字符串或undefined/null
        mockupImage: typeof response.mockupImage === 'string' ? response.mockupImage : '',
        materialImage: typeof response.materialImage === 'string' ? response.materialImage : '',
        // 确保Images数组存在
        Images: Array.isArray(response.Images) ? response.Images : []
      };
      
      setCurrentOrder(order);
      setDetailVisible(true);
    } catch (error) {
      setLoading(false);
      console.error('获取订单详情失败:', error);
      message.error(`获取订单详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  // 处理添加Google Drive文件夹
  const handleAddGoogleDriveFolder = async (order: any, type: 'mockup' | 'material') => {
    // 首先检查Google Drive授权状态
    try {
      const configResult = await window.electron.getAppConfig();
      
      if (configResult.success && configResult.data) {
        // 检查是否已授权Google Drive
        if (!configResult.data.googleDriveConfigured) {
          // 未授权，提示用户先授权
          Modal.confirm({
            title: '需要授权Google Drive',
            content: '使用此功能需要先授权Google Drive。是否前往设置页面进行授权？',
            okText: '前往授权',
            cancelText: '取消',
            onOk: () => {
              // 导航到设置页面
              navigate('/settings');
            }
          });
          return;
        }
      }
      
      // 已授权，继续流程
      setCurrentOrder(order);
      setCurrentFolderType(type);
      driveUrlForm.resetFields();
      setDriveUrlModalVisible(true);
    } catch (error) {
      console.error('检查Google Drive授权状态时出错:', error);
      message.error('检查授权状态失败，请重试');
    }
  };

  // 处理Google Drive文件夹链接提交
  const handleDriveUrlSubmit = async () => {
    try {
      const values = await driveUrlForm.validateFields();
      
      if (!currentOrder) {
        message.error('未选择订单');
        return;
      }
      
      // 再次检查授权状态，确保请求发送前已授权
      const configResult = await window.electron.getAppConfig();
      if (configResult.success && configResult.data && !configResult.data.googleDriveConfigured) {
        message.error('Google Drive未授权，请先在设置中授权');
        setDriveUrlModalVisible(false);
        navigate('/settings');
        return;
      }
      
      // 调用后端API处理文件夹
      const result = await window.electron.processGoogleDriveFolder(
        currentOrder.id,
        values.url,
        currentFolderType
      );
      
      if (result?.success) {
        message.success('文件夹处理任务已提交，可在文件夹下载管理页面查看进度');
        setDriveUrlModalVisible(false);
        
        // 延迟后刷新订单详情
        setTimeout(() => {
          handleViewDetail(currentOrder.id);
        }, 1000);
      } else {
        // 检查是否是授权错误
        if (result?.error && (
            result.error.includes('授权失败') || 
            result.error.includes('请先在设置中授权')
        )) {
          Modal.confirm({
            title: '需要授权Google Drive',
            content: result.error,
            okText: '前往授权',
            cancelText: '取消',
            onOk: () => {
              setDriveUrlModalVisible(false);
              navigate('/settings');
            }
          });
        } else {
          message.error(`处理失败: ${result?.error || '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('提交Google Drive文件夹链接时出错:', error);
      message.error('提交失败，请重试');
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '客户订单号',
      dataIndex: 'customerNo',
      key: 'customerNo',
      width: 120,
    },
    {
      title: '客户SKU',
      dataIndex: 'customerSku',
      key: 'customerSku',
      width: 120,
    },
    {
      title: 'SPU',
      dataIndex: 'spu',
      key: 'spu',
      width: 120,
    },
    {
      title: '尺码',
      dataIndex: 'size',
      key: 'size',
      width: 80,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
    },
    {
      title: '收件人',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'isShipped',
      key: 'isShipped',
      width: 100,
      render: (isShipped: boolean) => (
        isShipped ? 
          <Tag color="green">已发货</Tag> : 
          <Tag color="orange">待发货</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button 
            key={`view-${record.id}`}
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewDetail(record.id)}
          />
          {!record.isShipped && (
            <Button 
              key={`ship-${record.id}`}
              type="text" 
              icon={<CheckCircleOutlined />} 
              onClick={() => handleMarkShipped(record.id)}
            />
          )}
          <Button 
            key={`edit-${record.id}`}
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleViewDetail(record.id)}
          />
        </Space>
      ),
    },
  ];
  
  // 完全替换 filteredOrders 逻辑
  const filteredOrders = React.useMemo(() => {
    if(orders === null) {
      return [];
    }
    // 额外的安全检查
    if (!Array.isArray(orders)) {
      console.error('Orders is not an array:', orders);
      return [];
    }
    
    if (!searchText) return orders;
    
    const searchLower = searchText.toLowerCase();
    
    try {
      return orders.filter(order => {
        // 避免任何类型错误
        if (!order) return false;
        
        return (
          String(order.customerNo || '').toLowerCase().includes(searchLower) ||
          String(order.customerSku || '').toLowerCase().includes(searchLower) ||
          String(order.spu || '').toLowerCase().includes(searchLower) ||
          String(order.name || '').toLowerCase().includes(searchLower) ||
          String(order.country || '').toLowerCase().includes(searchLower)
        );
      });
    } catch (error) {
      console.error('过滤订单失败:', error);
      return [];
    }
  }, [orders, searchText]);

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

  // 获取图片显示源
  const getImageSrc = (img: any) => {
    // 添加调试信息
    console.log('处理图片:', {
      originalUrl: img.originalUrl,
      status: img.downloadStatus,
      localPath: img.localPath,
      absolutePath: img.absolutePath
    });

    // 如果是远程URL且已经以http开头，直接返回
    if (img.originalUrl && img.originalUrl.startsWith('http')) {
      console.log('使用远程URL:', img.originalUrl);
      return img.originalUrl;
    }
    
    // 如果已下载完成，显示本地文件
    if (img.downloadStatus === 'completed' && img.localPath) {
      // 优先使用绝对路径（如果存在）
      if (img.absolutePath) {
        console.log('使用绝对路径:', img.absolutePath);
        return `file://${img.absolutePath}`;
      }
      
      // 否则使用下载路径 + 相对路径
      try {
        const downloadPath = getConfig('downloadPath');
        if (downloadPath) {
          // 使用字符串拼接替代path.join
          const fullPath = downloadPath + (downloadPath.endsWith('/') ? '' : '/') + img.localPath;
          console.log('构建完整路径:', fullPath);
          return `file://${fullPath}`;
        }
      } catch (error) {
        console.error('获取下载路径失败:', error);
      }
      
      // 如果都失败了，尝试直接使用localPath（可能是绝对路径）
      console.log('使用本地路径作为后备:', img.localPath);
      return `file://${img.localPath}`;
    }
    
    // 否则显示占位图
    console.log('使用占位图');
    return '/placeholder.png';
  };

  // 处理旧版URL字符串
  const getLegacyImageSrc = (url: string) => {
    if (url && url.startsWith('http')) {
      return url;
    }
    return '/placeholder.png';
  };

  return (
    <div>
      <Title level={2}>订单管理</Title>
      
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="选择批次"
          style={{ width: 300 }}
          value={selectedBatch || undefined}
          onChange={setSelectedBatch}
          allowClear
        >
          {Array.isArray(batches) ? (
            batches.length > 0 ? (
              batches.map((batch: any) => {
                // 添加更严格的属性检查
                if (!batch || typeof batch !== 'object') return null;
                const batchId = batch.id || '';
                const batchName = batch.name || '';
                
                return (
                  <Option key={batchId} value={batchId}>
                    {batchName || `批次 ${batchId ? batchId.slice(0, 8) : '未命名'}`}
                  </Option>
                );
              })
            ) : (
              <Option disabled value="">没有可用批次</Option>
            )
          ) : (
            <Option disabled value="">批次加载错误</Option>
          )}
        </Select>
        
        <Input.Search
          placeholder="搜索订单号/SKU/SPU/收件人/国家"
          style={{ width: 300 }}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        
        <Button 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={() => fetchOrders(selectedBatch)}
        >
          刷新
        </Button>
        
        <Button 
          type="primary"
          icon={<ExportOutlined />}
          onClick={handleExport}
          disabled={orders.length === 0 && selectedRowKeys.length === 0}
        >
          导出发货单
        </Button>
      </Space>
      
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredOrders}
        loading={loading}
        scroll={{ x: 1100 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys)
        }}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条订单`
        }}
      />
      
      {/* 订单详情抽屉 */}
      <Drawer
        title="订单详情"
        width={720}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {currentOrder && !currentOrder.isShipped && (
              <Button 
                type="primary" 
                onClick={() => {
                  handleMarkShipped(currentOrder.id);
                  setDetailVisible(false);
                }}
              >
                标记为已发货
              </Button>
            )}
          </Space>
        }
      >
        {currentOrder && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="订单信息" size="small">
                    <p><strong>客户订单号:</strong> {currentOrder.customerNo}</p>
                    <p><strong>客户SKU:</strong> {currentOrder.customerSku}</p>
                    <p><strong>SPU:</strong> {currentOrder.spu}</p>
                    <p><strong>尺码:</strong> {currentOrder.size}</p>
                    <p><strong>数量:</strong> {currentOrder.quantity}</p>
                    <p><strong>状态:</strong> {currentOrder.isShipped ? '已发货' : '待发货'}</p>
                    {currentOrder.trackingNo && (
                      <p><strong>追踪号:</strong> {currentOrder.trackingNo}</p>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="收件人信息" size="small">
                    <p><strong>姓名:</strong> {currentOrder.name}</p>
                    <p><strong>国家:</strong> {currentOrder.country}</p>
                    <p><strong>省/州:</strong> {currentOrder.province}</p>
                    <p><strong>电话:</strong> {currentOrder.telephone}</p>
                    <p><strong>地址1:</strong> {currentOrder.address01}</p>
                    <p><strong>地址2:</strong> {currentOrder.address02}</p>
                  </Card>
                </Col>
              </Row>
            </TabPane>
            
            <TabPane tab="图片信息" key="images">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Space style={{ marginBottom: 16 }}>
                    <Button 
                      type="primary" 
                      icon={<FolderOutlined />}
                      onClick={() => handleAddGoogleDriveFolder(currentOrder, 'mockup')}
                    >
                      添加Google Drive效果图文件夹
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<FolderOutlined />}
                      onClick={() => handleAddGoogleDriveFolder(currentOrder, 'material')}
                    >
                      添加Google Drive素材图文件夹
                    </Button>
                    <Button
                      onClick={() => navigate(`/folder-downloads`)}
                    >
                      查看所有文件夹下载
                    </Button>
                  </Space>
                </Col>
                <Col span={24}>
                  <Card title="效果图" size="small">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Array.isArray(currentOrder.Images) && 
                       currentOrder.Images.filter((img: any) => img.type === 'mockup').length > 0 ? 
                        currentOrder.Images.filter((img: any) => img.type === 'mockup').map((img: any, index: number) => (
                          <div key={`mockup-${img.id || index}`} style={{ marginBottom: 8 }}>
                            <Image
                              width={150}
                              src={getImageSrc(img)}
                              fallback="/placeholder.png"
                            />
                            <p style={{ marginTop: 4, wordBreak: 'break-all' }}>
                              {img.originalUrl || ''}
                            </p>
                            <p>
                              <Typography.Text type={img.downloadStatus === 'completed' ? 'success' : 
                                    (img.downloadStatus === 'failed' ? 'danger' : 'warning')}>
                                {img.downloadStatus === 'completed' ? '下载成功' : 
                                 (img.downloadStatus === 'failed' ? '下载失败' : 
                                 (img.downloadStatus === 'downloading' ? '下载中' : '等待下载'))}
                              </Typography.Text>
                            </p>
                          </div>
                        ))
                      : (
                        currentOrder.mockupImage && typeof currentOrder.mockupImage === 'string' ? 
                          currentOrder.mockupImage.split(',').map((url: string, index: number) => (
                            <div key={`mockup-legacy-${index}`} style={{ marginBottom: 8 }}>
                              <Image
                                width={150}
                                src={getLegacyImageSrc(url)}
                                fallback="/placeholder.png"
                              />
                              <p style={{ marginTop: 4, wordBreak: 'break-all' }}>
                                {url}
                              </p>
                            </div>
                          ))
                        : <p>暂无效果图</p>
                      )}
                    </div>
                  </Card>
                </Col>
                
                <Col span={24}>
                  <Card title="素材图" size="small">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Array.isArray(currentOrder.Images) && 
                       currentOrder.Images.filter((img: any) => img.type === 'material').length > 0 ? 
                        currentOrder.Images.filter((img: any) => img.type === 'material').map((img: any, index: number) => (
                          <div key={`material-${img.id || index}`} style={{ marginBottom: 8 }}>
                            <Image
                              width={150}
                              src={getImageSrc(img)}
                              fallback="/placeholder.png"
                            />
                            <p style={{ marginTop: 4, wordBreak: 'break-all' }}>
                              {img.originalUrl || ''}
                            </p>
                            <p>
                              <Typography.Text type={img.downloadStatus === 'completed' ? 'success' : 
                                    (img.downloadStatus === 'failed' ? 'danger' : 'warning')}>
                                {img.downloadStatus === 'completed' ? '下载成功' : 
                                 (img.downloadStatus === 'failed' ? '下载失败' : 
                                 (img.downloadStatus === 'downloading' ? '下载中' : '等待下载'))}
                              </Typography.Text>
                            </p>
                          </div>
                        ))
                      : (
                        currentOrder.materialImage && typeof currentOrder.materialImage === 'string' ? 
                          currentOrder.materialImage.split(',').map((url: string, index: number) => (
                            <div key={`material-legacy-${index}`} style={{ marginBottom: 8 }}>
                              <Image
                                width={150}
                                src={getLegacyImageSrc(url)}
                                fallback="/placeholder.png"
                              />
                              <p style={{ marginTop: 4, wordBreak: 'break-all' }}>
                                {url}
                              </p>
                            </div>
                          ))
                        : <p>暂无素材图</p>
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        )}
      </Drawer>
      
      {/* Google Drive文件夹链接输入框 */}
      <Modal
        title={`添加Google Drive${currentFolderType === 'mockup' ? '效果图' : '素材图'}文件夹`}
        open={driveUrlModalVisible}
        onCancel={() => setDriveUrlModalVisible(false)}
        onOk={handleDriveUrlSubmit}
        destroyOnClose
      >
        <Form form={driveUrlForm} layout="vertical">
          <Form.Item
            name="url"
            label="Google Drive共享文件夹链接"
            rules={[
              { required: true, message: '请输入Google Drive共享文件夹链接' },
              { 
                pattern: /drive\.google\.com/, 
                message: '请输入有效的Google Drive链接' 
              }
            ]}
          >
            <AntInput placeholder="https://drive.google.com/drive/folders/..." />
          </Form.Item>
          <Typography.Text type="secondary">
            请确保文件夹已设置为共享状态，并且链接有效。处理过程可能需要几分钟时间，您可以在文件夹下载管理页面查看进度。
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
};

export default OrdersPage; 