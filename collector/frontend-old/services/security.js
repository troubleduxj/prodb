/**
 * 安全服务 - 处理配置验证、敏感信息保护和访问控制
 * 增强版本包含XSS防护、输入验证、会话管理和审计功能
 */

// 敏感字段列表
const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'key', 'credential',
    'username', 'clientSecret', 'privateKey', 'certificate',
    'apiKey', 'accessToken', 'refreshToken', 'sessionId'
];

// XSS防护模式
const XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi
];

// 危险HTML标签
const DANGEROUS_TAGS = [
    'script', 'iframe', 'object', 'embed', 'link', 'meta', 
    'form', 'input', 'textarea', 'button', 'select'
];

// SQL注入模式
const SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(--|\/\*|\*\/|;|'|")/g,
    /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
];

// 操作权限级别
const PERMISSION_LEVELS = {
    READ: 'read',
    WRITE: 'write',
    DELETE: 'delete',
    ADMIN: 'admin'
};

// 配置验证规则
const VALIDATION_RULES = {
    required: (value) => value !== null && value !== undefined && value !== '',
    minLength: (min) => (value) => value && value.length >= min,
    maxLength: (max) => (value) => value && value.length <= max,
    pattern: (regex) => (value) => regex.test(value),
    ipAddress: (value) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value),
    port: (value) => {
        const num = parseInt(value);
        return num >= 1 && num <= 65535;
    },
    url: (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }
};

class SecurityService {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.operationLog = [];
        this.sessionTimeout = 30 * 60 * 1000; // 30分钟
        this.lastActivity = Date.now();
        this.failedAttempts = new Map(); // 跟踪失败尝试
        this.blockedIPs = new Set(); // 被阻止的IP
        this.csrfToken = this.generateCSRFToken();
        
        // 启动会话监控
        this.startSessionMonitoring();
        
        // 启动安全监控
        this.startSecurityMonitoring();
        
