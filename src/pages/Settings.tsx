import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Divider, 
  Typography, 
  Switch, 
  InputNumber,
  message,
  Modal
} from 'antd';
import { SaveOutlined, ReloadOutlined, FolderOpenOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [hasConfigIssues, setHasConfigIssues] = useState(false);
  const [configIssues, setConfigIssues] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  
  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await window.electron.getAppConfig();
        if (result.success) {
          // 设置表单值
          form.setFieldsValue(result.data);
          setConfigLoaded(true);
          
          // 检查配置问题
          if (result.data.configIssues && result.data.configIssues.length > 0) {
            setHasConfigIssues(true);
            setConfigIssues(result.data.configIssues);
          } else {
            setHasConfigIssues(false);
            setConfigIssues([]);
          }
        } else {
          message.error('加载配置失败');
        }
      } catch (error) {
        console.error('加载配置失败:', error);
        message.error('加载配置失败');
      }
    };
    
    loadConfig();
  }, [form]);
  
  // 保存设置
  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      // 确保标记为已配置状态
      values.configured = true;
      
      const result = await window.electron.saveAppConfig(values);
      if (result.success) {
        message.success('设置保存成功');
        
        // 重新加载配置，以确认配置状态
        const configResult = await window.electron.getAppConfig();
        if (configResult.success) {
          form.setFieldsValue(configResult.data);
          
          // 更新配置问题状态
          if (configResult.data.configIssues && configResult.data.configIssues.length > 0) {
            setHasConfigIssues(true);
            setConfigIssues(configResult.data.configIssues);
          } else {
            setHasConfigIssues(false);
            setConfigIssues([]);
          }
        }
      } else {
        message.error(`保存失败: ${result.error}`);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsAuthorizing(true);
    try {
      const result = await window.electron.authorizeGoogleDrive();
      if (result.success) {
        message.success('Google Drive 授权成功');
        // 刷新配置
        const configResult = await window.electron.getAppConfig();
        if (configResult.success) {
          form.setFieldsValue(configResult.data);
        }
      } else {
        // 显示详细的错误信息
        message.error(`授权失败: ${result.error || '未知错误'}`);
        console.error('Google Drive授权失败:', result.error);
      }
    } catch (error) {
      // 改进错误处理，提供更详细的错误信息
      console.error('授权过程出错:', error);
      
      // 判断error的类型并提取有用信息
      let errorMessage = '授权过程出错';
      if (error && typeof error === 'object') {
        if ('error' in error && error.error) {
          errorMessage = `授权过程出错: ${error.error}`;
        } else if (error instanceof Error) {
          errorMessage = `授权过程出错: ${error.message}`;
        }
      }
      
      message.error(errorMessage);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确定要重置系统配置吗?',
      icon: <WarningOutlined style={{ color: 'red' }} />,
      content: '这将把所有配置恢复为默认值，可能会影响已有的下载和导出设置。',
      okText: '确认重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setIsResetting(true);
        try {
          const result = await window.electron.resetAppConfig();
          if (result.success) {
            message.success('配置已重置');
            
            // 重新加载配置
            const configResult = await window.electron.getAppConfig();
            if (configResult.success) {
              form.setFieldsValue(configResult.data);
              
              // 更新配置问题状态
              if (configResult.data.configIssues && configResult.data.configIssues.length > 0) {
                setHasConfigIssues(true);
                setConfigIssues(configResult.data.configIssues);
              } else {
                setHasConfigIssues(false);
                setConfigIssues([]);
              }
            }
          } else {
            message.error(`重置失败: ${result.error}`);
          }
        } catch (error) {
          console.error('重置配置失败:', error);
          message.error('重置配置失败');
        } finally {
          setIsResetting(false);
        }
      },
    });
  };
  
  return (
    <div className="settings-page" style={{ padding: '20px' }}>
      <Title level={2}>系统设置</Title>
      
      {hasConfigIssues && configIssues.length > 0 && (
        <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
          <Typography.Title level={4} style={{ color: '#fa8c16' }}>配置问题</Typography.Title>
          <ul>
            {configIssues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          <Typography.Text>请完成上述配置项以确保系统正常运行。</Typography.Text>
        </div>
      )}
      
      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            downloadPath: '',
            maxConcurrentDownloads: 3,
            downloadTimeout: 30,
            maxRetryAttempts: 3,
            enableAutomaticDownload: true,
            exportPath: '',
            configured: false,
            googleDriveConfigured: false
          }}
          onFinish={handleSave}
        >
          <Title level={4}>下载设置</Title>
          <Paragraph>配置图片下载相关参数</Paragraph>
          
          <Form.Item
            name="downloadPath"
            label="图片下载路径"
            rules={[{ required: true, message: '请输入图片下载路径' }]}
          >
            <Input 
              placeholder="例如: C:\PODERP\downloads" 
              suffix={<FolderOpenOutlined />}
              readOnly
            />
          </Form.Item>
          
          <Form.Item
            name="maxConcurrentDownloads"
            label="最大并行下载数"
            rules={[{ required: true, message: '请输入最大并行下载数' }]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="downloadTimeout"
            label="下载超时时间(分钟)"
            rules={[{ required: true, message: '请输入下载超时时间' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="maxRetryAttempts"
            label="最大重试次数"
            rules={[{ required: true, message: '请输入最大重试次数' }]}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="enableAutomaticDownload"
            label="导入订单后自动下载图片"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Divider />
          
          <Title level={4}>Google Drive 访问授权</Title>
          <Paragraph>下载Google Drive链接的图片时，需要进行授权</Paragraph>
          
          <Form.Item
            label="Google Drive授权状态"
            name="googleDriveConfigured"
            valuePropName="checked"
          >
            <Switch disabled />
          </Form.Item>
          
          <Button 
            type="primary"
            onClick={handleGoogleAuth}
            loading={isAuthorizing}
            icon={<ReloadOutlined />}
            style={{ marginBottom: 16 }}
          >
            {form.getFieldValue('googleDriveConfigured') ? '重新授权 Google Drive' : '授权 Google Drive'}
          </Button>
          
          <Divider />
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
            
            <Button 
              danger
              style={{ marginLeft: 16 }}
              onClick={handleReset}
              loading={isResetting}
              icon={<ReloadOutlined />}
            >
              重置配置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPage; 