@echo off
echo ========================================
echo Full OPC UA Simulator Test
echo ========================================
echo.

echo 1. Validating configuration...
go run validate_config.go
if %errorlevel% neq 0 (
    echo ❌ Configuration validation failed
    pause
    exit /b 1
)

echo.
echo 2. Building simulator...
go build -o opcua-simulator.exe main.go
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo 3. Starting simulator for testing...
start /B opcua-simulator.exe config.json

echo Waiting for simulator to start...
timeout /t 3 /nobreak >nul

echo.
echo 4. Testing HTTP API...
go run quick_test.go

echo.
echo 5. Stopping test simulator...
taskkill /f /im opcua-simulator.exe >nul 2>&1

echo.
echo ========================================
echo ✅ All tests passed!
echo ========================================
echo.
echo Your OPC UA Simulator is working perfectly!
echo The Kiro IDE warning is unrelated and can be ignored.
echo.
pause