# ProDB 部署指南

**版本**: 1.0.0
**创建日期**: 2025-01-30
**最后更新**: 2025-01-30

---

## 📋 目录

1. [环境要求](#环境要求)
2. [快速开始](#快速开始)
3. [详细安装步骤](#详细安装步骤)
4. [配置说明](#配置说明)
5. [服务启动](#服务启动)
6. [验证部署](#验证部署)
7. [故障排查](#故障排查)
8. [生产环境部署](#生产环境部署)

---

## 环境要求

### 硬件要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 20GB

**推荐配置**:
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 50GB+ (SSD推荐)

### 软件要求

#### 必需软件
- **操作系统**: 
  - Linux (Ubuntu 20.04+, CentOS 7+)
  - Windows 10/11
  - macOS 10.15+

- **Go**: 版本 1.21+
  ```bash
  go version
  # 应显示: go version go1.21.x
  ```

- **Node.js**: 版本 18+
  ```bash
  node --version
  # 应显示: v18.x.x 或更高
  ```

- **PostgreSQL**: 版本 15+
  ```bash
  psql --version
  # 应显示: psql (PostgreSQL) 15.x
  ```

#### 可选软件
- **TDengine**: 版本 3.0+ (用于时序数据存储)
- **Docker**: 版本 20.10+ (用于容器化部署)
- **Git**: 用于代码管理

---

## 快速开始

### 使用Docker Compose (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd ProDB

# 2. 启动所有服务
docker-compose up -d

# 3. 等待服务启动 (约30秒)
docker-compose ps

# 4. 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:8080
```

### 手动安装

```bash
# 1. 安装依赖
cd platform/backend && go mod download
cd ../frontend && npm install

# 2. 配置数据库
createdb prodbmanager

# 3. 启动后端
cd platform/backend
go run main.go

# 4. 启动前端 (新终端)
cd platform/frontend
npm run dev
```

---

## 详细安装步骤

### 1. 安装Go

#### Linux/macOS
```bash
# 下载Go
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz

# 解压
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# 配置环境变量
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 验证安装
go version
```

#### Windows
1. 下载安装包: https://go.dev/dl/
2. 运行安装程序
3. 验证安装: `go version`

### 2. 安装Node.js

#### Linux (使用nvm)
```bash
# 安装nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装Node.js
nvm install 18
nvm use 18

# 验证安装
node --version
npm --version
```

#### Windows
1. 下载安装包: https://nodejs.org/
2. 运行安装程序
3. 验证安装: `node --version`

### 3. 安装PostgreSQL

#### Linux (Ubuntu/Debian)
```bash
# 添加PostgreSQL仓库
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 安装PostgreSQL
sudo apt-get update
sudo apt-get install postgresql-15

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
1. 下载安装包: https://www.postgresql.org/download/windows/
2. 运行安装程序
3. 记住设置的密码

#### macOS
```bash
# 使用Homebrew
brew install postgresql@15

# 启动服务
brew services start postgresql@15
```

### 4. 安装TDengine (可选)

#### Linux
```bash
# 下载安装包
wget https://www.taosdata.com/assets-download/3.0/TDengine-server-3.0.0.0-Linux-x64.tar.gz

# 解压并安装
tar -xzf TDengine-server-3.0.0.0-Linux-x64.tar.gz
cd TDengine-server-3.0.0.0
sudo ./install.sh

# 启动服务
sudo systemctl start taosd
sudo systemctl enable taosd
```

#### Windows
1. 下载安装包: https://www.taosdata.com/cn/getting-started
2. 运行安装程序
3. 启动TDengine服务

---

## 配置说明

### 1. 数据库配置

#### 创建PostgreSQL数据库
```bash
# 切换到postgres用户
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE prodbmanager;
CREATE USER prodb_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE prodbmanager TO prodb_user;
\q
```

#### 配置数据库连接
编辑 `platform/backend/config/database.json`:
```json
{
  "host": "localhost",
  "port": 5432,
  "user": "prodb_user",
  "password": "your_password",
  "database": "prodbmanager",
  "sslmode": "disable"
}
```

### 2. TDengine配置

编辑 `platform/backend/config/tdengine.json`:
```json
{
  "host": "localhost",
  "port": 6030,
  "username": "root",
  "password": "taosdata",
  "database": "industrial_data",
  "max_open_conns": 10,
  "max_idle_conns": 5,
  "conn_timeout": 30
}
```

### 3. 后端配置

编辑 `platform/backend/config/app.json`:
```json
{
  "server": {
    "port": 8080,
    "mode": "debug"
  },
  "cors": {
    "allowed_origins": [
      "http://localhost:3000",
      "http://localhost:5173"
    ]
  },
  "jwt": {
    "secret": "your-secret-key-change-in-production",
    "expiration": 3600
  }
}
```

### 4. 前端配置

编辑 `platform/frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_APP_TITLE=ProDB管理平台
VITE_APP_VERSION=1.0.0
```

---

## 服务启动

### 开发环境

#### 1. 启动后端服务
```bash
cd platform/backend

# 安装依赖
go mod download

# 运行数据库迁移
go run main.go migrate

# 启动服务
go run main.go

# 或使用热重载 (需要安装air)
air
```

#### 2. 启动前端服务
```bash
cd platform/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问: http://localhost:5173
```

#### 3. 启动采集器 (可选)
```bash
cd collector

# 配置采集器
cp config.example.json config.json
# 编辑config.json设置采集器参数

# 启动采集器
go run main.go
```

#### 4. 启动OPC UA模拟器 (可选)
```bash
cd opcua-simulator

# 启动模拟器
go run main.go

# 或使用启动脚本
./start.sh  # Linux/macOS
start.bat   # Windows
```

### 生产环境

#### 1. 构建后端
```bash
cd platform/backend

# 构建二进制文件
go build -o prodb-backend main.go

# 运行
./prodb-backend
```

#### 2. 构建前端
```bash
cd platform/frontend

# 构建生产版本
npm run build

# 输出在 dist/ 目录
# 使用Nginx或其他Web服务器提供服务
```

---

## 验证部署

### 1. 检查服务状态

#### 后端健康检查
```bash
curl http://localhost:8080/ping

# 预期响应:
# {
#   "message": "pong",
#   "db_status": "connected",
#   "tdengine_status": {...}
# }
```

#### 前端访问
打开浏览器访问: http://localhost:3000

### 2. 测试API

#### 获取数据库列表
```bash
curl http://localhost:8080/api/v1/tdengine/databases

# 预期响应:
# {
#   "status": "success",
#   "data": {
#     "databases": [...]
#   }
# }
```

#### 测试认证
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 预期响应:
# {
#   "token": "eyJhbGc...",
#   "user": {...}
# }
```

### 3. 检查日志

#### 后端日志
```bash
# 查看实时日志
tail -f platform/backend/logs/app.log

# 检查错误日志
grep ERROR platform/backend/logs/app.log
```

#### 数据库日志
```bash
# PostgreSQL日志
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# TDengine日志
sudo tail -f /var/log/taos/taoslog.0
```

---

## 故障排查

### 常见问题

#### 1. 后端无法启动

**问题**: 端口被占用
```bash
# 检查端口占用
netstat -tulpn | grep 8080

# 或使用lsof
lsof -i :8080

# 杀死占用进程
kill -9 <PID>
```

**问题**: 数据库连接失败
```bash
# 检查PostgreSQL服务
sudo systemctl status postgresql

# 测试连接
psql -h localhost -U prodb_user -d prodbmanager

# 检查配置文件
cat platform/backend/config/database.json
```

#### 2. 前端无法访问

**问题**: 依赖安装失败
```bash
# 清理缓存
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

**问题**: API请求失败
```bash
# 检查CORS配置
# 确保后端允许前端域名

# 检查API地址
cat platform/frontend/.env
```

#### 3. TDengine连接问题

**问题**: 无法连接TDengine
```bash
# 检查TDengine服务
sudo systemctl status taosd

# 测试连接
taos

# 检查配置
cat platform/backend/config/tdengine.json
```

### 日志分析

#### 启用详细日志
```bash
# 后端
export LOG_LEVEL=debug
go run main.go

# 前端
export VITE_LOG_LEVEL=debug
npm run dev
```

#### 常见错误信息

**错误**: "database connection failed"
- 检查PostgreSQL服务是否运行
- 验证数据库配置
- 检查网络连接

**错误**: "TDengine not available"
- TDengine服务未启动
- 配置文件错误
- 网络连接问题

**错误**: "port already in use"
- 端口被其他程序占用
- 修改配置使用其他端口
- 停止占用端口的程序

---

## 生产环境部署

### 使用Docker

#### 1. 构建镜像
```bash
# 构建后端镜像
cd platform/backend
docker build -t prodb-backend:latest .

# 构建前端镜像
cd platform/frontend
docker build -t prodb-frontend:latest .
```

#### 2. 使用Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: prodbmanager
      POSTGRES_USER: prodb_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  tdengine:
    image: tdengine/tdengine:3.0.0.0
    volumes:
      - tdengine_data:/var/lib/taos
    restart: always

  backend:
    image: prodb-backend:latest
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      TDENGINE_HOST: tdengine
    depends_on:
      - postgres
      - tdengine
    restart: always

  frontend:
    image: prodb-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
  tdengine_data:
```

#### 3. 启动生产环境
```bash
# 设置环境变量
export DB_PASSWORD=your_secure_password

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 使用Kubernetes

参考 `platform/backend/docker/kubernetes/` 目录中的配置文件。

### 使用Nginx反向代理

```nginx
# /etc/nginx/sites-available/prodb
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        root /var/www/prodb/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 安全建议

### 1. 生产环境配置

- 修改所有默认密码
- 使用强密码策略
- 启用HTTPS
- 配置防火墙规则
- 定期更新依赖

### 2. 数据库安全

- 限制数据库访问IP
- 使用SSL连接
- 定期备份数据
- 设置访问权限

### 3. 应用安全

- 更改JWT密钥
- 启用CORS白名单
- 配置速率限制
- 启用日志审计

---

## 性能优化

### 1. 数据库优化

```sql
-- PostgreSQL优化
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
```

### 2. 应用优化

- 启用缓存
- 配置连接池
- 使用CDN
- 启用Gzip压缩

---

## 备份和恢复

### PostgreSQL备份
```bash
# 备份
pg_dump -U prodb_user prodbmanager > backup.sql

# 恢复
psql -U prodb_user prodbmanager < backup.sql
```

### TDengine备份
```bash
# 备份
taosdump -o /backup/tdengine

# 恢复
taosdump -i /backup/tdengine
```

---

## 监控和维护

### 1. 健康检查

```bash
# 创建健康检查脚本
cat > health_check.sh << 'EOF'
#!/bin/bash
curl -f http://localhost:8080/ping || exit 1
EOF

chmod +x health_check.sh
```

### 2. 日志轮转

```bash
# /etc/logrotate.d/prodb
/var/log/prodb/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 prodb prodb
}
```

---

## 相关文档

- [配置管理文档](./CONFIGURATION_GUIDE.md)
- [运维监控文档](./OPERATIONS_GUIDE.md)
- [故障排查手册](./TROUBLESHOOTING_GUIDE.md)
- [API文档](../platform/backend/tdengine/API_DOCUMENTATION.md)

---

**文档维护**: DevOps团队
**最后更新**: 2025-01-30
