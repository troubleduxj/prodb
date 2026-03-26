# 快速测试指南

**创建日期**: 2025-01-30
**适用对象**: 开发人员、测试人员

---

## 🚀 快速开始

### 运行所有测试
```bash
# 后端测试
go test ./... -v

# 前端测试
cd platform/frontend && npm test
```

---

## 📋 测试分类

### 1. 后端单元测试

#### 采集器核心测试
```bash
cd collector/internal/core
go test -v -cover
```

**测试内容**:
- 采集器创建和初始化
- 状态管理和转换
- 生命周期管理
- 并发安全性

#### 协议管理测试
```bash
cd collector/internal/protocol
go test -v -cover
```

**测试内容**:
- 协议注册和管理
- 数据采集功能
- 连接管理
- 任务调度

#### 认证授权测试
```bash
cd collector/internal/auth
go test -v -cover
```

**测试内容**:
- Token管理
- 认证流程
- 失败跟踪
- 安全验证

#### Handler层测试
```bash
cd platform/backend/handlers
go test -v -cover
```

**测试内容**:
- API端点测试
- 请求响应验证
- 错误处理
- 参数验证

---

### 2. 前端测试

#### 组件测试
```bash
cd platform/frontend
npm test -- --testPathPattern=components
```

#### Hook测试
```bash
npm test -- --testPathPattern=hooks
```

#### 服务测试
```bash
npm test -- --testPathPattern=services
```

---

## 📊 覆盖率报告

### 生成后端覆盖率
```bash
# 生成覆盖率文件
go test ./... -coverprofile=coverage.out

# 查看覆盖率统计
go tool cover -func=coverage.out

# 生成HTML报告
go tool cover -html=coverage.out -o coverage.html
```

### 生成前端覆盖率
```bash
cd platform/frontend
npm run test:coverage
```

---

## 🎯 测试目标

### 覆盖率目标
- **采集器核心**: ≥70%
- **协议管理**: ≥70%
- **认证授权**: ≥80%
- **Handler层**: ≥75%
- **总体目标**: ≥75%

### 当前状态
- ✅ 采集器核心: ~75%
- ✅ 协议管理: ~70%
- ✅ 认证授权: ~80%
- ✅ Handler层: ~76%
- ✅ **总体**: ~75%

---

## 🔍 测试验证

### 功能验证清单
- [x] 采集器创建和初始化
- [x] 状态管理和转换
- [x] 协议连接和数据采集
- [x] 认证和Token管理
- [x] API端点响应
- [x] 错误处理
- [x] 并发安全性

### 性能验证清单
- [x] 并发操作安全
- [x] 内存使用合理
- [x] 响应时间达标
- [x] 基准测试通过

---

## 🐛 调试测试

### 运行单个测试
```bash
# 运行特定测试
go test -v -run TestCollectorCreation

# 运行特定测试文件
go test -v ./collector/internal/core/collector_test.go
```

### 查看详细输出
```bash
# 显示详细日志
go test -v -cover

# 显示测试时间
go test -v -cover -benchtime=1s
```

### 调试失败的测试
```bash
# 只运行失败的测试
go test -v -failfast

# 显示完整错误堆栈
go test -v -cover 2>&1 | tee test.log
```

---

## ⚡ 性能测试

### 运行基准测试
```bash
# 运行所有基准测试
go test -bench=. -benchmem

# 运行特定基准测试
go test -bench=BenchmarkCollectorStatusRead -benchmem

# 比较基准测试结果
go test -bench=. -benchmem > old.txt
# 修改代码后
go test -bench=. -benchmem > new.txt
benchcmp old.txt new.txt
```

---

## 🔄 CI/CD集成

### GitHub Actions
测试会在以下情况自动运行:
- 代码推送到main分支
- 创建Pull Request
- 手动触发workflow

### 查看CI/CD状态
```bash
# 查看workflow配置
cat .github/workflows/test.yml

# 本地模拟CI环境
act -j test
```

---

## 📝 测试最佳实践

### 1. 编写测试
- 使用描述性的测试名称
- 每个测试只验证一个功能
- 使用表驱动测试处理多个场景
- 添加必要的注释说明

### 2. Mock使用
- 隔离外部依赖
- 使用testify/mock框架
- 验证Mock调用
- 清理Mock状态

### 3. 并发测试
- 使用goroutine测试并发
- 使用channel同步
- 验证数据竞争
- 使用-race标志

### 4. 测试维护
- 定期运行测试
- 及时修复失败测试
- 更新过时的测试
- 保持测试代码质量

---

## 🆘 常见问题

### Q: 测试运行很慢怎么办？
A: 使用`-short`标志跳过长时间测试
```bash
go test -short ./...
```

### Q: 如何只运行特定包的测试？
A: 指定包路径
```bash
go test ./collector/internal/core
```

### Q: 如何查看测试覆盖的具体代码？
A: 生成HTML报告
```bash
go tool cover -html=coverage.out
```

### Q: 测试失败但本地运行正常？
A: 检查环境变量和依赖版本
```bash
go env
go mod verify
```

---

## 📚 相关文档

- [完整测试指南](./TESTING_GUIDE.md)
- [测试实现总结](./TEST_IMPLEMENTATION_SUMMARY.md)
- [测试执行报告](./TEST_EXECUTION_REPORT.md)
- [CI/CD配置](../.github/workflows/test.yml)

---

**最后更新**: 2025-01-30
**维护人**: 测试团队

