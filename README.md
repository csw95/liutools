# PODERP - POD订单ERP系统

一个用于管理POD（Print On Demand）订单的桌面应用程序。

## 功能特点

- 订单管理与跟踪
- 批次导入导出
- 图片下载与管理
- Google Drive 集成
- 支持 Windows 和 macOS 平台

## 开发环境

### 前提条件

- Node.js (v16+)
- npm

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 编译项目

```bash
npm run compile
```

## 构建与打包

### 准备图标

在打包前，需要准备应用图标：

1. 将 `assets/icon.svg` 转换为以下格式：
   - Windows: `assets/icon.ico` (256x256)
   - macOS: `assets/icon.icns` (1024x1024)

可以使用在线工具或以下命令转换图标：

```bash
# 使用 ImageMagick 将 SVG 转换为 PNG
convert -background none -density 1024x1024 assets/icon.svg assets/icon.png

# macOS 图标
# 需安装 npm install -g svg2png png2icons
svg2png -o assets/icon.png assets/icon.svg
png2icons assets/icon.png assets/icon --icns

# Windows 图标
# 需安装 npm install -g svg2png
svg2png -o assets/icon.png assets/icon.svg --width=256 --height=256
# 然后使用在线工具将PNG转换为ICO格式
```

### 打包应用

```bash
# 同时打包 Windows 和 macOS 版本
npm run package

# 仅打包 Windows 版本
npm run package:win

# 仅打包 macOS 版本
npm run package:mac
```

打包后的文件将位于 `release` 目录中。

## 注意事项

### Windows 打包

- 在 macOS 上打包 Windows 版本需要安装 Wine
- 在 Windows 上打包时确保已安装 Visual Studio 和 Windows SDK

### macOS 打包 

- 在 Windows 上无法打包 macOS 版本
- 在 macOS 上打包需要安装 Xcode Command Line Tools

## 技术栈

- Electron
- React
- TypeScript
- Sequelize (SQLite)
- Ant Design 