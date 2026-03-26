# 操作日志记录系统 (Audit Logging System)

## 概述

操作日志记录系统是ProDB平台安全审计功能的核心组件，负责自动记录和存储用户操作、实现日志查询、过滤和导出功能，以及对敏感操作进行详细记录和追踪。

## 功能特性

### 1. 自动操作记录
- **全面记录**: 自动记录所有HTTP请求和响应
- **用户关联**: 记录操作用户信息和会话ID
- **详细信息**: 包含请求方法、路径、IP地址、用户代理等
- **性能监控**: 记录操作耗时和响应状态码
- **异步处理**: 异步记录避免影响请求性能

### 2. 敏感操作识别
- **智能分类**: 自动识别敏感操作（用户管理、配置修改等）
- **风险评级**: 按照低、中、高、严重四个级别评估操作风险
- **安全事件**: 高风险操作自动生成安全事件
- **详细追踪**: 敏感操作记录更详细的上下文信息

### 3. 日志查询和过滤
- **多维度过滤**: 支持按用户、时间、操作类型、资源等过滤
- **分页查询**: 高效的分页和排序功能
- **全文搜索**: 支持操作描述和资源的模糊搜索
- **统计分析**: 提供操作统计和趋势分析

### 4. 数据导出
- **CSV导出**: 支持将审计日志导出为CSV格式
- **批量导出**: 支持大批量数据的高效导出
- **自定义字段**: 可选择导出的字段和时间范围

## 系统架构

### 核心组件

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP请求      │───▶│  审计中间件      │───▶│   审计服务       │
│                 │    │                 │    │                 │
│ - 用户操作      │    │ - 请求拦截      │    │ - 日志存储      │
│ - API调用       │    │ - 数据提取      │    │ - 风险评估      │
│ - 登录尝试      │    │ - 异步记录      │    │ - 事件生成      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   数据库存储     │
                       │                 │
                       │ - 审计日志表    │
                       │ - 登录记录表    │
                       │ - 安全事件表    │
                       └─────────────────┘
