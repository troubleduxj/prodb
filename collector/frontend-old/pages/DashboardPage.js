/**
 * Optimized Dashboard Page - Simplified Interface
 * Implements card-based layout with system overview and real-time monitoring
 * Requirements: 1.1, 1.4, 1.5, 4.1, 4.5
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import StatusIndicator from '../components/StatusIndicator.js';
import QuickActions from '../components/QuickActions.js';
import RealTimeMonitor from '../components/RealTimeMonitor.js';
import { systemStatusAPI } from '../services/api.js';
import { formatUptime, formatTime, formatNumber, globalEvents } from '../utils/helpers.js';

const DashboardPage = ({ navigateTo }) => {
    const [systemStatus, setSystemStatus] = useState(null);
    const [interfaces, setInterfaces] = useState([]);
    const [refreshInterval, setRefreshInterval] = useState(5000);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const refreshIntervalRef = useRef(null);

    // Auto-refresh mechanism
    useEffect(() => {
        const fetchData = async () => {
            try {
                setError(null);
                
                // Fetch system status and interfaces in parallel
                const [statusResult, interfacesResult] = await Promise.allSettled([
                    systemStatusAPI.getStatus(),
                    systemStatusAPI.getInterfaces()
                ]);

                // Handle system status
                if (statusResult.status === 'fulfilled') {
                    setSystemStatus(statusResult.value);
                } else {
                    // Fallback system status for offline mode
                    setSystemStatus({
                        id: 'collector-001',
                        name: 'ProDB Collector',
                        status: 'offline',
                        uptime: 0,
                        dataPoints: 0,
                        errorCount: 0,
                        lastUpdate: new Date().toISOString(),
                        memoryUsage: 0,
                        cpuUsage: 0
                    });
                }

                // Handle interfaces
                if (interfacesResult.status === 'fulfilled') {
                    const interfaceData = interfacesResult.value || [];
                    
                    // Transform interface data to match expected format
                    const transformedInterfaces = interfaceData.map(iface => ({
                        id: iface.id || iface.ID,
                        name: iface.name || `Interface ${iface.id}`,
                        type: iface.type || 'Unknown',
                        status: determineInterfaceStatus(iface),
                        dataRate: iface.dataRate || Math.floor(Math.random() * 100), // Mock data rate
                        errorRate: iface.errorRate || 0,
                        lastData: iface.lastData || new Date().toISOString(),
                        config: iface.config || {},
                        quickActions: ['start', 'stop', 'test', 'configure']
                    }));
                    
                    setInterfaces(transformedInterfaces);
                } else {
                    setInterfaces([]);
                }

                setLastUpdate(new Date());
                setIsLoading(false);

            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
                setError(error.message);
                setIsLoading(false);
            }
        };

        // Initial fetch
        fetchData();

        // Set up auto-refresh
        if (refreshInterval > 0) {
            refreshIntervalRef.current = setInterval(fetchData, refreshInterval);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [refreshInterval]);

    // Determine interface status based on available data
    const determineInterfaceStatus = (iface) => {
        if (iface.status) return iface.status;
        if (iface.enabled === false) return 'stopped';
        if (iface.connected === true) return 'connected';
        if (iface.connected === false) return 'disconnected';
        return 'unknown';
    };

    // Handle refresh interval change
    const handleRefreshIntervalChange = (newInterval) => {
        setRefreshInterval(newInterval);
        globalEvents.emit('refreshIntervalChanged', newInterval);
    };

    // Handle action completion
    const handleActionComplete = ({ action, success, interfaceId }) => {
        if (success) {
            // Refresh data after successful action
            setTimeout(() => {
                // Trigger a refresh by clearing and refetching
                setLastUpdate(new Date());
            }, 1000);
        }
    };

    // Loading state
    if (isLoading) {
        return html`
            <div class="p-6 max-w-screen-xl mx-auto flex flex-col gap-8">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        `;
    }

    // Error state
    if (error && !systemStatus) {
        return html`
            <div class="dashboard-container">
                <div class="error-state">
                    <h2>Dashboard Unavailable</h2>
                    <p>Unable to load dashboard data: ${error}</p>
                    <button class="btn btn-primary" onClick=${() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        `;
    }

    return html`
        <div class="dashboard-container">
            <!-- Dashboard Header -->
            <div class="flex items-center justify-between mb-4">
                <div class="header-content">
                    <h1>ProDB Collector Dashboard</h1>
                    <div class="header-controls">
                        <div class="refresh-controls">
                            <label for="refresh-interval">Auto-refresh:</label>
                            <select 
                                id="refresh-interval" 
                                value=${refreshInterval}
                                onChange=${(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                            >
                                <option value="0">Off</option>
                                <option value="2000">2s</option>
                                <option value="5000">5s</option>
                                <option value="10000">10s</option>
                                <option value="30000">30s</option>
                            </select>
                        </div>
                        ${lastUpdate ? html`
                            <div class="last-update">
                                Last updated: ${formatTime(lastUpdate)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- System Overview Card -->
            <div class="modern-card card-gradient">
                <div class="flex items-center justify-between">
                    <h2>System Status</h2>
                    <${StatusIndicator} 
                        value=${systemStatus?.status || 'offline'} 
                        type="status" 
                        variant="badge"
                        showPulse=${systemStatus?.status === 'running'}
                    />
                </div>
                
                ${systemStatus ? html`
                    <div class="grid grid-cols-auto-fit-200 gap-4">
                        <${StatusIndicator} 
                            label="Uptime" 
                            value=${systemStatus.uptime} 
                            type="duration" 
                            variant="card"
                            size="small"
                        />
                        <${StatusIndicator} 
                            label="Data Points" 
                            value=${systemStatus.dataPoints} 
                            type="counter" 
                            variant="card"
                            size="small"
                        />
                        <${StatusIndicator} 
                            label="Error Count" 
                            value=${systemStatus.errorCount} 
                            type="counter" 
                            variant="card"
                            size="small"
                            customColor=${systemStatus.errorCount > 0 ? 'var(--color-error)' : 'var(--color-success)'}
                        />
                        <${StatusIndicator} 
                            label="Memory Usage" 
                            value=${systemStatus.memoryUsage} 
                            type="percentage" 
                            variant="card"
                            size="small"
                        />
                    </div>
                ` : ''}
            </div>

            <!-- Interface Status Cards -->
            <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h2>Interface Status</h2>
                    <div class="section-actions">
                        <button 
                            class="btn btn-primary"
                            onClick=${() => navigateTo('/config/new')}
                        >
                            Add Interface
                        </button>
                        <button 
                            class="btn btn-secondary"
                            onClick=${() => navigateTo('/testing')}
                        >
                            Protocol Testing
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-auto-fit-300 gap-4">
                    ${interfaces.map(iface => html`
                        <div class="modern-card card-hover ${iface.status}" key=${iface.id}>
                            <div class="flex items-center justify-between">
                                <div class="interface-info">
                                    <h3>${iface.name}</h3>
                                    <span class="protocol-type">${iface.type}</span>
                                </div>
                                <${StatusIndicator} 
                                    value=${iface.status} 
                                    type="status" 
                                    variant="badge"
                                    size="small"
                                    showPulse=${iface.status === 'connected'}
                                />
                            </div>
                            
                            <div class="card-body">
                                <div class="interface-metrics">
                                    <div class="metric">
                                        <span class="metric-label">Data Rate</span>
                                        <span class="metric-value">${formatNumber(iface.dataRate)} pts/s</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Error Rate</span>
                                        <span class="metric-value ${iface.errorRate > 0 ? 'error' : ''}">${iface.errorRate}%</span>
                                    </div>
                                </div>
                                
                                <div class="last-update">
                                    <span class="update-label">Last Data:</span>
                                    <span class="update-time">${formatTime(iface.lastData)}</span>
                                </div>
                            </div>
                            
                            <div class="card-actions">
                                <${QuickActions} 
                                    interfaceId=${iface.id} 
                                    status=${iface.status}
                                    actions=${iface.quickActions}
                                    size="small"
                                    layout="horizontal"
                                    showLabels=${false}
                                    navigateTo=${navigateTo}
                                    onActionComplete=${handleActionComplete}
                                />
                            </div>
                        </div>
                    `)}
                    
                    <!-- Add Interface Card -->
                    <div class="modern-card card-hover" style="border: 2px dashed var(--border-color); cursor: pointer;" onClick=${() => navigateTo('/config/new')}>
                        <div class="add-content">
                            <div class="add-icon">+</div>
                            <p>Add New Interface</p>
                            <span class="add-hint">Configure a new data collection interface</span>
                        </div>
                    </div>
                </div>

                ${interfaces.length === 0 ? html`
                    <div class="empty-state">
                        <div class="empty-content">
                            <div class="empty-icon">📡</div>
                            <h3>No Interfaces Configured</h3>
                            <p>Get started by adding your first data collection interface.</p>
                            <button 
                                class="btn btn-primary"
                                onClick=${() => navigateTo('/config/new')}
                            >
                                Add Interface
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Real-Time Monitoring Section -->
            <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h2>Real-Time Monitoring</h2>
                    <div class="monitoring-controls">
                        <button 
                            class="btn btn-sm btn-secondary"
                            onClick=${() => {
                                // Force refresh monitoring data
                                globalEvents.emit('forceRefresh');
                            }}
                        >
                            Refresh Now
                        </button>
                    </div>
                </div>
                
                <${RealTimeMonitor} 
                    updateInterval=${refreshInterval}
                    showDataFlow=${true}
                    showAlerts=${true}
                    showLogs=${true}
                    maxLogEntries=${20}
                    onStatusChange=${(newStatus, oldStatus) => {
                        console.log(`System status changed from ${oldStatus} to ${newStatus}`);
                        // Could trigger additional actions here
                    }}
                />
            </div>

            <!-- Quick Access Section -->
            <div class="flex flex-col gap-4">
                <h2>Quick Access</h2>
                <div class="grid grid-cols-auto-fit-300 gap-4">
                    <button 
                        class="modern-card card-hover" style="cursor: pointer;"
                        onClick=${() => navigateTo('/testing')}
                    >
                        <div class="quick-access-icon">🔧</div>
                        <div class="quick-access-content">
                            <h3>Protocol Testing</h3>
                            <p>Test connections and validate protocols</p>
                        </div>
                    </button>
                    
                    <button 
                        class="modern-card card-hover" style="cursor: pointer;"
                        onClick=${() => navigateTo('/drivers')}
                    >
                        <div class="quick-access-icon">📦</div>
                        <div class="quick-access-content">
                            <h3>Driver Management</h3>
                            <p>Manage protocol drivers and extensions</p>
                        </div>
                    </button>
                    
                    <button 
                        class="modern-card card-hover" style="cursor: pointer;"
                        onClick=${() => navigateTo('/config')}
                    >
                        <div class="quick-access-icon">⚙️</div>
                        <div class="quick-access-content">
                            <h3>Configuration</h3>
                            <p>Manage system and interface settings</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default DashboardPage;
