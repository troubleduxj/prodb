@echo off
echo 🔄 重启后端服务...
echo.

echo 📁 切换到后端目录...
cd /d "%~dp0platform\backend"

echo 🛑 停止可能运行的后端服务...
taskkill /f /im main.exe 2>nul
timeout /t 2 /nobreak >nul

echo 🔧 检查Go模块...
go mod tidy

echo 🚀 启动后端服务...
echo 📝 日志将显示在下方，按 Ctrl+C 停止服务
echo.
go run main.go