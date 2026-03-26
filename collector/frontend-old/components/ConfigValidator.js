/**
 * 配置验证组件 - 提供配置验证和安全检查功能
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import securityService from '../services/security.js';

const ConfigValidator = ({ config, schema, onValidationChange, showWarnings = true }) => {
    const [validationResult, setValidationResult] = useState(null);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (config && schema) {
            validateConfig();
        }
    }, [config, schema]);

    const validateConfig = async () => {
        setIsValidating(true);
        
        try {
            // 执行配置验证
            const result = securityService.validateConfig(config, schema);
            setValidationResult(result);
            
            // 通知父组件验证结果
            if (onValidationChange) {
                onValidationChange(result);
            }

            // 记录验证操作
            securityService.logOperation('config_validation', 'configuration', {
                isValid: result.isValid,
                errorCount: Object.keys(result.errors).length,
                warningCount: result.warnings.length
            });

        } catch (error) {
            console.error('Configuration validation failed:', error);
            securityService.logFailedOperation('config_validation', 'configuration', error);
        } finally {
            setIsValidating(false);
        }
    };

    const getFieldError = (fieldName) => {
        return validationResult?.errors[fieldName];
    };

    const hasFieldError = (fieldName) => {
        return validationResult?.errors && validationResult.errors[fieldName];
    };

    if (!validationResult && !isValidating) {
        return null;
    }

    return html`
        <div class="config-validator">
            ${isValidating && html`
                <div class="validation-loading">
                    <div class="loading-spinner"></div>
                    <span>正在验证配置...</span>
                </div>
            `}

            ${validationResult && html`
                <div class="validation-results">
                    <!-- 验证状态概览 -->
                    <div class="validation-summary ${validationResult.isValid ? 'valid' : 'invalid'}">
                        <div class="summary-icon">
                            ${validationResult.isValid 
                                ? html`<span class="icon-success">✓</span>`
                                : html`<span class="icon-error">✗</span>`
                            }
                        </div>
                        <div class="summary-text">
                            <h4>${validationResult.isValid ? '配置验证通过' : '配置验证失败'}</h4>
                            <p>
                                ${Object.keys(validationResult.errors).length > 0 && 
                                    `${Object.keys(validationResult.errors).length} 个错误`
                                }
                                ${Object.keys(validationResult.errors).length > 0 && validationResult.warnings.length > 0 && ', '}
                                ${validationResult.warnings.length > 0 && 
                                    `${validationResult.warnings.length} 个警告`
                                }
                            </p>
                        </div>
                    </div>

                    <!-- 错误列表 -->
                    ${Object.keys(validationResult.errors).length > 0 && html`
                        <div class="validation-errors">
                            <h5>配置错误</h5>
                            <ul class="error-list">
                                ${Object.entries(validationResult.errors).map(([field, error]) => html`
                                    <li key=${field} class="error-item">
                                        <span class="error-field">${field}:</span>
                                        <span class="error-message">${error}</span>
                                    </li>
                                `)}
                            </ul>
                        </div>
                    `}

                    <!-- 警告列表 -->
                    ${showWarnings && validationResult.warnings.length > 0 && html`
                        <div class="validation-warnings">
                            <h5>安全建议</h5>
                            <ul class="warning-list">
                                ${validationResult.warnings.map((warning, index) => html`
                                    <li key=${index} class="warning-item">
                                        <span class="warning-icon">⚠</span>
                                        <span class="warning-message">${warning}</span>
                                    </li>
                                `)}
                            </ul>
                        </div>
                    `}

                    <!-- 验证操作 -->
                    <div class="validation-actions">
                        <button 
                            class="btn-secondary" 
                            onClick=${validateConfig}
                            disabled=${isValidating}
                        >
                            重新验证
                        </button>
                        
                        ${!validationResult.isValid && html`
                            <button 
                                class="btn-primary" 
                                onClick=${() => window.dispatchEvent(new CustomEvent('showValidationHelp', { 
                                    detail: { errors: validationResult.errors, warnings: validationResult.warnings }
                                }))}
                            >
                                获取帮助
                            </button>
                        `}
                    </div>
                </div>
            `}
        </div>
    `;
};

/**
 * 字段验证指示器组件
 */
