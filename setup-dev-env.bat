@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo    安装LiuTools开发环境并运行（Windows版）
echo ====================================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 请以管理员权限运行此脚本！
    echo 右键点击此脚本，选择"以管理员身份运行"。
    pause
    exit /b 1
)

:: 创建日志文件
set LOGFILE=%TEMP%\liutools_setup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log
echo 安装日志将保存到: %LOGFILE%
echo.

:: 安装Chocolatey
echo 正在检查Chocolatey包管理器...
where choco >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在安装Chocolatey包管理器...
    @powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))" >> %LOGFILE% 2>&1
    if %errorLevel% neq 0 (
        echo 安装Chocolatey失败，请查看日志: %LOGFILE%
        pause
        exit /b 1
    )
    :: 刷新环境变量
    refreshenv >> %LOGFILE% 2>&1 || call :refreshEnv
) else (
    echo Chocolatey已安装.
)

:: 设置工作目录
set WORK_DIR=%USERPROFILE%\liutools
echo 工作目录: %WORK_DIR%

if not exist "%WORK_DIR%" (
    echo 创建工作目录...
    mkdir "%WORK_DIR%" >> %LOGFILE% 2>&1
)
cd /d "%WORK_DIR%"
echo.

:: 安装Git
echo 正在检查Git...
where git >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在安装Git...
    choco install git -y >> %LOGFILE% 2>&1
    if %errorLevel% neq 0 (
        echo 安装Git失败，请查看日志: %LOGFILE%
        pause
        exit /b 1
    )
    :: 刷新环境变量
    refreshenv >> %LOGFILE% 2>&1 || call :refreshEnv
) else (
    echo Git已安装.
)

:: 安装Node.js
echo 正在检查Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在安装Node.js...
    choco install nodejs-lts -y >> %LOGFILE% 2>&1
    if %errorLevel% neq 0 (
        echo 安装Node.js失败，请查看日志: %LOGFILE%
        pause
        exit /b 1
    )
    :: 刷新环境变量
    refreshenv >> %LOGFILE% 2>&1 || call :refreshEnv
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo Node.js已安装，版本: !NODE_VERSION!
)

:: 克隆代码库
echo.
echo 正在检查代码库...
if not exist "%WORK_DIR%\.git" (
    echo 正在克隆代码库（master分支）...
    git clone -b master https://github.com/csw95/liutools.git . >> %LOGFILE% 2>&1
    if %errorLevel% neq 0 (
        echo 克隆代码库失败，请查看日志: %LOGFILE%
        pause
        exit /b 1
    )
) else (
    echo 代码库已存在，正在拉取master分支最新代码...
    git checkout master >> %LOGFILE% 2>&1
    git pull origin master >> %LOGFILE% 2>&1
    if %errorLevel% neq 0 (
        echo 拉取代码失败，请查看日志: %LOGFILE%
        pause
        exit /b 1
    )
)

:: 安装npm依赖
echo.
echo 正在安装npm依赖...
call npm install >> %LOGFILE% 2>&1
if %errorLevel% neq 0 (
    echo 安装npm依赖失败，请查看日志: %LOGFILE%
    pause
    exit /b 1
)

:: 构建项目
echo.
echo 正在构建项目...
call npm run build >> %LOGFILE% 2>&1
if %errorLevel% neq 0 (
    echo 构建项目失败，请查看日志: %LOGFILE%
    pause
    exit /b 1
)

:: 运行开发服务器
echo.
echo 构建成功！正在启动开发服务器...
echo 可以按Ctrl+C终止开发服务器。
echo.
call npm run dev

exit /b 0

:refreshEnv
echo 刷新环境变量...
set "Path=%Path%;%ALLUSERSPROFILE%\chocolatey\bin;%ProgramFiles%\Git\cmd;%ProgramFiles%\nodejs"
exit /b 0 