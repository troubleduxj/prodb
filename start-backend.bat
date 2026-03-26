@echo off
echo 启动后端服务器...
cd platform\backend
echo 后端服务器将在端口8080启动
go run main.go
pause