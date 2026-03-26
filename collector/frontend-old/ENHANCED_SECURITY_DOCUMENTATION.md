# 增强安全功能文档

## 概述

本文档描述了采集器前端实现的增强安全功能，包括XSS防护、输入验证、会话管理、审计日志和访问控制等安全机制。

## 功能特性

### 1. XSS防护和输入验证

#### 1.1 XSS防护机制
- **自动清理**: 所有用户输入自动进行XSS清理
- **模式检测**: 检测常见的XSS攻击模式
- **HTML实体编码**: 对危险字符进行编码
- **脚本标签过滤**: 移除或转义脚本标签

#### 1.2 输入验证
- **实时验证**: 输入时实时检查安全性
- **SQL注入检测**: 检测SQL注入尝试
- **长度限制**: 防止过长输入攻击
- **危险字符检测**: 识别潜在危险字符

#### 1.3 安全输入组件
```javascript
import { SecureInput } from './components/AccessControl.js';

// 基本用法
<SecureInput
    value={inputValue}
    onChange={handleChange}
    onSecurityIssue={handleSecurityIssue}
    maxLength={1000}
    validateOnChange={true}
/>

// 敏感信息输入
<SecureInput
    type="password"
    sensitive={true}
    value={password}
    onChange={handlePasswordChange}
/>
```

### 2. 访问控制和权限管理

#### 2.1 权限保护组件
```javascript
import { ProtectedComponent } from './components/AccessControl.js';

// 基于权限的内容保护
<ProtectedComponent 
    requiredPermission="admin" 
    resource="system_config"
    context={{ operation: 'modify' }}
>
    <AdminPanel />
</ProtectedComponent>
```

#### 2.2 安全操作按钮
```javascript
import { ProtectedButton } from './components/AccessControl.js';

// 需要确认的危险操作
<ProtectedButton
    requiredPermission="delete"
    resource="interface_config"
    operation="delete"
    confirmMessage="确认删除此接口配置？"
    onClick={handleDelete}
    className="btn-danger"
>
    删除配置
</ProtectedButton>
```

#### 2.3 权限级别
- **READ**: 读取权限
- **WRITE**: 写入权限  
- **DELETE**: 删除权限
- **ADMIN**: 管理员权限

### 3. 会话管理和自动清理

#### 3.1 会话监控
- **活动检测**: 监控用户活动
- **自动过期**: 会话超时自动清理
- **页面可见性**: 根据页面状态调整会话
- **多标签页同步**: 跨标签页会话状态同步

#### 3.2 会话管理器组件
```javascript
import { SessionManager } from './components/AccessControl.js';

// 显示会话状态和剩余时间
<SessionManager />
```

#### 3.3 自动清理机制
- **敏感数据清理**: 自动清理内存中的敏感信息
- **DOM清理**: 清理DOM中的敏感输入
- **存储清理**: 清理本地和会话存储
- **日志清理**: 定期清理过期日志

### 4. 审计日志和操作记录

#### 4.1 增强的审计日志
```javascript
// 自动记录操作
securityService.logOperation('config_update', 'interface_001', {
    changes: ['host', 'port'],
    previousValues: { host: '192.168.1.100', port: 4840 }
});

// 记录失败操作
securityService.logFailedOperation('connection_test', 'opc_server', error, {
    endpoint: 'opc.tcp://192.168.1.100:4840',
    timeout: 5000
});
```

#### 4.2 日志信息包含
- **基本信息**: 时间戳、用户、操作、资源
- **安全信息**: 风险分数、异常标记、CSRF令牌
- **技术信息**: IP地址、用户代理、浏览器指纹
- **上下文信息**: 屏幕分辨率、时区、语言等

#### 4.3 操作日志查看器
```javascript
import OperationLogger from './components/OperationLogger.js';

// 带安全分析的日志查看器
<OperationLogger
    maxEntries={100}
    enableSecurityAnalysis={true}
    enableAnomalyDetection={true}
    showRiskScores={true}
    autoRefresh={true}
/>
```

### 5. 异常检测和风险评估

#### 5.1 异常检测类型
- **频繁失败**: 检测异常的操作失败
- **异常删除**: 检测大量删除操作
- **配置变更**: 检测异常的配置修改
- **时间异常**: 检测非工作时间访问
- **权限提升**: 检测权限提升尝试

