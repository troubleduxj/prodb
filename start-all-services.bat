@echo off
echo ========================================
echo    启动 ProDB 完整系统
echo ========================================
echo.
echo 1. 启动 OPC UA 模拟器...
start "OPC UA Simulator" start-opcua-simulator.bat

echo 2. 启动后端服务器...
start "Backend Server" start-backend.bat

echo 3. 等待10秒后启动数据采集器...
timeout /t 10 /nobreak

echo 4. 启动数据采集器...
start "OPC UA Collector" start-collector.bat

echo.
echo ========================================
echo 所有服务已启动！
echo ========================================
echo.
echo 窗口说明：
echo - "OPC UA Simulator" = OPC UA 模拟器
echo - "Backend Server" = 后端服务器  
echo - "OPC UA Collector" = 数据采集器
echo.
echo 前端访问地址: http://localhost:3000
echo 后端API地址: http://localhost:3001
echo.
pause