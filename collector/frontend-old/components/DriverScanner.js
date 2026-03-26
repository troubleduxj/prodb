/**
 * Driver Scanner Component for ProDB Collector
 * Handles automatic driver discovery and scanning
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { driverService } from '../services/drivers.js';
import { driverAPI } from '../services/api.js';
import StatusIndicator from './StatusIndicator.js';
import { devLog, formatTime } from '../utils/helpers.js';

const DriverScanner = ({ onScanComplete, autoScan = false }) => {
    const [scanning, setScanning] = useState(false);
    const [scanResults, setScanResults] = useState([]);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'scanning', 'completed', 'error'
    const [scanError, setScanError] = useState(null);
    const [scanPaths, setScanPaths] = useState([
        './drivers',
        './plugins',
        './extensions',
        '/usr/local/lib/prodb/drivers',
        'C:\\Program Files\\ProDB\\drivers'
    ]);
    const [selectedPaths, setSelectedPaths] = useState(new Set(scanPaths.slice(0, 3)));
    const [scanOptions, setScanOptions] = useState({
        includeSubdirectories: true,
        validateDrivers: true,
        checkDuplicates: true,
        scanNetworkPaths: false
    });

    // Auto-scan on mount if enabled
    useEffect(() => {
        if (autoScan) {
            startScan();
        }
    }, [autoScan]);

    /**
     * Start driver scanning process
     */
    const startScan = async () => {
        if (scanning) return;

        try {
            setScanning(true);
            setScanStatus('scanning');
            setScanError(null);
            setScanResults([]);
            setScanProgress(0);

            devLog('Starting driver scan...', { paths: Array.from(selectedPaths), options: scanOptions });

            const results = await performScan();
            
            setScanResults(results);
            setScanStatus('completed');
            setScanProgress(100);

            if (onScanComplete) {
                onScanComplete(results);
            }

            devLog('Driver scan completed:', results.length);

        } catch (error) {
            console.error('Driver scan failed:', error);
            setScanError(error.message);
            setScanStatus('error');
        } finally {
            setScanning(false);
        }
    };

    /**
     * Perform the actual scanning
     */
    const performScan = async () => {
        const results = [];
        const pathsToScan = Array.from(selectedPaths);
        
        for (let i = 0; i < pathsToScan.length; i++) {
            const path = pathsToScan[i];
            setScanProgress((i / pathsToScan.length) * 80); // Reserve 20% for validation

            try {
                const pathResults = await scanPath(path);
                results.push(...pathResults);
            } catch (error) {
                console.warn(`Failed to scan path ${path}:`, error);
                // Continue with other paths
            }
        }

        // Validation phase
        if (scanOptions.validateDrivers) {
            setScanProgress(80);
            await validateScanResults(results);
        }

        // Duplicate check
        if (scanOptions.checkDuplicates) {
            setScanProgress(90);
            removeDuplicates(results);
        }

        return results;
    };

    /**
     * Scan a specific path for drivers
     */
    const scanPath = async (path) => {
        try {
            // This would typically make an API call to scan the filesystem
            // For now, we'll simulate the scanning process
            const response = await driverAPI.scanDriverPath(path, {
                recursive: scanOptions.includeSubdirectories,
                extensions: ['.js', '.dll', '.so', '.dylib']
            });

            return response.drivers || [];

        } catch (error) {
            // If API is not available, simulate some results for demo
            if (error.message.includes('fetch')) {
                return simulateScanResults(path);
            }
            throw error;
        }
    };

    /**
     * Simulate scan results for demo purposes
     */
    const simulateScanResults = (path) => {
        const mockDrivers = [
            {
                id: `opcua-driver-${Date.now()}`,
                name: 'OPC UA Standard Driver',
                version: '1.0.0',
                protocol: 'OPC_UA',
                description: 'Standard OPC UA protocol driver',
                author: 'ProDB Team',
                filePath: `${path}/opcua-driver.js`,
                fileSize: 45678,
                lastModified: new Date().toISOString(),
                status: 'discovered',
                validated: false
            },
            {
                id: `modbus-driver-${Date.now()}`,
                name: 'Modbus TCP/RTU Driver',
                version: '2.1.0',
                protocol: 'MODBUS_TCP',
                description: 'Modbus TCP and RTU protocol driver',
                author: 'Community',
                filePath: `${path}/modbus-driver.js`,
                fileSize: 32456,
                lastModified: new Date(Date.now() - 86400000).toISOString(),
                status: 'discovered',
                validated: false
            }
        ];

        // Only return mock drivers for certain paths to simulate realistic scanning
        if (path.includes('drivers') || path.includes('plugins')) {
            return mockDrivers.slice(0, Math.floor(Math.random() * 3));
        }

        return [];
    };

    /**
     * Validate scan results
     */
    const validateScanResults = async (results) => {
        for (let i = 0; i < results.length; i++) {
            const driver = results[i];
            
            try {
                // Simulate validation process
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Basic validation checks
                const isValid = driver.name && driver.version && driver.protocol;
                driver.validated = isValid;
                driver.validationErrors = isValid ? [] : ['Missing required metadata'];
                
                if (isValid) {
                    driver.status = 'valid';
                } else {
                    driver.status = 'invalid';
                }

            } catch (error) {
                driver.validated = false;
                driver.status = 'error';
                driver.validationErrors = [error.message];
            }

            setScanProgress(80 + (i / results.length) * 10);
        }
    };

    /**
     * Remove duplicate drivers from results
     */
    const removeDuplicates = (results) => {
        const seen = new Set();
        const duplicates = [];

        for (let i = results.length - 1; i >= 0; i--) {
            const driver = results[i];
            const key = `${driver.name}-${driver.version}`;
            
            if (seen.has(key)) {
                duplicates.push(driver);
                results.splice(i, 1);
            } else {
                seen.add(key);
            }
        }

        if (duplicates.length > 0) {
            devLog('Removed duplicate drivers:', duplicates.length);
        }
    };

    /**
     * Toggle scan path selection
     */
    const togglePath = (path) => {
        const newSelected = new Set(selectedPaths);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedPaths(newSelected);
    };

    /**
     * Add custom scan path
     */
    const addCustomPath = () => {
        const path = prompt('请输入要扫描的路径:');
        if (path && path.trim()) {
            const trimmedPath = path.trim();
            if (!scanPaths.includes(trimmedPath)) {
                setScanPaths([...scanPaths, trimmedPath]);
                setSelectedPaths(new Set([...selectedPaths, trimmedPath]));
            }
        }
    };

    /**
     * Install discovered driver
     */
    const installDriver = async (driver) => {
        try {
            const result = await driverService.installDriverFromFile(driver.filePath);
            
            if (result.success) {
                // Update driver status in scan results
                const updatedResults = scanResults.map(d => 
                    d.id === driver.id ? { ...d, status: 'installed' } : d
                );
                setScanResults(updatedResults);
            } else {
                alert(`安装失败: ${result.error}`);
            }

        } catch (error) {
            console.error('Failed to install driver:', error);
            alert(`安装失败: ${error.message}`);
        }
    };

    return html`
        <div class="driver-scanner">
            <!-- Scanner Header -->
            <div class="scanner-header">
                <h3>驱动扫描器</h3>
                <p>自动发现系统中可用的协议驱动程序</p>
            </div>

            <!-- Scan Configuration -->
            <div class="scan-config">
                <div class="config-section">
                    <h4>扫描路径</h4>
                    <div class="path-list">
                        ${scanPaths.map(path => html`
                            <label key=${path} class="path-item">
                                <input
                                    type="checkbox"
                                    checked=${selectedPaths.has(path)}
                                    onChange=${() => togglePath(path)}
                                    disabled=${scanning}
                                />
                                <span class="path-text">${path}</span>
                            </label>
                        `)}
                        <button 
                            class="btn btn-sm btn-ghost add-path-btn"
                            onClick=${addCustomPath}
                            disabled=${scanning}
                        >
                            ➕ 添加路径
                        </button>
                    </div>
                </div>

                <div class="config-section">
                    <h4>扫描选项</h4>
                    <div class="options-list">
                        <label class="option-item">
                            <input
                                type="checkbox"
                                checked=${scanOptions.includeSubdirectories}
                                onChange=${(e) => setScanOptions({
                                    ...scanOptions,
                                    includeSubdirectories: e.target.checked
                                })}
                                disabled=${scanning}
                            />
                            <span>包含子目录</span>
                        </label>
                        <label class="option-item">
                            <input
                                type="checkbox"
                                checked=${scanOptions.validateDrivers}
                                onChange=${(e) => setScanOptions({
                                    ...scanOptions,
                                    validateDrivers: e.target.checked
                                })}
                                disabled=${scanning}
                            />
                            <span>验证驱动程序</span>
                        </label>
                        <label class="option-item">
                            <input
                                type="checkbox"
                                checked=${scanOptions.checkDuplicates}
                                onChange=${(e) => setScanOptions({
                                    ...scanOptions,
                                    checkDuplicates: e.target.checked
                                })}
                                disabled=${scanning}
                            />
                            <span>检查重复项</span>
                        </label>
                        <label class="option-item">
                            <input
                                type="checkbox"
                                checked=${scanOptions.scanNetworkPaths}
                                onChange=${(e) => setScanOptions({
                                    ...scanOptions,
                                    scanNetworkPaths: e.target.checked
                                })}
                                disabled=${scanning}
                            />
                            <span>扫描网络路径</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Scan Controls -->
            <div class="scan-controls">
                <button 
                    class="btn btn-primary"
                    onClick=${startScan}
                    disabled=${scanning || selectedPaths.size === 0}
                >
                    ${scanning ? '扫描中...' : '开始扫描'}
                </button>
                
                ${scanResults.length > 0 && html`
                    <button 
                        class="btn btn-secondary"
                        onClick=${() => setScanResults([])}
                        disabled=${scanning}
                    >
                        清除结果
                    </button>
                `}
            </div>

            <!-- Scan Progress -->
            ${scanning && html`
                <div class="scan-progress">
                    <div class="progress-bar">
                        <div 
                            class="progress-fill" 
                            style=${{ width: `${scanProgress}%` }}
                        ></div>
                    </div>
                    <div class="progress-text">
                        扫描进度: ${scanProgress.toFixed(0)}%
                    </div>
                </div>
            `}

            <!-- Scan Status -->
            <div class="scan-status">
                <${StatusIndicator} 
                    value=${scanStatus} 
                    type="status" 
                    size="small" 
                />
                <span class="status-text">
                    ${scanStatus === 'idle' && '准备扫描'}
                    ${scanStatus === 'scanning' && '正在扫描...'}
                    ${scanStatus === 'completed' && `扫描完成 - 发现 ${scanResults.length} 个驱动`}
                    ${scanStatus === 'error' && '扫描失败'}
                </span>
            </div>

            <!-- Error Display -->
            ${scanError && html`
                <div class="alert alert-error">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-message">${scanError}</span>
                </div>
            `}

            <!-- Scan Results -->
            ${scanResults.length > 0 && html`
                <div class="scan-results">
                    <div class="results-header">
                        <h4>扫描结果 (${scanResults.length})</h4>
                        <div class="results-summary">
                            ${scanResults.filter(d => d.status === 'valid').length} 有效,
                            ${scanResults.filter(d => d.status === 'invalid').length} 无效,
                            ${scanResults.filter(d => d.status === 'installed').length} 已安装
                        </div>
                    </div>

                    <div class="results-list">
                        ${scanResults.map(driver => html`
                            <div key=${driver.id} class="result-item ${driver.status}">
                                <div class="result-info">
                                    <div class="result-header">
                                        <h5 class="driver-name">${driver.name}</h5>
                                        <span class="driver-version">v${driver.version}</span>
                                        <${StatusIndicator} 
                                            value=${driver.status} 
                                            type="status" 
                                            size="small" 
                                        />
                                    </div>
                                    
                                    <div class="result-details">
                                        <span class="protocol-badge">${driver.protocol}</span>
                                        <span class="file-path">${driver.filePath}</span>
                                        ${driver.lastModified && html`
                                            <span class="last-modified">
                                                修改时间: ${formatTime(driver.lastModified)}
                                            </span>
                                        `}
                                    </div>

                                    <p class="driver-description">${driver.description}</p>

                                    ${driver.validationErrors && driver.validationErrors.length > 0 && html`
                                        <div class="validation-errors">
                                            ${driver.validationErrors.map(error => html`
                                                <div key=${error} class="validation-error">
                                                    ❌ ${error}
                                                </div>
                                            `)}
                                        </div>
                                    `}
                                </div>

                                <div class="result-actions">
                                    ${driver.status === 'valid' && html`
                                        <button 
                                            class="btn btn-sm btn-primary"
                                            onClick=${() => installDriver(driver)}
                                        >
                                            安装
                                        </button>
                                    `}
                                    
                                    ${driver.status === 'installed' && html`
                                        <span class="installed-badge">✅ 已安装</span>
                                    `}
                                    
                                    <button 
                                        class="btn btn-sm btn-ghost"
                                        onClick=${() => navigator.clipboard.writeText(driver.filePath)}
                                    >
                                        📋 复制路径
                                    </button>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

export default DriverScanner;