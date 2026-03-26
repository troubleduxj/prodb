# 原始页面恢复指南

## 🎯 目标

将简化版本的页面恢复为原始的完整功能版本，同时添加更好的错误处理来防止500错误。

## 🔧 已完成的修复

### 1. 错误边界组件
创建了 `ErrorBoundary` 组件 (`platform/frontend/src/components/error-boundary.tsx`)：
- 捕获React组件渲染错误
- 提供友好的错误界面
- 显示详细的错误信息（开发模式）
- 提供重试和刷新功能

### 2. API服务增强
修改了 `query-api.ts`：
- 添加了更好的错误处理
- 使用正确的API端点路径 (`/api/v1`)
- 添加了安全的默认返回值
- 改进了网络错误处理

### 3. Hook安全化
修改了 `useQueryBuilder` hook：
- 添加了try-catch错误处理
- 提供了安全的默认值
- 改进了错误状态管理

### 4. 路由配置更新
更新了路由文件，添加错误边界：
- `database-apps/query/index.tsx` - 数据查询页面
- `database-apps/trends/index.tsx` - 历史趋势页面  
- `database-apps/process-flow/index.tsx` - 工艺流程图页面

## 🧪 调试工具

### 1. API端点测试
```bash
test-api-endpoints.bat
```
测试关键API端点的可用性。

### 2. 页面加载调试
```
debug-page-loading.html
```
逐步诊断页面加载过程，定位问题。

## 📊 当前状态

### ✅ 已恢复的页面
- **数据查询页面** (`/database-apps/query`)
  - 使用原始 `DataQueryApp` 组件
  - 添加了错误边界和安全处理
  - API调用使用正确的端点

### 🔄 待恢复的页面
- **历史趋势页面** (`/database-apps/trends`)
  - 已添加错误边界
  - 需要测试原始组件功能

- **工艺流程图页面** (`/database-apps/process-flow`)
  - 已添加错误边界
  - 需要测试原始组件功能

## 🔍 测试步骤

### 1. 启动服务
```bash
# 启动后端服务
start-backend.bat

# 启动前端服务 (在 platform/frontend 目录)
npm run dev
```

### 2. 运行诊断
```bash
# 测试API端点
test-api-endpoints.bat

# 或者打开调试页面
debug-page-loading.html
```

### 3. 访问页面
- 数据查询：http://localhost:3000/database-apps/query
- 历史趋势：http://localhost:3000/database-apps/trends
- 工艺流程图：http://localhost:3000/database-apps/process-flow

## 🚨 可能遇到的问题

### 1. API端点不存在
**症状**：404错误，API调用失败
**解决**：
- 检查后端路由配置
- 确认API端点是否正确实现
- 查看后端日志

### 2. Hook初始化失败
**症状**：页面显示"初始化错误"
**解决**：
- 检查React Query配置
- 确认依赖项是否正确安装
- 查看浏览器控制台错误

### 3. 组件渲染错误
**症状**：错误边界显示错误信息
**解决**：
- 查看错误详情（开发模式）
- 检查组件依赖
- 确认props类型正确

### 4. 网络连接问题
**症状**：API调用超时或失败
**解决**：
- 检查后端服务状态
- 确认端口配置正确
- 检查防火墙设置

## 🔧 故障排除流程

### 1. 快速检查
```bash
# 检查后端服务
curl http://localhost:3001/ping

# 检查TDengine连接
curl http://localhost:3001/api/v1/tdengine/health
```

### 2. 详细诊断
1. 打开 `debug-page-loading.html`
2. 点击"开始完整诊断"
3. 查看每个步骤的结果
4. 根据失败的步骤进行针对性修复

### 3. 浏览器调试
1. 打开浏览器开发者工具
2. 查看Console标签的错误信息
3. 查看Network标签的API请求状态
4. 查看Sources标签定位代码问题

## 📈 性能优化建议

### 1. 错误处理优化
- 添加更细粒度的错误边界
- 实现错误重试机制
- 添加错误上报功能

### 2. 加载性能优化
- 实现组件懒加载
- 添加加载状态指示器
- 优化API请求缓存

### 3. 用户体验优化
- 添加骨架屏加载效果
- 实现离线状态处理
- 提供更友好的错误提示

## 🎯 下一步计划

1. **完成页面恢复**：
   - 测试所有恢复的页面
   - 修复发现的问题
   - 确保功能完整性

2. **增强错误处理**：
   - 添加更多错误边界
   - 实现全局错误处理
   - 添加错误监控

3. **优化用户体验**：
   - 改进加载状态
   - 添加更好的错误提示
   - 实现自动重试机制

## 📝 注意事项

- 在开发模式下，错误边界会显示详细的错误信息
- 生产模式下，只显示用户友好的错误提示
- 所有API调用都添加了错误处理和默认值
- 错误边界不会捕获事件处理器中的错误，需要单独处理

通过这些修复，原始页面应该能够更稳定地运行，即使遇到错误也能提供友好的用户体验。