const FieldValidator = ({ fieldName, config, schema, inline = false }) => {
    const [fieldValidation, setFieldValidation] = useState(null);

    useEffect(() => {
        if (config && schema && fieldName) {
            validateField();
        }
    }, [config, schema, fieldName]);

    const validateField = () => {
        const fieldValue = config[fieldName];
        const fieldRules = schema.fields?.[fieldName] || [];
        
        let error = null;
        
        // 检查必需字段
        if (schema.required?.includes(fieldName)) {
            if (!fieldValue || fieldValue === '') {
                error = `${fieldName} 是必需的`;
            }
        }

        // 检查字段规则
        if (!error && fieldValue && fieldRules.length > 0) {
            for (const rule of fieldRules) {
                const validator = securityService.constructor.VALIDATION_RULES?.[rule.type];
                if (validator) {
                    const isValid = rule.params 
                        ? validator(...rule.params)(fieldValue)
                        : validator(fieldValue);
                    
                    if (!isValid) {
                        error = rule.message || `${fieldName} 验证失败`;
                        break;
                    }
                }
            }
        }

        setFieldValidation({
            isValid: !error,
            error,
            fieldName
        });
    };

    if (!fieldValidation) {
        return null;
    }

    if (inline) {
        return html`
            <span class="field-validator inline ${fieldValidation.isValid ? 'valid' : 'invalid'}">
                ${fieldValidation.isValid 
                    ? html`<span class="icon-success">✓</span>`
                    : html`<span class="icon-error" title=${fieldValidation.error}>✗</span>`
                }
            </span>
        `;
    }

    return html`
        <div class="field-validator ${fieldValidation.isValid ? 'valid' : 'invalid'}">
            ${!fieldValidation.isValid && html`
                <div class="field-error">
                    <span class="error-icon">✗</span>
                    <span class="error-text">${fieldValidation.error}</span>
                </div>
            `}
        </div>
    `;
};

/**
 * 安全确认对话框组件
 */
const SecurityConfirmationDialog = ({ 
    isOpen, 
    operation, 
    resource, 
    message, 
    onConfirm, 
    onCancel,
    details = {}
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        securityService.logOperation('security_confirmation', resource, { 
            operation, 
            confirmed: true,
            ...details 
        });
        onConfirm();
    };

    const handleCancel = () => {
        securityService.logOperation('security_confirmation', resource, { 
            operation, 
            confirmed: false,
            ...details 
        });
        onCancel();
    };

    return html`
        <div class="security-confirmation-overlay">
            <div class="security-confirmation-dialog">
                <div class="dialog-header">
                    <h3>安全确认</h3>
                    <button class="close-btn" onClick=${handleCancel}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="confirmation-message">
                        <div class="warning-icon">⚠</div>
                        <p>${message || `确认要执行 ${operation} 操作吗？`}</p>
                    </div>
                    
                    <div class="confirmation-details">
                        <div class="detail-item">
                            <span class="label">操作:</span>
                            <span class="value">${operation}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">资源:</span>
                            <span class="value">${resource}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">用户:</span>
                            <span class="value">${securityService.currentUser?.name || 'Unknown'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">时间:</span>
                            <span class="value">${new Date().toLocaleString()}</span>
                        </div>
                        
                        ${Object.keys(details).length > 0 && html`
                            <div class="additional-details">
                                <h5>详细信息:</h5>
                                ${Object.entries(details).map(([key, value]) => html`
                                    <div class="detail-item" key=${key}>
                                        <span class="label">${key}:</span>
                                        <span class="value">${JSON.stringify(value)}</span>
                                    </div>
                                `)}
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="dialog-actions">
                    <button class="btn-secondary" onClick=${handleCancel}>
                        取消
                    </button>
                    <button class="btn-danger" onClick=${handleConfirm}>
                        确认执行
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default ConfigValidator;
export { FieldValidator, SecurityConfirmationDialog };