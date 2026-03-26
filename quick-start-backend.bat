@echo off
echo 🚀 快速启动后端服务...
echo.

echo 📁 切换到后端目录...
cd /d "%~dp0platform\backend"

echo 🛑 停止可能运行的服务...
taskkill /f /im go.exe 2>nul
taskkill /f /im main.exe 2>nul
timeout /t 2 /nobreak >nul

echo 🔧 检查Go模块...
go mod tidy

echo 🚀 启动后端服务...
echo 📝 服务将在端口3001运行
echo 🌐 测试地址: http://localhost:3001/ping
echo 📋 按 Ctrl+C 停止服务
echo.

go run main.go