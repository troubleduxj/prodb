/**
 * Batch Tester Component
 * Provides batch protocol testing functionality with configuration management
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import services
import { protocolService, SUPPORTED_PROTOCOLS } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

const html = htm.bind(h);

const BatchTester = ({ onBatchComplete, isLoading, setIsLoading }) => {
    const [testConfigs, setTestConfigs] = useState([]);
    const [batchProgress, setBatchProgress] = useState(0);
    const [currentTest, setCurrentTest] = useState(null);
    const [batchResults, setBatchResults] = useState([]);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // Initialize with a sample test config
    useEffect(() => {
        const sampleConfig = {
            id: Date.now(),
            name: '示例OPC UA测试',
            protocol: 'OPC_UA',
            config: {
                endpoint: 'opc.tcp://192.168.1.100:4840',
                securityPolicy: 'None',
                securityMode: 'None'
            },
            testType: 'connect',
            enabled: true
        };
        setTestConfigs([sampleConfig]);
    }, []);

    // Add new test configuration
    const addTestConfig = (newConfig) => {
        const testConfig = {
            id: Date.now(),
            name: newConfig.name || `${SUPPORTED_PROTOCOLS[newConfig.protocol]?.name} 测试`,
            protocol: newConfig.protocol,
            config: newConfig.config,
            testType: newConfig.testType || 'connect',
            enabled: true
        };
        setTestConfigs(prev => [...prev, testConfig]);
        setShowAddDialog(false);
        devLog('Added test config:', testConfig);
    };

    // Remove test configuration
    const removeTestConfig = (configId) => {
        setTestConfigs(prev => prev.filter(config => config.id !== configId));
        devLog('Removed test config:', configId);
    };

    // Toggle test configuration enabled state
    const toggleTestConfig = (configId) => {
        setTestConfigs(prev => prev.map(config =>
            config.id === configId
                ? { ...config, enabled: !config.enabled }
                : config
        ));
    };

    // Update test configuration
    const updateTestConfig = (configId, updates) => {
        setTestConfigs(prev => prev.map(config =>
            config.id === configId
                ? { ...config, ...updates }
                : config
        ));
    };

    // Execute batch test
    const executeBatchTest = async () => {
        const enabledConfigs = testConfigs.filter(config => config.enabled);
        
        if (enabledConfigs.length === 0) {
            alert('请至少启用一个测试配置');
            return;
        }

        setIsLoading(true);
        setBatchProgress(0);
        setBatchResults([]);
        
        const results = [];
        
        try {
            for (let i = 0; i < enabledConfigs.length; i++) {
                const config = enabledConfigs[i];
                setCurrentTest(config);
                
                devLog('Executing batch test:', config.name);
                
                try {
                    const result = await protocolService.testConnection(
                        config.protocol,
                        config.config,
                        config.testType
                    );
                    
                    result.configName = config.name;
                    results.push(result);
                    
                } catch (error) {
                    const errorResult = {
                        id: `batch-error-${Date.now()}`,
                        protocol: config.protocol,
                        testType: config.testType,
                        success: false,
                        duration: 0,
                        data: null,
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        configName: config.name
                    };
                    results.push(errorResult);
                }
                
                // Update progress
                const progress = ((i + 1) / enabledConfigs.length) * 100;
                setBatchProgress(progress);
                
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            setBatchResults(results);
            onBatchComplete(results);
            
            devLog('Batch test completed:', results.length, 'results');
            
        } catch (error) {
            console.error('Batch test failed:', error);
        } finally {
            setIsLoading(false);
            setCurrentTest(null);
            setTimeout(() => setBatchProgress(0), 2000);
        }
    };

    // Import test configurations from JSON
    const importConfigs = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedConfigs = JSON.parse(e.target.result);
                if (Array.isArray(importedConfigs)) {
                    const newConfigs = importedConfigs.map(config => ({
                        ...config,
                        id: Date.now() + Math.random(),
                        enabled: true
                    }));
                    setTestConfigs(prev => [...prev, ...newConfigs]);
                    devLog('Imported', newConfigs.length, 'test configurations');
                }
            } catch (error) {
                alert('导入失败: 文件格式无效');
                console.error('Import failed:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };

    // Export test configurations to JSON
    const exportConfigs = () => {
        const exportData = testConfigs.map(({ id, ...config }) => config);
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-test-configs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        devLog('Exported test configurations');
    };

    // Export batch test results
    const exportBatchResults = (format = 'json') => {
        const report = {
            testConfigs: testConfigs.filter(c => c.enabled),
            results: batchResults,
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: batchResults.length,
                successful: batchResults.filter(r => r.success).length,
                failed: batchResults.filter(r => !r.success).length,
                successRate: batchResults.length > 0 ? 
                    Math.round((batchResults.filter(r => r.success).length / batchResults.length) * 100) : 0,
                protocolCounts: {}
            }
        };

        // Count protocols
        batchResults.forEach(result => {
            report.summary.protocolCounts[result.protocol] = 
                (report.summary.protocolCounts[result.protocol] || 0) + 1;
        });

        let content, filename, mimeType;

        switch (format) {
            case 'csv':
                content = exportBatchResultsToCSV(report);
                filename = `batch-test-results-${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
                break;
            case 'json':
            default:
                content = JSON.stringify(report, null, 2);
                filename = `batch-test-results-${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
                break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        devLog('Exported batch test results:', filename);
    };

    // Export batch results to CSV format
    const exportBatchResultsToCSV = (report) => {
        const lines = [];
        
        // Header
        lines.push('Batch Test Results Report');
        lines.push(`Generated: ${report.timestamp}`);
        lines.push(`Total Tests: ${report.summary.totalTests}`);
        lines.push(`Success Rate: ${report.summary.successRate}%`);
        lines.push('');
        
        // Results
        lines.push('Test Results');
        lines.push('Config Name,Protocol,Test Type,Success,Duration (ms),Error');
        
        report.results.forEach(result => {
            lines.push([
                result.configName || '',
                result.protocol,
                result.testType,
                result.success,
                result.duration,
                result.error || ''
            ].join(','));
        });
        
        lines.push('');
        
        // Protocol Summary
        lines.push('Protocol Summary');
        lines.push('Protocol,Test Count');
        
        Object.entries(report.summary.protocolCounts).forEach(([protocol, count]) => {
            lines.push(`${protocol},${count}`);
        });
        
        return lines.join('\n');
    };

    return html`
        <div class="batch-tester">
            <!-- Batch Configuration Header -->
            <div class="batch-header">
                <div class="batch-info">
                    <h3>批量测试配置</h3>
                    <p>配置多个协议测试并批量执行</p>
                </div>
                <div class="batch-actions">
                    <button
                        class="btn btn-secondary"
                        onClick=${() => setShowAddDialog(true)}
                        disabled=${isLoading}
                    >
                        ➕ 添加测试
                    </button>
                    <label class="btn btn-secondary file-input-label">
                        📁 导入配置
                        <input
                            type="file"
                            accept=".json"
                            onChange=${importConfigs}
                            style="display: none"
                            disabled=${isLoading}
                        />
                    </label>
                    <button
                        class="btn btn-secondary"
                        onClick=${exportConfigs}
                        disabled=${testConfigs.length === 0 || isLoading}
                    >
                        💾 导出配置
                    </button>
                </div>
            </div>

            <!-- Test Configurations List -->
            <div class="test-configs-list">
                ${testConfigs.length === 0 ? html`
                    <div class="empty-configs">
                        <div class="empty-icon">📋</div>
                        <h4>暂无测试配置</h4>
                        <p>点击"添加测试"按钮创建第一个测试配置</p>
                    </div>
                ` : testConfigs.map(config => html`
                    <${TestConfigCard}
                        key=${config.id}
                        config=${config}
                        onToggle=${() => toggleTestConfig(config.id)}
                        onRemove=${() => removeTestConfig(config.id)}
                        onUpdate=${(updates) => updateTestConfig(config.id, updates)}
                        disabled=${isLoading}
                    />
                `)}
            </div>

            <!-- Batch Execution -->
            <div class="batch-execution">
                <div class="execution-header">
                    <div class="execution-info">
                        <span>启用的测试: ${testConfigs.filter(c => c.enabled).length}</span>
                        <span>总测试数: ${testConfigs.length}</span>
                    </div>
                    <button
                        class="btn btn-primary btn-lg"
                        onClick=${executeBatchTest}
                        disabled=${isLoading || testConfigs.filter(c => c.enabled).length === 0}
                    >
                        ${isLoading ? '执行中...' : '执行批量测试'}
                    </button>
                </div>

                <!-- Batch Progress -->
                ${isLoading && html`
                    <div class="batch-progress">
                        <div class="progress-header">
                            <span>执行进度</span>
                            <span>${Math.round(batchProgress)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div 
                                class="progress-fill" 
                                style="width: ${batchProgress}%"
                            ></div>
                        </div>
                        ${currentTest && html`
                            <div class="current-test">
                                正在测试: ${currentTest.name}
                            </div>
                        `}
                    </div>
                `}

                <!-- Batch Results Summary -->
                ${batchResults.length > 0 && html`
                    <div class="batch-results-summary">
                        <div class="results-header">
                            <h4>批量测试结果</h4>
                            <div class="results-actions">
                                <button
                                    class="btn btn-sm btn-secondary"
                                    onClick=${() => exportBatchResults('json')}
                                >
                                    📄 导出JSON
                                </button>
                                <button
                                    class="btn btn-sm btn-secondary"
                                    onClick=${() => exportBatchResults('csv')}
                                >
                                    📊 导出CSV
                                </button>
                            </div>
                        </div>
                        <div class="results-stats">
                            <div class="stat-item success">
                                <span class="stat-label">成功</span>
                                <span class="stat-value">
                                    ${batchResults.filter(r => r.success).length}
                                </span>
                            </div>
                            <div class="stat-item error">
                                <span class="stat-label">失败</span>
                                <span class="stat-value">
                                    ${batchResults.filter(r => !r.success).length}
                                </span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总计</span>
                                <span class="stat-value">${batchResults.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">成功率</span>
                                <span class="stat-value">
                                    ${batchResults.length > 0 ? 
                                        Math.round((batchResults.filter(r => r.success).length / batchResults.length) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                        
                        <!-- Detailed Results -->
                        <div class="detailed-results">
                            <h5>详细结果</h5>
                            <div class="results-list">
                                ${batchResults.map((result, index) => html`
                                    <div key=${index} class="result-item ${result.success ? 'success' : 'error'}">
                                        <div class="result-header">
                                            <span class="config-name">${result.configName}</span>
                                            <span class="protocol-name">${result.protocol}</span>
                                            <span class="test-type">${result.testType}</span>
                                            <span class="duration">${result.duration}ms</span>
                                        </div>
                                        ${result.error && html`
                                            <div class="result-error">
                                                错误: ${result.error}
                                            </div>
                                        `}
                                        ${result.data && html`
                                            <div class="result-data">
                                                <details>
                                                    <summary>详细数据</summary>
                                                    <pre>${JSON.stringify(result.data, null, 2)}</pre>
                                                </details>
                                            </div>
                                        `}
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                `}
            </div>

            <!-- Add Test Dialog -->
            ${showAddDialog && html`
                <${AddTestDialog}
                    onAdd=${addTestConfig}
                    onCancel=${() => setShowAddDialog(false)}
                />
            `}
        </div>
    `;
};

// Test Configuration Card Component
const TestConfigCard = ({ config, onToggle, onRemove, onUpdate, disabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editConfig, setEditConfig] = useState(config);

    const protocolInfo = SUPPORTED_PROTOCOLS[config.protocol];

    const saveEdit = () => {
        onUpdate(editConfig);
        setIsEditing(false);
    };

    const cancelEdit = () => {
        setEditConfig(config);
        setIsEditing(false);
    };

    return html`
        <div class="test-config-card ${config.enabled ? 'enabled' : 'disabled'}">
            <div class="config-header">
                <div class="config-info">
                    <label class="checkbox-label">
                        <input
                            type="checkbox"
                            checked=${config.enabled}
                            onChange=${onToggle}
                            disabled=${disabled}
                        />
                        <span class="config-name">${config.name}</span>
                    </label>
                    <div class="config-protocol">
                        <span class="protocol-icon">${protocolInfo?.icon}</span>
                        <span class="protocol-name">${protocolInfo?.name}</span>
                        <span class="test-type">${config.testType}</span>
                    </div>
                </div>
                <div class="config-actions">
                    <button
                        class="btn btn-sm btn-secondary"
                        onClick=${() => setIsEditing(!isEditing)}
                        disabled=${disabled}
                    >
                        ${isEditing ? '取消' : '编辑'}
                    </button>
                    <button
                        class="btn btn-sm btn-error"
                        onClick=${onRemove}
                        disabled=${disabled}
                    >
                        删除
                    </button>
                </div>
            </div>

            ${isEditing ? html`
                <div class="config-edit">
                    <div class="edit-field">
                        <label>测试名称</label>
                        <input
                            type="text"
                            class="form-input"
                            value=${editConfig.name}
                            onChange=${(e) => setEditConfig(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div class="edit-actions">
                        <button class="btn btn-sm btn-primary" onClick=${saveEdit}>
                            保存
                        </button>
                        <button class="btn btn-sm btn-secondary" onClick=${cancelEdit}>
                            取消
                        </button>
                    </div>
                </div>
            ` : html`
                <div class="config-details">
                    <div class="config-params">
                        ${Object.entries(config.config).map(([key, value]) => html`
                            <div key=${key} class="param-item">
                                <span class="param-key">${key}:</span>
                                <span class="param-value">${value}</span>
                            </div>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

// Add Test Dialog Component
const AddTestDialog = ({ onAdd, onCancel }) => {
    const [protocol, setProtocol] = useState('OPC_UA');
    const [testName, setTestName] = useState('');
    const [config, setConfig] = useState({});
    const [testType, setTestType] = useState('connect');

    // Initialize config when protocol changes
    useEffect(() => {
        const defaultConfig = protocolService.getDefaultConfig(protocol);
        setConfig(defaultConfig);
        
        const protocolDef = SUPPORTED_PROTOCOLS[protocol];
        if (protocolDef && protocolDef.testMethods.length > 0) {
            setTestType(protocolDef.testMethods[0]);
        }
        
        if (!testName) {
            setTestName(`${protocolDef?.name} 测试`);
        }
    }, [protocol]);

    const handleAdd = () => {
        if (!testName.trim()) {
            alert('请输入测试名称');
            return;
        }

        onAdd({
            name: testName.trim(),
            protocol,
            config,
            testType
        });
    };

    const protocolDef = SUPPORTED_PROTOCOLS[protocol];

    return html`
        <div class="dialog-overlay">
            <div class="dialog">
                <div class="dialog-header">
                    <h3>添加测试配置</h3>
                    <button class="dialog-close" onClick=${onCancel}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="form-field">
                        <label class="form-label">测试名称</label>
                        <input
                            type="text"
                            class="form-input"
                            value=${testName}
                            onChange=${(e) => setTestName(e.target.value)}
                            placeholder="输入测试名称"
                        />
                    </div>

                    <div class="form-field">
                        <label class="form-label">协议类型</label>
                        <select
                            class="form-select"
                            value=${protocol}
                            onChange=${(e) => setProtocol(e.target.value)}
                        >
                            ${Object.entries(SUPPORTED_PROTOCOLS).map(([key, proto]) => html`
                                <option key=${key} value=${key}>
                                    ${proto.icon} ${proto.name}
                                </option>
                            `)}
                        </select>
                    </div>

                    <div class="form-field">
                        <label class="form-label">测试类型</label>
                        <select
                            class="form-select"
                            value=${testType}
                            onChange=${(e) => setTestType(e.target.value)}
                        >
                            ${protocolDef?.testMethods.map(method => html`
                                <option key=${method} value=${method}>
                                    ${method}
                                </option>
                            `)}
                        </select>
                    </div>

                    <div class="form-field">
                        <label class="form-label">基本配置</label>
                        <div class="config-preview">
                            <pre>${JSON.stringify(config, null, 2)}</pre>
                        </div>
                        <p class="form-help">
                            配置将使用默认值，添加后可以编辑具体参数
                        </p>
                    </div>
                </div>

                <div class="dialog-actions">
                    <button class="btn btn-secondary" onClick=${onCancel}>
                        取消
                    </button>
                    <button class="btn btn-primary" onClick=${handleAdd}>
                        添加
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default BatchTester;