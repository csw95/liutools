# LiuTools 开发环境安装指南

此文档提供了如何在Windows系统上设置LiuTools开发环境的说明。

## 系统要求

- Windows 10/11（64位）
- 管理员权限
- 网络连接

## 快速开始

我们提供了两种脚本来帮助您快速设置开发环境：

### 方法1：使用批处理脚本（推荐普通用户）

1. 下载 `setup-dev-env.bat` 文件到您的电脑
2. 右键点击该文件，选择"以管理员身份运行"
3. 脚本将自动执行以下操作：
   - 安装Chocolatey包管理器（如果尚未安装）
   - 安装Git（如果尚未安装）
   - 安装Node.js（如果尚未安装）
   - 克隆LiuTools代码库
   - 安装项目依赖
   - 构建项目
   - 启动开发服务器

### 方法2：使用PowerShell脚本（推荐开发者）

1. 下载 `setup-dev-env.ps1` 文件到您的电脑
2. 打开PowerShell（以管理员身份）
3. 执行以下命令允许运行本地脚本：
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
4. 导航到脚本所在目录，然后运行：
   ```powershell
   .\setup-dev-env.ps1
   ```
5. 脚本将执行与批处理脚本相同的操作，但提供更详细的信息和彩色输出

## 手动安装步骤

如果您希望手动安装，可以按照以下步骤进行：

1. 安装必要软件：
   - Git: https://git-scm.com/download/win
   - Node.js (LTS版本): https://nodejs.org/en/download/

2. 打开命令提示符或PowerShell，运行以下命令：
   ```cmd
   mkdir %USERPROFILE%\liutools
   cd %USERPROFILE%\liutools
   git clone https://github.com/csw95/liutools.git .
   npm install
   npm run build
   npm run dev
   ```

## 常见问题

### 安装过程中出现错误

- 查看日志文件（保存在临时目录）获取详细错误信息
- 确保您有管理员权限
- 检查网络连接
- 尝试临时关闭防病毒软件

### 无法启动开发服务器

如果构建成功但开发服务器无法启动，可以尝试：

1. 运行 `npm run fix-complete`（修复常见问题）
2. 然后运行 `npm run dev`

### 需要重新安装依赖

如果遇到模块不兼容问题，可以尝试：

```cmd
cd %USERPROFILE%\liutools
rmdir /s /q node_modules
npm install
```

## 联系支持

如果您在安装过程中遇到问题，请提交问题到项目的GitHub仓库：
https://github.com/csw95/liutools/issues 