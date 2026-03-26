/**
 * Protocol Testing Page
 * Provides comprehensive protocol testing functionality with multiple test modes
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import components
import ProtocolTester from '../components/ProtocolTester.js';
import DeviceScanner from '../components/DeviceScanner.js';
import BatchTester from '../components/BatchTester.js';
import TestResultsDisplay from '../components/TestResultsDisplay.js';
import TestReportGenerator from '../components/TestReportGenerator.js';

// Import services
import { protocolService } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

const html = htm.bind(h);

const TestingPage = ({ navigateTo }) => {
    const [testMode, setTestMode] = useState('single'); // 'single' | 'scan' | 'batch'
    const [selectedProtocol, setSelectedProtocol] = useState('OPC_UA');
    const [testResults, setTestResults] = useState([]);
    const [scanResults, setScanResults] = useState([]);
    const [batchResults, setBatchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showReportGenerator, setShowReportGenerator] = useState(false);

    // Load existing test results on mount
    useEffect(() => {
        const existingResults = protocolService.getTestResults();
        setTestResults(existingResults);
        devLog('Loaded existing test results:', existingResults.length);
    }, []);

    // Handle test completion
    const handleTestComplete = (result) => {
        setTestResults(prev => [result, ...prev]);
        devLog('Test completed:', result);
    };

    // Handle batch test completion
    const handleBatchComplete = (results) => {
        setBatchResults(prev => [...results, ...prev]);
        setTestResults(prev => [...results, ...prev]);
        devLog('Batch test completed:', results.length, 'results');
    };

    // Handle device scan completion
    const handleScanComplete = (devices) => {
        setScanResults(devices);
        devLog('Device scan completed:', devices.length, 'devices found');
        // Convert scan results to test results format
        const scanResult = {
            id: `scan-${Date.now()}`,
            protocol: 'SCAN',
            testType: 'device_scan',
            success: true,
            duration: 0,
            data: { devices, count: devices.length },
            error: null,
            timestamp: new Date().toISOString()
        };
        handleTestComplete(scanResult);
    };

    // Clear all test results
    const clearResults = () => {
        setTestResults([]);
        setScanResults([]);
        setBatchResults([]);
        protocolService.clearTestResults();
        devLog('Test results cleared');
    };

    // Export test results
    const exportResults = (format = 'json') => {
        try {
            const exportData = protocolService.exportTestResults(format);
            const blob = new Blob([exportData], { 
                type: format === 'csv' ? 'text/csv' : 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `test-results-${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            devLog('Test results exported as', format);
        } catch (error) {
            console.error('Failed to export results:', error);
        }
    };

    // Get test mode description
    const getModeDescription = (mode) => {
        switch (mode) {
            case 'single':
                return '测试单个协议连接和功能';
            case 'scan':
                return '扫描网络中的设备和支持的协议';
            case 'batch':
                return '批量测试多个协议配置';
            default:
                return '';
        }
    };

    return html`
        <div class="p-6 max-w-screen-xl mx-auto flex flex-col gap-8">
            <!-- Page Header -->
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-2">
                    <h1>
                        <span class="text-2xl font-bold">🔧</span>
                        协议测试工具
                    </h1>
                    <p class="text-gray-500 dark:text-gray-400">
                        独立的协议测试和设备发现工具，支持多种工业协议的连接测试和数据验证
                    </p>
                </div>
                <div class="flex gap-2">
                    <button 
                        class="btn btn-secondary"
                        onClick=${() => navigateTo('/')}
                        title="返回仪表板"
                    >
                        ← 返回
                    </button>
                </div>
            </div>

            <!-- Test Mode Selector -->
            <div class="flex flex-col items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div class="flex gap-2">
                    <button 
                        class="btn btn-secondary ${testMode === 'single' ? 'active' : ''}"
                        onClick=${() => setTestMode('single')}
                        title="单点协议测试"
                    >
                        <span class="mr-2">🎯</span>
                        <span >单点测试</span>
                    </button>
                    <button 
                        class="btn btn-secondary ${testMode === 'scan' ? 'active' : ''}"
                        onClick=${() => setTestMode('scan')}
                        title="网络设备扫描"
                    >
                        <span class="mode-icon">🔍</span>
                        <span class="mode-label">设备扫描</span>
                    </button>
                    <button 
                        class="btn btn-secondary ${testMode === 'batch' ? 'active' : ''}"
                        onClick=${() => setTestMode('batch')}
                        title="批量协议测试"
                    >
                        <span class="mode-icon">📋</span>
                        <span class="mode-label">批量测试</span>
                    </button>
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                    <p>${getModeDescription(testMode)}</p>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="flex flex-col gap-8">
                    <!-- Single Protocol Testing -->
                    ${testMode === 'single' && html`
                        <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg card-hover">
                            <div class="p-4 border-b dark:border-gray-700">
                                <h2>单点协议测试</h2>
                                <p>选择协议类型并配置连接参数进行测试</p>
                            </div>
                            <${ProtocolTester}
                                protocol=${selectedProtocol}
                                onProtocolChange=${setSelectedProtocol}
                                onTestComplete=${handleTestComplete}
                                isLoading=${isLoading}
                                setIsLoading=${setIsLoading}
                            />
                        </div>
                    `}

                    <!-- Device Scanning -->
                    ${testMode === 'scan' && html`
                        <div class="modern-card card-hover">
                            <div class="panel-header">
                                <h2>网络设备扫描</h2>
                                <p>自动发现网络中的设备和支持的协议</p>
                            </div>
                            <${DeviceScanner}
                                onScanComplete=${handleScanComplete}
                                isLoading=${isLoading}
                                setIsLoading=${setIsLoading}
                            />
                        </div>
                    `}

                    <!-- Batch Testing -->
                    ${testMode === 'batch' && html`
                        <div class="modern-card card-hover">
                            <div class="panel-header">
                                <h2>批量协议测试</h2>
                                <p>配置多个测试项目并批量执行</p>
                            </div>
                            <${BatchTester}
                                onBatchComplete=${handleBatchComplete}
                                isLoading=${isLoading}
                                setIsLoading=${setIsLoading}
                            />
                        </div>
                    `}
                </div>

                <!-- Test Results Panel -->
                <div class="modern-card card-hover">
                    <div class="panel-header">
                        <h2>测试结果</h2>
                        <div class="flex justify-between items-center">
                            <button 
                                class="btn btn-sm btn-primary"
                                onClick=${() => setShowReportGenerator(true)}
                                disabled=${testResults.length === 0 && scanResults.length === 0 && batchResults.length === 0}
                                title="生成综合报告"
                            >
                                📊 生成报告
                            </button>
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${() => exportResults('json')}
                                disabled=${testResults.length === 0}
                                title="导出为JSON"
                            >
                                📄 JSON
                            </button>
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${() => exportResults('csv')}
                                disabled=${testResults.length === 0}
                                title="导出为CSV"
                            >
                                📊 CSV
                            </button>
                            <button 
                                class="btn btn-sm btn-warning"
                                onClick=${clearResults}
                                disabled=${testResults.length === 0}
                                title="清空结果"
                            >
                                🗑️ 清空
                            </button>
                        </div>
                    </div>
                    <${TestResultsDisplay}
                        results=${testResults}
                        isLoading=${isLoading}
                    />
                </div>
            </div>

            <!-- Loading Overlay -->
            ${isLoading && html`
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl flex items-center gap-4">
                        <div class="spinner"></div>
                        <p>正在执行测试...</p>
                    </div>
                </div>
            `}

            <!-- Test Report Generator -->
            ${showReportGenerator && html`
                <${TestReportGenerator}
                    scanResults=${scanResults}
                    testResults=${testResults.filter(r => r.protocol !== 'SCAN')}
                    batchResults=${batchResults}
                    onClose=${() => setShowReportGenerator(false)}
                />
            `}
        </div>
    `;
};

export default TestingPage;