/**
 * Real-Time Monitoring Component
 * Provides real-time data updates, visual alerts, and data flow monitoring
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import StatusIndicator from './StatusIndicator.js';
import { systemStatusAPI } from '../services/api.js';
import { globalEvents, formatNumber, formatTime } from '../utils/helpers.js';

const RealTimeMonitor = ({ 
    interfaceId = null,
    updateInterval = 2000,
    showDataFlow = true,
    showAlerts = true,
    showLogs = true,
    maxLogEntries = 50,
    onStatusChange = null,
    className = ''
}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [dataFlow, setDataFlow] = useState({
        rate: 0,
        errorRate: 0,
        totalPoints: 0,
        lastUpdate: null,
        trend: 'stable'
    });
    const [alerts, setAlerts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [previousValues, setPreviousValues] = useState({});
    
    const wsRef = useRef(null);
    const pollingRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Initialize real-time connection
    useEffect(() => {
        initializeConnection();
        
        return () => {
            cleanup();
        };
    }, [interfaceId, updateInterval]);

    // Initialize WebSocket or polling connection
    const initializeConnection = () => {
        // Try WebSocket first, fallback to polling
        if (window.WebSocket && !interfaceId) {
            initializeWebSocket();
        } else {
            initializePolling();
        }
    };

    // Initialize WebSocket connection
    const initializeWebSocket = () => {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/monitor`;
            
            wsRef.current = new WebSocket(wsUrl);
            
            wsRef.current.onopen = () => {
                console.log('WebSocket connected for real-time monitoring');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttempts.current = 0;
                
                // Subscribe to interface updates if specific interface
                if (interfaceId) {
                    wsRef.current.send(JSON.stringify({
                        type: 'subscribe',
                        interfaceId: interfaceId
                    }));
                }
            };
            
            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleRealtimeUpdate(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                setConnectionStatus('disconnected');
                
                // Attempt to reconnect
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        initializeWebSocket();
                    }, delay);
                } else {
                    // Fallback to polling
                    initializePolling();
                }
            };
            
            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnectionStatus('error');
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            initializePolling();
        }
    };

    // Initialize polling fallback
    const initializePolling = () => {
        setConnectionStatus('polling');
        
        const poll = async () => {
            try {
                let data;
                if (interfaceId) {
                    data = await systemStatusAPI.getInterface(interfaceId);
                } else {
                    const [status, interfaces] = await Promise.all([
                        systemStatusAPI.getStatus(),
                        systemStatusAPI.getInterfaces()
                    ]);
                    data = { systemStatus: status, interfaces };
                }
                
                handleRealtimeUpdate(data);
                setIsConnected(true);
                
            } catch (error) {
                console.error('Polling failed:', error);
                setIsConnected(false);
                addLogEntry('error', `Polling failed: ${error.message}`);
            }
        };
        
        // Initial poll
        poll();
        
        // Set up polling interval
        pollingRef.current = setInterval(poll, updateInterval);
    };

    // Handle real-time data updates
    const handleRealtimeUpdate = (data) => {
        const timestamp = new Date();
        
        // Update data flow metrics
        if (data.dataFlow || data.interfaces) {
            const newDataFlow = calculateDataFlow(data);
            
            // Calculate trends
            const trend = calculateTrend(newDataFlow.rate, dataFlow.rate);
            
            setPreviousValues(prev => ({
                ...prev,
                dataRate: dataFlow.rate,
                errorRate: dataFlow.errorRate
            }));
            
            setDataFlow({
                ...newDataFlow,
                trend,
                lastUpdate: timestamp
            });
        }
        
        // Handle status changes
        if (data.status && data.status !== connectionStatus) {
            const previousStatus = connectionStatus;
            setConnectionStatus(data.status);
            
            if (onStatusChange) {
                onStatusChange(data.status, previousStatus);
            }
            
            // Add status change alert
            addAlert('info', `Status changed from ${previousStatus} to ${data.status}`, timestamp);
            addLogEntry('info', `Interface status: ${data.status}`);
        }
        
        // Handle errors
        if (data.error) {
            addAlert('error', data.error.message || 'Unknown error occurred', timestamp);
            addLogEntry('error', data.error.message || 'Unknown error');
        }
        
        // Handle warnings
        if (data.warning) {
            addAlert('warning', data.warning.message || 'Warning condition detected', timestamp);
            addLogEntry('warning', data.warning.message || 'Warning condition');
        }
        
        // Emit global event
        globalEvents.emit('realtimeUpdate', {
            interfaceId,
            data,
            timestamp
        });
    };

    // Calculate data flow metrics
    const calculateDataFlow = (data) => {
        if (data.dataFlow) {
            return {
                rate: data.dataFlow.rate || 0,
                errorRate: data.dataFlow.errorRate || 0,
                totalPoints: data.dataFlow.totalPoints || 0
            };
        }
        
        // Calculate from interfaces data
        if (data.interfaces) {
            const totalRate = data.interfaces.reduce((sum, iface) => sum + (iface.dataRate || 0), 0);
            const totalErrors = data.interfaces.reduce((sum, iface) => sum + (iface.errorCount || 0), 0);
            const totalPoints = data.interfaces.reduce((sum, iface) => sum + (iface.dataPoints || 0), 0);
            
            return {
                rate: totalRate,
                errorRate: totalPoints > 0 ? (totalErrors / totalPoints) * 100 : 0,
                totalPoints
            };
        }
        
        // Single interface data
        return {
            rate: data.dataRate || 0,
            errorRate: data.errorRate || 0,
            totalPoints: data.dataPoints || 0
        };
    };

    // Calculate trend direction
    const calculateTrend = (current, previous) => {
        if (previous === undefined || previous === null) return 'stable';
        
        const change = current - previous;
        const threshold = previous * 0.1; // 10% change threshold
        
        if (Math.abs(change) < threshold) return 'stable';
        return change > 0 ? 'up' : 'down';
    };

    // Add alert
    const addAlert = (type, message, timestamp = new Date()) => {
        const alert = {
            id: Date.now() + Math.random(),
            type,
            message,
            timestamp,
            acknowledged: false
        };
        
        setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
        
        // Auto-acknowledge info alerts after 5 seconds
        if (type === 'info') {
            setTimeout(() => {
                acknowledgeAlert(alert.id);
            }, 5000);
        }
    };

    // Add log entry
    const addLogEntry = (level, message, timestamp = new Date()) => {
        const entry = {
            id: Date.now() + Math.random(),
            level,
            message,
            timestamp,
            interfaceId
        };
        
        setLogs(prev => [entry, ...prev.slice(0, maxLogEntries - 1)]);
    };

    // Acknowledge alert
    const acknowledgeAlert = (alertId) => {
        setAlerts(prev => prev.map(alert => 
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
    };

    // Clear all alerts
    const clearAlerts = () => {
        setAlerts([]);
    };

    // Clear logs
    const clearLogs = () => {
        setLogs([]);
    };

    // Cleanup function
    const cleanup = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
    };

    // Get connection status color
    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'var(--color-success)';
            case 'polling': return 'var(--color-info)';
            case 'disconnected': return 'var(--color-warning)';
            case 'error': return 'var(--color-error)';
            default: return 'var(--text-muted)';
        }
    };

    return html`
        <div class="realtime-monitor ${className}">
            <!-- Connection Status -->
            <div class="monitor-header">
                <div class="connection-status">
                    <${StatusIndicator} 
                        value=${connectionStatus} 
                        type="status" 
                        variant="badge"
                        showPulse=${isConnected}
                        customColor=${getConnectionStatusColor()}
                    />
                    <span class="connection-type">
                        ${connectionStatus === 'connected' ? 'WebSocket' : 'Polling'}
                    </span>
                </div>
                
                ${dataFlow.lastUpdate ? html`
                    <div class="last-update">
                        Last update: ${formatTime(dataFlow.lastUpdate)}
                    </div>
                ` : ''}
            </div>

            <!-- Data Flow Monitoring -->
            ${showDataFlow ? html`
                <div class="data-flow-section">
                    <h3>Data Flow</h3>
                    <div class="data-flow-metrics">
                        <${StatusIndicator} 
                            label="Data Rate" 
                            value=${dataFlow.rate} 
                            type="rate" 
                            variant="card"
                            size="small"
                            showTrend=${true}
                            previousValue=${previousValues.dataRate}
                            customIcon=${dataFlow.trend === 'up' ? '📈' : dataFlow.trend === 'down' ? '📉' : '📊'}
                        />
                        <${StatusIndicator} 
                            label="Error Rate" 
                            value=${dataFlow.errorRate} 
                            type="percentage" 
                            variant="card"
                            size="small"
                            showTrend=${true}
                            previousValue=${previousValues.errorRate}
                            customColor=${dataFlow.errorRate > 5 ? 'var(--color-error)' : dataFlow.errorRate > 1 ? 'var(--color-warning)' : 'var(--color-success)'}
                        />
                        <${StatusIndicator} 
                            label="Total Points" 
                            value=${dataFlow.totalPoints} 
                            type="counter" 
                            variant="card"
                            size="small"
                        />
                    </div>
                </div>
            ` : ''}

            <!-- Alerts Section -->
            ${showAlerts ? html`
                <div class="alerts-section">
                    <div class="alerts-header">
                        <h3>Alerts</h3>
                        <div class="alerts-actions">
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${clearAlerts}
                                disabled=${alerts.length === 0}
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                    
                    <div class="alerts-list">
                        ${alerts.length === 0 ? html`
                            <div class="no-alerts">
                                <span class="no-alerts-icon">✅</span>
                                <p>No active alerts</p>
                            </div>
                        ` : alerts.map(alert => html`
                            <div 
                                class="alert alert-${alert.type} ${alert.acknowledged ? 'acknowledged' : ''}"
                                key=${alert.id}
                            >
                                <div class="alert-content">
                                    <div class="alert-message">${alert.message}</div>
                                    <div class="alert-time">${formatTime(alert.timestamp)}</div>
                                </div>
                                ${!alert.acknowledged ? html`
                                    <button 
                                        class="alert-acknowledge"
                                        onClick=${() => acknowledgeAlert(alert.id)}
                                        title="Acknowledge alert"
                                    >
                                        ✓
                                    </button>
                                ` : ''}
                            </div>
                        `)}
                    </div>
                </div>
            ` : ''}

            <!-- Logs Section -->
            ${showLogs ? html`
                <div class="logs-section">
                    <div class="logs-header">
                        <h3>Activity Log</h3>
                        <div class="logs-actions">
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${clearLogs}
                                disabled=${logs.length === 0}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    
                    <div class="logs-list">
                        ${logs.length === 0 ? html`
                            <div class="no-logs">
                                <p>No log entries</p>
                            </div>
                        ` : logs.map(entry => html`
                            <div class="log-entry log-${entry.level}" key=${entry.id}>
                                <div class="log-time">${formatTime(entry.timestamp)}</div>
                                <div class="log-level">${entry.level.toUpperCase()}</div>
                                <div class="log-message">${entry.message}</div>
                            </div>
                        `)}
                    </div>
                </div>
            ` : ''}
        </div>

        <style>
            /* Real-Time Monitor Styles */
            .realtime-monitor {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                padding: var(--space-4);
            }

            /* Monitor Header */
            .monitor-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: var(--space-3);
                border-bottom: 1px solid var(--border-color);
            }

            .connection-status {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            .connection-type {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
                font-weight: var(--font-weight-medium);
            }

            .last-update {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }

            /* Data Flow Section */
            .data-flow-section h3 {
                margin: 0 0 var(--space-3) 0;
                color: var(--text-primary);
                font-size: var(--font-size-lg);
            }

            .data-flow-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: var(--space-3);
            }

            /* Alerts Section */
            .alerts-section h3,
            .logs-section h3 {
                margin: 0;
                color: var(--text-primary);
                font-size: var(--font-size-lg);
            }

            .alerts-header,
            .logs-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: var(--space-3);
            }

            .alerts-actions,
            .logs-actions {
                display: flex;
                gap: var(--space-2);
            }

            .alerts-list,
            .logs-list {
                max-height: 300px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            /* Alert Styles */
            .alert {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3);
                border-radius: var(--border-radius);
                border-left: 4px solid;
                background-color: var(--bg-secondary);
                transition: all var(--transition-normal);
            }

            .alert.acknowledged {
                opacity: 0.6;
            }

            .alert-info {
                border-left-color: var(--color-info);
            }

            .alert-warning {
                border-left-color: var(--color-warning);
            }

            .alert-error {
                border-left-color: var(--color-error);
            }

            .alert-content {
                flex: 1;
            }

            .alert-message {
                color: var(--text-primary);
                font-weight: var(--font-weight-medium);
                margin-bottom: var(--space-1);
            }

            .alert-time {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }

            .alert-acknowledge {
                background: none;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: var(--space-1) var(--space-2);
                color: var(--text-secondary);
                cursor: pointer;
                transition: all var(--transition-normal);
            }

            .alert-acknowledge:hover {
                background-color: var(--color-success);
                color: white;
                border-color: var(--color-success);
            }

            /* Log Styles */
            .log-entry {
                display: grid;
                grid-template-columns: auto auto 1fr;
                gap: var(--space-2);
                padding: var(--space-2);
                border-radius: var(--border-radius);
                background-color: var(--bg-secondary);
                font-size: var(--font-size-sm);
                align-items: center;
            }

            .log-time {
                color: var(--text-muted);
                font-size: var(--font-size-xs);
                white-space: nowrap;
            }

            .log-level {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-bold);
                padding: var(--space-1) var(--space-2);
                border-radius: var(--border-radius);
                text-align: center;
                min-width: 60px;
            }

            .log-info .log-level {
                background-color: var(--color-info);
                color: white;
            }

            .log-warning .log-level {
                background-color: var(--color-warning);
                color: white;
            }

            .log-error .log-level {
                background-color: var(--color-error);
                color: white;
            }

            .log-message {
                color: var(--text-primary);
            }

            /* Empty States */
            .no-alerts,
            .no-logs {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-6);
                color: var(--text-muted);
                text-align: center;
            }

            .no-alerts-icon {
                font-size: 2rem;
                margin-bottom: var(--space-2);
            }

            .no-alerts p,
            .no-logs p {
                margin: 0;
                font-size: var(--font-size-sm);
            }

            /* Scrollbar Styling */
            .alerts-list::-webkit-scrollbar,
            .logs-list::-webkit-scrollbar {
                width: 6px;
            }

            .alerts-list::-webkit-scrollbar-track,
            .logs-list::-webkit-scrollbar-track {
                background: var(--bg-tertiary);
                border-radius: 3px;
            }

            .alerts-list::-webkit-scrollbar-thumb,
            .logs-list::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 3px;
            }

            .alerts-list::-webkit-scrollbar-thumb:hover,
            .logs-list::-webkit-scrollbar-thumb:hover {
                background: var(--text-muted);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .monitor-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: var(--space-2);
                }

                .connection-status {
                    justify-content: center;
                }

                .data-flow-metrics {
                    grid-template-columns: 1fr;
                }

                .alerts-header,
                .logs-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: var(--space-2);
                }

                .log-entry {
                    grid-template-columns: 1fr;
                    gap: var(--space-1);
                }

                .log-time,
                .log-level {
                    justify-self: start;
                }
            }

            /* Animation for new alerts */
            @keyframes alertSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            .alert {
                animation: alertSlideIn 0.3s ease-out;
            }

            /* Pulse animation for active connection */
            @keyframes connectionPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .connection-status .status-indicator.pulse {
                animation: connectionPulse 2s infinite;
            }
        </style>
    `;
};

export default RealTimeMonitor;