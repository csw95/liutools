import React, { useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Typography, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  message, 
  Statistic,
  Alert 
} from 'antd';
import { 
  ImportOutlined, 
  ExportOutlined, 
  DownloadOutlined, 
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { confirm } = Modal;

const HomePage: React.FC = () => {
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleImport = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 选择Excel文件
      const fileResult = await window.electron.selectExcelFile();
      
      if (fileResult.canceled || !fileResult.filePath) {
        setLoading(false);
        return;
      }
      
      // 导入订单
      const importResult = await window.electron.importOrders({
        customerName: values.customerName,
        amount: values.amount,
        filePath: fileResult.filePath
      });
      
      if (importResult.success) {
        message.success('订单导入成功！');
        setImportModalVisible(false);
        form.resetFields();
        
        // 导航到订单列表
        if (importResult.batchId) {
          navigate(`/orders?batchId=${importResult.batchId}`);
        } else {
          navigate('/orders');
        }
      } else {
        setLoading(false);
        // 显示详细的错误信息
        showErrorDetails('导入失败', importResult.error || '未知错误');
      }
    } catch (error) {
      console.error('导入过程出错:', error);
      setLoading(false);
      showErrorDetails('导入错误', error instanceof Error ? error.message : '导入过程出现未知错误');
    }
  };
  
  // 显示详细错误信息的函数
  const showErrorDetails = (title: string, errorMessage: string) => {
    // 检查是否包含多个错误
    const isMultilineError = errorMessage.includes(';') || errorMessage.length > 100;
    
    if (isMultilineError) {
      // 对于复杂的错误信息，使用Modal展示
      Modal.error({
        title: title,
        content: (
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            <Alert
              message="导入过程中检测到以下问题:"
              description={
                <ul>
                  {errorMessage.split(';').map((err, index) => (
                    <li key={index}>{err.trim()}</li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
            />
          </div>
        ),
        width: 600,
        okText: '我知道了'
      });
    } else {
      // 对于简单错误，使用message
      message.error(`${title}: ${errorMessage}`);
    }
  };
  
  const handleDownloadTemplate = async () => {
    try {
      const result = await window.electron.downloadTemplate();
      if (result.success) {
        message.success('模板下载成功！');
      } else if (!result.canceled) {
        message.error(`下载失败: ${result.error}`);
      }
    } catch (error) {
      message.error('下载模板出错');
      console.error(error);
    }
  };

  return (
    <div>
      <Title level={2}>欢迎使用 PODERP 系统</Title>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理订单数"
              value={0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日导入批次"
              value={0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月订单总量"
              value={0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="图片待下载"
              value={0}
              suffix="张"
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card 
            title="订单导入" 
            bordered={false} 
            style={{ height: 200 }}
            actions={[
              <Button 
                type="primary" 
                icon={<ImportOutlined />} 
                onClick={() => setImportModalVisible(true)}
              >
                导入订单
              </Button>
            ]}
          >
            导入Excel格式的订单，支持批量导入
          </Card>
        </Col>
        
        <Col span={6}>
          <Card 
            title="订单管理" 
            bordered={false} 
            style={{ height: 200 }}
            actions={[
              <Button 
                type="primary" 
                icon={<DatabaseOutlined />}
                onClick={() => navigate('/orders')} 
              >
                管理订单
              </Button>
            ]}
          >
            查看和管理所有订单，标记发货状态
          </Card>
        </Col>
        
        <Col span={6}>
          <Card 
            title="导出发货单" 
            bordered={false} 
            style={{ height: 200 }}
            actions={[
              <Button 
                type="primary" 
                icon={<ExportOutlined />}
                onClick={() => navigate('/orders')}
              >
                导出发货单
              </Button>
            ]}
          >
            导出包含图片的发货单，支持打印
          </Card>
        </Col>
        
        <Col span={6}>
          <Card 
            title="文件夹下载" 
            bordered={false} 
            style={{ height: 200 }}
            actions={[
              <Button 
                type="primary" 
                icon={<FolderOutlined />}
                onClick={() => navigate('/folder-downloads')} 
              >
                管理文件夹下载
              </Button>
            ]}
          >
            查看Google Drive文件夹下载状态，管理下载中或已下载的图片文件夹
          </Card>
        </Col>
      </Row>
      
      {/* 导入订单弹窗 */}
      <Modal
        title="导入订单"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
        confirmLoading={loading}
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
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入订单金额"
              min={0}
              precision={2}
              formatter={(value: any) => `￥ ${value}`}
              parser={value => value!.replace(/￥\s?/g, '')}
            />
          </Form.Item>
          
          <p>点击确定后将弹出文件选择框，请选择Excel格式的订单文件</p>
        </Form>
      </Modal>
    </div>
  );
};

export default HomePage; 