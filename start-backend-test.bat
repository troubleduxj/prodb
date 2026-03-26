@echo off
echo 🚀 启动后端服务进行测试...
cd /d "%~dp0platform\backend"
start "Backend Server" cmd /k "go run main.go"
timeout /t 5 /nobreak >nul
echo 🧪 测试API端点...
curl -X GET http://localhost:3001/ping
echo.
curl -X GET http://localhost:3001/api/v1/tdengine/databases
echo.
curl -X GET http://localhost:3001/api/v1/trends/parameters
echo.
echo 测试完成！