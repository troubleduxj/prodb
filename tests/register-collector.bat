@echo off
title Register OPC UA Collector
echo ========================================
echo    注册 OPC UA 采集器
echo ========================================
echo 注册采集器到平台...
go run register-opcua-collector.go
echo.
echo 注册完成！
pause