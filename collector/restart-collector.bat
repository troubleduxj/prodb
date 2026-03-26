@echo off
REM ProDB Collector Restart Script

echo ========================================
echo Restarting ProDB Collector
echo ========================================
echo.

REM Kill existing collector process
echo Stopping existing collector...
taskkill /F /IM main.exe 2>nul
taskkill /F /IM collector.exe 2>nul
timeout /t 2 /nobreak >nul

REM Set environment variables
set COLLECTOR_ID=test-collector-001
set SECRET_KEY=test-secret-key-12345
set COLLECTOR_NAME=ProDB Test Collector
set PLATFORM_API_ENDPOINT=http://localhost:8088
set LOG_LEVEL=info
set TLS_INSECURE_SKIP_VERIFY=true

echo.
echo Environment variables set:
echo - COLLECTOR_ID: %COLLECTOR_ID%
echo - COLLECTOR_NAME: %COLLECTOR_NAME%
echo - PLATFORM_API_ENDPOINT: %PLATFORM_API_ENDPOINT%
echo.

echo Starting collector service...
echo Frontend will be available at: http://localhost:8093
echo.

go run main.go

pause