#### 5.2 风险评估
```javascript
// 计算操作风险分数 (0-10)
const riskScore = securityService.calculateRiskScore(
    'delete',           // 操作类型
    'system_config',    // 资源
    { batch: true }     // 上下文
);
```

#### 5.3 风险级别
- **低风险 (0-3)**: 常规操作
- **中风险 (4-7)**: 需要注意的操作
- **高风险 (8-10)**: 危险操作，需要额外确认

### 6. 敏感数据保护

#### 6.1 数据脱敏
```javascript
// 自动脱敏敏感字段
const maskedConfig = securityService.maskSensitiveData({
    username: 'admin',
    password: 'secret123',
    apiKey: 'sk-1234567890abcdef'
});
// 结果: { username: 'admin', password: 'se****23', apiKey: 'sk****ef' }
```

#### 6.2 敏感数据显示组件
```javascript
import { SensitiveDataDisplay } from './components/AccessControl.js';

// 可控制显示的敏感信息
<SensitiveDataDisplay
    data="super_secret_password"
    fieldName="password"
    allowReveal={true}
/>
```

#### 6.3 安全导出
```javascript
// 导出时自动处理敏感信息
const secureConfig = securityService.secureExportConfig(originalConfig);
```

### 7. CSRF保护

#### 7.1 CSRF令牌
- **自动生成**: 页面加载时自动生成CSRF令牌
- **表单保护**: 安全表单自动包含CSRF令牌
- **API请求**: 重要API请求包含CSRF验证

#### 7.2 安全表单组件
```javascript
import { SecureForm } from './components/AccessControl.js';

// 自动包含CSRF保护的表单
<SecureForm
    onSubmit={handleSubmit}
    enableCSRF={true}
    validateOnSubmit={true}
>
    <SecureInput name="username" required />
    <SecureInput name="password" type="password" sensitive={true} required />
    <button type="submit">提交</button>
</SecureForm>
```

### 8. IP阻止和频率限制

#### 8.1 自动IP阻止
- **失败尝试跟踪**: 跟踪每个IP的失败尝试
- **自动阻止**: 超过阈值自动阻止IP
- **自动解除**: 一定时间后自动解除阻止

#### 8.2 操作频率限制
```javascript
// 检查操作是否被频率限制
const isLimited = securityService.isRateLimited('create', 'interface');
```

### 9. 安全配置

#### 9.1 敏感字段配置
```javascript
const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'key', 'credential',
    'username', 'clientSecret', 'privateKey', 'certificate',
    'apiKey', 'accessToken', 'refreshToken', 'sessionId'
];
```

#### 9.2 安全策略配置
```javascript
// 会话超时设置
securityService.sessionTimeout = 30 * 60 * 1000; // 30分钟

// 失败尝试阈值
const MAX_FAILED_ATTEMPTS = 5;

// 操作频率限制
const RATE_LIMITS = {
    'create': 10,    // 每分钟最多10次创建操作
    'delete': 5,     // 每分钟最多5次删除操作
    'export': 3      // 每分钟最多3次导出操作
};
```

## 使用示例

### 完整的安全表单示例
```javascript
import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import { 
    SecureForm, 
    SecureInput, 
    ProtectedButton 
} from './components/AccessControl.js';

const SecureConfigForm = () => {
    const [config, setConfig] = useState({});
    const [securityIssues, setSecurityIssues] = useState([]);

    const handleSubmit = async (data) => {
        try {
            await api.saveConfig(data);
            alert('配置保存成功');
        } catch (error) {
            console.error('保存失败:', error);
        }
    };

    const handleSecurityIssue = (issues) => {
        setSecurityIssues(issues);
    };

    return html`
        <div class="secure-config-form">
            <h3>安全配置表单</h3>
            
            <${SecureForm} 
                onSubmit=${handleSubmit}
                onSecurityIssue=${handleSecurityIssue}
                enableCSRF=${true}
            >
                <div class="form-group">
                    <label>服务器地址:</label>
                    <${SecureInput}
                        name="host"
                        value=${config.host || ''}
                        onChange=${(e) => setConfig({...config, host: e.target.value})}
                        placeholder="192.168.1.100"
                        pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                        required
                    />
                </div>

                <div class="form-group">
                    <label>用户名:</label>
                    <${SecureInput}
                        name="username"
                        value=${config.username || ''}
                        onChange=${(e) => setConfig({...config, username: e.target.value})}
                        maxLength=${50}
                        required
                    />
                </div>

                <div class="form-group">
                    <label>密码:</label>
                    <${SecureInput}
                        name="password"
                        type="password"
                        value=${config.password || ''}
                        onChange=${(e) => setConfig({...config, password: e.target.value})}
                        sensitive=${true}
                        required
                    />
                </div>

                <div class="form-actions">
                    <${ProtectedButton}
                        type="submit"
                        requiredPermission="write"
                        resource="interface_config"
                        operation="create"
                        className="btn-primary"
                    >
                        保存配置
                    <//>
                </div>
            <//>

            ${securityIssues.length > 0 && html`
                <div class="security-warnings">
                    <h4>安全警告</h4>
                    ${securityIssues.map(issue => html`
                        <div class="security-issue">
                            ${issue.message}
                        </div>
                    `)}
                </div>
            `}
        </div>
    `;
};
```

