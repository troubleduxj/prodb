@echo off
REM ProDB Collector Startup Script

echo ========================================
echo Starting ProDB Collector
echo ========================================
echo.

REM Set environment variables
set COLLECTOR_ID=test-collector-001
set SECRET_KEY=test-secret-key-12345
set COLLECTOR_NAME=ProDB Test Collector
set PLATFORM_API_ENDPOINT=http://localhost:8088
set LOG_LEVEL=info
set TLS_INSECURE_SKIP_VERIFY=true

echo Environment variables set:
echo - COLLECTOR_ID: %COLLECTOR_ID%
echo - COLLECTOR_NAME: %COLLECTOR_NAME%
echo - PLATFORM_API_ENDPOINT: %PLATFORM_API_ENDPOINT%
echo.

echo Starting collector service...
go run main.go

pause
