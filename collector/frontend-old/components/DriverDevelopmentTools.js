/**
 * Driver Development Tools Component for ProDB Collector
 * Provides interface documentation, testing tools, and development utilities
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';
import { driverService } from '../services/drivers.js';
import { formatTime } from '../utils/helpers.js';

const DriverDevelopmentTools = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('documentation'); // 'documentation' | 'testing' | 'templates' | 'validator'
    const [apiDocumentation, setApiDocumentation] = useState(null);
    const [testResults, setTestResults] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDevelopmentData();
    }, []);

    /**
     * Load development tools data
     */
    const loadDevelopmentData = async () => {
        try {
            setLoading(true);
            
            const [docs, templateList] = await Promise.all([
                driverService.getDriverAPIDocumentation(),
                driverService.getDriverTemplates()
            ]);

            setApiDocumentation(docs);
            setTemplates(templateList);

        } catch (err) {
            console.error('Failed to load development data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return html`
        <${Modal} onClose=${onClose} title="驱动开发工具" size="extra-large">
            <div class="development-tools">
                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    <button 
                        class="tab-button ${activeTab === 'documentation' ? 'active' : ''}"
                        onClick=${() => setActiveTab('documentation')}
                    >
                        📚 接口文档
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'testing' ? 'active' : ''}"
                        onClick=${() => setActiveTab('testing')}
                    >
                        🧪 测试工具
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'templates' ? 'active' : ''}"
                        onClick=${() => setActiveTab('templates')}
                    >
                        📋 代码模板
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'validator' ? 'active' : ''}"
                        onClick=${() => setActiveTab('validator')}
                    >
                        ✅ 代码验证
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                    <!-- API Documentation Tab -->
                    ${activeTab === 'documentation' && html`
                        <${APIDocumentationTab} 
                            documentation=${apiDocumentation}
                            loading=${loading}
                        />
                    `}

                    <!-- Testing Tools Tab -->
                    ${activeTab === 'testing' && html`
                        <${TestingToolsTab} 
                            testResults=${testResults}
                            onTestComplete=${(results) => setTestResults([...testResults, ...results])}
                        />
                    `}

                    <!-- Code Templates Tab -->
                    ${activeTab === 'templates' && html`
                        <${CodeTemplatesTab} 
                            templates=${templates}
                            loading=${loading}
                        />
                    `}

                    <!-- Code Validator Tab -->
                    ${activeTab === 'validator' && html`
                        <${CodeValidatorTab} />
                    `}
                </div>

                <!-- Error Display -->
                ${error && html`
                    <div class="alert alert-error">
                        <span class="alert-icon">⚠️</span>
                        <span class="alert-message">${error}</span>
                        <button 
                            class="alert-close" 
                            onClick=${() => setError(null)}
                        >
                            ×
                        </button>
                    </div>
                `}

                <!-- Dialog Actions -->
                <div class="dialog-actions">
                    <button 
                        class="btn btn-secondary" 
                        onClick=${onClose}
                    >
                        关闭
                    </button>
                </div>
            </div>
        <//>
    `;
};

/**
 * API Documentation Tab Component
 */
const APIDocumentationTab = ({ documentation, loading }) => {
    const [selectedSection, setSelectedSection] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');

    if (loading) {
        return html`
            <div class="loading-container">
                <div class="spinner"></div>
                <p>加载API文档...</p>
            </div>
        `;
    }

    if (!documentation) {
        return html`
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>API文档不可用</h3>
                <p>请稍后再试或联系管理员</p>
            </div>
        `;
    }

    const filteredSections = documentation.sections?.filter(section =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.content.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return html`
        <div class="api-documentation">
            <!-- Documentation Sidebar -->
            <div class="doc-sidebar">
                <div class="doc-search">
                    <input
                        type="text"
                        placeholder="搜索文档..."
                        value=${searchQuery}
                        onInput=${(e) => setSearchQuery(e.target.value)}
                        class="search-input"
                    />
                </div>

                <div class="doc-navigation">
                    <div class="nav-section">
                        <h4>快速开始</h4>
                        <ul class="nav-list">
                            <li>
                                <button 
                                    class="nav-link ${selectedSection === 'overview' ? 'active' : ''}"
                                    onClick=${() => setSelectedSection('overview')}
                                >
                                    概述
                                </button>
                            </li>
                            <li>
                                <button 
                                    class="nav-link ${selectedSection === 'quickstart' ? 'active' : ''}"
                                    onClick=${() => setSelectedSection('quickstart')}
                                >
                                    快速开始
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h4>核心接口</h4>
                        <ul class="nav-list">
                            ${documentation.coreInterfaces?.map(iface => html`
                                <li key=${iface.name}>
                                    <button 
                                        class="nav-link ${selectedSection === iface.name ? 'active' : ''}"
                                        onClick=${() => setSelectedSection(iface.name)}
                                    >
                                        ${iface.title}
                                    </button>
                                </li>
                            `)}
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h4>协议实现</h4>
                        <ul class="nav-list">
                            ${documentation.protocols?.map(protocol => html`
                                <li key=${protocol.name}>
                                    <button 
                                        class="nav-link ${selectedSection === protocol.name ? 'active' : ''}"
                                        onClick=${() => setSelectedSection(protocol.name)}
                                    >
                                        ${protocol.title}
                                    </button>
                                </li>
                            `)}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Documentation Content -->
            <div class="doc-content">
                <${DocumentationSection} 
                    section=${selectedSection}
                    documentation=${documentation}
                />
            </div>
        </div>
    `;
};

/**
 * Documentation Section Component
 */
const DocumentationSection = ({ section, documentation }) => {
    const getSectionContent = () => {
        switch (section) {
            case 'overview':
                return documentation.overview;
            case 'quickstart':
                return documentation.quickstart;
            default:
                // Find in core interfaces or protocols
                const coreInterface = documentation.coreInterfaces?.find(i => i.name === section);
                if (coreInterface) return coreInterface;
                
                const protocol = documentation.protocols?.find(p => p.name === section);
                if (protocol) return protocol;
                
                return null;
        }
    };

    const content = getSectionContent();

    if (!content) {
        return html`
            <div class="doc-section-empty">
                <h3>内容不可用</h3>
                <p>所选章节的内容暂时不可用</p>
            </div>
        `;
    }

    return html`
        <div class="doc-section">
            <div class="doc-header">
                <h2>${content.title}</h2>
                ${content.version && html`
                    <span class="doc-version">v${content.version}</span>
                `}
            </div>

            <div class="doc-body">
                <!-- Description -->
                ${content.description && html`
                    <div class="doc-description">
                        <p>${content.description}</p>
                    </div>
                `}

                <!-- Code Examples -->
                ${content.examples && html`
                    <div class="doc-examples">
                        <h3>代码示例</h3>
                        ${content.examples.map(example => html`
                            <${CodeExample} 
                                key=${example.title}
                                example=${example}
                            />
                        `)}
                    </div>
                `}

                <!-- API Methods -->
                ${content.methods && html`
                    <div class="doc-methods">
                        <h3>API方法</h3>
                        ${content.methods.map(method => html`
                            <${APIMethod} 
                                key=${method.name}
                                method=${method}
                            />
                        `)}
                    </div>
                `}

                <!-- Configuration Schema -->
                ${content.configSchema && html`
                    <div class="doc-config">
                        <h3>配置参数</h3>
                        <${ConfigurationSchema} schema=${content.configSchema} />
                    </div>
                `}

                <!-- Events -->
                ${content.events && html`
                    <div class="doc-events">
                        <h3>事件</h3>
                        ${content.events.map(event => html`
                            <${EventDocumentation} 
                                key=${event.name}
                                event=${event}
                            />
                        `)}
                    </div>
                `}
            </div>
        </div>
    `;
};

/**
 * Code Example Component
 */
const CodeExample = ({ example }) => {
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        navigator.clipboard.writeText(example.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return html`
        <div class="code-example">
            <div class="example-header">
                <h4>${example.title}</h4>
                <button 
                    class="btn btn-sm btn-ghost"
                    onClick=${copyCode}
                    title="复制代码"
                >
                    ${copied ? '✅ 已复制' : '📋 复制'}
                </button>
            </div>
            
            ${example.description && html`
                <p class="example-description">${example.description}</p>
            `}
            
            <pre class="code-block">
                <code class="language-${example.language || 'javascript'}">
                    ${example.code}
                </code>
            </pre>
        </div>
    `;
};

/**
 * API Method Component
 */
const APIMethod = ({ method }) => {
    return html`
        <div class="api-method">
            <div class="method-signature">
                <code class="method-name">${method.name}</code>
                <span class="method-params">(${method.parameters?.map(p => p.name).join(', ') || ''})</span>
                ${method.returnType && html`
                    <span class="method-return">: ${method.returnType}</span>
                `}
            </div>
            
            <div class="method-description">
                <p>${method.description}</p>
            </div>

            <!-- Parameters -->
            ${method.parameters && method.parameters.length > 0 && html`
                <div class="method-parameters">
                    <h5>参数</h5>
                    <table class="params-table">
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>类型</th>
                                <th>必需</th>
                                <th>描述</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${method.parameters.map(param => html`
                                <tr key=${param.name}>
                                    <td><code>${param.name}</code></td>
                                    <td><code>${param.type}</code></td>
                                    <td>${param.required ? '是' : '否'}</td>
                                    <td>${param.description}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
            `}

            <!-- Return Value -->
            ${method.returns && html`
                <div class="method-returns">
                    <h5>返回值</h5>
                    <p><code>${method.returns.type}</code> - ${method.returns.description}</p>
                </div>
            `}

            <!-- Example -->
            ${method.example && html`
                <div class="method-example">
                    <h5>示例</h5>
                    <${CodeExample} example=${method.example} />
                </div>
            `}
        </div>
    `;
};

