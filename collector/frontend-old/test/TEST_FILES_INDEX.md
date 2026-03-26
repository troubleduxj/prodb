# Collector Frontend 测试文件索引

**创建日期**: 2025-01-30
**最后更新**: 2025-01-30

---

## 测试文件分类

### 1. 布局和UI测试
- `test-header-layout-fix.html` - Header布局修复测试
- `test-header-force-refresh.html` - Header强制刷新测试
- `test-header-unified.html` - Header统一测试
- `test-header-redesign.html` - Header重新设计测试
- `test-final-header-fix.html` - Header最终修复测试
- `test-header-perfect-fix.html` - Header完美修复测试
- `test-header-alignment-fix.html` - Header对齐修复测试
- `test-header-final-fix.html` - Header最终修复测试
- `test-layout-fixed.html` - 布局修复测试
- `test-chinese-menu-fix.html` - 中文菜单修复测试
- `test-sidebar-width-fix.html` - 侧边栏宽度修复测试
- `test-status-indicator-fix.html` - 状态指示器修复测试
- `test-statusindicator-final-fix.html` - 状态指示器最终修复测试

### 2. 功能测试
- `test-batch-operations.html` - 批量操作测试
- `test-config-management.html` - 配置管理测试
- `test-driver-management.html` - 驱动管理测试
- `test-driver-version-management.html` - 驱动版本管理测试
- `test-protocol-testers.html` - 协议测试器测试

### 3. 移动端和性能测试
- `test-mobile-optimization.html` - 移动端优化测试
- `test-mobile-performance.html` - 移动端性能测试
- `test-performance-optimizations.html` - 性能优化测试
- `test-offline-manager-fix.html` - 离线管理器修复测试
- `test-offline-manager-syntax.html` - 离线管理器语法测试

### 4. 安全和隐私测试
- `test-enhanced-security.html` - 增强安全测试
- `test-security-validation.html` - 安全验证测试
- `test-privacy-protection.html` - 隐私保护测试

### 5. 用户体验测试
- `test-ux-enhancements.html` - UX增强测试
- `test-ux-integration.html` - UX集成测试

### 6. 综合测试
- `test-all-fixes.html` - 所有修复测试
- `test-critical-fixes.html` - 关键修复测试
- `test-fixes.html` - 修复测试
- `test-import-fixes.html` - 导入修复测试
- `test-validation-fix.html` - 验证修复测试

### 7. 验证和状态检查
- `verify-header-fix.html` - 验证Header修复
- `verify-implementation.js` - 验证实现
- `verify-ux-implementation.js` - 验证UX实现
- `status-check.html` - 状态检查
- `fix-validation-imports.js` - 修复验证导入

---

## 测试执行指南

### 运行单个测试
在浏览器中打开对应的HTML文件即可运行测试。

### 运行所有测试
使用 `test/run-tests.html` 或 `test/run-integration-tests.html`

### 自动化测试
```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration

# 生成测试报告
npm run test:coverage
```

---

## 测试文件清理计划

### 保留文件（核心测试）
- `test-all-fixes.html` - 综合测试
- `test-critical-fixes.html` - 关键功能测试
- `status-check.html` - 状态检查

### 归档文件（历史参考）
将以下文件移动到 `test/archived/` 目录：
- 所有 `test-header-*.html` 文件（Header已修复）
- 所有 `test-offline-manager-*.html` 文件（离线管理器已修复）
- 所有 `verify-*.html` 和 `verify-*.js` 文件（验证已完成）

### 删除文件（过期测试）
- 重复的测试文件
- 已合并到综合测试的文件

---

## 相关文档
- [测试框架说明](./test/README.md)
- [集成测试报告](./test/INTEGRATION_TEST_REPORT.md)
- [测试指南](../../docs/TESTING_GUIDE.md)

---

**维护人**: 前端开发团队
**更新频率**: 每次添加或删除测试文件时更新
