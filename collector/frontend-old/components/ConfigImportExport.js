/**
 * Enhanced Configuration Import/Export Component for ProDB Collector
 * Handles configuration backup, restore, import and export functionality with multiple formats
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const ConfigImportExport = ({ interfaces = [], onImport, onClose }) => {
    const [activeTab, setActiveTab] = useState('export');
    const [exportFormat, setExportFormat] = useState('json');
    const [exportSelection, setExportSelection] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);
    const [importData, setImportData] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState('');

    const exportFormats = {
        json: { name: 'JSON', extension: 'json', mime: 'application/json', description: '标准JSON格式，完整保留所有配置信息' },
        csv: { name: 'CSV', extension: 'csv', mime: 'text/csv', description: 'CSV表格格式，适合Excel查看和编辑' },
        xml: { name: 'XML', extension: 'xml', mime: 'application/xml', description: 'XML格式，适合系统集成' },
        yaml: { name: 'YAML', extension: 'yaml', mime: 'text/yaml', description: 'YAML格式，人类可读性好' }
    };

    const handleExport = async () => {
        setProcessing(true);
        setMessage('');

        try {
            const interfacesToExport = exportSelection === 'all' 
                ? interfaces 
                : interfaces.filter(iface => selectedIds.includes(iface.id));

            if (interfacesToExport.length === 0) {
                setMessage('请选择要导出的接口配置');
                return;
            }

            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                source: 'ProDB Collector',
                interfaces: interfacesToExport.map(iface => ({
                    ...iface,
                    // Remove runtime-specific fields
                    id: undefined,
                    status: undefined,
                    createdAt: undefined,
                    updatedAt: undefined
                })).map(({ id, status, createdAt, updatedAt, ...rest }) => rest)
            };

            let content, filename, mimeType;

            switch (exportFormat) {
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename = `collector-config-${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json';
                    break;
                case 'yaml':
                    content = convertToYAML(exportData);
                    filename = `collector-config-${new Date().toISOString().split('T')[0]}.yaml`;
                    mimeType = 'text/yaml';
                    break;
                case 'csv':
                    content = convertToCSV(exportData.interfaces);
                    filename = `collector-config-${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv';
                    break;
                default:
                    throw new Error('不支持的导出格式');
            }

            // Create and download file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage(`成功导出 ${interfacesToExport.length} 个接口配置`);
        } catch (error) {
            console.error('Export failed:', error);
            setMessage(`导出失败: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleImport = async () => {
        setProcessing(true);
        setMessage('');

        try {
            let data;
            
            if (importFile) {
                const text = await readFileAsText(importFile);
                data = parseImportData(text, importFile.name);
            } else if (importData.trim()) {
                data = parseImportData(importData);
            } else {
                setMessage('请选择文件或输入配置数据');
                return;
            }

            if (!data.interfaces || !Array.isArray(data.interfaces)) {
                throw new Error('无效的配置数据格式');
            }

            // Validate imported interfaces
            const validatedInterfaces = data.interfaces.map((iface, index) => {
                if (!iface.name || !iface.protocol) {
                    throw new Error(`接口 ${index + 1} 缺少必要字段 (name, protocol)`);
                }

                return {
                    ...iface,
                    id: `imported-${Date.now()}-${index}`,
                    status: 'disconnected',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });

            await onImport(validatedInterfaces);
            setMessage(`成功导入 ${validatedInterfaces.length} 个接口配置`);
            setImportData('');
            setImportFile(null);
        } catch (error) {
            console.error('Import failed:', error);
            setMessage(`导入失败: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const parseImportData = (text, filename = '') => {
        try {
            // Try JSON first
            return JSON.parse(text);
        } catch (jsonError) {
            // Try YAML if JSON fails
            if (filename.toLowerCase().endsWith('.yaml') || filename.toLowerCase().endsWith('.yml')) {
                return parseYAML(text);
            }
            throw new Error('无法解析配置数据格式');
        }
    };

    const parseYAML = (yamlText) => {
        // Simple YAML parser for basic structures
        const lines = yamlText.split('\n');
        const result = {};
        let currentKey = null;
        let currentArray = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.endsWith(':')) {
                currentKey = trimmed.slice(0, -1);
                result[currentKey] = {};
                currentArray = null;
            } else if (trimmed.startsWith('- ')) {
                if (!currentArray) {
                    currentArray = [];
                    result[currentKey] = currentArray;
                }
                currentArray.push(trimmed.slice(2));
            } else if (trimmed.includes(': ')) {
                const [key, value] = trimmed.split(': ', 2);
                if (currentKey) {
                    result[currentKey][key] = value;
                } else {
                    result[key] = value;
                }
            }
        }
        
        return result;
    };

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    };

    const convertToYAML = (data) => {
        // Simple YAML conversion
        const convertValue = (value, indent = 0) => {
            const spaces = '  '.repeat(indent);
            
            if (Array.isArray(value)) {
                return value.map(item => `${spaces}- ${convertValue(item, 0)}`).join('\n');
            } else if (typeof value === 'object' && value !== null) {
                return Object.entries(value)
                    .map(([key, val]) => {
                        if (typeof val === 'object' && val !== null) {
                            return `${spaces}${key}:\n${convertValue(val, indent + 1)}`;
                        } else {
                            return `${spaces}${key}: ${val}`;
                        }
                    })
                    .join('\n');
            } else {
                return String(value);
            }
        };
        
        return convertValue(data);
    };

    const convertToCSV = (interfaces) => {
        if (!interfaces || interfaces.length === 0) return '';
        
        const headers = ['name', 'protocol', 'enabled'];
        const configKeys = new Set();
        
        // Collect all config keys
        interfaces.forEach(iface => {
            if (iface.config) {
                Object.keys(iface.config).forEach(key => configKeys.add(key));
            }
        });
        
        const allHeaders = [...headers, ...Array.from(configKeys)];
        
        const csvRows = [
            allHeaders.join(','),
            ...interfaces.map(iface => {
                const row = [];
                row.push(`"${iface.name || ''}"`);
                row.push(`"${iface.protocol || ''}"`);
                row.push(iface.enabled ? 'true' : 'false');
                
                configKeys.forEach(key => {
                    const value = iface.config?.[key] || '';
                    row.push(`"${String(value).replace(/"/g, '""')}"`);
                });
                
                return row.join(',');
            })
        ];
        
        return csvRows.join('\n');
    };

    return html`
        <div class="config-import-export">
            <div class="import-export-header">
                <h2>配置导入导出</h2>
                <p>备份、恢复和迁移接口配置</p>
                <button class="close-button" onClick=${onClose}>✕</button>
            </div>

            <div class="import-export-content">
                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    <button
                        class="tab-button ${activeTab === 'export' ? 'active' : ''}"
                        onClick=${() => setActiveTab('export')}
                    >
                        <span class="tab-icon">📤</span>
                        导出配置
                    </button>
                    <button
                        class="tab-button ${activeTab === 'import' ? 'active' : ''}"
                        onClick=${() => setActiveTab('import')}
                    >
                        <span class="tab-icon">📥</span>
                        导入配置
                    </button>
                </div>

                <!-- Export Tab -->
                ${activeTab === 'export' && html`
                    <div class="export-section">
                        <div class="export-options">
                            <div class="option-group">
                                <h3>选择导出范围</h3>
                                <label class="radio-option">
                                    <input
                                        type="radio"
                                        name="exportSelection"
                                        value="all"
                                        checked=${exportSelection === 'all'}
                                        onChange=${(e) => setExportSelection(e.target.value)}
                                    />
                                    <span>导出所有接口 (${interfaces.length} 个)</span>
                                </label>
                                <label class="radio-option">
                                    <input
                                        type="radio"
                                        name="exportSelection"
                                        value="selected"
                                        checked=${exportSelection === 'selected'}
                                        onChange=${(e) => setExportSelection(e.target.value)}
                                    />
                                    <span>导出选中接口</span>
                                </label>
                                
                                ${exportSelection === 'selected' && html`
                                    <div class="interface-selection">
                                        ${interfaces.map(iface => html`
                                            <label class="checkbox-option" key=${iface.id}>
                                                <input
                                                    type="checkbox"
                                                    checked=${selectedIds.includes(iface.id)}
                                                    onChange=${(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedIds(prev => [...prev, iface.id]);
                                                        } else {
                                                            setSelectedIds(prev => prev.filter(id => id !== iface.id));
                                                        }
                                                    }}
                                                />
                                                <span>${iface.name} (${iface.protocol})</span>
                                            </label>
                                        `)}
                                    </div>
                                `}
                            </div>

                            <div class="option-group">
                                <h3>选择导出格式</h3>
                                <label class="radio-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="json"
                                        checked=${exportFormat === 'json'}
                                        onChange=${(e) => setExportFormat(e.target.value)}
                                    />
                                    <span>JSON 格式 (推荐)</span>
                                </label>
                                <label class="radio-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="yaml"
                                        checked=${exportFormat === 'yaml'}
                                        onChange=${(e) => setExportFormat(e.target.value)}
                                    />
                                    <span>YAML 格式</span>
                                </label>
                                <label class="radio-option">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="csv"
                                        checked=${exportFormat === 'csv'}
                                        onChange=${(e) => setExportFormat(e.target.value)}
                                    />
                                    <span>CSV 格式 (仅基本信息)</span>
                                </label>
                            </div>
                        </div>

                        <div class="export-actions">
                            <button
                                class="btn btn-primary"
                                onClick=${handleExport}
                                disabled=${processing}
                            >
                                ${processing ? html`
                                    <span class="spinner small"></span>
                                    导出中...
                                ` : html`
                                    <span class="btn-icon">📤</span>
                                    开始导出
                                `}
                            </button>
                        </div>
                    </div>
                `}

                <!-- Import Tab -->
                ${activeTab === 'import' && html`
                    <div class="import-section">
                        <div class="import-options">
                            <div class="option-group">
                                <h3>选择导入方式</h3>
                                
                                <div class="import-method">
                                    <h4>文件上传</h4>
                                    <input
                                        type="file"
                                        accept=".json,.yaml,.yml,.csv"
                                        onChange=${(e) => {
                                            setImportFile(e.target.files[0]);
                                            setImportData('');
                                        }}
                                        class="file-input"
                                    />
                                    ${importFile && html`
                                        <div class="file-info">
                                            <span class="file-name">${importFile.name}</span>
                                            <span class="file-size">(${(importFile.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                    `}
                                </div>

                                <div class="import-method">
                                    <h4>直接输入</h4>
                                    <textarea
                                        class="import-textarea"
                                        placeholder="粘贴配置数据 (JSON 或 YAML 格式)..."
                                        value=${importData}
                                        onInput=${(e) => {
                                            setImportData(e.target.value);
                                            setImportFile(null);
                                        }}
                                        rows="10"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div class="import-actions">
                            <button
                                class="btn btn-primary"
                                onClick=${handleImport}
                                disabled=${processing || (!importFile && !importData.trim())}
                            >
                                ${processing ? html`
                                    <span class="spinner small"></span>
                                    导入中...
                                ` : html`
                                    <span class="btn-icon">📥</span>
                                    开始导入
                                `}
                            </button>
                        </div>
                    </div>
                `}

                <!-- Status Message -->
                ${message && html`
                    <div class="status-message ${message.includes('失败') ? 'error' : 'success'}">
                        ${message}
                        <button 
                            class="message-close"
                            onClick=${() => setMessage('')}
                        >
                            ✕
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
};

export default ConfigImportExport;