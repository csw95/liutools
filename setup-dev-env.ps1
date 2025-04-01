# LiuTools 开发环境安装和运行脚本 (PowerShell版本)

# 检查管理员权限
function Test-Administrator {  
    $user = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal $user
    $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)  
}

if (-not (Test-Administrator)) {
    Write-Host "请以管理员身份运行此脚本！" -ForegroundColor Red
    Write-Host "右键点击PowerShell图标，选择'以管理员身份运行'，然后执行此脚本。" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "    安装LiuTools开发环境并运行（PowerShell版）" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# 创建日志文件
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "$env:TEMP\liutools_setup_$timestamp.log"
Write-Host "安装日志将保存到: $logFile" -ForegroundColor Gray

# 设置工作目录
$workDir = "$env:USERPROFILE\liutools"
Write-Host "工作目录: $workDir" -ForegroundColor Yellow

if (-not (Test-Path $workDir)) {
    Write-Host "创建工作目录..." -ForegroundColor Yellow
    New-Item -Path $workDir -ItemType Directory | Out-Null
}

Set-Location $workDir

# 安装Chocolatey
Write-Host "正在检查Chocolatey包管理器..." -ForegroundColor Yellow
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "正在安装Chocolatey包管理器..." -ForegroundColor Green
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Host "安装Chocolatey失败: $_" -ForegroundColor Red
        Write-Output "安装Chocolatey失败: $_" | Out-File $logFile -Append
        pause
        exit 1
    }
} else {
    Write-Host "Chocolatey已安装." -ForegroundColor Green
}

# 安装Git
Write-Host "正在检查Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "正在安装Git..." -ForegroundColor Green
    try {
        choco install git -y | Out-File $logFile -Append
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Host "安装Git失败: $_" -ForegroundColor Red
        Write-Output "安装Git失败: $_" | Out-File $logFile -Append
        pause
        exit 1
    }
} else {
    $gitVersion = git --version
    Write-Host "Git已安装. 版本: $gitVersion" -ForegroundColor Green
}

# 安装Node.js
Write-Host "正在检查Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "正在安装Node.js..." -ForegroundColor Green
    try {
        choco install nodejs-lts -y | Out-File $logFile -Append
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } catch {
        Write-Host "安装Node.js失败: $_" -ForegroundColor Red
        Write-Output "安装Node.js失败: $_" | Out-File $logFile -Append
        pause
        exit 1
    }
} else {
    $nodeVersion = node --version
    Write-Host "Node.js已安装. 版本: $nodeVersion" -ForegroundColor Green
}

# 克隆代码库
Write-Host ""
Write-Host "正在检查代码库..." -ForegroundColor Yellow
if (-not (Test-Path "$workDir\.git")) {
    Write-Host "正在克隆代码库..." -ForegroundColor Green
    try {
        git clone https://github.com/csw95/liutools.git . | Out-File $logFile -Append
    } catch {
        Write-Host "克隆代码库失败: $_" -ForegroundColor Red
        Write-Output "克隆代码库失败: $_" | Out-File $logFile -Append
        pause
        exit 1
    }
} else {
    Write-Host "代码库已存在，正在拉取最新代码..." -ForegroundColor Green
    try {
        git pull | Out-File $logFile -Append
    } catch {
        Write-Host "拉取代码失败: $_" -ForegroundColor Red
        Write-Output "拉取代码失败: $_" | Out-File $logFile -Append
        pause
        exit 1
    }
}

# 安装npm依赖
Write-Host ""
Write-Host "正在安装npm依赖..." -ForegroundColor Yellow
try {
    npm install | Out-File $logFile -Append
} catch {
    Write-Host "安装npm依赖失败: $_" -ForegroundColor Red
    Write-Output "安装npm依赖失败: $_" | Out-File $logFile -Append
    pause
    exit 1
}

# 构建项目
Write-Host ""
Write-Host "正在构建项目..." -ForegroundColor Yellow
try {
    npm run build | Out-File $logFile -Append
} catch {
    Write-Host "构建项目失败: $_" -ForegroundColor Red
    Write-Output "构建项目失败: $_" | Out-File $logFile -Append
    pause
    exit 1
}

# 运行开发服务器
Write-Host ""
Write-Host "构建成功！正在启动开发服务器..." -ForegroundColor Green
Write-Host "可以按Ctrl+C终止开发服务器。" -ForegroundColor Yellow
Write-Host ""

npm run dev 