```

### 数据模型

#### 1. 审计日志 (AuditLog)
```go
type AuditLog struct {
    ID            uuid.UUID  // 日志唯一标识
    UserID        *uint      // 操作用户ID
    CollectorID   *uuid.UUID // 相关采集器ID
    Action        string     // 操作类型
    Resource      string     // 操作资源
    ResourceID    string     // 资源ID
    Method        string     // HTTP方法
    Path          string     // 请求路径
    IPAddress     string     // 客户端IP
    UserAgent     string     // 用户代理
    RequestData   string     // 请求数据(JSON)
    ResponseData  string     // 响应数据(JSON)
    StatusCode    int        // HTTP状态码
    Duration      int64      // 操作耗时(毫秒)
    IsSensitive   bool       // 是否敏感操作
    RiskLevel     string     // 风险级别
    SessionID     string     // 会话ID
    ErrorMessage  string     // 错误信息
    CreatedAt     time.Time  // 创建时间
}
```

#### 2. 登录尝试 (LoginAttempt)
```go
type LoginAttempt struct {
    ID          uuid.UUID  // 记录唯一标识
    Username    string     // 尝试登录的用户名
    IPAddress   string     // 客户端IP
    UserAgent   string     // 用户代理
    Success     bool       // 是否成功
    FailReason  string     // 失败原因
    SessionID   string     // 会话ID
    AttemptedAt time.Time  // 尝试时间
}
```

#### 3. 安全事件 (SecurityEvent)
```go
type SecurityEvent struct {
    ID            uuid.UUID  // 事件唯一标识
    UserID        *uint      // 相关用户ID
    CollectorID   *uuid.UUID // 相关采集器ID
    EventType     string     // 事件类型
    Severity      string     // 严重程度
    Status        string     // 事件状态
    IPAddress     string     // 相关IP地址
    Description   string     // 事件描述
    Details       string     // 详细信息(JSON)
    RuleID        string     // 触发规则ID
    Count         int        // 事件计数
    FirstSeen     time.Time  // 首次发现时间
    LastSeen      time.Time  // 最后发现时间
    ResolvedAt    *time.Time // 解决时间
    ResolvedBy    *uint      // 解决人
    Resolution    string     // 解决方案
}
```

## 使用指南

### 1. 集成审计中间件

```go
// 在main.go中集成审计中间件
func main() {
    // 初始化数据库和服务
    db := database.InitDB()
    auditService := services.NewAuditService(db)
    auditMiddleware := services.NewAuditMiddleware(auditService)
    
    // 创建Gin路由
    r := gin.Default()
    
    // 添加审计中间件
    r.Use(auditMiddleware.AuditLogger())
    
    // 为登录接口添加专门的登录审计
    auth := r.Group("/api/v1/auth")
    auth.Use(auditMiddleware.LoginAuditLogger())
    auth.POST("/login", authHandler.Login)
    
    // 其他路由...
}
```

### 2. 手动记录操作

```go
// 在业务逻辑中手动记录特殊操作
func (h *UserHandler) DeleteUser(c *gin.Context) {
    userID := c.Param("id")
    
    // 执行删除操作
    err := h.userService.DeleteUser(userID)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 手动记录敏感操作
    auditReq := &services.AuditLogRequest{
        UserID:     getCurrentUserID(c),
        Action:     "delete_user",
        Resource:   "user",
        ResourceID: userID,
        Method:     "DELETE",
        Path:       c.Request.URL.Path,
        IPAddress:  getClientIP(c),
        StatusCode: 200,
        Duration:   time.Since(start).Milliseconds(),
    }
    
    go h.auditService.LogOperation(c.Request.Context(), auditReq)
    
    c.JSON(200, gin.H{"message": "User deleted successfully"})
}
```

### 3. 查询审计日志

```go
// 查询审计日志示例
func GetAuditLogs() {
    filter := &services.AuditLogFilter{
        StartTime:   &startTime,
        EndTime:     &endTime,
        IsSensitive: &true,  // 只查询敏感操作
        RiskLevel:   "high", // 只查询高风险操作
        Page:        1,
        PageSize:    20,
        SortBy:      "created_at",
        SortOrder:   "desc",
    }
    
    response, err := auditService.GetAuditLogs(context.Background(), filter)
    if err != nil {
        log.Printf("Failed to get audit logs: %v", err)
        return
    }
    
    fmt.Printf("Total logs: %d\n", response.Total)
    for _, log := range response.Logs {
        fmt.Printf("Action: %s, Resource: %s, Risk: %s\n", 
            log.Action, log.Resource, log.RiskLevel)
    }
}
```

## API接口

### 1. 获取审计日志
```http
GET /api/v1/audit/logs?page=1&page_size=20&is_sensitive=true&risk_level=high
```

### 2. 导出审计日志
```http
GET /api/v1/audit/logs/export?start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z
```

### 3. 获取审计统计
```http
GET /api/v1/audit/statistics?start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z
```

### 4. 获取登录尝试记录
```http
GET /api/v1/audit/login-attempts?success=false&start_time=2024-01-01T00:00:00Z
```

### 5. 获取安全事件
```http
GET /api/v1/audit/security-events?severity=high&status=active
```

## 配置说明

### 1. 敏感操作配置
系统自动识别以下敏感操作：
- 用户管理：创建、删除、修改用户
- 权限管理：分配、撤销权限
- 配置管理：修改系统配置
- 密钥管理：重置、更新密钥
- 采集器管理：创建、删除采集器

### 2. 风险级别评估
- **严重(Critical)**: 删除用户、删除采集器、删除数据库
- **高(High)**: 创建用户、重置密钥、权限变更
- **中(Medium)**: 配置修改、4xx错误响应
- **低(Low)**: 普通读取操作、成功的常规操作

### 3. 性能优化
- 异步记录：避免阻塞主请求
- 批量写入：提高数据库写入效率
- 索引优化：关键字段建立索引
- 数据清理：定期清理过期日志

## 安全考虑

### 1. 数据保护
- 敏感数据脱敏：密码等敏感信息不记录原文
- 访问控制：只有授权用户可查看审计日志
- 数据完整性：防止审计日志被篡改
- 备份策略：定期备份审计数据

### 2. 隐私保护
- 最小化原则：只记录必要的信息
- 数据匿名化：在可能的情况下匿名化个人信息
- 保留期限：设置合理的数据保留期限
- 合规要求：符合相关法律法规要求

## 监控和告警

### 1. 系统监控
- 日志记录失败率
- 数据库写入性能
- 存储空间使用情况
- 查询响应时间

### 2. 安全告警
- 异常登录模式
- 大量敏感操作
- 系统错误激增
- 可疑IP活动

## 故障排除

### 1. 常见问题
- **日志记录失败**: 检查数据库连接和权限
- **性能影响**: 调整异步处理和批量大小
- **存储空间不足**: 实施日志轮转和清理策略
- **查询缓慢**: 优化数据库索引和查询条件

### 2. 调试方法
- 启用详细日志记录
- 监控数据库性能指标
- 分析慢查询日志
- 检查系统资源使用情况

## 最佳实践

1. **定期审查**: 定期审查审计日志，识别异常模式
2. **权限控制**: 严格控制审计日志的访问权限
3. **数据备份**: 定期备份审计数据，确保数据安全
4. **性能监控**: 持续监控系统性能，及时优化
5. **合规检查**: 确保审计功能符合相关合规要求
6. **培训教育**: 对相关人员进行审计系统使用培训

## 扩展功能

### 1. 实时监控
- WebSocket实时推送安全事件
- 实时仪表板显示系统状态
- 自动化响应机制

### 2. 高级分析
- 机器学习异常检测
- 用户行为分析
- 风险评分模型
- 预测性安全分析

### 3. 集成能力
- SIEM系统集成
- 第三方安全工具集成
- 企业身份管理系统集成
- 合规报告自动生成