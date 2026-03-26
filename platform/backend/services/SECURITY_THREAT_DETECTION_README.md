# 安全威胁检测系统 (Security Threat Detection System)

## 概述

安全威胁检测系统是ProDB平台安全防护的核心组件，负责实时监控和分析用户行为、检测安全威胁、自动响应安全事件，并提供全面的安全事件记录和分析功能。

## 功能特性

### 1. 异常登录检测
- **暴力破解检测**: 监控同一IP的多次失败登录尝试
- **异常登录模式**: 检测异常时间、地点、设备的登录行为
- **地理位置异常**: 基于IP地址检测异常登录位置
- **用户代理异常**: 识别可疑的用户代理字符串

### 2. 行为异常检测
- **快速API调用**: 检测异常高频的API请求
- **权限提升尝试**: 监控未授权访问敏感资源的行为
- **数据泄露检测**: 识别异常的数据访问和导出模式
- **可疑用户行为**: 分析用户操作模式的异常变化

### 3. 自动安全响应
- **IP地址封锁**: 自动封锁恶意IP地址
- **账户锁定**: 锁定存在安全风险的用户账户
- **速率限制**: 对异常请求应用速率限制
- **多因素认证**: 要求可疑登录进行额外验证
- **安全告警**: 实时发送安全事件通知

### 4. 威胁分析引擎
- **规则引擎**: 基于预定义规则检测威胁
- **置信度评估**: 为每个威胁检测结果提供置信度评分
- **风险等级**: 按照低、中、高、严重四个级别评估威胁
- **上下文分析**: 结合历史数据和当前环境进行威胁分析

## 系统架构

### 核心组件

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   数据输入      │───▶│  威胁检测引擎    │───▶│   安全响应      │
│                 │    │                 │    │                 │
│ - 登录尝试      │    │ - 规则匹配      │    │ - 自动封锁      │
│ - 审计日志      │    │ - 异常检测      │    │ - 账户锁定      │
│ - 用户行为      │    │ - 风险评估      │    │ - 告警通知      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   事件存储      │
                       │                 │
                       │ - 安全事件      │
                       │ - 响应记录      │
                       │ - 分析结果      │
                       └─────────────────┘
