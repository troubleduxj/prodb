@echo off
echo ========================================
echo ProDB 演示环境启动脚本
echo ========================================
echo.

REM 检查Go是否安装
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Go is not installed or not in PATH
    echo Please install Go from https://golang.org/dl/
    pause
    exit /b 1
)

echo 正在启动ProDB演示环境...
echo.

REM 启动OPC UA模拟器
echo [1/3] 启动OPC UA模拟器...
start "OPC UA Simulator" cmd /k "cd opcua-simulator && go mod tidy && echo OPC UA模拟器正在启动... && go run main.go config.json"

REM 等待模拟器启动
echo 等待OPC UA模拟器启动...
timeout /t 5 /nobreak >nul

REM 启动后端服务
echo [2/3] 启动后端服务...
start "Backend Service" cmd /k "cd platform/backend && echo 后端服务正在启动... && go run main.go"

REM 等待后端启动
echo 等待后端服务启动...
timeout /t 3 /nobreak >nul

REM 启动采集器
echo [3/3] 启动采集器...
start "Collector" cmd /k "cd collector && echo 采集器正在启动... && go run main.go -config configs/opcua-simulator.json"

echo.
echo ========================================
echo 演示环境启动完成！
echo ========================================
echo.
echo 服务地址:
echo - OPC UA模拟器: opc.tcp://localhost:4840/opcua/simulator
echo - 后端API服务: http://localhost:3001
echo - 前端界面: 需要单独启动 (cd platform/frontend && npm run dev)
echo.
echo 要停止所有服务，请关闭所有打开的命令行窗口
echo.
pause