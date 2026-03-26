@echo off
echo ========================================
echo OPC UA 模拟器与采集器连接测试
echo ========================================
echo.

echo [步骤 1/4] 启动 OPC UA 模拟器...
start "OPC UA Simulator" cmd /k "cd opcua-simulator && echo OPC UA模拟器启动中... && go run main.go config.json"

echo 等待模拟器启动...
timeout /t 5 /nobreak >nul

echo [步骤 2/4] 验证模拟器状态...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/opcua/status' -TimeoutSec 10; $data = $response.Content | ConvertFrom-Json; Write-Host '✓ 模拟器运行正常 - 节点数量:' $data.data.nodeCount } catch { Write-Host '❌ 模拟器连接失败:' $_.Exception.Message; exit 1 }"

if %errorlevel% neq 0 (
    echo 模拟器启动失败，请检查端口是否被占用
    pause
    exit /b 1
)

echo.
echo [步骤 3/4] 启动采集器...
start "Collector" cmd /k "cd collector && echo 采集器启动中... && go run main.go -config configs/opcua-simulator.json"

echo 等待采集器启动...
timeout /t 3 /nobreak >nul

echo.
echo [步骤 4/4] 测试数据采集...
echo 正在监控采集器日志，请查看采集器窗口中的输出...
echo.

echo ========================================
echo 连接测试完成！
echo ========================================
echo.
echo 服务状态:
echo - OPC UA 模拟器: http://localhost:8080 (API)
echo - OPC UA 端点: opc.tcp://localhost:4840/opcua/simulator
echo - 采集器: 运行中，查看采集器窗口获取详细日志
echo.
echo 测试节点 (共18个):
echo - 温度传感器: Temperature_Sensor_01/02/03
echo - 压力传感器: Pressure_Sensor_01/02
echo - 流量传感器: Flow_Sensor_01/02
echo - 液位传感器: Level_Sensor_01/02
echo - 电机状态: Motor_01_Status/Motor_02_Status
echo - 电机转速: Motor_01_Speed/Motor_02_Speed
echo - 阀门开度: Valve_01_Opening/Valve_02_Opening
echo - 运行时间: Device_Runtime
echo - 报警状态: Alarm_Temperature_High/Alarm_Pressure_Low
echo.
echo 要停止测试，请关闭所有打开的命令行窗口
echo.
pause