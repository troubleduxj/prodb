@echo off
title ProDB OPC UA Collector
echo ========================================
echo    ProDB OPC UA 数据采集器
echo ========================================
echo 等待5秒让后端启动...
timeout /t 5 /nobreak
echo 启动数据采集器...
go run start-opcua-collector.go
pause