@echo off
echo 在后台启动后端服务器...
cd platform\backend
start /B go run main.go
echo 后端服务器已在后台启动，端口8080
echo 可以通过 http://localhost:8080/ping 测试连接
pause