@echo off
title Debug TDengine Connection Save
echo ========================================
echo    调试TDengine连接保存问题
echo ========================================
echo.

echo 正在测试连接保存功能...
go run debug-connection-save.go

echo.
echo Press any key to exit...
pause > nul