/**
 * Testing Tools Tab Component
 */
const TestingToolsTab = ({ testResults, onTestComplete }) => {
    const [testCode, setTestCode] = useState('');
    const [testType, setTestType] = useState('unit'); // 'unit' | 'integration' | 'performance'
    const [testing, setTesting] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('');

    const testTemplates = {
        unit: `// 单元测试模板
class MyDriverTest {
    async testConnection() {
        const driver = new MyDriver();
        const config = {
            host: 'localhost',
            port: 502
        };
        
        const result = await driver.connect(config);
        assert(result.success, '连接应该成功');
    }
    
    async testDataRead() {
        // 测试数据读取功能
    }
}`,
        integration: `// 集成测试模板
class IntegrationTest {
    async testFullWorkflow() {
        const driver = new MyDriver();
        
        // 1. 连接
        await driver.connect(config);
        
        // 2. 读取数据
        const data = await driver.readData();
        
        // 3. 验证数据
        assert(data.length > 0, '应该读取到数据');
        
        // 4. 断开连接
        await driver.disconnect();
    }
}`,
        performance: `// 性能测试模板
class PerformanceTest {
    async testThroughput() {
        const driver = new MyDriver();
        const startTime = Date.now();
        
        for (let i = 0; i < 1000; i++) {
            await driver.readData();
        }
        
        const duration = Date.now() - startTime;
        const throughput = 1000 / (duration / 1000);
        
        console.log(\`吞吐量: \${throughput} ops/sec\`);
        assert(throughput > 100, '吞吐量应该大于100 ops/sec');
    }
}`
    };

    const runTest = async () => {
        try {
            setTesting(true);
            
            const result = await driverService.runDriverTest({
                code: testCode,
                type: testType
            });
            
            onTestComplete([result]);
            
        } catch (error) {
            console.error('Test failed:', error);
            onTestComplete([{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setTesting(false);
        }
    };

    const loadTemplate = (template) => {
        setTestCode(testTemplates[template] || '');
        setSelectedTemplate(template);
    };

    return html`
        <div class="testing-tools">
            <!-- Test Configuration -->
            <div class="test-config">
                <div class="config-row">
                    <label class="form-label">测试类型</label>
                    <select 
                        value=${testType} 
                        onChange=${(e) => setTestType(e.target.value)}
                        class="form-select"
                    >
                        <option value="unit">单元测试</option>
                        <option value="integration">集成测试</option>
                        <option value="performance">性能测试</option>
                    </select>
                </div>

                <div class="config-row">
                    <label class="form-label">代码模板</label>
                    <select 
                        value=${selectedTemplate} 
                        onChange=${(e) => loadTemplate(e.target.value)}
                        class="form-select"
                    >
                        <option value="">选择模板...</option>
                        <option value="unit">单元测试模板</option>
                        <option value="integration">集成测试模板</option>
                        <option value="performance">性能测试模板</option>
                    </select>
                </div>
            </div>

            <!-- Code Editor -->
            <div class="test-editor">
                <div class="editor-header">
                    <h4>测试代码</h4>
                    <div class="editor-actions">
                        <button 
                            class="btn btn-sm btn-secondary"
                            onClick=${() => setTestCode('')}
                        >
                            清空
                        </button>
                        <button 
                            class="btn btn-sm btn-primary"
                            onClick=${runTest}
                            disabled=${!testCode.trim() || testing}
                        >
                            ${testing ? '运行中...' : '运行测试'}
                        </button>
                    </div>
                </div>
                
                <textarea
                    class="code-textarea"
                    value=${testCode}
                    onInput=${(e) => setTestCode(e.target.value)}
                    placeholder="在此输入测试代码..."
                    rows="20"
                />
            </div>

            <!-- Test Results -->
            <div class="test-results">
                <h4>测试结果</h4>
                ${testResults.length === 0 ? html`
                    <div class="empty-results">
                        <p>暂无测试结果</p>
                    </div>
                ` : html`
                    <div class="results-list">
                        ${testResults.map((result, index) => html`
                            <${TestResult} 
                                key=${index}
                                result=${result}
                            />
                        `)}
                    </div>
                `}
            </div>
        </div>
    `;
};

/**
 * Test Result Component
 */
const TestResult = ({ result }) => {
    const [expanded, setExpanded] = useState(false);

    return html`
        <div class="test-result ${result.success ? 'success' : 'failure'}">
            <div class="result-header" onClick=${() => setExpanded(!expanded)}>
                <div class="result-info">
                    <span class="result-icon">
                        ${result.success ? '✅' : '❌'}
                    </span>
                    <span class="result-status">
                        ${result.success ? '通过' : '失败'}
                    </span>
                    <span class="result-time">
                        ${formatTime(result.timestamp)}
                    </span>
                </div>
                
                <span class="expand-icon ${expanded ? 'expanded' : ''}">
                    ▼
                </span>
            </div>

            ${expanded && html`
                <div class="result-details">
                    ${result.output && html`
                        <div class="result-output">
                            <h5>输出</h5>
                            <pre>${result.output}</pre>
                        </div>
                    `}
                    
                    ${result.error && html`
                        <div class="result-error">
                            <h5>错误</h5>
                            <pre class="error-text">${result.error}</pre>
                        </div>
                    `}
                    
                    ${result.metrics && html`
                        <div class="result-metrics">
                            <h5>性能指标</h5>
                            <div class="metrics-grid">
                                ${Object.entries(result.metrics).map(([key, value]) => html`
                                    <div key=${key} class="metric-item">
                                        <span class="metric-label">${key}:</span>
                                        <span class="metric-value">${value}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
};

/**
 * Code Templates Tab Component
 */
const CodeTemplatesTab = ({ templates, loading }) => {
    const [selectedCategory, setSelectedCategory] = useState('basic');
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    if (loading) {
        return html`
            <div class="loading-container">
                <div class="spinner"></div>
                <p>加载代码模板...</p>
            </div>
        `;
    }

    const categories = templates.reduce((acc, template) => {
        if (!acc[template.category]) {
            acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
    }, {});

    return html`
        <div class="code-templates">
            <!-- Template Categories -->
            <div class="template-sidebar">
                <h4>模板分类</h4>
                <div class="category-list">
                    ${Object.keys(categories).map(category => html`
                        <button
                            key=${category}
                            class="category-button ${selectedCategory === category ? 'active' : ''}"
                            onClick=${() => setSelectedCategory(category)}
                        >
                            ${category} (${categories[category].length})
                        </button>
                    `)}
                </div>
            </div>

            <!-- Template List -->
            <div class="template-content">
                <div class="template-list">
                    ${(categories[selectedCategory] || []).map(template => html`
                        <${TemplateCard}
                            key=${template.id}
                            template=${template}
                            onSelect=${() => setSelectedTemplate(template)}
                            selected=${selectedTemplate?.id === template.id}
                        />
                    `)}
                </div>

                <!-- Template Preview -->
                ${selectedTemplate && html`
                    <div class="template-preview">
                        <${TemplatePreview} template=${selectedTemplate} />
                    </div>
                `}
            </div>
        </div>
    `;
};

/**
 * Template Card Component
 */
const TemplateCard = ({ template, onSelect, selected }) => {
    return html`
        <div class="template-card ${selected ? 'selected' : ''}" onClick=${onSelect}>
            <div class="template-header">
                <h4>${template.name}</h4>
                <span class="template-protocol">${template.protocol}</span>
            </div>
            <p class="template-description">${template.description}</p>
            <div class="template-meta">
                <span class="template-language">${template.language}</span>
                <span class="template-complexity">${template.complexity}</span>
            </div>
        </div>
    `;
};

/**
 * Template Preview Component
 */
const TemplatePreview = ({ template }) => {
    const [copied, setCopied] = useState(false);

    const copyTemplate = () => {
        navigator.clipboard.writeText(template.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadTemplate = () => {
        const blob = new Blob([template.code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.name}.${template.language}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return html`
        <div class="template-preview">
            <div class="preview-header">
                <h3>${template.name}</h3>
                <div class="preview-actions">
                    <button 
                        class="btn btn-sm btn-secondary"
                        onClick=${copyTemplate}
                    >
                        ${copied ? '✅ 已复制' : '📋 复制'}
                    </button>
                    <button 
                        class="btn btn-sm btn-primary"
                        onClick=${downloadTemplate}
                    >
                        💾 下载
                    </button>
                </div>
            </div>

            <div class="preview-info">
                <p class="template-description">${template.description}</p>
                <div class="template-details">
                    <span class="detail-item">协议: ${template.protocol}</span>
                    <span class="detail-item">语言: ${template.language}</span>
                    <span class="detail-item">复杂度: ${template.complexity}</span>
                </div>
            </div>

            <div class="preview-code">
                <pre class="code-block">
                    <code class="language-${template.language}">
                        ${template.code}
                    </code>
                </pre>
            </div>

            ${template.usage && html`
                <div class="template-usage">
                    <h4>使用说明</h4>
                    <div class="usage-content">
                        ${template.usage.split('\n').map(line => html`
                            <p key=${line}>${line}</p>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

/**
 * Code Validator Tab Component
 */
const CodeValidatorTab = () => {
    const [code, setCode] = useState('');
    const [validationResults, setValidationResults] = useState(null);
    const [validating, setValidating] = useState(false);

    const validateCode = async () => {
        try {
            setValidating(true);
            
            const results = await driverService.validateDriverCode(code);
            setValidationResults(results);
            
        } catch (error) {
            console.error('Validation failed:', error);
            setValidationResults({
                valid: false,
                errors: [error.message]
            });
        } finally {
            setValidating(false);
        }
    };

    return html`
        <div class="code-validator">
            <div class="validator-header">
                <h3>驱动代码验证</h3>
                <button 
                    class="btn btn-primary"
                    onClick=${validateCode}
                    disabled=${!code.trim() || validating}
                >
                    ${validating ? '验证中...' : '🔍 验证代码'}
                </button>
            </div>

            <div class="code-input">
                <textarea
                    class="code-textarea"
                    value=${code}
                    onInput=${(e) => setCode(e.target.value)}
                    placeholder="在此粘贴驱动代码进行验证..."
                    rows="15"
                />
            </div>

            ${validationResults && html`
                <div class="validation-results">
                    <div class="results-header">
                        <h4>验证结果</h4>
                        <span class="validation-status ${validationResults.valid ? 'valid' : 'invalid'}">
                            ${validationResults.valid ? '✅ 通过' : '❌ 未通过'}
                        </span>
                    </div>

                    ${validationResults.errors && validationResults.errors.length > 0 && html`
                        <div class="validation-errors">
                            <h5>错误</h5>
                            ${validationResults.errors.map(error => html`
                                <div key=${error} class="validation-error">
                                    ❌ ${error}
                                </div>
                            `)}
                        </div>
                    `}

                    ${validationResults.warnings && validationResults.warnings.length > 0 && html`
                        <div class="validation-warnings">
                            <h5>警告</h5>
                            ${validationResults.warnings.map(warning => html`
                                <div key=${warning} class="validation-warning">
                                    ⚠️ ${warning}
                                </div>
                            `)}
                        </div>
                    `}

                    ${validationResults.suggestions && validationResults.suggestions.length > 0 && html`
                        <div class="validation-suggestions">
                            <h5>建议</h5>
                            ${validationResults.suggestions.map(suggestion => html`
                                <div key=${suggestion} class="validation-suggestion">
                                    💡 ${suggestion}
                                </div>
                            `)}
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
};

export default DriverDevelopmentTools;