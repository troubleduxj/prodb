# ProDB 测试指南

**创建日期**: 2025-01-30
**最后更新**: 2025-01-30

---

## 测试策略概述

ProDB项目采用多层次的测试策略，确保代码质量和系统稳定性：

1. **单元测试**: 测试独立的函数和组件
2. **集成测试**: 测试模块间的交互
3. **端到端测试**: 测试完整的用户流程
4. **性能测试**: 测试系统性能和负载能力

---

## 后端测试

### 测试框架
- **Go testing**: Go标准测试框架
- **testify**: 断言和模拟库
- **sqlmock**: 数据库模拟

### 运行测试

#### 运行所有测试
```bash
cd platform/backend
go test ./... -v
```

#### 运行特定包的测试
```bash
# TDengine服务测试
go test ./tdengine -v

# 子表管理测试
go test ./tdengine -v -run TestSubTable

# Handler测试
go test ./handlers -v
```

#### 生成测试覆盖率报告
```bash
# 生成覆盖率文件
go test ./... -coverprofile=coverage.out

# 查看覆盖率统计
go tool cover -func=coverage.out

# 生成HTML报告
go tool cover -html=coverage.out -o coverage.html
```

#### 运行基准测试
```bash
go test ./... -bench=. -benchmem
```

### 测试数据库配置

测试使用独立的测试数据库，避免影响开发数据：

```go
// 测试配置示例
testConfig := &config.DatabaseConfig{
    Host:     "localhost",
    Port:     5432,
    User:     "postgres",
    Password: "password",
    Database: "prodbmanager_test",
}
```

### 编写测试示例

```go
package tdengine

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestCreateSubTable(t *testing.T) {
    // Setup
    ctx := context.Background()
    service := setupTestService(t)
    defer teardownTestService(t, service)
    
    // Test data
    database := "test_db"
    superTable := "test_stable"
    subTableName := "test_subtable"
    tags := map[string]interface{}{
        "device_id": "device-001",
        "location": "workshop_a",
    }
    
    // Execute
    err := service.CreateSubTable(ctx, database, superTable, subTableName, tags, nil)
    
    // Assert
    require.NoError(t, err)
    
    // Verify
    exists, err := service.SubTableExists(ctx, database, subTableName)
    require.NoError(t, err)
    assert.True(t, exists)
}
```

---

## 前端测试

### 测试框架
- **Vitest**: 快速的单元测试框架
- **React Testing Library**: React组件测试
- **MSW**: API模拟
- **Playwright**: 端到端测试（可选）

### 运行测试

#### 运行所有测试
```bash
cd platform/frontend
npm test
```

#### 运行特定测试文件
```bash
npm test -- src/features/database/components/__tests__/database-list.test.tsx
```

#### 监听模式
```bash
npm test -- --watch
```

#### 生成覆盖率报告
```bash
npm run test:coverage
```

#### 运行集成测试
```bash
npm run test:integration
```

### 测试配置

测试配置在 `vite.config.ts` 中：

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ],
    },
  },
})
```

### 编写测试示例

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DatabaseList } from '../database-list'

describe('DatabaseList', () => {
  it('should render database list', async () => {
    // Arrange
    const mockDatabases = [
      { name: 'industrial_data', ntables: 5 },
      { name: 'sensor_data', ntables: 3 },
    ]
    
    // Act
    render(<DatabaseList databases={mockDatabases} />)
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('industrial_data')).toBeInTheDocument()
      expect(screen.getByText('sensor_data')).toBeInTheDocument()
    })
  })
  
  it('should handle database selection', async () => {
    // Arrange
    const onSelect = vi.fn()
    const mockDatabases = [{ name: 'test_db', ntables: 1 }]
    
    // Act
    render(<DatabaseList databases={mockDatabases} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('test_db'))
    
    // Assert
    expect(onSelect).toHaveBeenCalledWith('test_db')
  })
})
```

---

## 采集器前端测试

采集器前端使用原生JavaScript，测试方式略有不同：

### 测试框架
- 自定义测试框架 (`test/test-framework.js`)
- 浏览器内测试

### 运行测试

```bash
cd collector/frontend

# 在浏览器中打开测试页面
# Windows
start test/run-tests.html

# Linux/Mac
open test/run-tests.html
```

### 编写测试示例

```javascript
// test/components/status-indicator.test.js
describe('StatusIndicator', () => {
  it('should display online status', () => {
    const indicator = new StatusIndicator({ status: 'online' })
    const element = indicator.render()
    
    assert.equal(element.classList.contains('status-online'), true)
    assert.equal(element.textContent, '在线')
  })
  
  it('should update status dynamically', () => {
    const indicator = new StatusIndicator({ status: 'online' })
    indicator.updateStatus('offline')
    
    assert.equal(indicator.status, 'offline')
  })
})
```