## 安全最佳实践

### 1. 输入验证
- 始终使用 `SecureInput` 组件处理用户输入
- 对所有输入进行客户端和服务端双重验证
- 设置合理的输入长度限制
- 使用白名单而非黑名单进行验证

### 2. 权限控制
- 使用 `ProtectedComponent` 保护敏感功能
- 实施最小权限原则
- 定期审查和更新权限设置
- 记录所有权限检查和访问尝试

### 3. 会话管理
- 设置合理的会话超时时间
- 监控用户活动状态
- 实施会话固定保护
- 在敏感操作后刷新会话

### 4. 审计日志
- 记录所有重要操作
- 包含足够的上下文信息
- 定期备份和归档日志
- 监控异常访问模式

### 5. 敏感数据
- 对敏感数据进行脱敏处理
- 避免在客户端存储敏感信息
- 使用安全的传输协议
- 实施数据分类和标记

## 配置选项

### 安全服务配置
```javascript
// 在应用初始化时配置安全服务
securityService.configure({
    sessionTimeout: 30 * 60 * 1000,        // 会话超时时间
    maxFailedAttempts: 5,                   // 最大失败尝试次数
    blockDuration: 60 * 60 * 1000,         // IP阻止持续时间
    enableAnomalyDetection: true,           // 启用异常检测
    enableRiskAssessment: true,             // 启用风险评估
    logRetentionDays: 30,                   // 日志保留天数
    sensitiveFields: [...SENSITIVE_FIELDS], // 敏感字段列表
    csrfTokenLength: 32                     // CSRF令牌长度
});
```

## 测试和验证

### 运行安全测试
1. 打开 `test-enhanced-security.html`
2. 测试各种安全功能
3. 验证XSS防护效果
4. 检查权限控制机制
5. 测试异常检测功能

### 安全检查清单
- [ ] XSS防护正常工作
- [ ] 输入验证有效
- [ ] 权限控制正确
- [ ] 会话管理安全
- [ ] 审计日志完整
- [ ] 敏感数据保护
- [ ] CSRF保护启用
- [ ] 异常检测工作
- [ ] 风险评估准确

## 故障排除

### 常见问题
1. **输入被误判为XSS**: 检查输入内容，调整验证规则
2. **权限检查失败**: 确认用户权限和资源配置
3. **会话频繁过期**: 调整会话超时时间
4. **日志记录失败**: 检查后端API连接
5. **异常检测误报**: 调整检测阈值

### 调试方法
```javascript
// 启用调试模式
securityService.debug = true;

// 查看安全状态
console.log(securityService.getSecurityStatusReport());

// 查看操作日志
console.log(securityService.getOperationLogs());

// 检查异常
console.log(securityService.detectAnomalousAccess());
```

## 更新日志

### v1.0.0 (当前版本)
- 实现XSS防护和输入验证
- 添加权限控制和访问管理
- 实现会话管理和自动清理
- 添加审计日志和操作记录
- 实现异常检测和风险评估
- 添加敏感数据保护功能
- 实现CSRF保护机制
- 添加IP阻止和频率限制

## 后续计划

### 计划功能
- 双因素认证支持
- 更高级的异常检测算法
- 机器学习驱动的风险评估
- 集成外部安全服务
- 更细粒度的权限控制
- 安全合规性报告

---

**注意**: 本文档描述的安全功能主要用于前端保护，不能替代服务端安全措施。请确保后端也实施相应的安全控制。