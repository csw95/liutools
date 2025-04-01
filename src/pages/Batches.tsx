import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Typography, 
  message, 
  Modal, 
  Input, 
  Form,
  Popconfirm,
  Statistic,
  Card,
  Row,
  Col
} from 'antd';
import { 
  ReloadOutlined, 
  EditOutlined, 
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<any>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
  // 将函数提升到组件级别
  const fetchBatches = async () => {
    try {
      setLoading(true);
      const result = await window.electron.getBatches();
      if (result.success) {
        setBatches(result.data || []);
      } else {
        message.error(result.error || '获取批次失败');
      }
    } catch (error) {
      message.error('获取批次数据出错');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // 使用提升后的函数
  useEffect(() => {
    fetchBatches();
  }, []);
  
  // 编辑批次
  const handleEdit = (batch: any) => {
    setCurrentBatch(batch);
    form.setFieldsValue({
      customerName: batch.customerName,
      amount: batch.amount
    });
    setEditModalVisible(true);
  };
  
  // 保存编辑
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const result = await window.electron.updateBatch({
        id: currentBatch.id,
        ...values
      });
      
      if (result.success) {
        message.success('批次信息更新成功');
        setEditModalVisible(false);
        fetchBatches();
      } else {
        message.error(`更新失败: ${result.error}`);
      }
    } catch (error) {
      console.error('保存批次失败:', error);
    }
  };
  
  // 删除批次
  const handleDelete = async (id: string) => {
    try {
      console.log('删除批次ID:', id, typeof id);
      
      const result = await window.electron.deleteBatch(id);
      console.log('删除批次结果:', result);
      
      if (result.success) {
        message.success('批次删除成功');
        fetchBatches();
      } else {
        message.error(`删除失败: ${result.error}`);
      }
    } catch (error) {
      console.error('删除批次失败:', error);
      message.error('删除过程出错');
    }
  };
  
  // 查看批次内订单
  const handleViewOrders = (batchId: string) => {
    navigate(`/orders?batchId=${batchId}`);
  };
  
  // 导出批次图片
  const handleExportImages = async (batchId: string, batchName: string) => {
    try {
      message.loading({ content: '准备导出图片...', key: 'exportImages', duration: 0 });
      const result = await window.electron.exportBatchImages(batchId);
      
      if (result.success) {
        message.success({ content: result.message || '图片导出成功！', key: 'exportImages' });
      } else if (result.canceled) {
        message.info({ content: '已取消导出', key: 'exportImages' });
      } else {
        message.error({ content: `导出失败: ${result.error}`, key: 'exportImages' });
      }
    } catch (error) {
      console.error('导出图片失败:', error);
      message.error({ content: '导出过程出错', key: 'exportImages' });
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '批次名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: any) => {
        if (amount === undefined || amount === null) return '￥ 0.00';
        const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
        return isNaN(numAmount) ? '￥ 0.00' : `￥ ${numAmount.toFixed(2)}`;
      }
    },
    {
      title: '导入日期',
      dataIndex: 'importDate',
      key: 'importDate',
      render: (date: string) => {
        if (!date) return '-';
        try {
          return new Date(date).toLocaleDateString();
        } catch (error) {
          return '-';
        }
      }
    },
    {
      title: '订单数量',
      dataIndex: 'Orders',
      key: 'orders',
      render: (orders: any) => {
        if (!Array.isArray(orders)) return 0;
        return orders.length;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: React.ReactNode, record: any) => (
        <Space size="small">
          <Button 
            key={`view-${record.id}`}
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewOrders(record.id)}
          />
          <Button 
            key={`edit-${record.id}`}
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
          <Button
            key={`export-${record.id}`}
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleExportImages(record.id, record.name)}
            title="导出批次图片"
          />
          <Popconfirm
            key={`delete-${record.id}`}
            title="确定要删除此批次吗？"
            description={
              <div>
                <p>删除后将无法恢复，且该批次下所有订单都将被删除！</p>
                <p style={{ color: 'red', fontWeight: 'bold' }}>
                  {record.Orders && Array.isArray(record.Orders) && record.Orders.length > 0 
                    ? `此批次包含 ${record.Orders.length} 个订单，它们也将被删除！`
                    : '此操作不可撤销！'}
                </p>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button 
              key={`delete-btn-${record.id}`}
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 改用 Orders 属性计算订单总数
  const totalOrders = Array.isArray(batches) 
    ? batches.reduce((acc, batch: any) => acc + (batch.Orders?.length || 0), 0)
    : 0;

  return (
    <div>
      <Title level={2}>批次管理</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总批次数"
              value={batches.length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={totalOrders}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总金额"
              value={batches.reduce((sum, batch: any) => sum + (batch.amount || 0), 0)}
              precision={2}
              prefix="￥"
            />
          </Card>
        </Col>
      </Row>
      
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={fetchBatches}
        >
          刷新
        </Button>
      </Space>
      
      <Table
        rowKey="id"
        columns={columns}
        dataSource={batches}
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个批次`
        }}
      />
      
      {/* 编辑批次弹窗 */}
      <Modal
        title="编辑批次信息"
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="customerName"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          
          <Form.Item
            name="amount"
            label="订单金额"
            rules={[{ required: true, message: '请输入订单金额' }]}
          >
            <Input 
              type="number"
              step="0.01"
              min="0"
              placeholder="请输入订单金额"
              prefix="￥"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BatchesPage; 