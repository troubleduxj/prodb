@echo off
title ProDB OPC UA Simulator
echo ========================================
echo    ProDB OPC UA 模拟器
echo ========================================
echo 启动OPC UA模拟器...
cd opcua-simulator
go run main.go
pause