---

## 集成测试

### 测试场景

1. **数据库连接流程**
   - 创建连接
   - 测试连接
   - 查询数据库
   - 删除连接

2. **采集器认证流程**
   - 注册采集器
   - 认证请求
   - 批准/拒绝
   - 状态更新

3. **批量位号管理流程**
   - 导入位号
   - 批量编辑
   - 批量启用/禁用
   - 导出位号

4. **跨模块集成**
   - 采集器 → 数据摄取 → TDengine
   - 前端 → 后端API → 数据库

### 运行集成测试

```bash
# 前端集成测试
cd platform/frontend
npm run test:integration

# 后端集成测试
cd platform/backend
go test ./... -tags=integration -v
```

---

## CI/CD集成

### GitHub Actions

项目使用GitHub Actions进行自动化测试：

- **触发条件**: Push到main/develop分支，或创建Pull Request
- **测试任务**:
  - 后端单元测试
  - 前端单元测试
  - 集成测试
  - 测试覆盖率报告

### 查看测试结果

1. 访问GitHub仓库的Actions标签
2. 查看最新的工作流运行
3. 点击具体任务查看详细日志
4. 查看测试覆盖率报告

### 本地运行CI测试

```bash
# 安装act工具（模拟GitHub Actions）
# https://github.com/nektos/act

# 运行CI测试
act -j backend-tests
act -j frontend-tests
act -j integration-tests
```

---

## 测试覆盖率目标

### 当前目标
- **后端**: > 70%
- **前端**: > 70%
- **核心模块**: > 80%

### 查看覆盖率

#### 后端
```bash
cd platform/backend
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

#### 前端
```bash
cd platform/frontend
npm run test:coverage
# 打开 coverage/index.html
```

---

## 性能测试

### 后端性能测试

```bash
# 运行基准测试
cd platform/backend
go test ./tdengine -bench=BenchmarkSubTableCreation -benchmem

# 压力测试
go test ./handlers -bench=BenchmarkAPIEndpoints -benchtime=10s
```

### 前端性能测试

```bash
cd platform/frontend
npm run test:performance
```

### 负载测试

使用工具如 `k6` 或 `Apache JMeter` 进行负载测试：

```javascript
// k6 测试脚本示例
import http from 'k6/http'
import { check } from 'k6'

export let options = {
  vus: 100,
  duration: '30s',
}

export default function() {
  let res = http.get('http://localhost:8080/api/v1/tdengine/databases')
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })
}
```

---

## 测试最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 遵循 "should_do_something_when_condition" 格式
- 使用中文或英文保持一致

### 2. 测试结构
- **Arrange**: 准备测试数据和环境
- **Act**: 执行被测试的操作
- **Assert**: 验证结果

### 3. 测试隔离
- 每个测试独立运行
- 使用setup和teardown清理环境
- 避免测试间的依赖

### 4. 模拟和存根
- 使用mock隔离外部依赖
- 模拟数据库、API调用等
- 保持测试快速和可靠

### 5. 测试数据
- 使用有意义的测试数据
- 测试边界条件
- 测试错误情况

---

## 故障排查

### 常见问题

#### 1. 测试数据库连接失败
```bash
# 检查PostgreSQL是否运行
pg_isready -h localhost -p 5432

# 检查数据库是否存在
psql -h localhost -U postgres -l
```

#### 2. 前端测试超时
```typescript
// 增加超时时间
it('should load data', async () => {
  // ...
}, 10000) // 10秒超时
```

#### 3. 测试覆盖率不准确
```bash
# 清理缓存
rm -rf coverage/
rm coverage.out

# 重新运行测试
npm run test:coverage
```

---

## 持续改进

### 测试指标监控
- 定期检查测试覆盖率
- 监控测试执行时间
- 跟踪失败率和稳定性

### 测试维护
- 及时更新过时的测试
- 删除冗余的测试
- 重构复杂的测试

### 测试文档
- 记录测试策略和标准
- 更新测试指南
- 分享最佳实践

---

## 相关资源

### 文档
- [Go Testing](https://golang.org/pkg/testing/)
- [Testify](https://github.com/stretchr/testify)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)

### 工具
- [Codecov](https://codecov.io/) - 测试覆盖率
- [k6](https://k6.io/) - 负载测试
- [act](https://github.com/nektos/act) - 本地CI测试

---

**文档维护**: 测试团队
**最后更新**: 2025-01-30
