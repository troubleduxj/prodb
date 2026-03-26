/**
 * 隐私保护组件 - 提供数据安全和隐私保护功能
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import securityService from '../services/security.js';

/**
 * 隐私合规仪表板
 */
const PrivacyComplianceDashboard = () => {
    const [complianceData, setComplianceData] = useState(null);
    const [violations, setViolations] = useState([]);
    const [assessment, setAssessment] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadComplianceData();
    }, []);

    const loadComplianceData = async () => {
        setIsLoading(true);
        try {
            const compliance = securityService.checkPrivacyCompliance();
            const privacyViolations = securityService.detectPrivacyViolations();
            
            setComplianceData(compliance);
            setViolations(privacyViolations);
        } catch (error) {
            console.error('Failed to load compliance data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateAssessment = async () => {
        setIsLoading(true);
        try {
            const pia = securityService.generatePrivacyImpactAssessment();
            setAssessment(pia);
        } catch (error) {
            console.error('Failed to generate assessment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getComplianceColor = (score) => {
        if (score >= 0.8) return 'success';
        if (score >= 0.6) return 'warning';
        return 'error';
    };

    return html`
        <div class="privacy-compliance-dashboard">
            <div class="dashboard-header">
                <h2>隐私合规仪表板</h2>
                <div class="dashboard-actions">
                    <button class="btn-secondary" onClick=${loadComplianceData} disabled=${isLoading}>
                        ${isLoading ? '加载中...' : '刷新数据'}
                    </button>
                    <button class="btn-primary" onClick=${generateAssessment} disabled=${isLoading}>
                        生成隐私影响评估
                    </button>
                </div>
            </div>

            ${complianceData && html`
                <div class="compliance-overview">
                    <div class="compliance-score-card">
                        <h3>总体合规分数</h3>
                        <div class="score-display ${getComplianceColor(complianceData.overallScore / 100)}">
                            ${complianceData.overallScore}%
                        </div>
                    </div>

                    <div class="compliance-breakdown">
                        <div class="compliance-item">
                            <h4>GDPR 合规性</h4>
                            <div class="compliance-score ${getComplianceColor(complianceData.gdpr.score)}">
                                ${Math.round(complianceData.gdpr.score * 100)}%
                            </div>
                            <div class="compliance-details">
                                <div class="detail-item ${complianceData.gdpr.dataMinimization ? 'compliant' : 'non-compliant'}">
                                    数据最小化: ${complianceData.gdpr.dataMinimization ? '✓' : '✗'}
                                </div>
                                <div class="detail-item ${complianceData.gdpr.purposeLimitation ? 'compliant' : 'non-compliant'}">
                                    目的限制: ${complianceData.gdpr.purposeLimitation ? '✓' : '✗'}
                                </div>
                                <div class="detail-item ${complianceData.gdpr.userConsent ? 'compliant' : 'non-compliant'}">
                                    用户同意: ${complianceData.gdpr.userConsent ? '✓' : '✗'}
                                </div>
                            </div>
                        </div>

                        <div class="compliance-item">
                            <h4>CCPA 合规性</h4>
                            <div class="compliance-score ${getComplianceColor(complianceData.ccpa.score)}">
                                ${Math.round(complianceData.ccpa.score * 100)}%
                            </div>
                            <div class="compliance-details">
                                <div class="detail-item ${complianceData.ccpa.transparentDataPractices ? 'compliant' : 'non-compliant'}">
                                    透明数据实践: ${complianceData.ccpa.transparentDataPractices ? '✓' : '✗'}
                                </div>
                                <div class="detail-item ${complianceData.ccpa.userRights ? 'compliant' : 'non-compliant'}">
                                    用户权利: ${complianceData.ccpa.userRights ? '✓' : '✗'}
                                </div>
                            </div>
                        </div>

                        <div class="compliance-item">
                            <h4>一般安全措施</h4>
                            <div class="compliance-score ${getComplianceColor(complianceData.general.score)}">
                                ${Math.round(complianceData.general.score * 100)}%
                            </div>
                            <div class="compliance-details">
                                <div class="detail-item ${complianceData.general.accessLogging ? 'compliant' : 'non-compliant'}">
                                    访问日志: ${complianceData.general.accessLogging ? '✓' : '✗'}
                                </div>
                                <div class="detail-item ${complianceData.general.dataRetention ? 'compliant' : 'non-compliant'}">
                                    数据保留: ${complianceData.general.dataRetention ? '✓' : '✗'}
                                </div>
                            </div>
                        </div>
                    </div>

                    ${complianceData.recommendations.length > 0 && html`
                        <div class="compliance-recommendations">
                            <h4>合规建议</h4>
                            <ul>
                                ${complianceData.recommendations.map(rec => html`
                                    <li key=${rec}>${rec}</li>
                                `)}
                            </ul>
                        </div>
                    `}
                </div>
            `}

            ${violations.length > 0 && html`
                <div class="privacy-violations">
                    <h3>隐私违规检测</h3>
                    <div class="violations-list">
                        ${violations.map((violation, index) => html`
                            <div key=${index} class="violation-item ${violation.severity}">
                                <div class="violation-header">
                                    <span class="violation-type">${violation.type}</span>
                                    <span class="violation-severity ${violation.severity}">
                                        ${violation.severity === 'high' ? '高风险' : violation.severity === 'medium' ? '中风险' : '低风险'}
                                    </span>
                                </div>
                                <div class="violation-message">${violation.message}</div>
                                <div class="violation-details">
                                    次数: ${violation.count} | 建议: ${violation.recommendation}
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            ${assessment && html`
                <${PrivacyImpactAssessmentView} assessment=${assessment} />
            `}
        </div>
    `;
};

/**
 * 隐私影响评估视图
 */
const PrivacyImpactAssessmentView = ({ assessment }) => {
    const exportAssessment = () => {
        const blob = new Blob([JSON.stringify(assessment, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `privacy-impact-assessment-${assessment.assessmentId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return html`
        <div class="privacy-impact-assessment">
            <div class="assessment-header">
                <h3>隐私影响评估报告</h3>
                <div class="assessment-meta">
                    <span>评估ID: ${assessment.assessmentId}</span>
                    <span>生成时间: ${new Date(assessment.timestamp).toLocaleString()}</span>
                    <button class="btn-secondary" onClick=${exportAssessment}>
                        导出报告
                    </button>
                </div>
            </div>

            <div class="assessment-content">
                <div class="assessment-section">
                    <h4>数据处理信息</h4>
                    <div class="data-processing-info">
                        <div class="info-item">
                            <strong>个人数据类型:</strong>
                            <ul>
                                ${assessment.dataProcessing.personalDataTypes.map(type => html`
                                    <li key=${type}>${type}</li>
                                `)}
                            </ul>
                        </div>
                        <div class="info-item">
                            <strong>处理目的:</strong>
                            <ul>
                                ${assessment.dataProcessing.processingPurposes.map(purpose => html`
                                    <li key=${purpose}>${purpose}</li>
                                `)}
                            </ul>
                        </div>
                        <div class="info-item">
                            <strong>法律依据:</strong> ${assessment.dataProcessing.legalBasis}
                        </div>
                    </div>
                </div>

                <div class="assessment-section">
                    <h4>风险评估</h4>
                    <div class="risk-assessment">
                        <div class="risk-level ${assessment.riskAssessment.riskLevel}">
                            总体风险级别: ${assessment.riskAssessment.riskLevel === 'high' ? '高' : 
                                          assessment.riskAssessment.riskLevel === 'medium' ? '中' : '低'}
                        </div>
                        
                        ${assessment.riskAssessment.identifiedRisks.length > 0 && html`
                            <div class="identified-risks">
                                <h5>识别的风险</h5>
                                ${assessment.riskAssessment.identifiedRisks.map((risk, index) => html`
                                    <div key=${index} class="risk-item">
                                        <div class="risk-category">${risk.category}</div>
                                        <div class="risk-description">${risk.risk}</div>
                                        <div class="risk-metrics">
                                            可能性: ${risk.likelihood} | 影响: ${risk.impact}
                                        </div>
                                    </div>
                                `)}
                            </div>
                        `}

                        <div class="mitigation-measures">
                            <h5>缓解措施</h5>
                            <ul>
                                ${assessment.riskAssessment.mitigationMeasures.map(measure => html`
                                    <li key=${measure}>${measure}</li>
                                `)}
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="assessment-section">
                    <h4>建议措施</h4>
                    <ul class="recommendations-list">
                        ${assessment.recommendations.map(rec => html`
                            <li key=${rec}>${rec}</li>
                        `)}
                    </ul>
                </div>
            </div>
        </div>
    `;
};

/**
 * 数据脱敏配置组件
 */
const DataMaskingConfig = ({ onConfigChange }) => {
    const [maskingLevel, setMaskingLevel] = useState('standard');
    const [customRules, setCustomRules] = useState([]);
    const [testData, setTestData] = useState('');
    const [maskedResult, setMaskedResult] = useState('');

    useEffect(() => {
        if (testData) {
            testMasking();
        }
    }, [maskingLevel, testData]);

    const testMasking = () => {
        try {
            const data = JSON.parse(testData);
            const masked = securityService.advancedDataMasking(data, maskingLevel);
            setMaskedResult(JSON.stringify(masked, null, 2));
        } catch (error) {
            setMaskedResult('无效的JSON格式');
        }
    };

    const addCustomRule = () => {
        const newRule = {
            id: Date.now(),
            fieldPattern: '',
            maskingType: 'partial',
            visibleRatio: 0.2
        };
        setCustomRules([...customRules, newRule]);
    };

    const updateCustomRule = (id, field, value) => {
        setCustomRules(rules => 
            rules.map(rule => 
                rule.id === id ? { ...rule, [field]: value } : rule
            )
        );
    };

    const removeCustomRule = (id) => {
        setCustomRules(rules => rules.filter(rule => rule.id !== id));
    };

    return html`
        <div class="data-masking-config">
            <h3>数据脱敏配置</h3>
            
            <div class="masking-level-selector">
                <h4>脱敏级别</h4>
                <div class="level-options">
                    <label class="level-option">
                        <input 
                            type="radio" 
                            name="maskingLevel" 
                            value="minimal"
                            checked=${maskingLevel === 'minimal'}
                            onChange=${(e) => setMaskingLevel(e.target.value)}
                        />
                        <span class="level-label">最小脱敏</span>
                        <span class="level-description">保留更多信息，适用于内部使用</span>
                    </label>
                    
                    <label class="level-option">
                        <input 
                            type="radio" 
                            name="maskingLevel" 
                            value="standard"
                            checked=${maskingLevel === 'standard'}
                            onChange=${(e) => setMaskingLevel(e.target.value)}
                        />
                        <span class="level-label">标准脱敏</span>
                        <span class="level-description">平衡安全性和可用性</span>
                    </label>
                    
                    <label class="level-option">
                        <input 
                            type="radio" 
                            name="maskingLevel" 
                            value="strict"
                            checked=${maskingLevel === 'strict'}
                            onChange=${(e) => setMaskingLevel(e.target.value)}
                        />
                        <span class="level-label">严格脱敏</span>
                        <span class="level-description">最高安全性，适用于外部共享</span>
                    </label>
                </div>
            </div>

            <div class="custom-rules-section">
                <div class="section-header">
                    <h4>自定义脱敏规则</h4>
                    <button class="btn-secondary" onClick=${addCustomRule}>
                        添加规则
                    </button>
                </div>
                
                ${customRules.map(rule => html`
                    <div key=${rule.id} class="custom-rule">
                        <input 
                            type="text" 
                            placeholder="字段名模式 (如: *password*)"
                            value=${rule.fieldPattern}
                            onChange=${(e) => updateCustomRule(rule.id, 'fieldPattern', e.target.value)}
                        />
                        <select 
                            value=${rule.maskingType}
                            onChange=${(e) => updateCustomRule(rule.id, 'maskingType', e.target.value)}
                        >
                            <option value="partial">部分脱敏</option>
                            <option value="full">完全脱敏</option>
                            <option value="hash">哈希处理</option>
                        </select>
                        ${rule.maskingType === 'partial' && html`
                            <input 
                                type="number" 
                                min="0" 
                                max="1" 
                                step="0.1"
                                placeholder="可见比例"
                                value=${rule.visibleRatio}
                                onChange=${(e) => updateCustomRule(rule.id, 'visibleRatio', parseFloat(e.target.value))}
                            />
                        `}
                        <button class="btn-danger btn-sm" onClick=${() => removeCustomRule(rule.id)}>
                            删除
                        </button>
                    </div>
                `)}
            </div>

            <div class="masking-test">
                <h4>脱敏测试</h4>
                <div class="test-input">
                    <label>测试数据 (JSON格式):</label>
                    <textarea 
                        value=${testData}
                        onChange=${(e) => setTestData(e.target.value)}
                        placeholder='{"username": "admin", "password": "secret123", "email": "admin@example.com"}'
                        rows="4"
                    ></textarea>
                </div>
                
                <div class="test-result">
                    <label>脱敏结果:</label>
                    <pre class="masked-output">${maskedResult}</pre>
                </div>
            </div>
        </div>
    `;
};

/**
 * 安全导出对话框
 */
const SecureExportDialog = ({ data, onExport, onClose }) => {
    const [exportOptions, setExportOptions] = useState({
        maskingLevel: 'standard',
        includeMetadata: true,
        encryptSensitive: false,
        auditExport: true,
        format: 'json'
    });
    const [previewData, setPreviewData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        generatePreview();
    }, [exportOptions.maskingLevel]);

    const generatePreview = () => {
        const preview = securityService.privacyProtectedExport(data, {
            maskingLevel: exportOptions.maskingLevel,
            includeMetadata: false
        });
        setPreviewData(preview.data);
    };

    const handleExport = async () => {
        setIsProcessing(true);
        try {
            const exportPackage = securityService.privacyProtectedExport(data, exportOptions);
            
            let content, mimeType, filename;
            
            switch (exportOptions.format) {
                case 'json':
                    content = JSON.stringify(exportPackage, null, 2);
                    mimeType = 'application/json';
                    filename = `secure-export-${Date.now()}.json`;
                    break;
                case 'csv':
                    content = convertToCSV(exportPackage.data);
                    mimeType = 'text/csv';
                    filename = `secure-export-${Date.now()}.csv`;
                    break;
                default:
                    content = JSON.stringify(exportPackage, null, 2);
                    mimeType = 'application/json';
                    filename = `secure-export-${Date.now()}.json`;
            }
            
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            
            if (onExport) {
                onExport(exportPackage);
            }
            
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
            alert('导出失败: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const convertToCSV = (data) => {
        if (!Array.isArray(data)) {
            data = [data];
        }
        
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => 
                    JSON.stringify(row[header] || '')
                ).join(',')
            )
        ].join('\n');
        
        return csvContent;
    };

    return html`
        <div class="secure-export-overlay">
            <div class="secure-export-dialog">
                <div class="dialog-header">
                    <h3>安全数据导出</h3>
                    <button class="close-btn" onClick=${onClose}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="export-options">
                        <div class="option-group">
                            <label>脱敏级别:</label>
                            <select 
                                value=${exportOptions.maskingLevel}
                                onChange=${(e) => setExportOptions({...exportOptions, maskingLevel: e.target.value})}
                            >
                                <option value="minimal">最小脱敏</option>
                                <option value="standard">标准脱敏</option>
                                <option value="strict">严格脱敏</option>
                            </select>
                        </div>
                        
                        <div class="option-group">
                            <label>导出格式:</label>
                            <select 
                                value=${exportOptions.format}
                                onChange=${(e) => setExportOptions({...exportOptions, format: e.target.value})}
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                        
                        <div class="option-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked=${exportOptions.includeMetadata}
                                    onChange=${(e) => setExportOptions({...exportOptions, includeMetadata: e.target.checked})}
                                />
                                包含元数据
                            </label>
                        </div>
                        
                        <div class="option-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked=${exportOptions.auditExport}
                                    onChange=${(e) => setExportOptions({...exportOptions, auditExport: e.target.checked})}
                                />
                                记录导出操作
                            </label>
                        </div>
                    </div>
                    
                    ${previewData && html`
                        <div class="export-preview">
                            <h4>数据预览 (脱敏后)</h4>
                            <pre class="preview-content">${JSON.stringify(previewData, null, 2)}</pre>
                        </div>
                    `}
                </div>
                
                <div class="dialog-actions">
                    <button class="btn-secondary" onClick=${onClose}>
                        取消
                    </button>
                    <button 
                        class="btn-primary" 
                        onClick=${handleExport}
                        disabled=${isProcessing}
                    >
                        ${isProcessing ? '导出中...' : '安全导出'}
                    </button>
                </div>
            </div>
        </div>
    `;
};

/**
 * 用户教育组件
 */
const SecurityEducationPanel = () => {
    const [educationHistory, setEducationHistory] = useState([]);
    const [selectedContext, setSelectedContext] = useState('general');

    useEffect(() => {
        loadEducationHistory();
    }, []);

    const loadEducationHistory = () => {
        const logs = securityService.getOperationLogs({
            operation: 'security_education_shown'
        });
        setEducationHistory(logs.slice(0, 10));
    };

    const showEducation = (context) => {
        if (securityService.shouldShowEducation(context)) {
            securityService.showSecurityEducation(context);
            setTimeout(loadEducationHistory, 1000); // 延迟加载以获取新记录
        } else {
            alert('此教育内容已被标记为不再显示');
        }
    };

    const resetEducationSettings = () => {
        const contexts = ['general', 'sensitive_data', 'export', 'privacy'];
        contexts.forEach(context => {
            localStorage.removeItem(`security_education_${context}`);
        });
        alert('教育设置已重置，所有提示将重新显示');
    };

    return html`
        <div class="security-education-panel">
            <h3>安全教育管理</h3>
            
            <div class="education-controls">
                <div class="context-selector">
                    <label>选择教育内容:</label>
                    <select 
                        value=${selectedContext}
                        onChange=${(e) => setSelectedContext(e.target.value)}
                    >
                        <option value="general">一般安全提示</option>
                        <option value="sensitive_data">敏感数据处理</option>
                        <option value="export">数据导出安全</option>
                        <option value="privacy">隐私保护提醒</option>
                    </select>
                </div>
                
                <div class="education-actions">
                    <button 
                        class="btn-primary" 
                        onClick=${() => showEducation(selectedContext)}
                    >
                        显示教育内容
                    </button>
                    <button 
                        class="btn-secondary" 
                        onClick=${resetEducationSettings}
                    >
                        重置教育设置
                    </button>
                </div>
            </div>
            
            <div class="education-history">
                <h4>教育记录</h4>
                ${educationHistory.length > 0 ? html`
                    <div class="history-list">
                        ${educationHistory.map(log => html`
                            <div key=${log.id} class="history-item">
                                <div class="history-time">
                                    ${new Date(log.timestamp).toLocaleString()}
                                </div>
                                <div class="history-context">
                                    ${log.details?.context || 'general'}
                                </div>
                                <div class="history-status">
                                    ${log.operation === 'security_education_acknowledged' ? '已确认' : '已显示'}
                                </div>
                            </div>
                        `)}
                    </div>
                ` : html`
                    <div class="no-history">暂无教育记录</div>
                `}
            </div>
        </div>
    `;
};

export default PrivacyComplianceDashboard;
export { 
    PrivacyImpactAssessmentView,
    DataMaskingConfig, 
    SecureExportDialog,
    SecurityEducationPanel
};