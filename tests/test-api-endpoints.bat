@echo off
title Test API Endpoints
echo ========================================
echo    测试API端点可用性
echo ========================================
echo.

go run test-api-endpoints.go

echo.
echo Press any key to exit...
pause > nul