# ProDB 优化工作快速开始指南

**目标读者**: 开发团队成员
**更新日期**: 2025-01-30

---

## 🎯 快速了解

### 我们在做什么？
对ProDB项目进行系统性优化，完善核心功能，提升系统质量，准备生产环境部署。

### 当前进度
- ✅ 项目分析完成
- ✅ 任务规划完成
- ✅ 子表管理功能验证完成
- 🔄 自动化测试框架搭建中
- 🔄 前端问题修复中

### 预计完成时间
10周（约2.5个月）

---

## 📖 必读文档

### 1. 优化任务清单
**文件**: `docs/OPTIMIZATION_TASK_LIST.md`
**内容**: 所有待完成任务的详细列表，按优先级和阶段组织

**重点关注**:
- P0任务（紧急）
- P1任务（高优先级）
- 你负责的任务

### 2. 任务进度跟踪
**文件**: `docs/TASK_PROGRESS_TRACKER.md`
**内容**: 实时更新的任务进度和状态

**每日查看**:
- 当前进度
- 下一步行动
- 问题和风险

### 3. 优化工作总结
**文件**: `docs/OPTIMIZATION_SUMMARY.md`
**内容**: 优化工作的整体概要和成果

**了解**:
- 项目现状
- 关键发现
- 成功标准

---

## 🚀 如何开始

### 后端开发人员

#### 第一周任务
1. **注册子表管理API路由**
   ```go
   // 在 platform/backend/main.go 中添加路由
   tdengineGroup := v1.Group("/tdengine")
   {
       // 子表管理路由
       tdengineGroup.POST("/databases/:database/supertables/:supertable/subtables", 
           tdengineHandler.CreateSubTable)
       tdengineGroup.GET("/databases/:database/supertables/:supertable/subtables", 
           tdengineHandler.ListSubTables)
       // ... 其他路由
   }
   ```

2. **搭建后端测试框架**
   - 配置Go testing
   - 集成testify库
   - 编写示例测试

3. **编写子表管理集成测试**
   - 测试自动创建功能
   - 测试查询和过滤
   - 测试生命周期管理

#### 参考文件
- `platform/backend/tdengine/subtable.go`
- `platform/backend/handlers/tdengine_handler.go`
- `platform/backend/tdengine/subtable_test.go`

### 前端开发人员

#### 第一周任务
1. **修复Header布局问题**
   - 检查 `collector/frontend/components/Layout.js`
   - 验证修复效果
   - 清理测试文件

2. **修复离线管理器语法问题**
   - 检查 `collector/frontend/services/offline-manager.js`
   - 修复import语句
   - 测试离线功能

3. **搭建前端测试框架**
   - 配置Vitest
   - 集成React Testing Library
   - 编写示例测试

#### 参考文件
- `collector/frontend/HEADER_LAYOUT_FIX_SUMMARY.md`
- `collector/frontend/test/test-framework.js`
- `platform/frontend/vite.config.ts`

### 测试工程师

#### 第一周任务
1. **设计测试策略**
   - 单元测试计划
   - 集成测试计划
   - 性能测试计划

2. **搭建CI/CD流程**
   - 配置GitHub Actions
   - 添加自动化测试步骤
   - 配置测试报告

3. **编写核心模块测试**
   - TDengine服务层测试
   - 采集器核心功能测试
   - 认证授权模块测试

#### 参考文件
- `platform/backend/tdengine/service_test.go`
- `collector/frontend/test/README.md`
- `.github/workflows/` (需要创建)

### DevOps工程师

#### 第一周任务
1. **编写安装部署指南**
   - 环境要求
   - 依赖安装
   - 服务启动

2. **编写配置管理文档**
   - 配置文件说明
   - 环境变量
   - 数据库配置

3. **准备测试环境**
   - Docker环境
   - 数据库环境
   - 监控环境

#### 参考文件
- `README.md`
- `platform/backend/docker/docker-compose.yml`
- `platform/backend/config/`

---

## 📝 日常工作流程

