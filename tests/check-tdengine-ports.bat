@echo off
title Check TDengine Ports
echo ========================================
echo    TDengine端口和连接类型检查
echo ========================================
echo.

go run check-tdengine-ports.go

echo.
echo Press any key to exit...
pause > nul