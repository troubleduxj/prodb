/**
 * Test Report Generator Component
 * Provides comprehensive test report generation and export functionality
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

// Import services
import { protocolService } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

const html = htm.bind(h);

const TestReportGenerator = ({ 
    scanResults = [], 
    testResults = [], 
    batchResults = [],
    onClose 
}) => {
    const [reportConfig, setReportConfig] = useState({
        includeDeviceInfo: true,
        includeTestDetails: true,
        includeStatistics: true,
        includeCharts: false,
        format: 'json'
    });
    const [generatedReport, setGeneratedReport] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Generate comprehensive report
    const generateReport = async () => {
        setIsGenerating(true);
        
        try {
            const report = {
                metadata: {
                    title: 'ProDB Collector Test Report',
                    generated: new Date().toISOString(),
                    generator: 'ProDB Collector Frontend',
                    version: '1.0.0'
                },
                summary: generateSummary(),
                deviceScan: reportConfig.includeDeviceInfo ? {
                    results: scanResults,
                    statistics: generateDeviceStatistics()
                } : null,
                connectionTests: reportConfig.includeTestDetails ? {
                    results: testResults,
                    statistics: generateTestStatistics()
                } : null,
                batchTests: reportConfig.includeTestDetails ? {
                    results: batchResults,
                    statistics: generateBatchStatistics()
                } : null,
                analysis: reportConfig.includeStatistics ? generateAnalysis() : null
            };

            setGeneratedReport(report);
            devLog('Generated comprehensive test report');
            
        } catch (error) {
            console.error('Report generation failed:', error);
            alert('报告生成失败: ' + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // Generate report summary
    const generateSummary = () => {
        const allResults = [...testResults, ...batchResults];
        
        return {
            totalDevicesScanned: scanResults.length,
            totalTestsExecuted: allResults.length,
            successfulTests: allResults.filter(r => r.success).length,
            failedTests: allResults.filter(r => !r.success).length,
            successRate: allResults.length > 0 ? 
                Math.round((allResults.filter(r => r.success).length / allResults.length) * 100) : 0,
            protocolsUsed: [...new Set(allResults.map(r => r.protocol))],
            averageResponseTime: allResults.length > 0 ?
                Math.round(allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length) : 0
        };
    };

    // Generate device scan statistics
    const generateDeviceStatistics = () => {
        const protocolCounts = {};
        const serviceCounts = {};
        const responseTimeStats = {
            min: Infinity,
            max: 0,
            average: 0,
            total: 0
        };

        scanResults.forEach(device => {
            // Count protocols
            device.protocols.forEach(protocol => {
                protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
            });

            // Count services
            if (device.services) {
                device.services.forEach(service => {
                    serviceCounts[service.protocol] = (serviceCounts[service.protocol] || 0) + 1;
                });
            }

            // Response time statistics
            if (device.responseTime) {
                responseTimeStats.min = Math.min(responseTimeStats.min, device.responseTime);
                responseTimeStats.max = Math.max(responseTimeStats.max, device.responseTime);
                responseTimeStats.total += device.responseTime;
            }
        });

        if (scanResults.length > 0) {
            responseTimeStats.average = Math.round(responseTimeStats.total / scanResults.length);
        }

        return {
            protocolDistribution: protocolCounts,
            serviceDistribution: serviceCounts,
            responseTimeStatistics: responseTimeStats,
            deviceCount: scanResults.length
        };
    };

    // Generate test statistics
    const generateTestStatistics = () => {
        const protocolStats = {};
        const errorStats = {};

        testResults.forEach(result => {
            // Protocol statistics
            if (!protocolStats[result.protocol]) {
                protocolStats[result.protocol] = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    averageTime: 0,
                    totalTime: 0
                };
            }

            const stats = protocolStats[result.protocol];
            stats.total++;
            stats.totalTime += result.duration;
            
            if (result.success) {
                stats.successful++;
            } else {
                stats.failed++;
                
                // Error statistics
                const errorType = result.error || 'Unknown Error';
                errorStats[errorType] = (errorStats[errorType] || 0) + 1;
            }
        });

        // Calculate averages
        Object.values(protocolStats).forEach(stats => {
            stats.averageTime = stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0;
            stats.successRate = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;
        });

        return {
            protocolStatistics: protocolStats,
            errorDistribution: errorStats,
            testCount: testResults.length
        };
    };

    // Generate batch test statistics
    const generateBatchStatistics = () => {
        const configStats = {};
        
        batchResults.forEach(result => {
            const configName = result.configName || 'Unknown Config';
            
            if (!configStats[configName]) {
                configStats[configName] = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    protocol: result.protocol,
                    averageTime: 0,
                    totalTime: 0
                };
            }

            const stats = configStats[configName];
            stats.total++;
            stats.totalTime += result.duration;
            
            if (result.success) {
                stats.successful++;
            } else {
                stats.failed++;
            }
        });

        // Calculate averages
        Object.values(configStats).forEach(stats => {
            stats.averageTime = stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0;
            stats.successRate = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;
        });

        return {
            configurationStatistics: configStats,
            batchCount: batchResults.length
        };
    };

    // Generate analysis and recommendations
    const generateAnalysis = () => {
        const analysis = {
            recommendations: [],
            issues: [],
            insights: []
        };

        const allResults = [...testResults, ...batchResults];
        const failedResults = allResults.filter(r => !r.success);
        const successRate = allResults.length > 0 ? 
            (allResults.filter(r => r.success).length / allResults.length) * 100 : 0;

        // Success rate analysis
        if (successRate < 50) {
            analysis.issues.push('连接成功率较低 (<50%)，建议检查网络配置和设备状态');
        } else if (successRate < 80) {
            analysis.recommendations.push('连接成功率中等，可以优化配置参数提高稳定性');
        } else {
            analysis.insights.push('连接成功率良好，系统运行稳定');
        }

        // Protocol analysis
        const protocolCounts = {};
        allResults.forEach(result => {
            protocolCounts[result.protocol] = (protocolCounts[result.protocol] || 0) + 1;
        });

        const mostUsedProtocol = Object.entries(protocolCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostUsedProtocol) {
            analysis.insights.push(`最常用的协议是 ${mostUsedProtocol[0]} (${mostUsedProtocol[1]} 次测试)`);
        }

        // Error analysis
        const errorCounts = {};
        failedResults.forEach(result => {
            const error = result.error || 'Unknown Error';
            errorCounts[error] = (errorCounts[error] || 0) + 1;
        });

        const mostCommonError = Object.entries(errorCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostCommonError) {
            analysis.issues.push(`最常见的错误: ${mostCommonError[0]} (${mostCommonError[1]} 次)`);
        }

        // Response time analysis
        const responseTimes = allResults.map(r => r.duration).filter(t => t > 0);
        if (responseTimes.length > 0) {
            const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            
            if (avgResponseTime > 5000) {
                analysis.recommendations.push('平均响应时间较长，建议优化网络配置或增加超时时间');
            } else if (avgResponseTime < 1000) {
                analysis.insights.push('响应时间良好，网络连接稳定');
            }
        }

        return analysis;
    };

    // Export report
    const exportReport = (format = 'json') => {
        if (!generatedReport) {
            alert('请先生成报告');
            return;
        }

        let content, filename, mimeType;

        switch (format) {
            case 'csv':
                content = exportToCSV(generatedReport);
                filename = `test-report-${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
                break;
            case 'html':
                content = exportToHTML(generatedReport);
                filename = `test-report-${new Date().toISOString().split('T')[0]}.html`;
                mimeType = 'text/html';
                break;
            case 'json':
            default:
                content = JSON.stringify(generatedReport, null, 2);
                filename = `test-report-${new Date().toISOString().split('T')[0]}.json`;
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
        
        devLog('Exported test report:', filename);
    };

    // Export to CSV format
    const exportToCSV = (report) => {
        const lines = [];
        
        // Header
        lines.push('ProDB Collector Test Report');
        lines.push(`Generated: ${report.metadata.generated}`);
        lines.push('');
        
        // Summary
        lines.push('Summary');
        lines.push('Metric,Value');
        lines.push(`Total Devices Scanned,${report.summary.totalDevicesScanned}`);
        lines.push(`Total Tests Executed,${report.summary.totalTestsExecuted}`);
        lines.push(`Successful Tests,${report.summary.successfulTests}`);
        lines.push(`Failed Tests,${report.summary.failedTests}`);
        lines.push(`Success Rate,${report.summary.successRate}%`);
        lines.push(`Average Response Time,${report.summary.averageResponseTime}ms`);
        lines.push('');
        
        // Device scan results
        if (report.deviceScan && report.deviceScan.results.length > 0) {
            lines.push('Device Scan Results');
            lines.push('IP,Hostname,Protocols,Services,Response Time (ms)');
            
            report.deviceScan.results.forEach(device => {
                const services = device.services ? 
                    device.services.map(s => `${s.port}:${s.protocol}`).join(';') : '';
                lines.push([
                    device.ip,
                    device.hostname || '',
                    device.protocols.join(';'),
                    services,
                    device.responseTime
                ].join(','));
            });
            lines.push('');
        }
        
        // Test results
        const allTestResults = [
            ...(report.connectionTests?.results || []),
            ...(report.batchTests?.results || [])
        ];
        
        if (allTestResults.length > 0) {
            lines.push('Test Results');
            lines.push('Protocol,Test Type,Success,Duration (ms),Error,Config Name');
            
            allTestResults.forEach(result => {
                lines.push([
                    result.protocol,
                    result.testType,
                    result.success,
                    result.duration,
                    result.error || '',
                    result.configName || ''
                ].join(','));
            });
        }
        
        return lines.join('\n');
    };

    // Export to HTML format
    const exportToHTML = (report) => {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>ProDB Collector Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .summary-item { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .success { color: green; }
        .error { color: red; }
        .recommendations { background: #e7f3ff; padding: 15px; border-radius: 5px; }
        .issues { background: #ffe7e7; padding: 15px; border-radius: 5px; }
        .insights { background: #e7ffe7; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ProDB Collector Test Report</h1>
        <p>Generated: ${new Date(report.metadata.generated).toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <strong>Devices Scanned:</strong> ${report.summary.totalDevicesScanned}
            </div>
            <div class="summary-item">
                <strong>Tests Executed:</strong> ${report.summary.totalTestsExecuted}
            </div>
            <div class="summary-item">
                <strong>Success Rate:</strong> ${report.summary.successRate}%
            </div>
            <div class="summary-item">
                <strong>Avg Response Time:</strong> ${report.summary.averageResponseTime}ms
            </div>
        </div>
    </div>
    
    ${report.analysis ? `
    <div class="section">
        <h2>Analysis</h2>
        ${report.analysis.insights.length > 0 ? `
        <div class="insights">
            <h3>Insights</h3>
            <ul>
                ${report.analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${report.analysis.recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${report.analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${report.analysis.issues.length > 0 ? `
        <div class="issues">
            <h3>Issues</h3>
            <ul>
                ${report.analysis.issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
    ` : ''}
</body>
</html>
        `;
    };

    return html`
        <div class="dialog-overlay">
            <div class="dialog report-generator-dialog">
                <div class="dialog-header">
                    <h3>测试报告生成器</h3>
                    <button class="dialog-close" onClick=${onClose}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="report-config">
                        <h4>报告配置</h4>
                        <div class="config-options">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${reportConfig.includeDeviceInfo}
                                    onChange=${(e) => setReportConfig(prev => ({
                                        ...prev,
                                        includeDeviceInfo: e.target.checked
                                    }))}
                                />
                                <span>包含设备扫描信息</span>
                            </label>
                            
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${reportConfig.includeTestDetails}
                                    onChange=${(e) => setReportConfig(prev => ({
                                        ...prev,
                                        includeTestDetails: e.target.checked
                                    }))}
                                />
                                <span>包含测试详细信息</span>
                            </label>
                            
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${reportConfig.includeStatistics}
                                    onChange=${(e) => setReportConfig(prev => ({
                                        ...prev,
                                        includeStatistics: e.target.checked
                                    }))}
                                />
                                <span>包含统计分析</span>
                            </label>
                        </div>
                    </div>

                    <div class="data-summary">
                        <h4>数据概览</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">扫描设备</span>
                                <span class="stat-value">${scanResults.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">连接测试</span>
                                <span class="stat-value">${testResults.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">批量测试</span>
                                <span class="stat-value">${batchResults.length}</span>
                            </div>
                        </div>
                    </div>

                    ${generatedReport && html`
                        <div class="report-preview">
                            <h4>报告预览</h4>
                            <div class="preview-summary">
                                <p><strong>总设备数:</strong> ${generatedReport.summary.totalDevicesScanned}</p>
                                <p><strong>总测试数:</strong> ${generatedReport.summary.totalTestsExecuted}</p>
                                <p><strong>成功率:</strong> ${generatedReport.summary.successRate}%</p>
                                <p><strong>平均响应时间:</strong> ${generatedReport.summary.averageResponseTime}ms</p>
                            </div>
                        </div>
                    `}
                </div>

                <div class="dialog-actions">
                    <button
                        class="btn btn-primary"
                        onClick=${generateReport}
                        disabled=${isGenerating}
                    >
                        ${isGenerating ? '生成中...' : '生成报告'}
                    </button>
                    
                    ${generatedReport && html`
                        <button
                            class="btn btn-secondary"
                            onClick=${() => exportReport('json')}
                        >
                            📄 导出JSON
                        </button>
                        <button
                            class="btn btn-secondary"
                            onClick=${() => exportReport('csv')}
                        >
                            📊 导出CSV
                        </button>
                        <button
                            class="btn btn-secondary"
                            onClick=${() => exportReport('html')}
                        >
                            🌐 导出HTML
                        </button>
                    `}
                    
                    <button class="btn btn-secondary" onClick=${onClose}>
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default TestReportGenerator;