        // 绑定全局错误处理
        this.setupGlobalErrorHandling();
    }

    /**
     * 获取当前用户信息
     */
    getCurrentUser() {
        return {
            id: 'collector-user',
            name: 'Collector Admin',
            permissions: [PERMISSION_LEVELS.READ, PERMISSION_LEVELS.WRITE, PERMISSION_LEVELS.DELETE],
            sessionId: this.generateSessionId(),
            loginTime: Date.now()
        };
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * 生成CSRF令牌
     */
    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * XSS防护 - 清理用户输入
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        let sanitized = input;

        // 移除危险的脚本标签和事件处理器
        for (const pattern of XSS_PATTERNS) {
            sanitized = sanitized.replace(pattern, '');
        }

        // HTML实体编码
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');

        return sanitized;
    }

    /**
     * 深度清理对象中的所有字符串值
     */
    deepSanitize(obj) {
        if (typeof obj === 'string') {
            return this.sanitizeInput(obj);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepSanitize(item));
        }
        
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[this.sanitizeInput(key)] = this.deepSanitize(value);
            }
            return sanitized;
        }
        
        return obj;
    }

    /**
     * 检测SQL注入尝试
     */
    detectSQLInjection(input) {
        if (typeof input !== 'string') {
            return false;
        }

        for (const pattern of SQL_INJECTION_PATTERNS) {
            if (pattern.test(input)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 验证输入安全性
     */
    validateInputSecurity(input, fieldName = 'unknown') {
        const issues = [];

        if (typeof input === 'string') {
            // 检查XSS
            for (const pattern of XSS_PATTERNS) {
                if (pattern.test(input)) {
                    issues.push({
                        type: 'xss_attempt',
                        field: fieldName,
                        message: '检测到潜在的XSS攻击尝试'
                    });
                    break;
                }
            }

            // 检查SQL注入
            if (this.detectSQLInjection(input)) {
                issues.push({
                    type: 'sql_injection_attempt',
                    field: fieldName,
                    message: '检测到潜在的SQL注入尝试'
                });
            }

            // 检查过长输入
            if (input.length > 10000) {
                issues.push({
                    type: 'excessive_length',
                    field: fieldName,
                    message: '输入长度超过安全限制'
                });
            }

            // 检查危险字符
            const dangerousChars = /[<>{}[\]\\]/g;
            if (dangerousChars.test(input)) {
                issues.push({
                    type: 'dangerous_characters',
                    field: fieldName,
                    message: '输入包含潜在危险字符'
                });
            }
        }

        return {
            isSecure: issues.length === 0,
            issues
        };
    }

    /**
     * 安全的JSON解析
     */
    secureJSONParse(jsonString) {
        try {
            // 预检查JSON字符串
            const securityCheck = this.validateInputSecurity(jsonString, 'json_input');
            if (!securityCheck.isSecure) {
                throw new Error('JSON输入包含安全风险: ' + securityCheck.issues.map(i => i.message).join(', '));
            }

            const parsed = JSON.parse(jsonString);
            return this.deepSanitize(parsed);
        } catch (error) {
            this.logFailedOperation('json_parse', 'security', error);
            throw new Error('JSON解析失败: ' + error.message);
        }
    }

    /**
     * 验证配置数据
     */
    validateConfig(config, schema) {
        const errors = {};
        const warnings = [];

        // 基础字段验证
        if (schema.required) {
            for (const field of schema.required) {
                if (!VALIDATION_RULES.required(config[field])) {
                    errors[field] = `字段 ${field} 是必需的`;
                }
            }
        }

        // 字段规则验证
        if (schema.fields) {
            for (const [fieldName, fieldRules] of Object.entries(schema.fields)) {
                const value = config[fieldName];
                
                if (value !== undefined && value !== null) {
                    for (const rule of fieldRules) {
                        const validator = VALIDATION_RULES[rule.type];
                        if (validator) {
                            const isValid = rule.params 
                                ? validator(...rule.params)(value)
                                : validator(value);
                            
                            if (!isValid) {
                                errors[fieldName] = rule.message || `字段 ${fieldName} 验证失败`;
                            }
                        }
                    }
                }
            }
        }

        // 安全性检查
        this.performSecurityChecks(config, warnings);

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    }

    /**
     * 执行安全性检查
     */
    performSecurityChecks(config, warnings) {
        // 检查弱密码
        if (config.password && config.password.length < 8) {
            warnings.push('密码长度建议至少8位');
        }

        // 检查默认凭据
        const defaultCredentials = ['admin', 'password', '123456', 'default'];
        if (config.username && defaultCredentials.includes(config.username.toLowerCase())) {
            warnings.push('建议不要使用默认用户名');
        }
        if (config.password && defaultCredentials.includes(config.password.toLowerCase())) {
            warnings.push('建议不要使用默认密码');
        }

        // 检查不安全的协议设置
        if (config.securityPolicy === 'None' && config.protocol === 'OPC_UA') {
            warnings.push('OPC UA建议启用安全策略');
        }

        // 检查敏感信息是否加密
        for (const field of SENSITIVE_FIELDS) {
            if (config[field] && typeof config[field] === 'string' && !this.isEncrypted(config[field])) {
                warnings.push(`敏感字段 ${field} 建议加密存储`);
            }
        }
    }

    /**
     * 检查字符串是否已加密
     */
    isEncrypted(value) {
        // 简单检查是否为Base64编码或其他加密格式
        return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20;
    }

    /**
     * 脱敏显示敏感信息
     */
    maskSensitiveData(config) {
        const maskedConfig = { ...config };
        
        for (const field of SENSITIVE_FIELDS) {
            if (maskedConfig[field]) {
                const value = maskedConfig[field];
                if (typeof value === 'string' && value.length > 0) {
                    if (value.length <= 4) {
                        maskedConfig[field] = '*'.repeat(value.length);
                    } else {
                        maskedConfig[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
                    }
                }
            }
        }

        return maskedConfig;
    }

    /**
     * 检查操作权限
     */
    checkPermission(operation, resource = null) {
        if (!this.currentUser) {
            return false;
        }

        // 检查会话是否过期
        if (this.isSessionExpired()) {
            this.clearSession();
            return false;
        }

        // 更新最后活动时间
        this.updateActivity();

        // 权限检查逻辑
        const requiredPermissions = {
            'read': [PERMISSION_LEVELS.READ],
            'create': [PERMISSION_LEVELS.WRITE],
            'update': [PERMISSION_LEVELS.WRITE],
            'delete': [PERMISSION_LEVELS.DELETE],
            'admin': [PERMISSION_LEVELS.ADMIN]
        };

        const required = requiredPermissions[operation] || [];
        return required.some(perm => this.currentUser.permissions.includes(perm));
    }

    /**
     * 记录操作日志
     */
    logOperation(operation, resource, details = {}) {
        return this.createAuditLog(operation, resource, details, 'success');
    }

    /**
     * 记录失败操作
     */
    logFailedOperation(operation, resource, error, details = {}) {
        const enhancedDetails = {
            ...details,
            error: error.message || error,
            stack: error.stack
        };
        return this.createAuditLog(operation, resource, enhancedDetails, 'failure');
    }

    /**
     * 清理日志详情中的敏感信息
     */
    sanitizeLogDetails(details) {
        const sanitized = { ...details };
        
        for (const field of SENSITIVE_FIELDS) {
            if (sanitized[field]) {
                sanitized[field] = '[MASKED]';
            }
        }

        return sanitized;
    }

    /**
     * 生成日志ID
     */
    generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    /**
     * 获取客户端IP（模拟）
     */
    getClientIP() {
        // 在实际应用中，这应该从服务器获取
        return '127.0.0.1';
    }

    /**
     * 发送日志到后端
     */
    async sendLogToBackend(logEntry) {
        try {
            await fetch('/api/v1/audit/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.warn('Failed to send log to backend:', error);
        }
    }

    /**
     * 获取操作日志
     */
    getOperationLogs(filters = {}) {
        let logs = [...this.operationLog];

        // 应用过滤器
        if (filters.operation) {
            logs = logs.filter(log => log.operation === filters.operation);
        }
        if (filters.user) {
            logs = logs.filter(log => log.user && log.user.id === filters.user);
        }
        if (filters.startTime) {
            logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startTime));
        }
        if (filters.endTime) {
            logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endTime));
        }

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * 检查会话是否过期
     */
    isSessionExpired() {
        return Date.now() - this.lastActivity > this.sessionTimeout;
    }

    /**
     * 更新活动时间
     */
    updateActivity() {
        this.lastActivity = Date.now();
    }

    /**
     * 清理会话
     */
    clearSession() {
        this.currentUser = null;
        this.logOperation('session_expired', 'system');
    }

    /**
     * 启动会话监控
     */
    startSessionMonitoring() {
        setInterval(() => {
            if (this.isSessionExpired() && this.currentUser) {
                this.clearSession();
                // 触发会话过期事件
                window.dispatchEvent(new CustomEvent('sessionExpired'));
            }
        }, 60000); // 每分钟检查一次

        // 监听用户活动
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        const updateActivity = () => this.updateActivity();
        
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // 页面可见性变化监听
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logOperation('page_hidden', 'session');
            } else {
                this.logOperation('page_visible', 'session');
                this.updateActivity();
            }
        });
    }

    /**
     * 启动安全监控
     */
    startSecurityMonitoring() {
        // 定期检查异常访问
        setInterval(() => {
            const anomalies = this.detectAnomalousAccess();
            if (anomalies.length > 0) {
                this.handleSecurityAnomalies(anomalies);
            }
        }, 5 * 60 * 1000); // 每5分钟检查一次

        // 清理过期的失败尝试记录
        setInterval(() => {
            this.cleanupFailedAttempts();
        }, 10 * 60 * 1000); // 每10分钟清理一次
    }

    /**
     * 设置全局错误处理
     */
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            this.logFailedOperation('javascript_error', 'global', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                message: event.message
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logFailedOperation('unhandled_promise_rejection', 'global', event.reason);
        });
    }

    /**
     * 增强的权限检查
     */
    checkPermissionEnhanced(operation, resource = null, context = {}) {
        // 基础权限检查
        if (!this.checkPermission(operation, resource)) {
            this.recordFailedAttempt('permission_denied', { operation, resource, context });
            return false;
        }

        // 检查IP是否被阻止
        const clientIP = this.getClientIP();
        if (this.blockedIPs.has(clientIP)) {
            this.logFailedOperation('blocked_ip_access', resource, new Error('IP被阻止'), { ip: clientIP });
            return false;
        }

        // 检查操作频率限制
        if (this.isRateLimited(operation, resource)) {
            this.recordFailedAttempt('rate_limit_exceeded', { operation, resource });
            return false;
        }

        // 敏感操作需要额外验证
        const sensitiveOperations = ['delete', 'admin', 'export', 'backup'];
        if (sensitiveOperations.includes(operation)) {
            return this.validateSensitiveOperation(operation, resource, context);
        }

        return true;
    }

    /**
     * 记录失败尝试
     */
    recordFailedAttempt(type, details) {
        const clientIP = this.getClientIP();
        const key = `${clientIP}_${type}`;
        
        if (!this.failedAttempts.has(key)) {
            this.failedAttempts.set(key, []);
        }
        
        this.failedAttempts.get(key).push({
            timestamp: Date.now(),
            details
        });

        // 检查是否需要阻止IP
        const attempts = this.failedAttempts.get(key);
        const recentAttempts = attempts.filter(a => Date.now() - a.timestamp < 15 * 60 * 1000); // 15分钟内
        
        if (recentAttempts.length >= 5) {
            this.blockIP(clientIP, '频繁的失败尝试');
        }

        this.logFailedOperation('security_violation', 'access_control', new Error(type), details);
    }

    /**
     * 阻止IP地址
     */
    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        this.logOperation('ip_blocked', 'security', { ip, reason });
        
        // 设置自动解除阻止（1小时后）
        setTimeout(() => {
            this.unblockIP(ip);
        }, 60 * 60 * 1000);
    }

    /**
     * 解除IP阻止
     */
    unblockIP(ip) {
        this.blockedIPs.delete(ip);
        this.logOperation('ip_unblocked', 'security', { ip });
    }

    /**
     * 检查操作频率限制
     */
    isRateLimited(operation, resource) {
        const key = `${operation}_${resource || 'global'}`;
        const now = Date.now();
        const timeWindow = 60 * 1000; // 1分钟窗口
        const maxOperations = {
            'create': 10,
            'update': 20,
            'delete': 5,
            'export': 3,
            'test': 30
        };

        const limit = maxOperations[operation] || 50;
        
        // 获取时间窗口内的操作
        const recentOps = this.operationLog.filter(log => 
            log.operation === operation &&
            (log.resource === resource || !resource) &&
            now - new Date(log.timestamp).getTime() < timeWindow
        );

        return recentOps.length >= limit;
    }

    /**
     * 验证敏感操作
     */
    validateSensitiveOperation(operation, resource, context) {
        // 检查是否在安全时间窗口内
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            this.logFailedOperation('sensitive_operation_outside_hours', resource, 
                new Error('敏感操作在非工作时间被拒绝'));
            return false;
        }

        // 检查最近是否有类似操作
        const recentSimilarOps = this.operationLog.filter(log => 
            log.operation === operation &&
            Date.now() - new Date(log.timestamp).getTime() < 5 * 60 * 1000 // 5分钟内
        );

        if (recentSimilarOps.length > 0) {
            this.logFailedOperation('duplicate_sensitive_operation', resource, 
                new Error('短时间内重复的敏感操作'));
            return false;
        }

        return true;
    }

    /**
     * 清理过期的失败尝试记录
     */
    cleanupFailedAttempts() {
        const cutoff = Date.now() - 60 * 60 * 1000; // 1小时前
        
        for (const [key, attempts] of this.failedAttempts.entries()) {
            const validAttempts = attempts.filter(a => a.timestamp > cutoff);
            if (validAttempts.length === 0) {
                this.failedAttempts.delete(key);
            } else {
                this.failedAttempts.set(key, validAttempts);
            }
        }
    }

    /**
     * 处理安全异常
     */
    handleSecurityAnomalies(anomalies) {
        for (const anomaly of anomalies) {
            this.logOperation('security_anomaly_detected', 'monitoring', anomaly);
            
            // 根据异常类型采取行动
            switch (anomaly.type) {
                case 'frequent_failures':
                    if (anomaly.count > 20) {
                        // 临时提高安全级别
                        this.sessionTimeout = 15 * 60 * 1000; // 缩短会话超时
                    }
                    break;
                case 'excessive_deletions':
                    // 发送警告通知
                    this.showSecurityAlert('检测到异常的删除操作模式', 'warning');
                    break;
            }
        }
    }

    /**
     * 显示安全警告
     */
    showSecurityAlert(message, type = 'warning') {
        const alert = document.createElement('div');
        alert.className = `security-alert alert-${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">⚠️</span>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // 自动移除
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    }

    /**
     * 安全确认对话框
     */
    async requestSecurityConfirmation(operation, resource, message) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'security-confirmation-dialog';
            dialog.innerHTML = `
                <div class="dialog-overlay">
                    <div class="dialog-content">
                        <h3>安全确认</h3>
                        <p>${message || `确认要执行 ${operation} 操作吗？`}</p>
                        <div class="confirmation-details">
                            <p><strong>操作:</strong> ${operation}</p>
                            <p><strong>资源:</strong> ${resource}</p>
                            <p><strong>用户:</strong> ${this.currentUser?.name || 'Unknown'}</p>
                            <p><strong>时间:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        <div class="dialog-actions">
                            <button class="btn-secondary cancel-btn">取消</button>
                            <button class="btn-primary confirm-btn">确认</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            const cleanup = () => {
                document.body.removeChild(dialog);
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                this.logOperation('security_confirmation', resource, { operation, confirmed: true });
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                this.logOperation('security_confirmation', resource, { operation, confirmed: false });
                resolve(false);
            });

            // ESC键取消
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleKeydown);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    /**
     * 导出配置时的安全处理
     */
    secureExportConfig(config) {
        const exportConfig = { ...config };
        
        // 移除或脱敏敏感信息
        for (const field of SENSITIVE_FIELDS) {
            if (exportConfig[field]) {
                exportConfig[field] = '[REMOVED_FOR_SECURITY]';
            }
        }

        // 添加导出元数据
        exportConfig._exportMetadata = {
            exportedBy: this.currentUser?.name,
            exportedAt: new Date().toISOString(),
            version: '1.0',
            securityLevel: 'sanitized'
        };

        return exportConfig;
    }

    /**
     * 检测异常访问模式
     */
    detectAnomalousAccess() {
        const recentLogs = this.getOperationLogs({
            startTime: new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
        });

        const anomalies = [];

        // 检测频繁失败的操作
        const failedOps = recentLogs.filter(log => !log.success);
        if (failedOps.length > 10) {
            anomalies.push({
                type: 'frequent_failures',
                count: failedOps.length,
                message: '检测到频繁的操作失败',
                severity: failedOps.length > 20 ? 'high' : 'medium'
            });
        }

        // 检测异常操作模式
        const deleteOps = recentLogs.filter(log => log.operation === 'delete');
        if (deleteOps.length > 5) {
            anomalies.push({
                type: 'excessive_deletions',
                count: deleteOps.length,
                message: '检测到异常的删除操作',
                severity: deleteOps.length > 10 ? 'high' : 'medium'
            });
        }

        // 检测短时间内大量配置更改
        const configOps = recentLogs.filter(log => 
            ['create', 'update', 'delete'].includes(log.operation) &&
            log.resource && log.resource.includes('config')
        );
        if (configOps.length > 15) {
            anomalies.push({
                type: 'excessive_config_changes',
                count: configOps.length,
                message: '检测到异常的配置更改频率',
                severity: 'high'
            });
        }

        // 检测异常时间访问
        const nightOps = recentLogs.filter(log => {
            const hour = new Date(log.timestamp).getHours();
            return hour < 6 || hour > 22;
        });
        if (nightOps.length > 5) {
            anomalies.push({
                type: 'unusual_time_access',
                count: nightOps.length,
                message: '检测到非工作时间的异常访问',
                severity: 'medium'
            });
        }

        // 检测权限提升尝试
        const adminOps = recentLogs.filter(log => log.operation === 'admin');
        if (adminOps.length > 3) {
            anomalies.push({
                type: 'privilege_escalation_attempt',
                count: adminOps.length,
                message: '检测到可能的权限提升尝试',
                severity: 'high'
            });
        }

        return anomalies;
    }

    /**
     * 增强的审计日志记录
     */
    createAuditLog(operation, resource, details = {}, result = 'success') {
        const auditEntry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            sessionId: this.currentUser?.sessionId,
            user: this.currentUser ? {
                id: this.currentUser.id,
                name: this.currentUser.name,
                permissions: this.currentUser.permissions
            } : null,
            operation,
            resource,
            details: this.sanitizeLogDetails(details),
            result,
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            url: window.location.href,
            csrfToken: this.csrfToken,
            browserFingerprint: this.getBrowserFingerprint(),
            riskScore: this.calculateRiskScore(operation, resource, details)
        };

        // 添加上下文信息
        auditEntry.context = {
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            onlineStatus: navigator.onLine
        };

        this.operationLog.push(auditEntry);
        this.sendAuditLogToBackend(auditEntry);

        return auditEntry;
    }

    /**
     * 获取浏览器指纹
     */
    getBrowserFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Browser fingerprint', 2, 2);
        
        return btoa(JSON.stringify({
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            canvas: canvas.toDataURL()
        })).substring(0, 32);
    }

    /**
     * 计算操作风险分数
     */
    calculateRiskScore(operation, resource, details) {
        let score = 0;

        // 基础操作风险
        const operationRisk = {
            'read': 1,
            'create': 2,
            'update': 3,
            'delete': 5,
            'admin': 8,
            'export': 4,
            'import': 6
        };
        score += operationRisk[operation] || 2;

        // 资源敏感性
        if (resource && resource.includes('config')) score += 2;
        if (resource && resource.includes('security')) score += 3;
        if (resource && resource.includes('admin')) score += 4;

        // 时间因素
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) score += 3;

        // 频率因素
        const recentSimilarOps = this.operationLog.filter(log => 
            log.operation === operation &&
            Date.now() - new Date(log.timestamp).getTime() < 10 * 60 * 1000
        );
        score += Math.min(recentSimilarOps.length, 5);

        return Math.min(score, 10);
    }

    /**
     * 发送审计日志到后端
     */
    async sendAuditLogToBackend(auditEntry) {
        try {
            await fetch('/api/v1/audit/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify(auditEntry)
            });
        } catch (error) {
            console.warn('Failed to send audit log to backend:', error);
            // 存储到本地存储作为备份
            this.storeAuditLogLocally(auditEntry);
        }
    }

    /**
     * 本地存储审计日志
     */
    storeAuditLogLocally(auditEntry) {
        try {
            const localLogs = JSON.parse(localStorage.getItem('audit_logs_backup') || '[]');
            localLogs.push(auditEntry);
            
            // 保持最近1000条记录
            if (localLogs.length > 1000) {
                localLogs.splice(0, localLogs.length - 1000);
            }
            
            localStorage.setItem('audit_logs_backup', JSON.stringify(localLogs));
        } catch (error) {
            console.warn('Failed to store audit log locally:', error);
        }
    }

    /**
     * 获取本地备份的审计日志
     */
    getLocalAuditLogs() {
        try {
            return JSON.parse(localStorage.getItem('audit_logs_backup') || '[]');
        } catch (error) {
            console.warn('Failed to retrieve local audit logs:', error);
            return [];
        }
    }

    /**
     * 自动清理会话和缓存
     */
    performSecurityCleanup() {
        // 清理敏感数据
        const sensitiveKeys = ['password', 'token', 'secret', 'key'];
        for (const key of sensitiveKeys) {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        }

        // 清理过期的操作日志
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24小时前
        this.operationLog = this.operationLog.filter(log => 
            new Date(log.timestamp).getTime() > cutoff
        );

        // 清理DOM中的敏感信息
        const inputs = document.querySelectorAll('input[type="password"], input[data-sensitive="true"]');
        inputs.forEach(input => {
            if (input.value) {
                input.value = '';
            }
        });

        this.logOperation('security_cleanup', 'system', { 
            clearedItems: sensitiveKeys.length,
            clearedLogs: this.operationLog.length 
        });
    }

    /**
     * 强制会话过期
     */
    forceSessionExpiry(reason = 'manual') {
        this.performSecurityCleanup();
        this.logOperation('forced_session_expiry', 'security', { reason });
        this.clearSession();
        
        // 触发会话过期事件
        window.dispatchEvent(new CustomEvent('sessionExpired', { 
            detail: { reason, forced: true } 
        }));
    }

    /**
     * 获取安全状态报告
     */
    getSecurityStatusReport() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        const recentLogs = this.operationLog.filter(log => 
            new Date(log.timestamp).getTime() > oneHourAgo
        );
        const dailyLogs = this.operationLog.filter(log => 
            new Date(log.timestamp).getTime() > oneDayAgo
        );

        return {
            sessionInfo: {
                isActive: !!this.currentUser,
                sessionId: this.currentUser?.sessionId,
                lastActivity: new Date(this.lastActivity).toISOString(),
                timeUntilExpiry: this.sessionTimeout - (now - this.lastActivity)
            },
            securityMetrics: {
                totalOperations: this.operationLog.length,
                recentOperations: recentLogs.length,
                dailyOperations: dailyLogs.length,
                failedOperations: recentLogs.filter(log => !log.success).length,
                blockedIPs: this.blockedIPs.size,
                failedAttempts: this.failedAttempts.size
            },
            riskAssessment: {
                currentRiskLevel: this.calculateCurrentRiskLevel(),
                anomalies: this.detectAnomalousAccess(),
                recommendations: this.getSecurityRecommendations()
            }
        };
    }

    /**
     * 计算当前风险级别
     */
    calculateCurrentRiskLevel() {
        const anomalies = this.detectAnomalousAccess();
        const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
        const mediumSeverityCount = anomalies.filter(a => a.severity === 'medium').length;

        if (highSeverityCount > 0) return 'high';
        if (mediumSeverityCount > 2) return 'medium';
        return 'low';
    }

    /**
     * 获取安全建议
     */
    getSecurityRecommendations() {
        const recommendations = [];
        const anomalies = this.detectAnomalousAccess();

        if (anomalies.length > 0) {
            recommendations.push('检测到安全异常，建议检查最近的操作日志');
        }

        if (this.sessionTimeout > 30 * 60 * 1000) {
            recommendations.push('建议缩短会话超时时间以提高安全性');
        }

        if (this.operationLog.filter(log => !log.success).length > 10) {
            recommendations.push('检测到较多失败操作，建议检查系统状态');
        }

        return recommendations;
    }

    /**
     * 高级敏感信息脱敏处理
     */
    advancedDataMasking(data, maskingLevel = 'standard') {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const maskedData = Array.isArray(data) ? [] : {};
        
        for (const [key, value] of Object.entries(data)) {
            if (this.isSensitiveField(key)) {
                maskedData[key] = this.maskFieldValue(value, key, maskingLevel);
            } else if (typeof value === 'object' && value !== null) {
                maskedData[key] = this.advancedDataMasking(value, maskingLevel);
            } else {
                maskedData[key] = this.sanitizeNonSensitiveValue(value);
            }
        }

        return maskedData;
    }

    /**
     * 检查字段是否为敏感字段
     */
    isSensitiveField(fieldName) {
        const lowerFieldName = fieldName.toLowerCase();
        return SENSITIVE_FIELDS.some(sensitiveField => 
            lowerFieldName.includes(sensitiveField.toLowerCase())
        );
    }

    /**
     * 根据脱敏级别处理字段值
     */
    maskFieldValue(value, fieldName, level) {
        if (!value || typeof value !== 'string') {
            return '[MASKED]';
        }

        const lowerFieldName = fieldName.toLowerCase();
        
        switch (level) {
            case 'minimal':
                // 最小脱敏，保留更多信息
                if (lowerFieldName.includes('email')) {
                    return this.maskEmail(value);
                } else if (lowerFieldName.includes('phone')) {
                    return this.maskPhone(value);
                } else if (lowerFieldName.includes('ip') || lowerFieldName.includes('address')) {
                    return this.maskIPAddress(value);
                } else {
                    return this.partialMask(value, 0.3); // 显示30%
                }
                
            case 'standard':
                // 标准脱敏
                if (lowerFieldName.includes('password') || lowerFieldName.includes('secret')) {
                    return '[REDACTED]';
                } else if (lowerFieldName.includes('token') || lowerFieldName.includes('key')) {
                    return this.partialMask(value, 0.1); // 显示10%
                } else {
                    return this.partialMask(value, 0.2); // 显示20%
                }
                
            case 'strict':
                // 严格脱敏，完全隐藏
                return '[CLASSIFIED]';
                
            default:
                return this.partialMask(value, 0.2);
        }
    }

    /**
     * 部分脱敏，保留指定比例的字符
     */
    partialMask(value, visibleRatio) {
        if (!value || value.length <= 2) {
            return '*'.repeat(value.length);
        }

        const visibleCount = Math.max(1, Math.floor(value.length * visibleRatio));
        const startVisible = Math.floor(visibleCount / 2);
        const endVisible = visibleCount - startVisible;
        
        const start = value.substring(0, startVisible);
        const end = value.substring(value.length - endVisible);
        const middle = '*'.repeat(value.length - startVisible - endVisible);
        
        return start + middle + end;
    }

    /**
     * 邮箱脱敏
     */
    maskEmail(email) {
        const atIndex = email.indexOf('@');
        if (atIndex === -1) return this.partialMask(email, 0.2);
        
        const username = email.substring(0, atIndex);
        const domain = email.substring(atIndex);
        
        const maskedUsername = username.length > 2 
            ? username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
            : '*'.repeat(username.length);
            
        return maskedUsername + domain;
    }

    /**
     * 电话号码脱敏
     */
    maskPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 4) return '*'.repeat(phone.length);
        
        const start = cleaned.substring(0, 3);
        const end = cleaned.substring(cleaned.length - 2);
        const middle = '*'.repeat(cleaned.length - 5);
        
        return start + middle + end;
    }

    /**
     * IP地址脱敏
     */
    maskIPAddress(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return this.partialMask(ip, 0.3);
        
        return `${parts[0]}.${parts[1]}.*.***`;
    }

    /**
     * 清理非敏感值中的潜在危险内容
     */
    sanitizeNonSensitiveValue(value) {
        if (typeof value !== 'string') return value;
        
        // 移除潜在的脚本内容
        let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]');
        
        // 移除潜在的SQL注入内容
        if (this.detectSQLInjection(sanitized)) {
            sanitized = '[POTENTIAL_SQL_INJECTION_REMOVED]';
        }
        
        return sanitized;
    }

    /**
     * 数据导出时的隐私保护处理
     */
    privacyProtectedExport(data, exportOptions = {}) {
        const {
            maskingLevel = 'standard',
            includeMetadata = true,
            encryptSensitive = false,
            auditExport = true
        } = exportOptions;

        // 深度脱敏处理
        const maskedData = this.advancedDataMasking(data, maskingLevel);

        // 添加导出元数据
        const exportPackage = {
            data: maskedData,
            ...(includeMetadata && {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    exportedBy: this.currentUser?.name || 'Unknown',
                    exportId: this.generateExportId(),
                    maskingLevel,
                    dataIntegrity: this.calculateDataHash(maskedData),
                    privacyCompliance: {
                        gdprCompliant: true,
                        dataMinimization: true,
                        purposeLimitation: 'System configuration export',
                        retentionPeriod: '30 days'
                    }
                }
            })
        };

        // 记录导出操作
        if (auditExport) {
            this.logOperation('privacy_protected_export', 'data_export', {
                exportId: exportPackage.metadata?.exportId,
                maskingLevel,
                recordCount: Array.isArray(maskedData) ? maskedData.length : 1,
                sensitiveFieldsProcessed: this.countSensitiveFields(data)
            });
        }

        return exportPackage;
    }

    /**
     * 生成导出ID
     */
    generateExportId() {
        return 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    /**
     * 计算数据哈希值用于完整性验证
     */
    calculateDataHash(data) {
        const dataString = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    /**
     * 统计敏感字段数量
     */
    countSensitiveFields(data, count = 0) {
        if (!data || typeof data !== 'object') return count;
        
        for (const [key, value] of Object.entries(data)) {
            if (this.isSensitiveField(key)) {
                count++;
            }
            if (typeof value === 'object' && value !== null) {
                count = this.countSensitiveFields(value, count);
            }
        }
        
        return count;
    }

    /**
     * 异常访问检测增强版
     */
    detectPrivacyViolations() {
        const violations = [];
        const recentLogs = this.getOperationLogs({
            startTime: new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
        });

        // 检测频繁的敏感数据访问
        const sensitiveAccess = recentLogs.filter(log => 
            log.operation === 'reveal_sensitive_data' || 
            log.resource?.includes('sensitive') ||
            log.details?.sensitive === true
        );

        if (sensitiveAccess.length > 10) {
            violations.push({
                type: 'excessive_sensitive_access',
                count: sensitiveAccess.length,
                message: '检测到异常的敏感数据访问频率',
                severity: 'high',
                recommendation: '建议审查用户权限和访问需求'
            });
        }

        // 检测大量数据导出
        const exportOps = recentLogs.filter(log => 
            log.operation.includes('export') || log.operation.includes('download')
        );

        if (exportOps.length > 5) {
            violations.push({
                type: 'excessive_data_export',
                count: exportOps.length,
                message: '检测到异常的数据导出活动',
                severity: 'medium',
                recommendation: '建议检查导出数据的合规性'
            });
        }

        // 检测跨时区访问异常
        const nightOps = recentLogs.filter(log => {
            const hour = new Date(log.timestamp).getHours();
            return (hour < 6 || hour > 22) && log.operation !== 'session_expired';
        });

        if (nightOps.length > 3) {
            violations.push({
                type: 'unusual_time_access',
                count: nightOps.length,
                message: '检测到非工作时间的异常访问',
                severity: 'medium',
                recommendation: '建议验证访问的合法性'
            });
        }

        // 检测权限提升尝试
        const privilegeOps = recentLogs.filter(log => 
            log.operation === 'permission_check' && 
            log.details?.granted === false
        );

        if (privilegeOps.length > 8) {
            violations.push({
                type: 'privilege_escalation_attempts',
                count: privilegeOps.length,
                message: '检测到可能的权限提升尝试',
                severity: 'high',
                recommendation: '建议立即审查用户活动和权限设置'
            });
        }

        return violations;
    }

    /**
     * 隐私合规性检查
     */
    checkPrivacyCompliance() {
        const compliance = {
            gdpr: {
                dataMinimization: true,
                purposeLimitation: true,
                storageMinimization: true,
                userConsent: false, // 需要实现用户同意机制
                rightToErasure: true,
                dataPortability: true,
                score: 0.83
            },
            ccpa: {
                transparentDataPractices: true,
                userRights: true,
                dataSecurityMeasures: true,
                thirdPartyDisclosure: false,
                score: 0.75
            },
            general: {
                dataEncryption: false, // 前端不加密存储
                accessLogging: true,
                dataRetention: true,
                incidentResponse: true,
                score: 0.75
            }
        };

        // 计算总体合规分数
        const totalScore = (compliance.gdpr.score + compliance.ccpa.score + compliance.general.score) / 3;
        
        return {
            ...compliance,
            overallScore: Math.round(totalScore * 100),
            recommendations: this.getComplianceRecommendations(compliance)
        };
    }

    /**
     * 获取合规性建议
     */
    getComplianceRecommendations(compliance) {
        const recommendations = [];

        if (!compliance.gdpr.userConsent) {
            recommendations.push('实施用户同意管理机制以符合GDPR要求');
        }

        if (!compliance.ccpa.thirdPartyDisclosure) {
            recommendations.push('建立第三方数据共享披露机制');
        }

        if (!compliance.general.dataEncryption) {
            recommendations.push('考虑对敏感数据进行客户端加密');
        }

        return recommendations;
    }

    /**
     * 用户教育和安全提示
     */
    showSecurityEducation(context = 'general') {
        const educationContent = {
            general: {
                title: '数据安全提示',
                content: [
                    '请勿在公共场所输入敏感信息',
                    '定期更改密码并使用强密码',
                    '注意识别钓鱼攻击和社会工程',
                    '及时报告可疑活动'
                ],
                icon: '🛡️'
            },
            sensitive_data: {
                title: '敏感数据处理提醒',
                content: [
                    '您正在访问敏感信息，请确保环境安全',
                    '不要截图或复制敏感数据到不安全的位置',
                    '使用完毕后请及时关闭相关页面',
                    '如发现数据异常请立即报告'
                ],
                icon: '🔐'
            },
            export: {
                title: '数据导出安全须知',
                content: [
                    '导出的数据已进行脱敏处理',
                    '请妥善保管导出文件，避免泄露',
                    '不要将导出文件发送给未授权人员',
                    '建议在安全环境中处理导出数据'
                ],
                icon: '📤'
            },
            privacy: {
                title: '隐私保护提醒',
                content: [
                    '系统会记录您的操作以确保安全',
                    '个人信息将按照隐私政策处理',
                    '您有权查看和删除个人数据',
                    '如有隐私问题请联系管理员'
                ],
                icon: '🔒'
            }
        };

        const education = educationContent[context] || educationContent.general;
        
        this.showEducationDialog(education);
        
        // 记录教育提示显示
        this.logOperation('security_education_shown', 'user_education', {
            context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 显示教育对话框
     */
    showEducationDialog(education) {
        const dialog = document.createElement('div');
        dialog.className = 'security-education-overlay';
        dialog.innerHTML = `
            <div class="security-education-dialog">
                <div class="education-header">
                    <span class="education-icon">${education.icon}</span>
                    <h3>${education.title}</h3>
                </div>
                <div class="education-content">
                    <ul>
                        ${education.content.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                <div class="education-actions">
                    <label class="dont-show-again">
                        <input type="checkbox" id="dontShowAgain">
                        不再显示此提示
                    </label>
                    <button class="btn-primary understand-btn">我已了解</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const understandBtn = dialog.querySelector('.understand-btn');
        const dontShowCheckbox = dialog.querySelector('#dontShowAgain');

        understandBtn.addEventListener('click', () => {
            if (dontShowCheckbox.checked) {
                localStorage.setItem(`security_education_${education.title}`, 'dismissed');
            }
            document.body.removeChild(dialog);
            
            this.logOperation('security_education_acknowledged', 'user_education', {
                title: education.title,
                dontShowAgain: dontShowCheckbox.checked
            });
        });

        // 自动关闭（30秒后）
        setTimeout(() => {
            if (dialog.parentElement) {
                document.body.removeChild(dialog);
            }
        }, 30000);
    }

    /**
     * 检查是否应该显示教育提示
     */
    shouldShowEducation(context) {
        const key = `security_education_${context}`;
        return !localStorage.getItem(key);
    }

    /**
     * 数据泄露检测
     */
    detectDataLeakage() {
        const leakageIndicators = [];
        
        // 检查是否有大量敏感数据被访问
        const recentSensitiveAccess = this.operationLog.filter(log => 
            log.operation === 'reveal_sensitive_data' &&
            Date.now() - new Date(log.timestamp).getTime() < 10 * 60 * 1000 // 10分钟内
        );

        if (recentSensitiveAccess.length > 5) {
            leakageIndicators.push({
                type: 'rapid_sensitive_access',
                severity: 'high',
                count: recentSensitiveAccess.length,
                message: '短时间内大量敏感数据被访问'
            });
        }

        // 检查异常的复制操作
        const copyOperations = this.operationLog.filter(log => 
            log.operation.includes('copy') || log.operation.includes('clipboard')
        );

        if (copyOperations.length > 10) {
            leakageIndicators.push({
                type: 'excessive_copy_operations',
                severity: 'medium',
                count: copyOperations.length,
                message: '检测到异常的复制操作'
            });
        }

        return leakageIndicators;
    }

    /**
     * 生成隐私影响评估报告
     */
    generatePrivacyImpactAssessment() {
        const assessment = {
            timestamp: new Date().toISOString(),
            assessmentId: this.generateAssessmentId(),
            dataProcessing: {
                personalDataTypes: ['用户凭据', '系统配置', '操作日志'],
                processingPurposes: ['系统管理', '安全监控', '故障排除'],
                dataSubjects: ['系统管理员', '操作人员'],
                legalBasis: '合法利益'
            },
            riskAssessment: {
                identifiedRisks: this.identifyPrivacyRisks(),
                riskLevel: this.calculateOverallRiskLevel(),
                mitigationMeasures: this.getMitigationMeasures()
            },
            compliance: this.checkPrivacyCompliance(),
            recommendations: this.getPrivacyRecommendations()
        };

        // 记录评估生成
        this.logOperation('privacy_impact_assessment', 'compliance', {
            assessmentId: assessment.assessmentId,
            riskLevel: assessment.riskAssessment.riskLevel
        });

        return assessment;
    }

    /**
     * 生成评估ID
     */
    generateAssessmentId() {
        return 'pia_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * 识别隐私风险
     */
    identifyPrivacyRisks() {
        const risks = [];
        
        // 检查数据存储风险
        if (this.operationLog.some(log => log.details && typeof log.details === 'object')) {
            risks.push({
                category: '数据存储',
                risk: '操作日志可能包含敏感信息',
                likelihood: 'medium',
                impact: 'medium'
            });
        }

        // 检查访问控制风险
        const failedPermissionChecks = this.operationLog.filter(log => 
            log.operation === 'permission_check' && log.details?.granted === false
        );

        if (failedPermissionChecks.length > 0) {
            risks.push({
                category: '访问控制',
                risk: '存在未授权访问尝试',
                likelihood: 'low',
                impact: 'high'
            });
        }

        return risks;
    }

    /**
     * 计算总体风险级别
     */
    calculateOverallRiskLevel() {
        const risks = this.identifyPrivacyRisks();
        const violations = this.detectPrivacyViolations();
        
        const highRiskCount = risks.filter(r => r.impact === 'high').length;
        const highViolationCount = violations.filter(v => v.severity === 'high').length;
        
        if (highRiskCount > 0 || highViolationCount > 0) {
            return 'high';
        } else if (risks.length > 2 || violations.length > 1) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 获取缓解措施
     */
    getMitigationMeasures() {
        return [
            '实施数据最小化原则',
            '定期清理过期日志',
            '加强访问控制验证',
            '实施数据脱敏处理',
            '建立事件响应机制',
            '定期进行安全培训'
        ];
    }

    /**
     * 获取隐私建议
     */
    getPrivacyRecommendations() {
        const recommendations = [];
        const compliance = this.checkPrivacyCompliance();
        
        if (compliance.overallScore < 80) {
            recommendations.push('提高隐私合规性评分，当前分数: ' + compliance.overallScore);
        }
        
        const violations = this.detectPrivacyViolations();
        if (violations.length > 0) {
            recommendations.push('处理检测到的隐私违规问题');
        }
        
        const leakage = this.detectDataLeakage();
        if (leakage.length > 0) {
            recommendations.push('调查潜在的数据泄露风险');
        }
        
        return recommendations;
    }
}

// 创建全局安全服务实例
const securityService = new SecurityService();

export default securityService;
export { PERMISSION_LEVELS, VALIDATION_RULES };