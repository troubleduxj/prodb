@echo off
echo ========================================
echo OPC UA Simulator Verification
echo ========================================
echo.

echo Checking Go installation...
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Go is not installed or not in PATH
    echo Please install Go from https://golang.org/dl/
    pause
    exit /b 1
)
echo ✓ Go is installed

echo.
echo Checking project files...
if not exist "main.go" (
    echo ❌ main.go not found
    pause
    exit /b 1
)
echo ✓ main.go found

if not exist "config.json" (
    echo ❌ config.json not found
    pause
    exit /b 1
)
echo ✓ config.json found

echo.
echo Building simulator...
go build -o opcua-simulator.exe main.go
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✓ Build successful

echo.
echo Starting simulator for testing...
start /B opcua-simulator.exe config.json

echo Waiting for simulator to start...
timeout /t 3 /nobreak >nul

echo.
echo Testing HTTP API...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/opcua/status' -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host '✓ HTTP API is working' } else { Write-Host '❌ HTTP API returned status:' $response.StatusCode } } catch { Write-Host '❌ HTTP API test failed:' $_.Exception.Message }"

echo.
echo Stopping test simulator...
taskkill /f /im opcua-simulator.exe >nul 2>&1

echo.
echo ========================================
echo Verification completed!
echo ========================================
echo.
echo The OPC UA Simulator is ready to use.
echo Run 'go run main.go config.json' to start it.
echo.
pause