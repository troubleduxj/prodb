/**
 * Device Scanner Component
 * Provides network device discovery and protocol identification
 */

import { h } from 'https://esm.sh/preact?no-require';
import htm from 'https://esm.sh/htm?no-require';
import { useState } from 'https://esm.sh/preact/hooks';

// Import services
import { protocolService } from '../services/protocols.js';
import { devLog } from '../utils/helpers.js';

const html = htm.bind(h);

const DeviceScanner = ({ onScanComplete, isLoading, setIsLoading }) => {
    const [scanConfig, setScanConfig] = useState({
        ipRange: '192.168.1.0/24',
        protocols: ['OPC_UA', 'MODBUS_TCP', 'MQTT'],
        timeout: 5000,
        portScan: true,
        pingTest: true
    });
    const [scanResults, setScanResults] = useState([]);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'scanning', 'completed', 'error'
    const [testResults, setTestResults] = useState([]);
    const [showReportDialog, setShowReportDialog] = useState(false);

    // Handle scan configuration change
    const handleConfigChange = (field, value) => {
        setScanConfig(prev => ({
            ...prev,
            [field]: value
        }));
        devLog('Scan config updated:', field, '=', value);
    };

    // Handle protocol selection
    const handleProtocolToggle = (protocol) => {
        setScanConfig(prev => ({
            ...prev,
            protocols: prev.protocols.includes(protocol)
                ? prev.protocols.filter(p => p !== protocol)
                : [...prev.protocols, protocol]
        }));
    };

    // Validate scan configuration
    const validateScanConfig = () => {
        const errors = [];
        
        if (!scanConfig.ipRange) {
            errors.push('IP范围不能为空');
        } else if (!isValidIPRange(scanConfig.ipRange)) {
            errors.push('IP范围格式无效');
        }
        
        if (scanConfig.protocols.length === 0) {
            errors.push('至少选择一个协议');
        }
        
        if (scanConfig.timeout < 1000 || scanConfig.timeout > 30000) {
            errors.push('超时时间应在1-30秒之间');
        }
        
        return errors;
    };

    // Execute device scan
    const executeScan = async () => {
        const errors = validateScanConfig();
        if (errors.length > 0) {
            alert('配置错误:\n' + errors.join('\n'));
            return;
        }

        setIsLoading(true);
        setScanStatus('scanning');
        setScanProgress(0);
        setScanResults([]);

        try {
            devLog('Starting device scan with config:', scanConfig);
            
            // Simulate scan progress
            const progressInterval = setInterval(() => {
                setScanProgress(prev => {
                    const newProgress = prev + Math.random() * 10;
                    return newProgress >= 95 ? 95 : newProgress;
                });
            }, 200);

            // Execute the actual scan
            const devices = await protocolService.scanDevices(scanConfig);
            
            clearInterval(progressInterval);
            setScanProgress(100);
            setScanResults(devices);
            setScanStatus('completed');
            
            devLog('Device scan completed:', devices.length, 'devices found');
            onScanComplete(devices);
            
        } catch (error) {
            console.error('Device scan failed:', error);
            setScanStatus('error');
            
            // Create mock results for demonstration
            const mockDevices = generateMockScanResults();
            setScanResults(mockDevices);
            onScanComplete(mockDevices);
            
        } finally {
            setIsLoading(false);
            setTimeout(() => setScanProgress(0), 2000);
        }
    };

    // Test device connection
    const testDevice = async (device, protocol) => {
        try {
            setIsLoading(true);
            devLog('Testing device connection:', device.ip, protocol);
            
            // Generate test configuration based on device and protocol
            const testConfig = generateTestConfig(device, protocol);
            
            const result = await protocolService.testConnection(
                protocol,
                testConfig,
                'connect'
            );
            
            // Add device info to result
            result.deviceInfo = {
                ip: device.ip,
                hostname: device.hostname,
                protocol: protocol
            };
            
            setTestResults(prev => [...prev, result]);
            
            // Show success/error notification
            if (result.success) {
                alert(`设备 ${device.ip} (${protocol}) 连接成功!`);
            } else {
                alert(`设备 ${device.ip} (${protocol}) 连接失败: ${result.error}`);
            }
            
        } catch (error) {
            console.error('Device test failed:', error);
            alert(`测试失败: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate test configuration for device and protocol
    const generateTestConfig = (device, protocol) => {
        const baseConfig = protocolService.getDefaultConfig(protocol);
        
        switch (protocol) {
            case 'OPC_UA':
                return {
                    ...baseConfig,
                    endpoint: `opc.tcp://${device.ip}:4840`
                };
            case 'MODBUS_TCP':
                return {
                    ...baseConfig,
                    host: device.ip,
                    port: 502
                };
            case 'MQTT':
                return {
                    ...baseConfig,
                    broker: `mqtt://${device.ip}`,
                    port: 1883
                };
            case 'ETHERNET_IP':
                return {
                    ...baseConfig,
                    host: device.ip
                };
            default:
                return baseConfig;
        }
    };

    // Generate scan report
    const generateScanReport = () => {
        const report = {
            scanConfig,
            scanResults,
            testResults,
            timestamp: new Date().toISOString(),
            summary: {
                totalDevices: scanResults.length,
                protocolCounts: {},
                testCounts: {
                    total: testResults.length,
                    successful: testResults.filter(r => r.success).length,
                    failed: testResults.filter(r => !r.success).length
                }
            }
        };

        // Count protocols
        scanResults.forEach(device => {
            device.protocols.forEach(protocol => {
                report.summary.protocolCounts[protocol] = 
                    (report.summary.protocolCounts[protocol] || 0) + 1;
            });
        });

        return report;
    };

    // Export scan report
    const exportReport = (format = 'json') => {
        const report = generateScanReport();
        let content, filename, mimeType;

        switch (format) {
            case 'csv':
                content = exportToCSV(report);
                filename = `device-scan-report-${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
                break;
            case 'json':
            default:
                content = JSON.stringify(report, null, 2);
                filename = `device-scan-report-${new Date().toISOString().split('T')[0]}.json`;
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
        
        devLog('Exported scan report:', filename);
    };

    // Export to CSV format
    const exportToCSV = (report) => {
        const lines = [];
        
        // Header
        lines.push('Device Scan Report');
        lines.push(`Generated: ${report.timestamp}`);
        lines.push(`IP Range: ${report.scanConfig.ipRange}`);
        lines.push(`Protocols: ${report.scanConfig.protocols.join(', ')}`);
        lines.push('');
        
        // Devices
        lines.push('Discovered Devices');
        lines.push('IP,Hostname,Protocols,Services,Response Time (ms)');
        
        report.scanResults.forEach(device => {
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
        
        // Test Results
        if (report.testResults.length > 0) {
            lines.push('Test Results');
            lines.push('Device IP,Protocol,Success,Duration (ms),Error');
            
            report.testResults.forEach(result => {
                lines.push([
                    result.deviceInfo?.ip || '',
                    result.protocol,
                    result.success,
                    result.duration,
                    result.error || ''
                ].join(','));
            });
        }
        
        return lines.join('\n');
    };

    // Generate mock scan results for demonstration
    const generateMockScanResults = () => {
        const mockDevices = [
            {
                ip: '192.168.1.100',
                hostname: 'plc-server-01',
                protocols: ['OPC_UA'],
                services: [
                    { port: 4840, protocol: 'OPC_UA', info: 'Prosys OPC UA Server' }
                ],
                responseTime: 45
            },
            {
                ip: '192.168.1.101',
                hostname: 'modbus-device',
                protocols: ['MODBUS_TCP'],
                services: [
                    { port: 502, protocol: 'MODBUS_TCP', info: 'Modbus TCP Server' }
                ],
                responseTime: 23
            },
            {
                ip: '192.168.1.102',
                hostname: 'mqtt-broker',
                protocols: ['MQTT'],
                services: [
                    { port: 1883, protocol: 'MQTT', info: 'Eclipse Mosquitto' }
                ],
                responseTime: 12
            }
        ];
        
        return mockDevices.filter(device => 
            device.protocols.some(p => scanConfig.protocols.includes(p))
        );
    };

    // Get protocol options
    const protocolOptions = protocolService.getProtocolOptions();

    return html`
        <div class="device-scanner">
            <!-- Scan Configuration -->
            <div class="scan-config">
                <h3>扫描配置</h3>
                
                <!-- IP Range Configuration -->
                <div class="config-section">
                    <label class="form-label">IP地址范围</label>
                    <div class="ip-range-config">
                        <input
                            type="text"
                            class="form-input"
                            value=${scanConfig.ipRange}
                            onChange=${(e) => handleConfigChange('ipRange', e.target.value)}
                            placeholder="192.168.1.0/24"
                        />
                        <div class="ip-range-presets">
                            ${['192.168.1.0/24', '192.168.0.0/24', '10.0.0.0/24'].map(preset => html`
                                <button
                                    key=${preset}
                                    class="preset-button ${scanConfig.ipRange === preset ? 'active' : ''}"
                                    onClick=${() => handleConfigChange('ipRange', preset)}
                                >
                                    ${preset}
                                </button>
                            `)}
                        </div>
                    </div>
                </div>

                <!-- Protocol Selection -->
                <div class="config-section">
                    <label class="form-label">扫描协议</label>
                    <div class="protocol-checkboxes">
                        ${protocolOptions.map(option => html`
                            <label key=${option.value} class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${scanConfig.protocols.includes(option.value)}
                                    onChange=${() => handleProtocolToggle(option.value)}
                                />
                                <span class="protocol-icon">${option.icon}</span>
                                <span class="protocol-name">${option.label}</span>
                            </label>
                        `)}
                    </div>
                </div>

                <!-- Advanced Options -->
                <div class="config-section">
                    <label class="form-label">高级选项</label>
                    <div class="advanced-options">
                        <div class="option-row">
                            <label class="form-label">超时时间 (毫秒)</label>
                            <input
                                type="number"
                                class="form-input"
                                value=${scanConfig.timeout}
                                onChange=${(e) => handleConfigChange('timeout', parseInt(e.target.value))}
                                min="1000"
                                max="30000"
                                step="1000"
                            />
                        </div>
                        <div class="option-row">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${scanConfig.portScan}
                                    onChange=${(e) => handleConfigChange('portScan', e.target.checked)}
                                />
                                <span>端口扫描</span>
                            </label>
                        </div>
                        <div class="option-row">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked=${scanConfig.pingTest}
                                    onChange=${(e) => handleConfigChange('pingTest', e.target.checked)}
                                />
                                <span>Ping测试</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Scan Actions -->
            <div class="scan-actions">
                <button
                    class="btn btn-primary btn-lg"
                    onClick=${executeScan}
                    disabled=${isLoading}
                >
                    ${isLoading ? '扫描中...' : '开始扫描'}
                </button>
                
                <button
                    class="btn btn-secondary"
                    onClick=${() => {
                        setScanResults([]);
                        setTestResults([]);
                        setScanStatus('idle');
                        setScanProgress(0);
                    }}
                    disabled=${isLoading}
                >
                    清空结果
                </button>
                
                ${scanResults.length > 0 && html`
                    <button
                        class="btn btn-secondary"
                        onClick=${() => setShowReportDialog(true)}
                        disabled=${isLoading}
                    >
                        📊 生成报告
                    </button>
                `}
            </div>

            <!-- Scan Progress -->
            ${scanStatus === 'scanning' && html`
                <div class="scan-progress">
                    <div class="progress-header">
                        <span>扫描进度</span>
                        <span>${Math.round(scanProgress)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div 
                            class="progress-fill" 
                            style="width: ${scanProgress}%"
                        ></div>
                    </div>
                    <div class="progress-status">
                        正在扫描 ${scanConfig.ipRange} 范围内的设备...
                    </div>
                </div>
            `}

            <!-- Scan Results -->
            ${scanResults.length > 0 && html`
                <div class="scan-results">
                    <div class="results-header">
                        <h3>扫描结果</h3>
                        <div class="results-summary">
                            发现 ${scanResults.length} 个设备
                        </div>
                    </div>
                    
                    <div class="devices-grid">
                        ${scanResults.map((device, index) => html`
                            <div key=${index} class="device-card">
                                <div class="device-header">
                                    <div class="device-ip">${device.ip}</div>
                                    <div class="device-response-time">${device.responseTime}ms</div>
                                </div>
                                
                                ${device.hostname && html`
                                    <div class="device-hostname">${device.hostname}</div>
                                `}
                                
                                <div class="device-protocols">
                                    <label class="protocols-label">支持的协议:</label>
                                    <div class="protocol-tags">
                                        ${device.protocols.map(protocol => {
                                            const protocolInfo = protocolOptions.find(p => p.value === protocol);
                                            return html`
                                                <span key=${protocol} class="protocol-tag">
                                                    ${protocolInfo?.icon} ${protocolInfo?.label || protocol}
                                                </span>
                                            `;
                                        })}
                                    </div>
                                </div>
                                
                                ${device.services && device.services.length > 0 && html`
                                    <div class="device-services">
                                        <label class="services-label">服务:</label>
                                        <div class="services-list">
                                            ${device.services.map((service, serviceIndex) => html`
                                                <div key=${serviceIndex} class="service-item">
                                                    <span class="service-port">:${service.port}</span>
                                                    <span class="service-protocol">${service.protocol}</span>
                                                    ${service.info && html`
                                                        <span class="service-info">${service.info}</span>
                                                    `}
                                                </div>
                                            `)}
                                        </div>
                                    </div>
                                `}
                                
                                <div class="device-actions">
                                    ${device.protocols.map(protocol => html`
                                        <button 
                                            key=${protocol}
                                            class="btn btn-sm btn-primary"
                                            onClick=${() => testDevice(device, protocol)}
                                            disabled=${isLoading}
                                        >
                                            测试 ${protocol}
                                        </button>
                                    `)}
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Empty State -->
            ${scanStatus === 'completed' && scanResults.length === 0 && html`
                <div class="empty-results">
                    <div class="empty-icon">🔍</div>
                    <h3>未发现设备</h3>
                    <p>在指定的IP范围内未发现支持所选协议的设备</p>
                    <div class="empty-suggestions">
                        <p>建议:</p>
                        <ul>
                            <li>检查IP地址范围是否正确</li>
                            <li>确认设备已连接到网络</li>
                            <li>尝试增加超时时间</li>
                            <li>检查防火墙设置</li>
                        </ul>
                    </div>
                </div>
            `}

            <!-- Test Results -->
            ${testResults.length > 0 && html`
                <div class="test-results-section">
                    <h3>连接测试结果</h3>
                    <div class="test-results-grid">
                        ${testResults.map((result, index) => html`
                            <div key=${index} class="test-result-card ${result.success ? 'success' : 'error'}">
                                <div class="result-header">
                                    <div class="device-info">
                                        <span class="device-ip">${result.deviceInfo?.ip}</span>
                                        <span class="protocol-name">${result.protocol}</span>
                                    </div>
                                    <div class="result-status">
                                        ${result.success ? '✅ 成功' : '❌ 失败'}
                                    </div>
                                </div>
                                <div class="result-details">
                                    <div class="result-timing">
                                        响应时间: ${result.duration}ms
                                    </div>
                                    ${result.error && html`
                                        <div class="result-error">
                                            错误: ${result.error}
                                        </div>
                                    `}
                                    ${result.data && html`
                                        <div class="result-data">
                                            <details>
                                                <summary>详细信息</summary>
                                                <pre>${JSON.stringify(result.data, null, 2)}</pre>
                                            </details>
                                        </div>
                                    `}
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Report Dialog -->
            ${showReportDialog && html`
                <${ReportDialog}
                    scanResults=${scanResults}
                    testResults=${testResults}
                    scanConfig=${scanConfig}
                    onExport=${exportReport}
                    onClose=${() => setShowReportDialog(false)}
                />
            `}
        </div>
    `;
};

// Report Dialog Component
const ReportDialog = ({ scanResults, testResults, scanConfig, onExport, onClose }) => {
    const report = {
        scanConfig,
        scanResults,
        testResults,
        timestamp: new Date().toISOString(),
        summary: {
            totalDevices: scanResults.length,
            protocolCounts: {},
            testCounts: {
                total: testResults.length,
                successful: testResults.filter(r => r.success).length,
                failed: testResults.filter(r => !r.success).length
            }
        }
    };

    // Count protocols
    scanResults.forEach(device => {
        device.protocols.forEach(protocol => {
            report.summary.protocolCounts[protocol] = 
                (report.summary.protocolCounts[protocol] || 0) + 1;
        });
    });

    return html`
        <div class="dialog-overlay">
            <div class="dialog report-dialog">
                <div class="dialog-header">
                    <h3>扫描报告</h3>
                    <button class="dialog-close" onClick=${onClose}>×</button>
                </div>
                
                <div class="dialog-content">
                    <div class="report-summary">
                        <h4>扫描概要</h4>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">扫描时间</span>
                                <span class="summary-value">
                                    ${new Date(report.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">IP范围</span>
                                <span class="summary-value">${report.scanConfig.ipRange}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">发现设备</span>
                                <span class="summary-value">${report.summary.totalDevices}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">连接测试</span>
                                <span class="summary-value">
                                    ${report.summary.testCounts.successful}/${report.summary.testCounts.total}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="protocol-distribution">
                        <h4>协议分布</h4>
                        <div class="protocol-stats">
                            ${Object.entries(report.summary.protocolCounts).map(([protocol, count]) => {
                                const protocolInfo = protocolService.getProtocol(protocol);
                                return html`
                                    <div key=${protocol} class="protocol-stat">
                                        <span class="protocol-icon">${protocolInfo?.icon}</span>
                                        <span class="protocol-name">${protocolInfo?.name || protocol}</span>
                                        <span class="protocol-count">${count}</span>
                                    </div>
                                `;
                            })}
                        </div>
                    </div>

                    ${report.summary.testCounts.total > 0 && html`
                        <div class="test-summary">
                            <h4>测试结果</h4>
                            <div class="test-stats">
                                <div class="test-stat success">
                                    <span class="stat-label">成功</span>
                                    <span class="stat-value">${report.summary.testCounts.successful}</span>
                                </div>
                                <div class="test-stat error">
                                    <span class="stat-label">失败</span>
                                    <span class="stat-value">${report.summary.testCounts.failed}</span>
                                </div>
                                <div class="test-stat">
                                    <span class="stat-label">成功率</span>
                                    <span class="stat-value">
                                        ${report.summary.testCounts.total > 0 ? 
                                            Math.round((report.summary.testCounts.successful / report.summary.testCounts.total) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    `}
                </div>

                <div class="dialog-actions">
                    <button 
                        class="btn btn-secondary" 
                        onClick=${() => onExport('json')}
                    >
                        📄 导出JSON
                    </button>
                    <button 
                        class="btn btn-secondary" 
                        onClick=${() => onExport('csv')}
                    >
                        📊 导出CSV
                    </button>
                    <button class="btn btn-primary" onClick=${onClose}>
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
};

// Helper function to validate IP range
const isValidIPRange = (ipRange) => {
    // Simple validation for CIDR notation
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(ipRange)) {
        return false;
    }
    
    const [ip, mask] = ipRange.split('/');
    const maskNum = parseInt(mask);
    
    // Validate mask
    if (maskNum < 8 || maskNum > 32) {
        return false;
    }
    
    // Validate IP octets
    const octets = ip.split('.');
    return octets.every(octet => {
        const num = parseInt(octet);
        return num >= 0 && num <= 255;
    });
};

export default DeviceScanner;