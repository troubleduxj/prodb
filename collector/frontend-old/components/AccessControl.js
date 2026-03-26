/**
 * 访问控制组件 - 提供权限验证和访问控制功能
 * 增强版本包含XSS防护、输入验证、会话管理和审计功能
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import securityService, { PERMISSION_LEVELS } from '../services/security.js';

/**
 * 权限保护组件 - 根据权限显示或隐藏内容
 */
const ProtectedComponent = ({ 
    requiredPermission, 
    resource = null,
    fallback = null,
    children,
    enableAudit = true,
    context = {}
}) => {
    const [hasPermission, setHasPermission] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [securityStatus, setSecurityStatus] = useState('checking');

    useEffect(() => {
        checkPermission();
    }, [requiredPermission, resource]);

    const checkPermission = async () => {
        setIsChecking(true);
        setSecurityStatus('checking');
        
        try {
            // 使用增强的权限检查
            const permitted = securityService.checkPermissionEnhanced(
                requiredPermission, 
                resource, 
                context
            );
            
            setHasPermission(permitted);
            setSecurityStatus(permitted ? 'granted' : 'denied');
            
            // 记录权限检查（如果启用审计）
            if (enableAudit) {
                securityService.logOperation('permission_check', resource || 'component', {
                    requiredPermission,
                    granted: permitted,
                    context
                });
            }
        } catch (error) {
            console.error('Permission check failed:', error);
            setHasPermission(false);
            setSecurityStatus('error');
            
            securityService.logFailedOperation('permission_check', resource || 'component', error, {
                requiredPermission,
                context
            });
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return html`
            <div class="permission-checking">
                <div class="checking-spinner"></div>
                <span>验证权限中...</span>
            </div>
        `;
    }

    if (!hasPermission) {
        return fallback || html`
            <div class="permission-denied ${securityStatus}">
                <div class="denied-icon">🔒</div>
                <h4>访问受限</h4>
                <p>您没有权限访问此功能</p>
                <div class="permission-details">
                    <small>需要权限: <code>${requiredPermission}</code></small>
                    ${resource && html`<small>资源: <code>${resource}</code></small>`}
                </div>
                ${securityStatus === 'error' && html`
                    <div class="error-notice">
                        <small>权限验证时发生错误，请联系管理员</small>
                    </div>
                `}
            </div>
        `;
    }

    return children;
};

/**
 * 操作按钮权限包装器
 */
const ProtectedButton = ({ 
    requiredPermission, 
    resource = null,
    operation,
    confirmMessage = null,
    onClick,
    children,
    className = 'btn-primary',
    disabled = false,
    ...props 
}) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleClick = async (e) => {
        e.preventDefault();
        
        if (disabled || isProcessing) {
            return;
        }

        setIsProcessing(true);

        try {
            // 检查权限
            const hasPermission = securityService.checkPermission(requiredPermission, resource);
            
            if (!hasPermission) {
                alert('您没有权限执行此操作');
                securityService.logFailedOperation('unauthorized_access', resource, 
                    new Error('Insufficient permissions'), { 
                        requiredPermission, 
                        operation 
                    });
                return;
            }

            // 安全确认（如果需要）
            let confirmed = true;
            if (confirmMessage) {
                confirmed = await securityService.requestSecurityConfirmation(
                    operation, 
                    resource, 
                    confirmMessage
                );
            }

            if (confirmed && onClick) {
                await onClick(e);
            }

        } catch (error) {
            console.error('Protected button action failed:', error);
            securityService.logFailedOperation(operation, resource, error);
        } finally {
            setIsProcessing(false);
        }
    };

    return html`
        <${ProtectedComponent} requiredPermission=${requiredPermission} resource=${resource}>
            <button 
                class=${className}
                onClick=${handleClick}
                disabled=${disabled || isProcessing}
                ...${props}
            >
                ${isProcessing ? '处理中...' : children}
            </button>
        <//>
    `;
};

/**
 * 会话管理组件
 */