### 每日流程
1. **查看任务进度** (`docs/TASK_PROGRESS_TRACKER.md`)
2. **更新任务状态** (完成的任务标记为✅)
3. **提交代码** (遵循代码规范)
4. **运行测试** (确保测试通过)
5. **更新文档** (如有必要)

### 每周流程
1. **周会回顾** (讨论进度和问题)
2. **更新进度文档** (更新完成情况)
3. **规划下周任务** (分配新任务)
4. **代码审查** (审查本周代码)

---

## 🛠️ 开发工具和命令

### 后端开发
```bash
# 运行测试
cd platform/backend
go test ./... -v

# 运行特定测试
go test ./tdengine -v -run TestSubTable

# 生成测试覆盖率报告
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# 启动后端服务
go run main.go
```

### 前端开发
```bash
# 平台前端
cd platform/frontend
npm install
npm run test
npm run dev

# 采集器前端
cd collector/frontend
# 在浏览器中打开 index.html
```

### 测试
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- path/to/test.test.ts

# 生成覆盖率报告
npm run test:coverage
```

---

## 📞 沟通和协作

### 问题反馈
- **技术问题**: 在代码仓库创建Issue
- **任务问题**: 在任务进度文档中标记
- **紧急问题**: 直接联系项目经理

### 代码审查
- 所有代码必须经过审查
- 使用Pull Request流程
- 至少一人审查通过才能合并

### 文档更新
- 代码变更同步更新文档
- 每周更新进度文档
- 重要变更更新README

---

## ✅ 检查清单

### 开始工作前
- [ ] 阅读优化任务清单
- [ ] 了解自己负责的任务
- [ ] 查看任务依赖关系
- [ ] 准备开发环境

### 完成任务后
- [ ] 代码通过测试
- [ ] 更新相关文档
- [ ] 提交Pull Request
- [ ] 更新任务状态
- [ ] 通知相关人员

### 每周检查
- [ ] 完成本周任务
- [ ] 更新进度文档
- [ ] 参加周会
- [ ] 规划下周工作

---

## 🎓 学习资源

### 项目文档
- [TDengine实现文档](../platform/backend/tdengine/IMPLEMENTATION_SUMMARY.md)
- [子表管理文档](../platform/backend/tdengine/SUBTABLE_IMPLEMENTATION.md)
- [API文档](../platform/backend/tdengine/API_DOCUMENTATION.md)

### 技术文档
- [Go Testing](https://golang.org/pkg/testing/)
- [Vitest](https://vitest.dev/)
- [TDengine文档](https://docs.taosdata.com/)

---

## 💡 最佳实践

### 代码质量
- 遵循项目代码规范
- 编写清晰的注释
- 保持函数简洁
- 避免重复代码

### 测试
- 测试先行（TDD）
- 覆盖边界情况
- 使用有意义的测试名称
- 保持测试独立性

### 文档
- 及时更新文档
- 使用清晰的语言
- 提供代码示例
- 包含使用说明

---

## 🚨 常见问题

### Q: 我的任务依赖其他任务怎么办？
A: 查看任务清单中的依赖关系，与相关人员协调，或先完成其他独立任务。

### Q: 遇到技术难题怎么办？
A: 先查阅相关文档，如果无法解决，在团队中寻求帮助或创建Issue讨论。

### Q: 如何更新任务状态？
A: 直接编辑 `docs/TASK_PROGRESS_TRACKER.md` 文件，将完成的任务标记为✅。

### Q: 测试失败怎么办？
A: 检查错误信息，修复问题后重新运行测试，确保所有测试通过后再提交代码。

---

## 📅 重要日期

- **2025-01-30**: 优化工作启动
- **2025-02-05**: 第一周任务截止
- **2025-02-14**: 第一阶段完成
- **2025-02-28**: 第二阶段完成
- **2025-03-28**: 第三阶段完成
- **2025-04-11**: 第四阶段完成（生产就绪）

---

**祝工作顺利！如有问题，随时沟通。**

---

**文档维护**: 项目经理
**最后更新**: 2025-01-30
