/**
 * Simple Log Viewer Component
 * Displays simplified logs and error information
 * Requirements: 4.4
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { systemStatusAPI } from '../services/api.js';
import { formatTime } from '../utils/helpers.js';

const LogViewer = ({ 
    interfaceId = null,
    maxEntries = 100,
    autoRefresh = true,
    refreshInterval = 10000,
    showLevels = ['error', 'warning', 'info'],
    className = ''
}) => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch logs
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setError(null);
                
                // Mock log data since we don't have a real log API yet
                const mockLogs = generateMockLogs();
                setLogs(mockLogs);
                setIsLoading(false);
                
            } catch (err) {
                console.error('Failed to fetch logs:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchLogs();

        // Set up auto-refresh
        let interval;
        if (autoRefresh) {
            interval = setInterval(fetchLogs, refreshInterval);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [interfaceId, autoRefresh, refreshInterval]);

    // Filter logs based on level and search term
    useEffect(() => {
        let filtered = logs;

        // Filter by level
        if (selectedLevel !== 'all') {
            filtered = filtered.filter(log => log.level === selectedLevel);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(term) ||
                log.source.toLowerCase().includes(term)
            );
        }

        setFilteredLogs(filtered);
    }, [logs, selectedLevel, searchTerm]);

    // Generate mock log data
    const generateMockLogs = () => {
        const levels = ['info', 'warning', 'error'];
        const sources = ['OPC UA', 'Modbus TCP', 'MQTT', 'System', 'Network'];
        const messages = {
            info: [
                'Connection established successfully',
                'Data collection started',
                'Configuration updated',
                'Heartbeat received',
                'Interface initialized'
            ],
            warning: [
                'Connection timeout detected',
                'Data quality degraded',
                'High memory usage detected',
                'Slow response time',
                'Configuration validation warning'
            ],
            error: [
                'Connection failed',
                'Authentication error',
                'Data parsing failed',
                'Network unreachable',
                'Protocol error occurred'
            ]
        };

        const mockLogs = [];
        const now = new Date();

        for (let i = 0; i < 50; i++) {
            const level = levels[Math.floor(Math.random() * levels.length)];
            const source = sources[Math.floor(Math.random() * sources.length)];
            const messageList = messages[level];
            const message = messageList[Math.floor(Math.random() * messageList.length)];
            
            mockLogs.push({
                id: `log-${i}`,
                timestamp: new Date(now.getTime() - (i * 60000)), // 1 minute intervals
                level,
                source,
                message: `${message} - Interface ${Math.floor(Math.random() * 5) + 1}`,
                interfaceId: interfaceId || `interface-${Math.floor(Math.random() * 5) + 1}`
            });
        }

        return mockLogs.sort((a, b) => b.timestamp - a.timestamp);
    };

    // Get level badge color
    const getLevelColor = (level) => {
        switch (level) {
            case 'error': return 'var(--color-error)';
            case 'warning': return 'var(--color-warning)';
            case 'info': return 'var(--color-info)';
            default: return 'var(--text-muted)';
        }
    };

    // Get level counts
    const getLevelCounts = () => {
        const counts = { all: logs.length };
        showLevels.forEach(level => {
            counts[level] = logs.filter(log => log.level === level).length;
        });
        return counts;
    };

    const levelCounts = getLevelCounts();

    if (isLoading) {
        return html`
            <div class="log-viewer ${className}">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading logs...</p>
                </div>
            </div>
        `;
    }

    if (error) {
        return html`
            <div class="log-viewer ${className}">
                <div class="error-state">
                    <h3>Failed to Load Logs</h3>
                    <p>${error}</p>
                    <button class="btn btn-primary" onClick=${() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        `;
    }

    return html`
        <div class="log-viewer ${className}">
            <!-- Log Viewer Header -->
            <div class="log-viewer-header">
                <h3>System Logs</h3>
                <div class="log-controls">
                    <!-- Search -->
                    <input 
                        type="text" 
                        placeholder="Search logs..."
                        value=${searchTerm}
                        onChange=${(e) => setSearchTerm(e.target.value)}
                        class="log-search"
                    />
                    
                    <!-- Level Filter -->
                    <select 
                        value=${selectedLevel}
                        onChange=${(e) => setSelectedLevel(e.target.value)}
                        class="log-level-filter"
                    >
                        <option value="all">All (${levelCounts.all})</option>
                        ${showLevels.map(level => html`
                            <option value=${level} key=${level}>
                                ${level.charAt(0).toUpperCase() + level.slice(1)} (${levelCounts[level] || 0})
                            </option>
                        `)}
                    </select>
                </div>
            </div>

            <!-- Log Entries -->
            <div class="log-entries">
                ${filteredLogs.length === 0 ? html`
                    <div class="no-logs">
                        <p>No log entries found</p>
                        ${searchTerm || selectedLevel !== 'all' ? html`
                            <button 
                                class="btn btn-sm btn-secondary"
                                onClick=${() => {
                                    setSearchTerm('');
                                    setSelectedLevel('all');
                                }}
                            >
                                Clear Filters
                            </button>
                        ` : ''}
                    </div>
                ` : filteredLogs.map(log => html`
                    <div class="log-entry log-${log.level}" key=${log.id}>
                        <div class="log-timestamp">
                            ${formatTime(log.timestamp)}
                        </div>
                        <div class="log-level-badge" style="background-color: ${getLevelColor(log.level)}">
                            ${log.level.toUpperCase()}
                        </div>
                        <div class="log-source">
                            ${log.source}
                        </div>
                        <div class="log-message">
                            ${log.message}
                        </div>
                    </div>
                `)}
            </div>

            <!-- Log Footer -->
            <div class="log-footer">
                <div class="log-stats">
                    Showing ${filteredLogs.length} of ${logs.length} entries
                </div>
                <div class="log-actions">
                    <button 
                        class="btn btn-sm btn-secondary"
                        onClick=${() => {
                            // Export logs functionality
                            const logData = filteredLogs.map(log => 
                                `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.source}: ${log.message}`
                            ).join('\\n');
                            
                            const blob = new Blob([logData], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `collector-logs-${new Date().toISOString().split('T')[0]}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                    >
                        Export
                    </button>
                    <button 
                        class="btn btn-sm btn-secondary"
                        onClick=${() => {
                            setLogs([]);
                            setFilteredLogs([]);
                        }}
                    >
                        Clear All
                    </button>
                </div>
            </div>
        </div>

        <style>
            /* Log Viewer Styles */
            .log-viewer {
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: 500px;
            }

            /* Header */
            .log-viewer-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-4);
                border-bottom: 1px solid var(--border-color);
                background-color: var(--bg-secondary);
            }

            .log-viewer-header h3 {
                margin: 0;
                color: var(--text-primary);
                font-size: var(--font-size-lg);
            }

            .log-controls {
                display: flex;
                gap: var(--space-2);
                align-items: center;
            }

            .log-search {
                padding: var(--space-1) var(--space-2);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                background-color: var(--bg-primary);
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                min-width: 200px;
            }

            .log-level-filter {
                padding: var(--space-1) var(--space-2);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                background-color: var(--bg-primary);
                color: var(--text-primary);
                font-size: var(--font-size-sm);
            }

            /* Log Entries */
            .log-entries {
                flex: 1;
                overflow-y: auto;
                padding: var(--space-2);
            }

            .log-entry {
                display: grid;
                grid-template-columns: auto auto auto 1fr;
                gap: var(--space-2);
                padding: var(--space-2);
                border-radius: var(--border-radius);
                margin-bottom: var(--space-1);
                font-size: var(--font-size-sm);
                align-items: center;
                transition: background-color var(--transition-normal);
            }

            .log-entry:hover {
                background-color: var(--bg-secondary);
            }

            .log-timestamp {
                color: var(--text-muted);
                font-size: var(--font-size-xs);
                white-space: nowrap;
                font-family: monospace;
            }

            .log-level-badge {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-bold);
                padding: var(--space-1) var(--space-2);
                border-radius: var(--border-radius);
                color: white;
                text-align: center;
                min-width: 60px;
            }

            .log-source {
                color: var(--text-secondary);
                font-weight: var(--font-weight-medium);
                white-space: nowrap;
            }

            .log-message {
                color: var(--text-primary);
                word-break: break-word;
            }

            /* Footer */
            .log-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3) var(--space-4);
                border-top: 1px solid var(--border-color);
                background-color: var(--bg-secondary);
            }

            .log-stats {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }

            .log-actions {
                display: flex;
                gap: var(--space-2);
            }

            /* Empty States */
            .no-logs,
            .loading-state,
            .error-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-8);
                text-align: center;
                color: var(--text-muted);
            }

            .loading-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid var(--border-color);
                border-top: 3px solid var(--color-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: var(--space-4);
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .error-state h3 {
                color: var(--color-error);
                margin-bottom: var(--space-2);
            }

            /* Scrollbar Styling */
            .log-entries::-webkit-scrollbar {
                width: 8px;
            }

            .log-entries::-webkit-scrollbar-track {
                background: var(--bg-tertiary);
                border-radius: 4px;
            }

            .log-entries::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }

            .log-entries::-webkit-scrollbar-thumb:hover {
                background: var(--text-muted);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .log-viewer-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: var(--space-3);
                }

                .log-controls {
                    justify-content: space-between;
                }

                .log-search {
                    min-width: 0;
                    flex: 1;
                }

                .log-entry {
                    grid-template-columns: 1fr;
                    gap: var(--space-1);
                    padding: var(--space-3);
                }

                .log-timestamp,
                .log-level-badge,
                .log-source {
                    justify-self: start;
                }

                .log-footer {
                    flex-direction: column;
                    gap: var(--space-2);
                    align-items: stretch;
                }

                .log-actions {
                    justify-content: center;
                }
            }

            @media (max-width: 480px) {
                .log-viewer {
                    height: 400px;
                }

                .log-viewer-header {
                    padding: var(--space-3);
                }

                .log-entries {
                    padding: var(--space-1);
                }

                .log-footer {
                    padding: var(--space-2) var(--space-3);
                }
            }
        </style>
    `;
};

export default LogViewer;