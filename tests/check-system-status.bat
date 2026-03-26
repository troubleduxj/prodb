@echo off
title ProDB System Status Check
echo ========================================
echo    ProDB 系统状态检查
echo ========================================
echo.

go run check-system-status.go

echo.
echo Press any key to exit...
pause > nul