const SessionManager = () => {
    const [sessionInfo, setSessionInfo] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(0);

    useEffect(() => {
        updateSessionInfo();
        
        const interval = setInterval(() => {
            updateSessionInfo();
        }, 1000);

        // 监听会话过期事件
        const handleSessionExpired = () => {
            alert('会话已过期，请重新登录');
            window.location.reload();
        };

        window.addEventListener('sessionExpired', handleSessionExpired);

        return () => {
            clearInterval(interval);
            window.removeEventListener('sessionExpired', handleSessionExpired);
        };
    }, []);

    const updateSessionInfo = () => {
        const user = securityService.currentUser;
        if (user) {
            const remaining = Math.max(0, 
                securityService.sessionTimeout - (Date.now() - securityService.lastActivity)
            );
            
            setSessionInfo(user);
            setTimeRemaining(remaining);
        }
    };

    const formatTimeRemaining = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const extendSession = () => {
        securityService.updateActivity();
        securityService.logOperation('session_extended', 'system');
        updateSessionInfo();
    };

    if (!sessionInfo) {
        return null;
    }

    const isExpiringSoon = timeRemaining < 5 * 60 * 1000; // 5分钟

    return html`
        <div class="session-manager ${isExpiringSoon ? 'expiring-soon' : ''}">
            <div class="session-info">
                <span class="user-name">${sessionInfo.name}</span>
                <span class="session-time">
                    剩余: ${formatTimeRemaining(timeRemaining)}
                </span>
            </div>
            
            ${isExpiringSoon && html`
                <button class="btn-warning btn-sm" onClick=${extendSession}>
                    延长会话
                </button>
            `}
        </div>
    `;
};

/**
 * 权限管理面板
 */
