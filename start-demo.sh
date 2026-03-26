#!/bin/bash

echo "========================================"
echo "ProDB 演示环境启动脚本"
echo "========================================"
echo

# 检查Go是否安装
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed or not in PATH"
    echo "Please install Go from https://golang.org/dl/"
    exit 1
fi

echo "正在启动ProDB演示环境..."
echo

# 启动OPC UA模拟器
echo "[1/3] 启动OPC UA模拟器..."
cd opcua-simulator
go mod tidy
echo "OPC UA模拟器正在启动..."
go run main.go &
OPCUA_PID=$!
cd ..

# 等待模拟器启动
echo "等待OPC UA模拟器启动..."
sleep 5

# 启动后端服务
echo "[2/3] 启动后端服务..."
cd platform/backend
echo "后端服务正在启动..."
go run main.go &
BACKEND_PID=$!
cd ../..

# 等待后端启动
echo "等待后端服务启动..."
sleep 3

# 启动采集器
echo "[3/3] 启动采集器..."
cd collector
echo "采集器正在启动..."
go run main.go -config configs/opcua-simulator.json &
COLLECTOR_PID=$!
cd ..

echo
echo "========================================"
echo "演示环境启动完成！"
echo "========================================"
echo
echo "服务地址:"
echo "- OPC UA模拟器: opc.tcp://localhost:4840/opcua/simulator"
echo "- 后端API服务: http://localhost:3001"
echo "- 前端界面: 需要单独启动 (cd platform/frontend && npm run dev)"
echo
echo "进程ID:"
echo "- OPC UA模拟器: $OPCUA_PID"
echo "- 后端服务: $BACKEND_PID"
echo "- 采集器: $COLLECTOR_PID"
echo

# 创建停止脚本
cat > stop-demo.sh << EOF
#!/bin/bash
echo "正在停止ProDB演示环境..."
kill $OPCUA_PID $BACKEND_PID $COLLECTOR_PID 2>/dev/null
echo "演示环境已停止"
EOF

chmod +x stop-demo.sh

echo "要停止所有服务，请运行: ./stop-demo.sh"
echo "按 Ctrl+C 退出此脚本"

# 等待用户中断
trap 'echo "正在停止服务..."; kill $OPCUA_PID $BACKEND_PID $COLLECTOR_PID 2>/dev/null; exit 0' INT

# 保持脚本运行
while true; do
    sleep 1
done