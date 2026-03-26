# OPC UA Simulator Dockerfile
FROM golang:1.21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 go mod 文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o opcua-simulator main.go

# 使用轻量级镜像运行
FROM alpine:latest

# 安装 ca-certificates
RUN apk --no-cache add ca-certificates

# 设置工作目录
WORKDIR /root/

# 从构建阶段复制可执行文件和配置
COPY --from=builder /app/opcua-simulator .
COPY --from=builder /app/config.json .

# 暴露端口
EXPOSE 8080 4840

# 运行应用
CMD ["./opcua-simulator", "config.json"]