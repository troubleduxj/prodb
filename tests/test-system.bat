@echo off
title Test ProDB System
echo ========================================
echo    测试 ProDB 系统
echo ========================================
echo.
echo 测试后端路由...
go run test-routes.go
echo.
echo 测试完成！
pause