```

### 威胁检测规则

#### 1. 暴力破解检测 (Brute Force Detection)
```go
Rule: brute_force_login
- 时间窗口: 15分钟
- 失败阈值: 5次
- 成功率阈值: < 20%
- 严重程度: 高
- 响应动作: 封锁IP、发送告警
```

#### 2. 可疑登录模式 (Suspicious Login Pattern)
```go
Rule: suspicious_login_pattern
- 时间窗口: 1小时
- 检测条件: 异常时间 + 异常位置 + 异常设备
- 严重程度: 中
- 响应动作: 发送告警、要求MFA
```

#### 3. 快速API调用 (Rapid API Calls)
```go
Rule: rapid_api_calls
- 时间窗口: 1分钟
- 请求阈值: 100次/分钟
- 错误率阈值: > 50%
- 严重程度: 中
- 响应动作: 速率限制、发送告警
```

#### 4. 权限提升尝试 (Privilege Escalation)
```go
Rule: privilege_escalation
- 时间窗口: 5分钟
- 检测条件: 访问管理端点 + 未授权状态码
- 严重程度: 严重
- 响应动作: 锁定账户、发送告警、记录事件
```

#### 5. 数据泄露检测 (Data Exfiltration)
```go
Rule: data_exfiltration
- 时间窗口: 10分钟
- 访问阈值: 10次大量数据操作
- 检测条件: 导出操作 + 长时间查询
- 严重程度: 严重
- 响应动作: 封锁用户、发送告警、记录事件
```

## 数据模型

### 威胁检测规则 (ThreatDetectionRule)
```go
type ThreatDetectionRule struct {
    ID          string                 // 规则唯一标识
    Name        string                 // 规则名称
    Description string                 // 规则描述
    RuleType    string                 // 规则类型
    Enabled     bool                   // 是否启用
    Severity    string                 // 严重程度
    Conditions  map[string]interface{} // 检测条件
    Actions     []string               // 响应动作
    Threshold   int                    // 触发阈值
    TimeWindow  time.Duration          // 时间窗口
}
```

### 威胁分析结果 (ThreatAnalysisResult)
```go
type ThreatAnalysisResult struct {
    ThreatDetected bool                   // 是否检测到威胁
    ThreatType     string                 // 威胁类型
    Severity       string                 // 严重程度
    Confidence     float64                // 置信度 (0.0-1.0)
    Details        map[string]interface{} // 详细信息
    Actions        []string               // 建议动作
    RuleID         string                 // 触发规则ID
}
```

### 安全响应 (SecurityResponse)
```go
type SecurityResponse struct {
    ID          uuid.UUID              // 响应唯一标识
    EventID     uuid.UUID              // 关联事件ID
    ActionType  string                 // 动作类型
    Target      string                 // 目标对象
    Status      string                 // 执行状态
    Details     map[string]interface{} // 详细信息
    ExecutedAt  *time.Time             // 执行时间
    ExpiresAt   *time.Time             // 过期时间
}
```

## 使用指南

### 1. 集成威胁检测

```go
// 初始化威胁检测服务
func initSecurityServices(db *gorm.DB) {
    auditService := services.NewAuditService(db)
    threatService := services.NewSecurityThreatDetectionService(db, auditService)
    
    // 在登录处理中集成威胁检测
    loginHandler := func(c *gin.Context) {
        // ... 登录逻辑 ...
        
        // 记录登录尝试
        loginAttempt := &models.LoginAttempt{
            Username:    username,
            IPAddress:   getClientIP(c),
            Success:     success,
            AttemptedAt: time.Now(),
        }
        
        // 异步威胁分析
        go func() {
            result, err := threatService.AnalyzeLoginAttempt(context.Background(), loginAttempt)
            if err != nil {
                log.Printf("Threat analysis failed: %v", err)
                return
            }
            
            if result.ThreatDetected {
                log.Printf("Threat detected: %s (Confidence: %.2f)", 
                    result.ThreatType, result.Confidence)
            }
        }()
    }
}
```

### 2. 审计日志威胁分析

```go
// 在审计中间件中集成威胁检测
func auditMiddlewareWithThreatDetection(threatService *SecurityThreatDetectionService) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... 审计日志记录 ...
        
        // 异步威胁分析
        go func() {
            result, err := threatService.AnalyzeAuditLog(context.Background(), auditLog)
            if err != nil {
                log.Printf("Audit threat analysis failed: %v", err)
                return
            }
            
            if result.ThreatDetected {
                log.Printf("Audit threat detected: %s (Severity: %s)", 
                    result.ThreatType, result.Severity)
            }
        }()
    }
}
```

### 3. 手动威胁分析

```go
// 手动分析特定事件
func analyzeSpecificEvent() {
    loginAttempt := &models.LoginAttempt{
        Username:    "suspicious_user",
        IPAddress:   "192.168.1.100",
        UserAgent:   "curl/7.68.0",
        Success:     false,
        AttemptedAt: time.Now(),
    }
    
    result, err := threatService.AnalyzeLoginAttempt(context.Background(), loginAttempt)
    if err != nil {
        log.Printf("Analysis failed: %v", err)
        return
    }
    
    fmt.Printf("Threat Analysis Result:\n")
    fmt.Printf("- Threat Detected: %t\n", result.ThreatDetected)
    fmt.Printf("- Threat Type: %s\n", result.ThreatType)
    fmt.Printf("- Severity: %s\n", result.Severity)
    fmt.Printf("- Confidence: %.2f\n", result.Confidence)
    fmt.Printf("- Suggested Actions: %v\n", result.Actions)
}
```

## API接口

### 1. 威胁分析
```http
POST /api/v1/security/analyze
Content-Type: application/json

{
  "type": "login_attempt",
  "data": {
    "username": "testuser",
    "ip_address": "192.168.1.100",
    "user_agent": "curl/7.68.0",
    "success": false
  }
}
```

### 2. 获取威胁规则
```http
GET /api/v1/security/rules

Response:
{
  "rules": [
    {
      "id": "brute_force_login",
      "name": "Brute Force Login Detection",
      "enabled": true,
      "severity": "high",
      "threshold": 5,
      "time_window": "15m"
    }
  ]
}
```

### 3. 安全仪表板
```http
GET /api/v1/security/dashboard?start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z

