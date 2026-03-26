@echo off
echo ========================================
echo ProDB 完整演示环境启动脚本
echo ========================================
echo.

REM 检查Go是否安装
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Go未安装或不在PATH中
    echo 请从 https://golang.org/dl/ 安装Go
    pause
    exit /b 1
)

echo ✓ Go环境检查通过
echo.

echo [步骤 1/5] 启动 OPC UA 模拟器...
start "OPC UA Simulator" cmd /k "cd opcua-simulator && echo === OPC UA 模拟器 === && echo 端点: opc.tcp://localhost:4840/opcua/simulator && echo HTTP API: http://localhost:8080 && echo. && go run main.go config.json"

echo 等待模拟器启动...
timeout /t 5 /nobreak >nul

echo [步骤 2/5] 启动平台后端服务...
start "Platform Backend" cmd /k "cd platform/backend && echo === 平台后端服务 === && echo API地址: http://localhost:3001 && echo 认证端点: https://localhost:8088 && echo. && go run main.go"

echo 等待后端服务启动...
timeout /t 8 /nobreak >nul

echo [步骤 3/5] 初始化采集器认证...
echo 正在为采集器创建认证密钥...

REM 创建采集器认证脚本
echo $headers = @{ > init-collector-auth.ps1
echo     'Content-Type' = 'application/json' >> init-collector-auth.ps1
echo } >> init-collector-auth.ps1
echo $body = @{ >> init-collector-auth.ps1
echo     collector_id = 'opcua-simulator-collector' >> init-collector-auth.ps1
echo     secret_key = 'opcua-collector-secret-key-2024' >> init-collector-auth.ps1
echo     description = 'OPC UA模拟器采集器' >> init-collector-auth.ps1
echo } ^| ConvertTo-Json >> init-collector-auth.ps1
echo try { >> init-collector-auth.ps1
echo     $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/collectors/register' -Method Post -Headers $headers -Body $body >> init-collector-auth.ps1
echo     Write-Host '✓ 采集器认证初始化成功' >> init-collector-auth.ps1
echo } catch { >> init-collector-auth.ps1
echo     Write-Host '⚠️  采集器认证初始化失败，可能已存在:' $_.Exception.Message >> init-collector-auth.ps1
echo } >> init-collector-auth.ps1

powershell -ExecutionPolicy Bypass -File init-collector-auth.ps1
del init-collector-auth.ps1

echo [步骤 4/5] 启动采集器...
start "Collector" cmd /k "cd collector && echo === 数据采集器 === && echo 采集器ID: opcua-simulator-collector && echo 配置管理: http://localhost:8093 && echo. && set COLLECTOR_ID=opcua-simulator-collector && set SECRET_KEY=opcua-collector-secret-key-2024 && go run main.go -config configs/opcua-simulator.json"

echo 等待采集器启动...
timeout /t 5 /nobreak >nul

echo [步骤 5/5] 启动前端界面...
start "Frontend" cmd /k "cd platform/frontend && echo === 前端界面 === && echo 访问地址: http://localhost:3000 && echo. && npm run dev"

echo.
echo ========================================
echo 🎉 ProDB 完整演示环境启动完成！
echo ========================================
echo.
echo 📊 服务地址:
echo - OPC UA模拟器 API: http://localhost:8080
echo - OPC UA端点: opc.tcp://localhost:4840/opcua/simulator  
echo - 平台后端API: http://localhost:3001
echo - 采集器配置: http://localhost:8093
echo - 前端界面: http://localhost:3000
echo.
echo 📈 数据流向:
echo   OPC UA模拟器 → 采集器 → 平台后端 → TDengine → 前端展示
echo.
echo 🔧 测试步骤:
echo 1. 访问 http://localhost:8080/opcua/status 检查模拟器
echo 2. 访问 http://localhost:3001/api/health 检查后端
echo 3. 访问 http://localhost:8093/status 检查采集器
echo 4. 访问 http://localhost:3000 查看前端界面
echo.
echo 要停止所有服务，请关闭所有命令行窗口
echo.
pause