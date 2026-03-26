#!/bin/bash

echo "========================================"
echo "    ProDB OPC UA Simulator Demo"
echo "========================================"
echo

echo "Starting OPC UA Simulator..."
go run main.go config.json &
SIMULATOR_PID=$!

echo "Waiting for simulator to initialize..."
sleep 3

echo
echo "Testing simulator connection..."
go run quick_test.go

echo
echo "========================================"
echo "Demo completed!"
echo
echo "The simulator is running with PID: $SIMULATOR_PID"
echo "You can access it at:"
echo "  HTTP API: http://localhost:8080"
echo "  OPC UA:   opc.tcp://localhost:4840/opcua/simulator"
echo
echo "To stop the simulator, run: kill $SIMULATOR_PID"
echo "========================================"
echo

# 保持脚本运行，等待用户输入
echo "Press Enter to stop the simulator and exit..."
read
kill $SIMULATOR_PID 2>/dev/null
echo "Simulator stopped."