Response:
{
  "statistics": {
    "total_events": 150,
    "active_events": 12,
    "severity_distribution": {
      "critical": 3,
      "high": 8,
      "medium": 25,
      "low": 114
    }
  }
}
```

### 4. 活跃威胁
```http
GET /api/v1/security/threats/active?severity=high&page=1&page_size=20

Response:
{
  "events": [
    {
      "id": "uuid",
      "event_type": "brute_force_login",
      "severity": "high",
      "status": "active",
      "ip_address": "192.168.1.100",
      "description": "Multiple failed login attempts detected"
    }
  ]
}
```

### 5. 解决威胁
```http
PUT /api/v1/security/threats/{id}/resolve
Content-Type: application/json

{
  "resolution": "IP address blocked and user notified"
}
```

## 配置说明

### 1. 威胁检测规则配置
```json
{
  "threat_rules": {
    "brute_force_login": {
      "enabled": true,
      "threshold": 5,
      "time_window": "15m",
      "actions": ["block_ip", "send_alert"]
    },
    "suspicious_login_pattern": {
      "enabled": true,
      "confidence_threshold": 0.6,
      "actions": ["send_alert", "require_mfa"]
    }
  }
}
```

### 2. 自动响应配置
```json
{
  "auto_response": {
    "enabled": true,
    "ip_block_duration": "1h",
    "account_lock_duration": "30m",
    "rate_limit_duration": "5m",
    "notification_channels": ["email", "webhook"]
  }
}
```

### 3. 分析引擎配置
```json
{
  "analysis_engine": {
    "async_processing": true,
    "batch_size": 100,
    "processing_interval": "30s",
    "confidence_threshold": 0.5
  }
}
```

## 性能优化

### 1. 异步处理
- 威胁分析采用异步处理，避免阻塞主请求
- 批量处理多个事件，提高分析效率
- 使用消息队列处理高并发场景

### 2. 缓存策略
- 缓存威胁检测规则，减少数据库查询
- 缓存用户行为模式，加速异常检测
- 使用Redis存储临时分析结果

### 3. 数据库优化
- 为关键字段建立索引（IP地址、用户ID、时间戳）
- 分区存储历史数据，提高查询性能
- 定期清理过期的安全事件数据

## 安全考虑

### 1. 误报处理
- 提供白名单机制，排除已知安全的IP和用户
- 支持手动调整威胁检测阈值
- 记录误报情况，持续优化检测规则

### 2. 隐私保护
- 敏感信息脱敏处理
- 遵循数据保护法规
- 提供数据删除和匿名化功能

### 3. 系统安全
- 威胁检测系统本身的安全防护
- 防止绕过威胁检测机制
- 定期安全审计和漏洞扫描

## 监控和告警

### 1. 系统监控
- 威胁检测引擎性能监控
- 分析处理延迟监控
- 误报率和漏报率统计

### 2. 安全告警
- 实时威胁告警通知
- 告警升级机制
- 多渠道告警发送（邮件、短信、Webhook）

### 3. 报表分析
- 威胁趋势分析报表
- 安全事件统计报表
- 系统安全健康度评估

## 故障排除

### 1. 常见问题
- **检测延迟**: 检查异步处理队列状态
- **误报过多**: 调整检测阈值和规则参数
- **漏报问题**: 分析威胁模式，完善检测规则
- **性能问题**: 优化数据库查询和缓存策略

### 2. 调试工具
- 威胁分析日志查看
- 规则匹配过程跟踪
- 性能指标监控面板
- 测试威胁场景模拟

## 扩展功能

### 1. 机器学习集成
- 基于历史数据训练异常检测模型
- 用户行为基线学习
- 自适应威胁检测阈值调整

### 2. 外部集成
- SIEM系统集成
- 威胁情报源集成
- 第三方安全工具联动

### 3. 高级分析
- 攻击链分析
- 威胁归因分析
- 预测性安全分析

## 最佳实践

1. **规则调优**: 根据实际环境调整威胁检测规则
2. **定期审查**: 定期审查安全事件和响应效果
3. **培训教育**: 对安全团队进行威胁检测系统培训
4. **持续改进**: 基于反馈持续优化检测算法
5. **合规要求**: 确保威胁检测符合相关安全标准
6. **应急响应**: 建立完善的安全事件应急响应流程