const PermissionPanel = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [anomalies, setAnomalies] = useState([]);

    useEffect(() => {
        setCurrentUser(securityService.currentUser);
        checkAnomalies();
        
        const interval = setInterval(checkAnomalies, 60000); // 每分钟检查一次
        return () => clearInterval(interval);
    }, []);

    const checkAnomalies = () => {
        const detected = securityService.detectAnomalousAccess();
        setAnomalies(detected);
    };

    return html`
        <div class="permission-panel">
            <div class="panel-header">
                <h3>安全状态</h3>
            </div>

            <!-- 用户信息 -->
            ${currentUser && html`
                <div class="user-info-section">
                    <h4>当前用户</h4>
                    <div class="user-details">
                        <div class="detail-row">
                            <span class="label">用户名:</span>
                            <span class="value">${currentUser.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">用户ID:</span>
                            <span class="value">${currentUser.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">会话ID:</span>
                            <span class="value">${currentUser.sessionId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">登录时间:</span>
                            <span class="value">${new Date(currentUser.loginTime).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `}

            <!-- 权限列表 -->
            ${currentUser && html`
                <div class="permissions-section">
                    <h4>用户权限</h4>
                    <div class="permissions-list">
                        ${currentUser.permissions.map(permission => html`
                            <div key=${permission} class="permission-item">
                                <span class="permission-icon">✓</span>
                                <span class="permission-name">${permission}</span>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- 异常检测 -->
            <div class="anomalies-section">
                <h4>安全异常</h4>
                ${anomalies.length > 0 ? html`
                    <div class="anomalies-list">
                        ${anomalies.map((anomaly, index) => html`
                            <div key=${index} class="anomaly-item ${anomaly.type}">
                                <div class="anomaly-icon">⚠</div>
                                <div class="anomaly-content">
                                    <div class="anomaly-message">${anomaly.message}</div>
                                    <div class="anomaly-details">
                                        类型: ${anomaly.type}, 次数: ${anomaly.count}
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                ` : html`
                    <div class="no-anomalies">
                        <span class="success-icon">✓</span>
                        <span>未检测到异常活动</span>
                    </div>
                `}
            </div>

            <!-- 会话管理 -->
            <${SessionManager} />
        </div>
    `;
};

/**
 * 敏感信息显示组件
 */
const SensitiveDataDisplay = ({ 
    data, 
    fieldName, 
    showMasked = true,
    allowReveal = true 
}) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        // 检查是否有查看敏感信息的权限
        const permitted = securityService.checkPermission('read', 'sensitive_data');
        setHasPermission(permitted);
    }, []);

    const toggleReveal = async () => {
        if (!hasPermission) {
            alert('您没有权限查看敏感信息');
            return;
        }

        if (!isRevealed) {
            // 请求安全确认
            const confirmed = await securityService.requestSecurityConfirmation(
                'reveal_sensitive_data',
                fieldName,
                `确认要显示敏感字段 "${fieldName}" 的完整内容吗？`
            );

            if (confirmed) {
                setIsRevealed(true);
                securityService.logOperation('reveal_sensitive_data', fieldName);
            }
        } else {
            setIsRevealed(false);
            securityService.logOperation('hide_sensitive_data', fieldName);
        }
    };

    const displayValue = isRevealed ? data : securityService.maskSensitiveData({ [fieldName]: data })[fieldName];

    return html`
        <div class="sensitive-data-display">
            <span class="sensitive-value ${isRevealed ? 'revealed' : 'masked'}">
                ${displayValue}
            </span>
            
            ${allowReveal && hasPermission && html`
                <button 
                    class="btn-link reveal-btn" 
                    onClick=${toggleReveal}
                    title=${isRevealed ? '隐藏' : '显示完整内容'}
                >
                    ${isRevealed ? '👁️‍🗨️' : '👁️'}
                </button>
            `}
            
            ${!hasPermission && html`
                <span class="no-permission-indicator" title="无权限查看">🔒</span>
            `}
        </div>
    `;
};

/**
 * 安全输入组件 - 带有XSS防护和输入验证
 */
const SecureInput = ({
    type = 'text',
    value = '',
    onChange,
    onSecurityIssue,
    placeholder = '',
    className = '',
    required = false,
    sensitive = false,
    maxLength = 1000,
    pattern = null,
    validateOnChange = true,
    ...props
}) => {
    const [inputValue, setInputValue] = useState(value);
    const [securityIssues, setSecurityIssues] = useState([]);
    const [isValid, setIsValid] = useState(true);
    const inputRef = useRef(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const validateInput = (val) => {
        const validation = securityService.validateInputSecurity(val, props.name || 'input');
        setSecurityIssues(validation.issues);
        setIsValid(validation.isSecure);

        if (!validation.isSecure && onSecurityIssue) {
            onSecurityIssue(validation.issues);
        }

        return validation.isSecure;
    };

    const handleChange = (e) => {
        let newValue = e.target.value;

        // 长度限制
        if (newValue.length > maxLength) {
            newValue = newValue.substring(0, maxLength);
        }

        // 实时验证（如果启用）
        if (validateOnChange) {
            validateInput(newValue);
        }

        // 清理输入（对于非敏感字段）
        if (!sensitive) {
            newValue = securityService.sanitizeInput(newValue);
        }

        setInputValue(newValue);

        if (onChange) {
            onChange({
                ...e,
                target: {
                    ...e.target,
                    value: newValue
                }
            });
        }
    };

    const handleBlur = (e) => {
        // 失焦时进行完整验证
        validateInput(inputValue);
        
        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    const handlePaste = (e) => {
        // 检查粘贴内容的安全性
        const pastedText = e.clipboardData.getData('text');
        const validation = securityService.validateInputSecurity(pastedText, 'paste');
        
        if (!validation.isSecure) {
            e.preventDefault();
            alert('粘贴的内容包含潜在的安全风险，已被阻止');
            securityService.logFailedOperation('paste_blocked', 'input', 
                new Error('Unsafe paste content'), { issues: validation.issues });
            return;
        }
    };

    return html`
        <div class="secure-input-wrapper">
            <input
                ref=${inputRef}
                type=${type}
                value=${inputValue}
                onChange=${handleChange}
                onBlur=${handleBlur}
                onPaste=${handlePaste}
                placeholder=${placeholder}
                className=${`secure-input ${className} ${!isValid ? 'has-security-issues' : ''}`}
                required=${required}
                maxLength=${maxLength}
                pattern=${pattern}
                data-sensitive=${sensitive}
                ...${props}
            />
            
            ${securityIssues.length > 0 && html`
                <div class="security-issues">
                    ${securityIssues.map((issue, index) => html`
                        <div key=${index} class="security-issue ${issue.type}">
                            <span class="issue-icon">⚠️</span>
                            <span class="issue-message">${issue.message}</span>
                        </div>
                    `)}
                </div>
            `}
            
            ${sensitive && html`
                <div class="sensitive-indicator" title="敏感信息字段">
                    🔐
                </div>
            `}
        </div>
    `;
};

/**
 * 安全表单组件 - 带有CSRF保护和输入验证
 */
const SecureForm = ({
    onSubmit,
    onSecurityIssue,
    enableCSRF = true,
    validateOnSubmit = true,
    children,
    className = '',
    ...props
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formSecurityIssues, setFormSecurityIssues] = useState([]);
    const formRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        setFormSecurityIssues([]);

        try {
            const formData = new FormData(formRef.current);
            const data = Object.fromEntries(formData.entries());

            // 验证表单数据安全性
            if (validateOnSubmit) {
                const allIssues = [];
                
                for (const [key, value] of Object.entries(data)) {
                    const validation = securityService.validateInputSecurity(value, key);
                    if (!validation.isSecure) {
                        allIssues.push(...validation.issues);
                    }
                }

                if (allIssues.length > 0) {
                    setFormSecurityIssues(allIssues);
                    if (onSecurityIssue) {
                        onSecurityIssue(allIssues);
                    }
                    return;
                }
            }

            // 添加CSRF令牌
            if (enableCSRF) {
                data._csrf = securityService.csrfToken;
            }

            // 深度清理数据
            const sanitizedData = securityService.deepSanitize(data);

            // 记录表单提交
            securityService.logOperation('form_submit', 'secure_form', {
                fields: Object.keys(sanitizedData),
                csrfEnabled: enableCSRF
            });

            if (onSubmit) {
                await onSubmit(sanitizedData, e);
            }

        } catch (error) {
            console.error('Secure form submission failed:', error);
            securityService.logFailedOperation('form_submit', 'secure_form', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return html`
        <form
            ref=${formRef}
            onSubmit=${handleSubmit}
            className=${`secure-form ${className}`}
            ...${props}
        >
            ${formSecurityIssues.length > 0 && html`
                <div class="form-security-issues">
                    <h4>表单安全问题</h4>
                    ${formSecurityIssues.map((issue, index) => html`
                        <div key=${index} class="security-issue ${issue.type}">
                            <span class="issue-field">${issue.field}:</span>
                            <span class="issue-message">${issue.message}</span>
                        </div>
                    `)}
                </div>
            `}
            
            ${children}
            
            ${enableCSRF && html`
                <input type="hidden" name="_csrf" value=${securityService.csrfToken} />
            `}
        </form>
    `;
};

/**
 * 安全操作日志查看器
 */
const SecurityAuditViewer = ({ 
    maxEntries = 100,
    showFilters = true,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    const [logs, setLogs] = useState([]);
    const [filters, setFilters] = useState({
        operation: '',
        user: '',
        success: '',
        startTime: '',
        endTime: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadLogs();
        
        if (autoRefresh) {
            const interval = setInterval(loadLogs, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [filters, autoRefresh, refreshInterval]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const auditLogs = securityService.getOperationLogs(filters);
            setLogs(auditLogs.slice(0, maxEntries));
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const exportLogs = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            filters,
            logs: logs.map(log => securityService.sanitizeLogDetails(log))
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-audit-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        securityService.logOperation('audit_export', 'security', {
            entriesCount: logs.length,
            filters
        });
    };

    return html`
        <div class="security-audit-viewer">
            <div class="audit-header">
                <h3>安全审计日志</h3>
                <div class="audit-actions">
                    <button class="btn-secondary" onClick=${loadLogs} disabled=${isLoading}>
                        ${isLoading ? '加载中...' : '刷新'}
                    </button>
                    <button class="btn-primary" onClick=${exportLogs}>
                        导出日志
                    </button>
                </div>
            </div>

            ${showFilters && html`
                <div class="audit-filters">
                    <div class="filter-row">
                        <select 
                            value=${filters.operation}
                            onChange=${(e) => handleFilterChange('operation', e.target.value)}
                        >
                            <option value="">所有操作</option>
                            <option value="create">创建</option>
                            <option value="update">更新</option>
                            <option value="delete">删除</option>
                            <option value="read">读取</option>
                            <option value="admin">管理</option>
                        </select>

                        <select 
                            value=${filters.success}
                            onChange=${(e) => handleFilterChange('success', e.target.value)}
                        >
                            <option value="">所有结果</option>
                            <option value="true">成功</option>
                            <option value="false">失败</option>
                        </select>

                        <input
                            type="datetime-local"
                            value=${filters.startTime}
                            onChange=${(e) => handleFilterChange('startTime', e.target.value)}
                            placeholder="开始时间"
                        />

                        <input
                            type="datetime-local"
                            value=${filters.endTime}
                            onChange=${(e) => handleFilterChange('endTime', e.target.value)}
                            placeholder="结束时间"
                        />
                    </div>
                </div>
            `}

            <div class="audit-logs">
                ${logs.length === 0 ? html`
                    <div class="no-logs">
                        ${isLoading ? '加载中...' : '暂无日志记录'}
                    </div>
                ` : html`
                    <div class="logs-list">
                        ${logs.map(log => html`
                            <div key=${log.id} class="log-entry ${log.result}">
                                <div class="log-header">
                                    <span class="log-timestamp">
                                        ${new Date(log.timestamp).toLocaleString()}
                                    </span>
                                    <span class="log-operation">${log.operation}</span>
                                    <span class="log-result ${log.result}">${log.result}</span>
                                </div>
                                <div class="log-details">
                                    <div class="log-user">
                                        用户: ${log.user?.name || 'Unknown'}
                                    </div>
                                    <div class="log-resource">
                                        资源: ${log.resource || 'N/A'}
                                    </div>
                                    ${log.riskScore && html`
                                        <div class="log-risk">
                                            风险分数: ${log.riskScore}/10
                                        </div>
                                    `}
                                </div>
                                ${log.error && html`
                                    <div class="log-error">
                                        错误: ${log.error}
                                    </div>
                                `}
                            </div>
                        `)}
                    </div>
                `}
            </div>
        </div>
    `;
};

/**
 * 安全操作确认高阶组件
 */
const withSecurityConfirmation = (WrappedComponent, options = {}) => {
    return (props) => {
        const {
            operation = 'unknown',
            resource = 'unknown',
            confirmMessage = null,
            requiredPermission = 'write',
            enableRiskAssessment = true
        } = options;

        const [showConfirmation, setShowConfirmation] = useState(false);
        const [pendingAction, setPendingAction] = useState(null);
        const [riskLevel, setRiskLevel] = useState('low');

        const handleSecureAction = async (action, actionProps = {}) => {
            // 检查权限
            const hasPermission = securityService.checkPermissionEnhanced(
                requiredPermission, 
                resource, 
                actionProps
            );
            
            if (!hasPermission) {
                alert('您没有权限执行此操作');
                return;
            }

            // 评估风险级别
            if (enableRiskAssessment) {
                const risk = securityService.calculateRiskScore(operation, resource, actionProps);
                setRiskLevel(risk > 7 ? 'high' : risk > 4 ? 'medium' : 'low');
            }

            // 设置待执行的操作
            setPendingAction(() => action);
            setShowConfirmation(true);
        };

        const handleConfirm = async () => {
            setShowConfirmation(false);
            
            if (pendingAction) {
                try {
                    await pendingAction();
                    securityService.logOperation(operation, resource, { 
                        confirmed: true,
                        riskLevel 
                    });
                } catch (error) {
                    securityService.logFailedOperation(operation, resource, error);
                }
            }
            
            setPendingAction(null);
        };

        const handleCancel = () => {
            setShowConfirmation(false);
            securityService.logOperation('security_confirmation', resource, { 
                operation, 
                confirmed: false,
                riskLevel
            });
            setPendingAction(null);
        };

        return html`
            <${WrappedComponent} 
                ...${props}
                onSecureAction=${handleSecureAction}
            />
            
            ${showConfirmation && html`
                <div class="security-confirmation-overlay">
                    <div class="security-confirmation-dialog ${riskLevel}-risk">
                        <div class="confirmation-header">
                            <h3>安全确认</h3>
                            <div class="risk-indicator ${riskLevel}">
                                风险级别: ${riskLevel === 'high' ? '高' : riskLevel === 'medium' ? '中' : '低'}
                            </div>
                        </div>
                        
                        <div class="confirmation-content">
                            <p>${confirmMessage || `确认要执行 ${operation} 操作吗？`}</p>
                            
                            <div class="operation-details">
                                <div class="detail-item">
                                    <strong>操作:</strong> ${operation}
                                </div>
                                <div class="detail-item">
                                    <strong>资源:</strong> ${resource}
                                </div>
                                <div class="detail-item">
                                    <strong>时间:</strong> ${new Date().toLocaleString()}
                                </div>
                            </div>
                            
                            ${riskLevel === 'high' && html`
                                <div class="high-risk-warning">
                                    ⚠️ 这是一个高风险操作，请仔细确认后再继续
                                </div>
                            `}
                        </div>
                        
                        <div class="dialog-actions">
                            <button class="btn-secondary" onClick=${handleCancel}>取消</button>
                            <button class="btn-danger" onClick=${handleConfirm}>
                                ${riskLevel === 'high' ? '我确认执行' : '确认'}
                            </button>
                        </div>
                    </div>
                </div>
            `}
        `;
    };
};

export default ProtectedComponent;
export { 
    ProtectedButton, 
    SessionManager, 
    PermissionPanel, 
    SensitiveDataDisplay,
    SecureInput,
    SecureForm,
    SecurityAuditViewer,
    withSecurityConfirmation
};