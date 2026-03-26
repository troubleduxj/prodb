@echo off
title Check Database Tables
echo ========================================
echo    检查数据库表结构
echo ========================================
echo.

go run check-database-tables.go

echo.
echo Press any key to exit...
pause > nul