# OPC UA Simulator Makefile

.PHONY: run build test clean help

# 默认目标
all: run

# 运行模拟器
run:
	@echo "Starting OPC UA Simulator..."
	@go run main.go config.json

# 构建可执行文件
build:
	@echo "Building OPC UA Simulator..."
	@go build -o opcua-simulator main.go
	@echo "Build completed: opcua-simulator"

# 运行测试
test:
	@echo "Running tests..."
	@go run test_simulator.go

# 清理构建文件
clean:
	@echo "Cleaning up..."
	@rm -f opcua-simulator opcua-simulator.exe
	@echo "Clean completed"

# 安装依赖
deps:
	@echo "Installing dependencies..."
	@go mod tidy
	@echo "Dependencies installed"

# 显示帮助信息
help:
	@echo "Available targets:"
	@echo "  run    - Run the OPC UA simulator"
	@echo "  build  - Build the executable"
	@echo "  test   - Run tests"
	@echo "  clean  - Clean build files"
	@echo "  deps   - Install dependencies"
	@echo "  help   - Show this help message"