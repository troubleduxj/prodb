#!/bin/bash

echo "Starting OPC UA Simulator..."
echo ""
echo "Configuration file: config.json"
echo "HTTP API will be available at: http://localhost:8080"
echo "OPC UA endpoint: opc.tcp://localhost:4840/opcua/simulator"
echo ""

go run main.go config.json